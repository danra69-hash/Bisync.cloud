using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class CreditNoteService(
    BisyncDbContext db,
    ComponentStockService componentStock,
    FifoBatchIssueService fifoBatches)
{
    public const string ReferenceType = "credit_note";
    public const string StatusConfirmed = "confirmed";
    public const string StatusCancelled = "cancelled";

    public async Task<IReadOnlyList<object>> SearchPurchaseOrdersAsync(
        int companyId,
        string? query,
        CancellationToken cancellationToken = default)
    {
        var term = (query ?? string.Empty).Trim();
        IQueryable<PurchaseOrder> q = db.PurchaseOrders
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.CompanyId == companyId)
            .Where(o =>
                o.Status == PurchaseOrderWorkflow.StatusReceived
                || o.Status == PurchaseOrderWorkflow.StatusPartiallyDelivered
                || o.Status == PurchaseOrderWorkflow.StatusReconciled);

        if (term.Length > 0)
        {
            var like = term.ToLowerInvariant();
            q = q.Where(o =>
                o.PoNumber.ToLower().Contains(like)
                || o.VendorName.ToLower().Contains(like));
        }

        var orders = await q
            .OrderByDescending(o => o.OrderDate)
            .ThenByDescending(o => o.Id)
            .Take(40)
            .ToListAsync(cancellationToken);

        return orders
            .Select(o => MapPoSearch(o))
            .Where(x => x is not null)
            .Cast<object>()
            .ToList();
    }

    static bool IsEligiblePoStatus(string? status) =>
        string.Equals(status, PurchaseOrderWorkflow.StatusReceived, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, PurchaseOrderWorkflow.StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase)
        || string.Equals(status, PurchaseOrderWorkflow.StatusReconciled, StringComparison.OrdinalIgnoreCase);

    public async Task<CreditNote> CreateAsync(
        int companyId,
        int purchaseOrderId,
        int purchaseOrderItemId,
        decimal quantity,
        string? creditNoteNumber,
        DateOnly creditNoteDate,
        string? locationExternalId,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            throw new InvalidOperationException("Credit quantity must be greater than zero.");

        var order = await db.PurchaseOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == purchaseOrderId, cancellationToken)
            ?? throw new InvalidOperationException("Purchase order not found.");

        if (order.CompanyId is int oc && oc != companyId)
            throw new InvalidOperationException("Purchase order belongs to another company.");

        if (!IsEligiblePoStatus(order.Status))
            throw new InvalidOperationException("Credit notes require a received or consolidated purchase order.");

        var item = order.Items.FirstOrDefault(i => i.Id == purchaseOrderItemId)
            ?? throw new InvalidOperationException("Purchase order line not found.");

        if (item.IsReturnableDeposit)
            throw new InvalidOperationException("Returnable deposit lines cannot be credited here. Use Returnable Goods.");

        if (string.IsNullOrWhiteSpace(item.ComponentId))
            throw new InvalidOperationException("Purchase order line has no component to adjust in stock.");

        var delivered = Math.Max(
            item.DeliveredQuantity,
            Math.Max(item.ReconciledQuantity ?? 0m, item.ReceivedQuantity ?? 0m));
        if (delivered <= 0)
            throw new InvalidOperationException("No delivered quantity on this line to credit against.");

        var alreadyCredited = await db.CreditNotes
            .Where(c => c.PurchaseOrderItemId == item.Id && c.Status == StatusConfirmed)
            .SumAsync(c => (decimal?)c.Quantity, cancellationToken) ?? 0m;
        var remaining = delivered - alreadyCredited;
        if (quantity > remaining + 0.0001m)
            throw new InvalidOperationException(
                $"Credit qty cannot exceed remaining delivered qty ({remaining:0.####}).");

        var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
        var location = !string.IsNullOrWhiteSpace(locationExternalId)
            ? locationExternalId.Trim()
            : locationIds.FirstOrDefault() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(location))
            throw new InvalidOperationException("Location is required for stock adjustment.");

        var deliveryUom = string.IsNullOrWhiteSpace(item.Unit) ? (item.ComponentUom ?? string.Empty) : item.Unit;
        var deliveryUnitPrice =
            item.ReconciledUnitPrice
            ?? item.ReceivedUnitPrice
            ?? (item.IssuedUnitPrice > 0 ? item.IssuedUnitPrice : item.UnitPrice);

        var amount = StockCardFifoEngine.RoundUnitPrice(quantity * deliveryUnitPrice);
        var productName = string.IsNullOrWhiteSpace(item.Name)
            ? (item.ComponentName ?? string.Empty)
            : item.Name;
        var componentName = string.IsNullOrWhiteSpace(item.ComponentName) ? productName : item.ComponentName;

        var ingredient = await db.Ingredients
            .AsNoTracking()
            .FirstOrDefaultAsync(
                i => i.ComponentId == item.ComponentId && i.CompanyId == companyId,
                cancellationToken)
            ?? await db.Ingredients
                .AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == item.ComponentId, cancellationToken);

        // Credit qty is entered in Delivery UOM. Prefer the same stock qty/UOM that was
        // actually posted for this PO line so outbound matches on-hand layers.
        decimal stockQty;
        string stockUom;
        decimal stockUnitPrice;
        var postedPurchases = await db.InventoryPurchases.AsNoTracking()
            .Where(p => p.PurchaseOrderItemId == item.Id)
            .Where(p => p.CompanyId == null || p.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        var postedQty = postedPurchases.Sum(p => p.Quantity);
        if (postedPurchases.Count > 0 && delivered > 0 && postedQty > 0)
        {
            stockQty = quantity * (postedQty / delivered);
            stockUom = string.IsNullOrWhiteSpace(postedPurchases[0].Uom)
                ? deliveryUom
                : postedPurchases[0].Uom.Trim();
            stockUnitPrice = stockQty > 0
                ? StockCardFifoEngine.RoundUnitPrice(amount / stockQty)
                : deliveryUnitPrice;
        }
        else if (ingredient is not null)
        {
            // Quantity is in delivery UOM — convert to Principal Component Unit for stock.
            (stockQty, stockUom, stockUnitPrice) = IngredientUomBridge.ToInboundPrincipal(
                ingredient,
                quantity,
                deliveryUom,
                deliveryUnitPrice,
                item.VendorProductId,
                deliveryUom);
            stockUnitPrice = stockQty > 0
                ? StockCardFifoEngine.RoundUnitPrice(amount / stockQty)
                : stockUnitPrice;
        }
        else
        {
            stockQty = quantity;
            stockUom = deliveryUom;
            stockUnitPrice = deliveryUnitPrice;
        }

        var onHand = await componentStock.GetOnHandAsync(
            item.ComponentId, location, stockUom, cancellationToken);
        if (stockQty > onHand + StockCardFifoEngine.QtyEpsilon)
            throw new InvalidOperationException(
                $"Insufficient stock on hand ({onHand:0.####} {stockUom}) to post credit note outbound of {stockQty:0.####} {stockUom}.");

        var entry = new CreditNote
        {
            CompanyId = companyId,
            LocationExternalId = location.Trim().ToLowerInvariant(),
            CreditNoteNumber = (creditNoteNumber ?? string.Empty).Trim(),
            CreditNoteDate = creditNoteDate,
            PurchaseOrderId = order.Id,
            PoNumber = order.PoNumber ?? string.Empty,
            PurchaseOrderItemId = item.Id,
            VendorExternalId = order.VendorExternalId ?? string.Empty,
            VendorName = order.VendorName ?? string.Empty,
            VendorProductId = item.VendorProductId ?? string.Empty,
            ProductName = productName,
            ComponentId = item.ComponentId,
            ComponentName = componentName,
            DeliveryUom = deliveryUom.Trim(),
            DeliveryUnitPrice = StockCardFifoEngine.RoundUnitPrice(deliveryUnitPrice),
            Quantity = DecimalRounding.ToDb(quantity),
            Amount = amount,
            StockQuantity = DecimalRounding.ToDb(stockQty),
            StockUom = stockUom.Trim(),
            StockUnitPrice = stockUnitPrice,
            Status = StatusConfirmed,
            CreatedAt = DateTime.UtcNow,
        };

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            db.CreditNotes.Add(entry);
            await db.SaveChangesAsync(cancellationToken);

            await componentStock.RecordDeductionAsync(
                entry.ComponentId,
                entry.ComponentName,
                entry.LocationExternalId,
                entry.StockQuantity,
                entry.StockUom,
                $"Credit note — PO {entry.PoNumber}"
                    + (string.IsNullOrWhiteSpace(entry.CreditNoteNumber)
                        ? string.Empty
                        : $" / CN {entry.CreditNoteNumber}"),
                ReferenceType,
                entry.Id,
                companyId,
                cancellationToken,
                createdAt: DateTime.UtcNow,
                unitPriceOverride: entry.StockUnitPrice);

            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        return entry;
    }

    public async Task<CreditNote> UpdateNumberAsync(
        int id,
        int companyId,
        string creditNoteNumber,
        CancellationToken cancellationToken = default)
    {
        var entry = await db.CreditNotes
            .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException("Credit note not found.");

        if (string.Equals(entry.Status, StatusCancelled, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Cancelled credit notes cannot be edited.");

        entry.CreditNoteNumber = (creditNoteNumber ?? string.Empty).Trim();
        entry.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    public async Task<CreditNote> CancelAsync(
        int id,
        int companyId,
        string cancelPoNumber,
        string cancelDoOrInvoiceNumber,
        string? cancelledBy,
        CancellationToken cancellationToken = default)
    {
        var poNumber = (cancelPoNumber ?? string.Empty).Trim();
        var docNumber = (cancelDoOrInvoiceNumber ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(poNumber))
            throw new InvalidOperationException("Replacement PO number is required to cancel.");
        if (string.IsNullOrWhiteSpace(docNumber))
            throw new InvalidOperationException("Delivery order or invoice number is required to cancel.");

        var entry = await db.CreditNotes
            .FirstOrDefaultAsync(c => c.Id == id && c.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException("Credit note not found.");

        if (string.Equals(entry.Status, StatusCancelled, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Credit note is already cancelled.");

        var replacement = await db.PurchaseOrders
            .AsNoTracking()
            .FirstOrDefaultAsync(
                o => o.CompanyId == companyId
                     && o.PoNumber.ToLower() == poNumber.ToLower(),
                cancellationToken)
            ?? throw new InvalidOperationException($"Purchase order '{poNumber}' not found.");

        var doMatch = string.Equals(
            (replacement.VendorDoNumber ?? string.Empty).Trim(),
            docNumber,
            StringComparison.OrdinalIgnoreCase);
        var invMatch = string.Equals(
            (replacement.VendorInvoiceNumber ?? string.Empty).Trim(),
            docNumber,
            StringComparison.OrdinalIgnoreCase);
        if (!doMatch && !invMatch)
            throw new InvalidOperationException(
                $"PO {replacement.PoNumber} does not have DO or invoice number '{docNumber}'.");

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var revaluedQty = await RevalueZeroCostReceiptsAsync(
                entry,
                replacement.Id,
                cancellationToken);

            if (revaluedQty <= StockCardFifoEngine.QtyEpsilon)
                throw new InvalidOperationException(
                    "No zero-cost replacement receipt found on that PO for this component. "
                    + "Receive the free replacement first, then cancel the credit note.");

            entry.Status = StatusCancelled;
            entry.CancelPurchaseOrderId = replacement.Id;
            entry.CancelPoNumber = replacement.PoNumber ?? poNumber;
            entry.CancelDoOrInvoiceNumber = docNumber;
            entry.CancelledAt = DateTime.UtcNow;
            entry.CancelledBy = (cancelledBy ?? string.Empty).Trim();
            entry.UpdatedAt = DateTime.UtcNow;

            // Do NOT reverse the original credit-note outbound qty — free receipt already restored stock.
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }

        return entry;
    }

    async Task<decimal> RevalueZeroCostReceiptsAsync(
        CreditNote entry,
        int replacementPoId,
        CancellationToken cancellationToken)
    {
        var purchases = await db.InventoryPurchases
            .Where(p => p.PurchaseOrderId == replacementPoId)
            .Where(p => p.ComponentId == entry.ComponentId)
            .Where(p => p.CompanyId == entry.CompanyId || p.CompanyId == null)
            .OrderBy(p => p.DateCreatedInStock)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken);

        var stockUomNorm = (entry.StockUom ?? string.Empty).Trim().ToUpperInvariant();
        var deliveryUomNorm = (entry.DeliveryUom ?? string.Empty).Trim().ToUpperInvariant();

        // Prefer matching inventory UOM at stock unit price; fall back to delivery UOM / price.
        var candidates = purchases
            .Where(p => p.UnitPrice <= StockCardFifoEngine.QtyEpsilon)
            .Where(p =>
            {
                var uom = (p.Uom ?? string.Empty).Trim().ToUpperInvariant();
                return string.IsNullOrEmpty(uom)
                    || uom == stockUomNorm
                    || uom == deliveryUomNorm;
            })
            .ToList();

        if (candidates.Count == 0)
            return 0m;

        var useStockUnits = candidates.Any(p =>
            string.Equals((p.Uom ?? string.Empty).Trim(), entry.StockUom, StringComparison.OrdinalIgnoreCase));
        var targetQty = useStockUnits ? entry.StockQuantity : entry.Quantity;
        var targetPrice = useStockUnits ? entry.StockUnitPrice : entry.DeliveryUnitPrice;
        var revalued = 0m;

        foreach (var purchase in candidates)
        {
            if (revalued >= targetQty - StockCardFifoEngine.QtyEpsilon)
                break;

            purchase.UnitPrice = targetPrice;
            await UpdateBatchUnitCostAsync(purchase.Id, targetPrice, cancellationToken);
            revalued += purchase.Quantity;
        }

        return revalued;
    }

    async Task UpdateBatchUnitCostAsync(
        int sourcePurchaseId,
        decimal unitCost,
        CancellationToken cancellationToken)
    {
        await fifoBatches.EnsureSchemaAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE inventory_batches
            SET unit_cost = {0}
            WHERE source_purchase_id = {1}
            """,
            StockCardFifoEngine.RoundUnitPrice(unitCost),
            sourcePurchaseId);
    }

    static object? MapPoSearch(PurchaseOrder order)
    {
        var lines = order.Items
            .Where(i => !i.IsReturnableDeposit)
            .Where(i => !string.IsNullOrWhiteSpace(i.ComponentId))
            .Select(i =>
            {
                var delivered = Math.Max(
                    i.DeliveredQuantity,
                    Math.Max(i.ReconciledQuantity ?? 0m, i.ReceivedQuantity ?? 0m));
                if (delivered <= 0) return null;
                var unitPrice =
                    i.ReconciledUnitPrice
                    ?? i.ReceivedUnitPrice
                    ?? (i.IssuedUnitPrice > 0 ? i.IssuedUnitPrice : i.UnitPrice);
                return new
                {
                    id = i.Id,
                    vendorProductId = i.VendorProductId,
                    name = i.Name,
                    componentId = i.ComponentId,
                    componentName = string.IsNullOrWhiteSpace(i.ComponentName) ? i.Name : i.ComponentName,
                    unit = i.Unit,
                    componentUom = i.ComponentUom,
                    deliveredQuantity = delivered,
                    unitPrice,
                };
            })
            .Where(x => x is not null)
            .ToList();

        if (lines.Count == 0) return null;

        var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
        return new
        {
            id = order.Id,
            poNumber = order.PoNumber,
            vendorName = order.VendorName,
            vendorExternalId = order.VendorExternalId,
            status = order.Status,
            orderDate = order.OrderDate.ToString("yyyy-MM-dd"),
            vendorDoNumber = order.VendorDoNumber,
            vendorInvoiceNumber = order.VendorInvoiceNumber,
            locationExternalIds = locationIds,
            items = lines,
        };
    }

    public static object Map(CreditNote c) => new
    {
        c.Id,
        companyId = c.CompanyId,
        locationExternalId = c.LocationExternalId,
        creditNoteNumber = c.CreditNoteNumber,
        creditNoteDate = c.CreditNoteDate.ToString("yyyy-MM-dd"),
        purchaseOrderId = c.PurchaseOrderId,
        poNumber = c.PoNumber,
        purchaseOrderItemId = c.PurchaseOrderItemId,
        vendorExternalId = c.VendorExternalId,
        vendorName = c.VendorName,
        vendorProductId = c.VendorProductId,
        productName = c.ProductName,
        componentId = c.ComponentId,
        componentName = c.ComponentName,
        deliveryUom = c.DeliveryUom,
        deliveryUnitPrice = c.DeliveryUnitPrice,
        quantity = c.Quantity,
        amount = c.Amount,
        stockQuantity = c.StockQuantity,
        stockUom = c.StockUom,
        stockUnitPrice = c.StockUnitPrice,
        status = c.Status,
        cancelPurchaseOrderId = c.CancelPurchaseOrderId,
        cancelPoNumber = c.CancelPoNumber,
        cancelDoOrInvoiceNumber = c.CancelDoOrInvoiceNumber,
        cancelledAt = c.CancelledAt,
        cancelledBy = c.CancelledBy,
        createdAt = c.CreatedAt,
        updatedAt = c.UpdatedAt,
    };
}
