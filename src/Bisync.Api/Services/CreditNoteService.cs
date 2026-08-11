using System.Text.RegularExpressions;
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

    /// <summary>
    /// Erroneous delivery qty that can appear from bad PCU conversion / mistype (displayed 0.0010).
    /// </summary>
    public const decimal ErroneousTinyQuantity = 0.001m;

    /// <summary>Minimum allowed credit qty (delivery packages). Anything below is purged as junk.</summary>
    public const decimal MinAllowedCreditQuantity = 0.01m;

    static readonly Regex FifoTransactionMarker = new(
        @"\[fifo:([0-9a-fA-F]{32})\]",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

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
        if (quantity < MinAllowedCreditQuantity)
            throw new InvalidOperationException(
                $"Credit quantity must be at least {MinAllowedCreditQuantity:0.##} delivery units (got {quantity:0.####}).");

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
            // Prefer VendorProduct.DeliveryJson (same as receive / Stock Card / healer).
            var deliveryBasis = string.IsNullOrWhiteSpace(item.Unit)
                ? item.DeliveryPackage
                : item.Unit;
            if (string.IsNullOrWhiteSpace(deliveryBasis))
                deliveryBasis = deliveryUom;
            var (pathPrincipal, pathPrincipalUom) = await DeliveryPrincipalResolver.ResolvePathPrincipalAsync(
                db,
                ingredient,
                item.VendorProductId,
                deliveryBasis,
                cancellationToken);
            (stockQty, stockUom, stockUnitPrice) = IngredientUomBridge.ToInboundPrincipal(
                ingredient,
                quantity,
                deliveryUom,
                deliveryUnitPrice,
                item.VendorProductId,
                deliveryBasis,
                pathPrincipal,
                pathPrincipalUom);
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

        // Document authority = delivery credit amount; residual discloses 4dp PCU extended variance.
        var extendedAtUnitPrice = stockQty > 0 && stockUnitPrice > 0
            ? DecimalRounding.ToDb(stockQty * stockUnitPrice)
            : amount;
        var roundingResidual = DecimalRounding.ToDb(extendedAtUnitPrice - amount);

        var onHand = await componentStock.GetOnHandAsync(
            item.ComponentId, location, stockUom, cancellationToken);
        if (stockQty > onHand + StockCardFifoEngine.QtyEpsilon)
            throw new InvalidOperationException(
                $"Insufficient stock on hand ({onHand:0.####} {stockUom}) to post credit note outbound of {stockQty:0.####} {stockUom}"
                + $" (credit {quantity:0.####} {deliveryUom} = {stockQty:0.####} {stockUom}).");

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
            DocumentAmount = amount,
            RoundingResidual = roundingResidual,
            StockQuantity = DecimalRounding.ToDb(stockQty),
            StockUom = stockUom.Trim(),
            StockUnitPrice = stockUnitPrice,
            Status = StatusConfirmed,
            CreatedAt = DateTime.UtcNow,
        };

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Align FIFO batches with healed PCU purchase rows before deducting.
            // Under-converted batches (still holding package qty) cause "Short by ~3787.79"
            // when reversing 1 delivery unit that maps to ~3790 principal units.
            foreach (var purchase in postedPurchases)
                await fifoBatches.SyncBatchFromPurchaseAsync(purchase, cancellationToken);

            db.CreditNotes.Add(entry);
            await db.SaveChangesAsync(cancellationToken);

            try
            {
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
            }
            catch (InvalidOperationException ex) when (
                ex.Message.Contains("Insufficient stock", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"{ex.Message} Credit of {quantity:0.####} {deliveryUom} reverses {stockQty:0.####} {stockUom} on the stock card"
                    + $" (ledger on hand {onHand:0.####} {stockUom})."
                    + " If packages were received before principal conversion, stock layers may need a refresh — retry once; contact support if it persists.",
                    ex);
            }

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

    /// <summary>
    /// Permanently removes a credit note, reverses its stock outbound (ledger + FIFO), and
    /// deletes related inventory movements. Unlike Cancel, no replacement PO is required.
    /// </summary>
    public async Task DeleteCompletelyAsync(
        int id,
        int? companyId = null,
        CancellationToken cancellationToken = default)
    {
        var query = db.CreditNotes.Where(c => c.Id == id);
        if (companyId is int cid)
            query = query.Where(c => c.CompanyId == cid);

        var entry = await query.FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Credit note not found.");

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await ReverseStockEffectsAsync(entry, cancellationToken);
            db.CreditNotes.Remove(entry);
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// Purge credit notes with delivery qty below the allowed minimum (e.g. displayed 0.0010).
    /// Best-effort: stock reverse failures still remove the credit-note row so the UI clears.
    /// </summary>
    public async Task<int> PurgeErroneousTinyQuantityAsync(
        CancellationToken cancellationToken = default)
    {
        // Load candidates in memory — EF decimal compare against PG numeric can miss edge rows.
        var candidates = await db.CreditNotes
            .OrderBy(c => c.Id)
            .ToListAsync(cancellationToken);

        var tiny = candidates
            .Where(c => c.Quantity > 0 && c.Quantity < MinAllowedCreditQuantity)
            .ToList();

        if (tiny.Count == 0)
            return 0;

        var purged = 0;
        foreach (var entry in tiny)
        {
            try
            {
                await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    try
                    {
                        await ReverseStockEffectsAsync(entry, cancellationToken);
                    }
                    catch
                    {
                        // Still delete the bad CN even if FIFO restore fails.
                        var orphanMoves = await db.InventoryMovements
                            .Where(m => m.ReferenceType == ReferenceType && m.ReferenceId == entry.Id)
                            .ToListAsync(cancellationToken);
                        if (orphanMoves.Count > 0)
                            db.InventoryMovements.RemoveRange(orphanMoves);
                    }

                    db.CreditNotes.Remove(entry);
                    await db.SaveChangesAsync(cancellationToken);
                    await tx.CommitAsync(cancellationToken);
                    purged++;
                }
                catch
                {
                    await tx.RollbackAsync(cancellationToken);
                    // Detach and fall through to raw SQL force-delete.
                    db.ChangeTracker.Clear();
                    await ForceDeleteCreditNoteRowAsync(entry.Id, cancellationToken);
                    purged++;
                }
            }
            catch
            {
                // Continue purging remaining tiny rows.
                db.ChangeTracker.Clear();
            }
        }

        return purged;
    }

    async Task ForceDeleteCreditNoteRowAsync(int creditNoteId, CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            DELETE FROM "InventoryMovements"
            WHERE "ReferenceType" = {0} AND "ReferenceId" = {1}
            """,
            ReferenceType,
            creditNoteId);
        await db.Database.ExecuteSqlRawAsync(
            """
            DELETE FROM "CreditNotes" WHERE "Id" = {0}
            """,
            creditNoteId);
    }

    async Task ReverseStockEffectsAsync(CreditNote entry, CancellationToken cancellationToken)
    {
        if (!string.Equals(entry.Status, StatusConfirmed, StringComparison.OrdinalIgnoreCase))
        {
            // Cancelled notes already kept outbound; still drop orphan movements if any.
        }

        var movements = await db.InventoryMovements
            .Where(m => m.ReferenceType == ReferenceType && m.ReferenceId == entry.Id)
            .ToListAsync(cancellationToken);

        foreach (var movement in movements)
        {
            var fifoId = TryParseFifoTransactionId(movement.Reason);
            if (fifoId is Guid txId)
                await fifoBatches.RestoreIssueTransactionAsync(txId, cancellationToken);
        }

        if (movements.Count > 0)
            db.InventoryMovements.RemoveRange(movements);

        // If outbound posted but movement/FIFO marker is missing, still restore ledger via addition
        // only when no movements were found and confirmed stock qty remains.
        if (movements.Count == 0
            && string.Equals(entry.Status, StatusConfirmed, StringComparison.OrdinalIgnoreCase)
            && entry.StockQuantity > StockCardFifoEngine.QtyEpsilon)
        {
            componentStock.RecordAddition(
                entry.ComponentId,
                entry.ComponentName,
                entry.LocationExternalId,
                entry.StockQuantity,
                entry.StockUom,
                $"Credit note #{entry.Id} deleted — reverse outbound",
                "credit_note_delete",
                entry.Id,
                entry.CompanyId,
                createdAt: DateTime.UtcNow,
                unitPrice: entry.StockUnitPrice);
        }
    }

    static Guid? TryParseFifoTransactionId(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            return null;
        var match = FifoTransactionMarker.Match(reason);
        if (!match.Success)
            return null;
        return Guid.TryParseExact(match.Groups[1].Value, "N", out var id) ? id : null;
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
            await CancelCoreAsync(
                entry,
                replacement,
                docNumber,
                cancelledBy,
                requireVendorProductMatch: false,
                replacementPurchaseOrderItemId: null,
                cancellationToken);
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

    /// <summary>
    /// Settle a confirmed credit note against a freebie / replacement receive on
    /// <paramref name="replacementOrder"/>. Vendor product on the receive line must
    /// match the credit note exactly. When receive qty is lower than the CN qty,
    /// the CN is reduced first (excess outbound restored), then cancelled.
    /// Caller owns the ambient DB transaction.
    /// </summary>
    public async Task<CreditNote> SettleAgainstReplacementReceiveAsync(
        int creditNoteId,
        int companyId,
        PurchaseOrder replacementOrder,
        string receiveVendorProductId,
        decimal receiveQuantity,
        string? cancelledBy,
        int? replacementPurchaseOrderItemId = null,
        CancellationToken cancellationToken = default)
    {
        if (receiveQuantity <= 0)
            throw new InvalidOperationException("Receive quantity must be greater than zero to settle a credit note.");

        var entry = await db.CreditNotes
            .FirstOrDefaultAsync(c => c.Id == creditNoteId && c.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException("Credit note not found.");

        if (!string.Equals(entry.Status, StatusConfirmed, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only confirmed credit notes can be settled on receive.");

        var cnVp = (entry.VendorProductId ?? string.Empty).Trim();
        var recvVp = (receiveVendorProductId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cnVp) || string.IsNullOrWhiteSpace(recvVp)
            || !string.Equals(cnVp, recvVp, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Credit note vendor product must match the received vendor product exactly.");
        }

        var docNumber = !string.IsNullOrWhiteSpace(replacementOrder.VendorDoNumber)
            ? replacementOrder.VendorDoNumber.Trim()
            : (replacementOrder.VendorInvoiceNumber ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(docNumber))
            throw new InvalidOperationException(
                "DO or invoice number is required on this PO to settle the linked credit note.");

        // Receive qty lower than CN → shrink CN (and reverse excess stock outbound) before cancel.
        if (receiveQuantity + 0.0001m < entry.Quantity)
            await ReduceConfirmedQuantityAsync(entry, receiveQuantity, cancellationToken);

        await CancelCoreAsync(
            entry,
            replacementOrder,
            docNumber,
            cancelledBy,
            requireVendorProductMatch: true,
            replacementPurchaseOrderItemId,
            cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return entry;
    }

    /// <summary>
    /// Lightweight checks before stock is posted: confirmed, unique, exact vendor product.
    /// </summary>
    public async Task ValidateLinkedCreditNoteForReceiveAsync(
        int creditNoteId,
        int companyId,
        string receiveVendorProductId,
        CancellationToken cancellationToken = default)
    {
        var entry = await db.CreditNotes.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == creditNoteId && c.CompanyId == companyId, cancellationToken)
            ?? throw new InvalidOperationException($"Credit note #{creditNoteId} was not found.");

        if (!string.Equals(entry.Status, StatusConfirmed, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"Credit note #{creditNoteId} is not confirmed (status: {entry.Status}).");

        var cnVp = (entry.VendorProductId ?? string.Empty).Trim();
        var recvVp = (receiveVendorProductId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cnVp) || string.IsNullOrWhiteSpace(recvVp)
            || !string.Equals(cnVp, recvVp, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Credit note #{creditNoteId} vendor product must match the received vendor product exactly.");
        }
    }

    async Task ReduceConfirmedQuantityAsync(
        CreditNote entry,
        decimal newDeliveryQty,
        CancellationToken cancellationToken)
    {
        if (newDeliveryQty < MinAllowedCreditQuantity)
            throw new InvalidOperationException(
                $"Settled credit quantity must be at least {MinAllowedCreditQuantity:0.##}.");

        var oldQty = entry.Quantity;
        if (oldQty <= 0)
            throw new InvalidOperationException("Credit note has no quantity to adjust.");

        var ratio = newDeliveryQty / oldQty;
        var oldStockQty = entry.StockQuantity;
        var newStockQty = DecimalRounding.ToDb(oldStockQty * ratio);
        var excessStock = DecimalRounding.ToDb(oldStockQty - newStockQty);

        if (excessStock > StockCardFifoEngine.QtyEpsilon
            && !string.IsNullOrWhiteSpace(entry.ComponentId))
        {
            // Restore the portion of outbound that is no longer credited.
            componentStock.RecordAddition(
                entry.ComponentId,
                entry.ComponentName,
                entry.LocationExternalId,
                excessStock,
                entry.StockUom,
                $"Credit note #{entry.Id} reduced on replacement receive — reverse excess outbound",
                "credit_note_adjust",
                entry.Id,
                entry.CompanyId,
                createdAt: DateTime.UtcNow,
                unitPrice: entry.StockUnitPrice);
        }

        entry.Quantity = DecimalRounding.ToDb(newDeliveryQty);
        entry.Amount = DecimalRounding.ToDb(newDeliveryQty * entry.DeliveryUnitPrice);
        entry.DocumentAmount = entry.Amount;
        entry.StockQuantity = newStockQty;
        entry.RoundingResidual = DecimalRounding.ToDb(
            (newStockQty * entry.StockUnitPrice) - entry.DocumentAmount);
        entry.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    async Task CancelCoreAsync(
        CreditNote entry,
        PurchaseOrder replacement,
        string docNumber,
        string? cancelledBy,
        bool requireVendorProductMatch,
        int? replacementPurchaseOrderItemId,
        CancellationToken cancellationToken)
    {
        var revaluedQty = await RevalueZeroCostReceiptsAsync(
            entry,
            replacement.Id,
            requireVendorProductMatch,
            replacementPurchaseOrderItemId,
            cancellationToken);

        if (revaluedQty <= StockCardFifoEngine.QtyEpsilon)
            throw new InvalidOperationException(
                "No zero-cost replacement receipt found on that PO for this "
                + (requireVendorProductMatch ? "vendor product" : "component")
                + ". Receive the free replacement first, then cancel the credit note.");

        entry.Status = StatusCancelled;
        entry.CancelPurchaseOrderId = replacement.Id;
        entry.CancelPoNumber = replacement.PoNumber ?? string.Empty;
        entry.CancelDoOrInvoiceNumber = docNumber;
        entry.CancelledAt = DateTime.UtcNow;
        entry.CancelledBy = (cancelledBy ?? string.Empty).Trim();
        entry.UpdatedAt = DateTime.UtcNow;
    }

    async Task<decimal> RevalueZeroCostReceiptsAsync(
        CreditNote entry,
        int replacementPoId,
        bool requireVendorProductMatch,
        int? replacementPurchaseOrderItemId,
        CancellationToken cancellationToken)
    {
        var purchases = await db.InventoryPurchases
            .Where(p => p.PurchaseOrderId == replacementPoId)
            .Where(p => p.ComponentId == entry.ComponentId)
            .Where(p => p.CompanyId == entry.CompanyId || p.CompanyId == null)
            .OrderBy(p => p.DateCreatedInStock)
            .ThenBy(p => p.Id)
            .ToListAsync(cancellationToken);

        // Prefer the exact unordered receive line that linked this CN (avoids
        // revaluing a same-VP ordered line that happens to be zero-cost).
        if (replacementPurchaseOrderItemId is > 0)
        {
            purchases = purchases
                .Where(p => p.PurchaseOrderItemId == replacementPurchaseOrderItemId.Value)
                .ToList();
        }
        else if (requireVendorProductMatch && !string.IsNullOrWhiteSpace(entry.VendorProductId))
        {
            var vp = entry.VendorProductId.Trim();
            var matchingItemIds = await db.PurchaseOrderItems.AsNoTracking()
                .Where(i => i.PurchaseOrderId == replacementPoId)
                .Where(i => i.VendorProductId.ToLower() == vp.ToLower())
                .Select(i => i.Id)
                .ToListAsync(cancellationToken);
            purchases = purchases
                .Where(p => matchingItemIds.Contains(p.PurchaseOrderItemId))
                .ToList();
        }

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
                    || uom == deliveryUomNorm
                    || UomCanonical.Equals(p.Uom, entry.StockUom)
                    || UomCanonical.Equals(p.Uom, entry.DeliveryUom);
            })
            .ToList();

        if (candidates.Count == 0)
            return 0m;

        var ingredient = await db.Ingredients.AsNoTracking()
            .FirstOrDefaultAsync(
                i => i.ComponentId == entry.ComponentId
                    && (i.CompanyId == null || i.CompanyId == entry.CompanyId),
                cancellationToken)
            ?? await db.Ingredients.AsNoTracking()
                .FirstOrDefaultAsync(i => i.ComponentId == entry.ComponentId, cancellationToken);

        PurchaseOrderItem? replacementItem = null;
        if (replacementPurchaseOrderItemId is > 0)
        {
            replacementItem = await db.PurchaseOrderItems.AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == replacementPurchaseOrderItemId.Value, cancellationToken);
        }

        var revalued = 0m;
        var targetStockQty = entry.StockQuantity > 0 ? entry.StockQuantity : entry.Quantity;
        var targetStockPrice = entry.StockUnitPrice > 0 ? entry.StockUnitPrice : entry.DeliveryUnitPrice;
        var targetStockUom = !string.IsNullOrWhiteSpace(entry.StockUom)
            ? entry.StockUom.Trim()
            : entry.DeliveryUom;

        foreach (var purchase in candidates)
        {
            if (revalued >= targetStockQty - StockCardFifoEngine.QtyEpsilon)
                break;

            var remaining = DecimalRounding.ToDb(targetStockQty - revalued);
            if (remaining <= StockCardFifoEngine.QtyEpsilon)
                break;

            // Freebie often still sits in delivery packages (tub). Convert to the CN stock
            // UOM/qty so Stock Card inbound can normalize against Recipe UOM (e.g. Gr).
            if (ingredient is not null
                && !UomCanonical.Equals(purchase.Uom, targetStockUom)
                && purchase.Quantity > 0
                && purchase.Quantity + 0.0001m <= entry.Quantity + 0.0001m)
            {
                var deliveryBasis = replacementItem is null
                    ? (string.IsNullOrWhiteSpace(entry.DeliveryUom) ? purchase.Uom : entry.DeliveryUom)
                    : (string.IsNullOrWhiteSpace(replacementItem.Unit)
                        ? replacementItem.DeliveryPackage
                        : replacementItem.Unit);
                var (pathPrincipal, pathPrincipalUom) = await DeliveryPrincipalResolver.ResolvePathPrincipalAsync(
                    db,
                    ingredient,
                    entry.VendorProductId,
                    deliveryBasis,
                    cancellationToken);
                var inbound = IngredientUomBridge.ToInboundPrincipal(
                    ingredient,
                    purchase.Quantity,
                    string.IsNullOrWhiteSpace(purchase.Uom) ? deliveryBasis : purchase.Uom,
                    entry.DeliveryUnitPrice > 0 ? entry.DeliveryUnitPrice : purchase.UnitPrice,
                    entry.VendorProductId,
                    deliveryBasis,
                    pathPrincipal,
                    pathPrincipalUom);

                if (inbound.Quantity > purchase.Quantity + 0.0001m
                    || UomCanonical.Equals(inbound.Uom, targetStockUom))
                {
                    var takeQty = Math.Min(inbound.Quantity, remaining);
                    purchase.Quantity = takeQty;
                    purchase.Uom = string.IsNullOrWhiteSpace(inbound.Uom)
                        ? (targetStockUom ?? string.Empty)
                        : inbound.Uom;
                    purchase.UnitPrice = targetStockPrice;
                    purchase.DocumentAmount = DecimalRounding.ToDb(takeQty * targetStockPrice);
                    purchase.RoundingResidual = 0m;
                    await UpdateBatchUnitCostAsync(purchase.Id, targetStockPrice, cancellationToken);
                    revalued += takeQty;
                    continue;
                }
            }

            var useStockUnits = UomCanonical.Equals(purchase.Uom, entry.StockUom)
                || (string.IsNullOrWhiteSpace(entry.StockUom)
                    && !UomCanonical.Equals(purchase.Uom, entry.DeliveryUom));
            var targetPrice = useStockUnits ? targetStockPrice : entry.DeliveryUnitPrice;
            if (targetPrice <= 0)
                targetPrice = targetStockPrice;

            purchase.UnitPrice = targetPrice;
            await UpdateBatchUnitCostAsync(purchase.Id, targetPrice, cancellationToken);
            revalued += useStockUnits
                ? purchase.Quantity
                : (entry.StockQuantity > 0 && entry.Quantity > 0
                    ? DecimalRounding.ToDb(purchase.Quantity * (entry.StockQuantity / entry.Quantity))
                    : purchase.Quantity);
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
        documentAmount = ResolveDocumentAmount(c),
        roundingResidual = ResolveRoundingResidual(c),
        extendedAtUnitPrice = ResolveExtendedAtUnitPrice(c),
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

    /// <summary>CN document amount (delivery credit) — falls back to Amount for legacy rows.</summary>
    public static decimal ResolveDocumentAmount(CreditNote c)
    {
        if (c.DocumentAmount > 0 || Math.Abs(c.RoundingResidual) > 0.00005m)
            return DecimalRounding.ToDb(c.DocumentAmount > 0 ? c.DocumentAmount : c.Amount);
        return DecimalRounding.ToDb(c.Amount);
    }

    public static decimal ResolveExtendedAtUnitPrice(CreditNote c)
    {
        if (c.StockQuantity > 0 && c.StockUnitPrice > 0)
            return DecimalRounding.ToDb(c.StockQuantity * c.StockUnitPrice);
        return ResolveDocumentAmount(c);
    }

    public static decimal ResolveRoundingResidual(CreditNote c)
    {
        if (Math.Abs(c.RoundingResidual) > 0.00005m)
            return DecimalRounding.ToDb(c.RoundingResidual);
        return DecimalRounding.ToDb(ResolveExtendedAtUnitPrice(c) - ResolveDocumentAmount(c));
    }
}
