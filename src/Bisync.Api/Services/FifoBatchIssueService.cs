using System.Data;
using System.Data.Common;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Bisync.Api.Services;

public sealed class FifoIssueResult
{
    public Guid TransactionId { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal TotalCost { get; init; }
    public decimal Quantity { get; init; }
}

/// <summary>
/// Live FIFO issuance via PostgreSQL <c>issue_fifo_stock</c> (strict oldest-first,
/// FOR UPDATE locking, zero-tolerance shortfall). Also maintains <c>inventory_batches</c>
/// rows on receipt so each inbound shipment stays cost-segregated.
/// </summary>
public class FifoBatchIssueService(BisyncDbContext db, ComponentFifoCostingService fifoCosting)
{
    public async Task EnsureSchemaAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.ExecuteSqlRawAsync(FifoIssueStockSql.CreateTablesAndFunction, cancellationToken);
    }

    public Task RecordReceiptFromPurchaseAsync(
        InventoryPurchase purchase,
        CancellationToken cancellationToken = default)
    {
        var location = !string.IsNullOrWhiteSpace(purchase.LocationExternalId)
            ? purchase.LocationExternalId.Trim()
            : FirstLocationId(purchase.LocationIdsJson);
        return RecordReceiptBatchAsync(
            purchase.ComponentId,
            location,
            purchase.Uom,
            purchase.Quantity,
            purchase.UnitPrice,
            purchase.DateCreatedInStock,
            purchase.Id,
            purchase.CompanyId,
            cancellationToken);
    }

    /// <summary>
    /// Syncs FIFO batch unit cost when accounting consolidates / affirms a receipt price.
    /// </summary>
    public async Task UpdateBatchUnitCostFromPurchaseAsync(
        InventoryPurchase purchase,
        CancellationToken cancellationToken = default)
    {
        if (purchase.Id <= 0) return;
        await EnsureSchemaAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE inventory_batches
            SET unit_cost = {0}
            WHERE source_purchase_id = {1}
            """,
            StockCardFifoEngine.RoundUnitPrice(purchase.UnitPrice),
            purchase.Id);
    }

    public async Task RecordReceiptBatchAsync(
        string componentId,
        string locationExternalId,
        string uom,
        decimal quantity,
        decimal unitCost,
        DateTime receiptDate,
        int? sourcePurchaseId,
        int? companyId,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= StockCardFifoEngine.QtyEpsilon)
            return;

        var component = (componentId ?? string.Empty).Trim();
        var location = (locationExternalId ?? string.Empty).Trim();
        var normalizedUom = NormalizeUom(uom);
        if (string.IsNullOrWhiteSpace(component) || string.IsNullOrWhiteSpace(normalizedUom))
            return;

        if (sourcePurchaseId is int purchaseId and > 0)
        {
            var exists = await ExistsBatchForPurchaseAsync(purchaseId, cancellationToken);
            if (exists)
                return;
        }

        await EnsureSchemaAsync(cancellationToken);

        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO inventory_batches (
                batch_id, component_id, location_external_id, uom,
                receipt_date, original_qty, remaining_qty, unit_cost,
                status, source_purchase_id, company_id, created_at
            )
            VALUES (
                gen_random_uuid(), {0}, {1}, {2},
                {3}, {4}, {4}, {5},
                'ACTIVE', {6}, {7}, NOW()
            )
            """,
            component,
            location,
            normalizedUom,
            receiptDate.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(receiptDate, DateTimeKind.Utc)
                : receiptDate.ToUniversalTime(),
            DecimalRounding.ToDb(quantity),
            StockCardFifoEngine.RoundUnitPrice(unitCost),
            sourcePurchaseId,
            companyId);
    }

    public async Task EnsureBatchesSyncedAsync(
        string componentId,
        string locationExternalId,
        string uom,
        int? companyId,
        CancellationToken cancellationToken = default)
    {
        await EnsureSchemaAsync(cancellationToken);

        var component = (componentId ?? string.Empty).Trim();
        var location = (locationExternalId ?? string.Empty).Trim();
        var normalizedUom = NormalizeUom(uom);
        if (string.IsNullOrWhiteSpace(component) || string.IsNullOrWhiteSpace(normalizedUom))
            return;

        var batchCount = await CountActiveOrAnyBatchesAsync(component, location, normalizedUom, cancellationToken);
        if (batchCount > 0)
        {
            await EnsureMissingPurchaseBatchesAsync(component, location, normalizedUom, companyId, cancellationToken);
            return;
        }

        // First use: materialize remaining FIFO layers into locked batch rows.
        var unitPrice = 0m;
        _ = unitPrice;
        var events = await fifoCosting.LoadInboundEventsForSyncAsync(
            component, location, normalizedUom, companyId, cancellationToken);
        var simulation = StockCardFifoEngine.Simulate(events);
        foreach (var layer in simulation.RemainingLayers
                     .OrderBy(l => l.ReceivedAt)
                     .ThenBy(l => l.SourceId))
        {
            if (layer.Quantity <= StockCardFifoEngine.QtyEpsilon)
                continue;

            await db.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO inventory_batches (
                    batch_id, component_id, location_external_id, uom,
                    receipt_date, original_qty, remaining_qty, unit_cost,
                    status, source_purchase_id, company_id, created_at
                )
                VALUES (
                    gen_random_uuid(), {0}, {1}, {2},
                    {3}, {4}, {4}, {5},
                    'ACTIVE', {6}, {7}, NOW()
                )
                """,
                component,
                location,
                normalizedUom,
                layer.ReceivedAt.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(layer.ReceivedAt, DateTimeKind.Utc)
                    : layer.ReceivedAt.ToUniversalTime(),
                DecimalRounding.ToDb(layer.Quantity),
                StockCardFifoEngine.RoundUnitPrice(layer.UnitPrice),
                layer.SourceId > 0 ? layer.SourceId : null,
                companyId);
        }
    }

    public async Task<FifoIssueResult> IssueAsync(
        string componentId,
        string locationExternalId,
        string uom,
        decimal quantity,
        string transactionType,
        string referenceId,
        int? companyId,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= StockCardFifoEngine.QtyEpsilon)
            return new FifoIssueResult();

        var qty = DecimalRounding.ToDb(quantity);
        await EnsureBatchesSyncedAsync(componentId, locationExternalId, uom, companyId, cancellationToken);

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync(cancellationToken);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText =
            """
            SELECT issue_fifo_stock(
                @p_component_id,
                @p_location_external_id,
                @p_uom,
                @p_qty_required,
                @p_transaction_type,
                @p_reference_id
            )
            """;
        cmd.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();

        AddParam(cmd, "@p_component_id", (componentId ?? string.Empty).Trim());
        AddParam(cmd, "@p_location_external_id", (locationExternalId ?? string.Empty).Trim());
        AddParam(cmd, "@p_uom", NormalizeUom(uom));
        AddParam(cmd, "@p_qty_required", qty);
        AddParam(cmd, "@p_transaction_type", string.IsNullOrWhiteSpace(transactionType) ? "issue" : transactionType.Trim());
        AddParam(cmd, "@p_reference_id", referenceId ?? string.Empty);

        object? scalar;
        try
        {
            scalar = await cmd.ExecuteScalarAsync(cancellationToken);
        }
        catch (PostgresException ex) when (
            ex.SqlState == PostgresErrorCodes.RaiseException
            || (ex.MessageText ?? ex.Message).Contains("Insufficient stock", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(ex.MessageText ?? ex.Message, ex);
        }
        catch (DbException ex) when (ex.Message.Contains("Insufficient stock", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(ex.Message, ex);
        }

        if (scalar is null || scalar is DBNull)
            throw new InvalidOperationException("FIFO issue did not return a transaction id.");

        var transactionId = scalar is Guid g ? g : Guid.Parse(scalar.ToString()!);
        var (totalCost, issuedQty) = await LoadIssueCostAsync(transactionId, cancellationToken);
        var unitPrice = issuedQty > StockCardFifoEngine.QtyEpsilon
            ? StockCardFifoEngine.RoundUnitPrice(totalCost / issuedQty)
            : 0m;

        return new FifoIssueResult
        {
            TransactionId = transactionId,
            TotalCost = StockCardFifoEngine.RoundUnitPrice(totalCost),
            Quantity = issuedQty,
            UnitPrice = unitPrice,
        };
    }

    async Task EnsureMissingPurchaseBatchesAsync(
        string componentId,
        string locationExternalId,
        string uom,
        int? companyId,
        CancellationToken cancellationToken)
    {
        var purchases = await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.ComponentId == componentId)
            .OrderBy(p => p.DateCreatedInStock)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken);

        foreach (var purchase in purchases)
        {
            if (!StockLocationRules.PurchaseMatchesLocation(purchase.LocationIdsJson, locationExternalId))
                continue;
            if (NormalizeUom(purchase.Uom) != uom)
                continue;
            if (companyId is int cid && purchase.CompanyId is int pcid && pcid != cid)
                continue;
            if (await ExistsBatchForPurchaseAsync(purchase.Id, cancellationToken))
                continue;

            // New receipt after batches were already materialized — full qty as a new ACTIVE batch.
            await RecordReceiptBatchAsync(
                componentId,
                locationExternalId,
                uom,
                purchase.Quantity,
                purchase.UnitPrice,
                purchase.DateCreatedInStock,
                purchase.Id,
                purchase.CompanyId ?? companyId,
                cancellationToken);
        }
    }

    async Task<bool> ExistsBatchForPurchaseAsync(int purchaseId, CancellationToken cancellationToken)
    {
        await using var cmd = db.Database.GetDbConnection().CreateCommand();
        if (cmd.Connection!.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync(cancellationToken);
        cmd.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        cmd.CommandText =
            """
            SELECT 1
            FROM inventory_batches
            WHERE source_purchase_id = @id
            LIMIT 1
            """;
        AddParam(cmd, "@id", purchaseId);
        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return result is not null && result is not DBNull;
    }

    async Task<int> CountActiveOrAnyBatchesAsync(
        string componentId,
        string locationExternalId,
        string uom,
        CancellationToken cancellationToken)
    {
        await using var cmd = db.Database.GetDbConnection().CreateCommand();
        if (cmd.Connection!.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync(cancellationToken);
        cmd.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        cmd.CommandText =
            """
            SELECT COUNT(*)::int
            FROM inventory_batches
            WHERE component_id = @component_id
              AND location_external_id = @location
              AND UPPER(TRIM(uom)) = @uom
            """;
        AddParam(cmd, "@component_id", componentId);
        AddParam(cmd, "@location", locationExternalId);
        AddParam(cmd, "@uom", uom);
        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result ?? 0);
    }

    async Task<(decimal TotalCost, decimal Qty)> LoadIssueCostAsync(
        Guid transactionId,
        CancellationToken cancellationToken)
    {
        await using var cmd = db.Database.GetDbConnection().CreateCommand();
        if (cmd.Connection!.State != ConnectionState.Open)
            await db.Database.OpenConnectionAsync(cancellationToken);
        cmd.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        cmd.CommandText =
            """
            SELECT
                COALESCE(SUM(qty_deducted * unit_cost), 0)::numeric,
                COALESCE(SUM(qty_deducted), 0)::numeric
            FROM transaction_lines
            WHERE transaction_id = @tx
            """;
        AddParam(cmd, "@tx", transactionId);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
            return (0m, 0m);
        return (reader.GetDecimal(0), reader.GetDecimal(1));
    }

    static void AddParam(DbCommand cmd, string name, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }

    static string FirstLocationId(string? locationIdsJson)
    {
        if (string.IsNullOrWhiteSpace(locationIdsJson))
            return string.Empty;
        try
        {
            var ids = System.Text.Json.JsonSerializer.Deserialize<List<string>>(locationIdsJson);
            return ids?.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    static string NormalizeUom(string uom) => (uom ?? string.Empty).Trim().ToUpperInvariant();
}
