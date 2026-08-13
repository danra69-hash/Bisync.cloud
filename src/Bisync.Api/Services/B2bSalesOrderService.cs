using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class B2bSalesOrderService(BisyncDbContext db)
{
    /// <summary>Default client-acceptance / holdout window in working days (weekends excluded).</summary>
    public const int DefaultClientAcceptWorkingDays = 7;

    public static readonly HashSet<string> ValidSources = new(StringComparer.OrdinalIgnoreCase)
    {
        "sales_order", "online_order",
    };

    public async Task<B2bSalesOrder> IssueAsync(int orderId, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        if (!string.Equals(order.Status, "draft", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only draft sales orders can be issued.");

        if (order.LockPeriodDays <= 0)
            throw new InvalidOperationException("Lock period (days) must be defined before issuing a sales order.");

        if (order.Lines.Count == 0)
            throw new InvalidOperationException("Add at least one line before issuing the sales order.");

        var companyCountry = await db.Companies.AsNoTracking()
            .Where(c => c.Id == order.CompanyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync(cancellationToken) ?? "MY";
        var issuedDate = OrgClock.TodayLocal(companyCountry);
        order.IssuedDate = issuedDate.ToString("yyyy-MM-dd");
        // Client acceptance / stock holdout: LockPeriodDays are working days (default 7).
        order.LockExpiryDate = WorkingDayCalendar
            .AddWorkingDays(issuedDate, order.LockPeriodDays)
            .ToString("yyyy-MM-dd");
        order.Status = "issued";
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var line in order.Lines)
        {
            if (line.IsCombo && line.PromotionId is int promoId)
            {
                await LockComboComponentsAsync(line, promoId, cancellationToken);
                continue;
            }

            var product = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == line.ProductId && p.Active, cancellationToken)
                ?? throw new InvalidOperationException($"Product not found for line: {line.ProductName}");

            if (!product.IsSubProduct && !product.B2bEnabled)
                throw new InvalidOperationException($"Product {product.Name} is not enabled for B2B sales.");

            var stock = await EnsureStockRowAsync(line.ProductId, line.LocationExternalId, cancellationToken);
            var toLock = Math.Min(line.QuantityOrdered, stock.InStock);
            if (toLock <= 0)
                throw new InvalidOperationException($"Insufficient on-hand stock for {line.ProductName} at {line.LocationExternalId}.");

            stock.InStock -= toLock;
            stock.OnOrderQty += toLock;
            stock.UpdatedAt = DateTime.UtcNow;
            line.QuantityLocked = toLock;
            line.Status = "locked";
            if (string.IsNullOrWhiteSpace(line.ProductName))
                line.ProductName = product.Name;
            if (line.Rrp <= 0)
                line.Rrp = product.Rrp;
            if (string.IsNullOrWhiteSpace(line.Uom))
                line.Uom = ResolveProductUom(product);
        }

        if (string.IsNullOrWhiteSpace(order.ShareToken))
            order.ShareToken = Guid.NewGuid().ToString("N");

        await db.SaveChangesAsync(cancellationToken);
        return order;
    }

    public async Task<B2bSalesOrder> FulfillAsync(
        int orderId,
        bool deliveryOrderIssued,
        bool invoiceIssued,
        CancellationToken cancellationToken = default)
    {
        if (!deliveryOrderIssued || !invoiceIssued)
            throw new InvalidOperationException("Both delivery order (DO) and invoice must be issued to fulfill the sales order.");

        var order = await LoadOrderAsync(orderId, cancellationToken);
        if (!string.Equals(order.Status, "issued", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(order.Status, "confirmed", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only issued or confirmed sales orders can be fulfilled.");

        order.DeliveryOrderIssued = true;
        order.InvoiceIssued = true;
        var fulfillCountry = await db.Companies.AsNoTracking()
            .Where(c => c.Id == order.CompanyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync(cancellationToken) ?? "MY";
        order.FulfilledDate = OrgClock.TodayLocal(fulfillCountry).ToString("yyyy-MM-dd");
        order.Status = "fulfilled";
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var line in order.Lines.Where(l => l.QuantityLocked > 0))
        {
            if (line.IsCombo && line.PromotionId is int promoId)
            {
                await FulfillComboComponentsAsync(order, line, promoId, cancellationToken);
                continue;
            }

            var stock = await EnsureStockRowAsync(line.ProductId, line.LocationExternalId, cancellationToken);
            var qty = Math.Min(line.QuantityLocked, stock.OnOrderQty);
            if (qty <= 0)
                continue;

            stock.OnOrderQty = Math.Max(0, stock.OnOrderQty - qty);
            stock.UpdatedAt = DateTime.UtcNow;
            line.Status = "fulfilled";

            var product = await db.Products
                .Include(p => p.Items)
                .FirstAsync(p => p.Id == line.ProductId, cancellationToken);

            var channel = string.Equals(order.Source, "online_order", StringComparison.OrdinalIgnoreCase)
                ? "online"
                : "offline";

            var doNumber = await ResolveDoNumberAsync(order, cancellationToken);
            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = product.Id,
                EntryType = ProductSaleInventoryService.ChannelToReferenceType(channel),
                Quantity = qty,
                ProductionDate = order.FulfilledDate,
                BatchNumber = doNumber,
                UnitPrice = line.Rrp,
                LocationIdsJson = System.Text.Json.JsonSerializer.Serialize(new[] { line.LocationExternalId }),
                CompanyId = product.CompanyId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return order;
    }

    /// <summary>
    /// Move available stock into Holdout (OnOrderQty) for an online PO sales order.
    /// No holdout period — LockPeriodDays stays 0 and LockExpiryDate stays empty.
    /// </summary>
    public async Task<B2bSalesOrder> ReserveHoldoutAsync(int orderId, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        if (order.Lines.Any(l => l.QuantityLocked > 0))
            return order;

        if (order.Lines.Count == 0)
            throw new InvalidOperationException("Add at least one line before reserving holdout.");

        foreach (var line in order.Lines)
        {
            if (line.IsCombo && line.PromotionId is int promoId)
            {
                await LockComboComponentsAsync(line, promoId, cancellationToken);
                continue;
            }

            var product = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == line.ProductId && p.Active, cancellationToken)
                ?? throw new InvalidOperationException($"Product not found for line: {line.ProductName}");

            if (!product.IsSubProduct && !product.B2bEnabled)
                throw new InvalidOperationException($"Product {product.Name} is not enabled for B2B sales.");

            var stock = await EnsureStockRowAsync(line.ProductId, line.LocationExternalId, cancellationToken);
            var toLock = Math.Min(line.QuantityOrdered, stock.InStock);
            if (toLock <= 0)
                throw new InvalidOperationException($"Insufficient on-hand stock for {line.ProductName} at {line.LocationExternalId}.");

            stock.InStock -= toLock;
            stock.OnOrderQty += toLock;
            stock.UpdatedAt = DateTime.UtcNow;
            line.QuantityLocked = toLock;
            line.Status = "locked";
            if (string.IsNullOrWhiteSpace(line.ProductName))
                line.ProductName = product.Name;
            if (line.Rrp <= 0)
                line.Rrp = product.Rrp;
            if (string.IsNullOrWhiteSpace(line.Uom))
                line.Uom = ResolveProductUom(product);
        }

        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return order;
    }

    /// <summary>Issue a price-less Delivery Order from Holdout lines (still Holdout until receipt).</summary>
    public async Task<(B2bSalesOrder Order, DeliveryOrder DeliveryOrder)> IssueDeliveryOrderAsync(
        int orderId,
        CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        if (!string.Equals(order.Status, "issued", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(order.Status, "confirmed", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only issued or confirmed sales orders can issue a delivery order.");

        var shippable = order.Lines
            .Where(l => l.QuantityLocked > 0
                && (string.Equals(l.Status, "locked", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(l.Status, "ready_to_ship", StringComparison.OrdinalIgnoreCase)))
            .ToList();
        if (shippable.Count == 0)
            throw new InvalidOperationException("No holdout quantity available to issue on a delivery order.");

        if (order.DeliveryOrderId is int existingId)
        {
            var existing = await db.DeliveryOrders
                .Include(d => d.Lines)
                .FirstOrDefaultAsync(d => d.Id == existingId, cancellationToken);
            if (existing is not null
                && !string.Equals(existing.Status, "received", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(existing.Status, "cancelled", StringComparison.OrdinalIgnoreCase))
            {
                return (order, existing);
            }
        }

        var companyCountry = await db.Companies.AsNoTracking()
            .Where(c => c.Id == order.CompanyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync(cancellationToken) ?? "MY";
        var issueDate = OrgClock.TodayLocal(companyCountry).ToString("yyyy-MM-dd");
        var doCount = await db.DeliveryOrders.CountAsync(d => d.CompanyId == order.CompanyId, cancellationToken);
        var deliveryOrder = new DeliveryOrder
        {
            CompanyId = order.CompanyId,
            DoNumber = $"DO-{order.CompanyId:D3}-{doCount + 1:D5}",
            IssueDate = issueDate,
            SalesOrderId = order.Id,
            SourcePurchaseOrderId = order.SourcePurchaseOrderId,
            Status = "issued",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Lines = shippable.Select(line => new DeliveryOrderLine
            {
                SalesOrderLineId = line.Id,
                ProductId = line.ProductId,
                ProductAliasId = line.ProductAliasId,
                ProductName = line.ProductName,
                LocationExternalId = line.LocationExternalId,
                Quantity = line.QuantityLocked,
                Uom = line.Uom,
            }).ToList(),
        };

        db.DeliveryOrders.Add(deliveryOrder);
        await db.SaveChangesAsync(cancellationToken);

        order.DeliveryOrderIssued = true;
        order.DeliveryOrderId = deliveryOrder.Id;
        order.UpdatedAt = DateTime.UtcNow;
        foreach (var line in shippable)
        {
            if (!string.Equals(line.Status, "fulfilled", StringComparison.OrdinalIgnoreCase))
                line.Status = "ready_to_ship";
        }

        await db.SaveChangesAsync(cancellationToken);
        return (order, deliveryOrder);
    }

    /// <summary>Customer confirms receipt: Holdout → sold on stock card with DO reference.</summary>
    public async Task<B2bSalesOrder> ConfirmDeliveryOrderReceiptAsync(
        int deliveryOrderId,
        CancellationToken cancellationToken = default)
    {
        var deliveryOrder = await db.DeliveryOrders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == deliveryOrderId, cancellationToken)
            ?? throw new InvalidOperationException("Delivery order not found.");

        if (string.Equals(deliveryOrder.Status, "received", StringComparison.OrdinalIgnoreCase))
        {
            var already = await LoadOrderAsync(deliveryOrder.SalesOrderId, cancellationToken);
            return already;
        }

        if (!string.Equals(deliveryOrder.Status, "issued", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only issued delivery orders can be confirmed as received.");

        var order = await LoadOrderAsync(deliveryOrder.SalesOrderId, cancellationToken);
        var companyCountry = await db.Companies.AsNoTracking()
            .Where(c => c.Id == order.CompanyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync(cancellationToken) ?? "MY";
        var receivedDate = OrgClock.TodayLocal(companyCountry).ToString("yyyy-MM-dd");

        deliveryOrder.Status = "received";
        deliveryOrder.ReceivedDate = receivedDate;
        deliveryOrder.UpdatedAt = DateTime.UtcNow;

        order.DeliveryOrderIssued = true;
        order.DeliveryOrderId = deliveryOrder.Id;
        order.FulfilledDate = receivedDate;
        order.Status = "fulfilled";
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var doLine in deliveryOrder.Lines)
        {
            var soLine = order.Lines.FirstOrDefault(l => l.Id == doLine.SalesOrderLineId)
                ?? order.Lines.FirstOrDefault(l =>
                    l.ProductId == doLine.ProductId
                    && string.Equals(l.LocationExternalId, doLine.LocationExternalId, StringComparison.OrdinalIgnoreCase));

            if (soLine is not null && soLine.IsCombo && soLine.PromotionId is int promoId)
            {
                await FulfillComboComponentsAsync(order, soLine, promoId, cancellationToken);
                continue;
            }

            var stock = await EnsureStockRowAsync(doLine.ProductId, doLine.LocationExternalId, cancellationToken);
            var qty = Math.Min(doLine.Quantity, stock.OnOrderQty);
            if (soLine is not null)
                qty = Math.Min(qty, soLine.QuantityLocked);
            if (qty <= 0)
                continue;

            stock.OnOrderQty = Math.Max(0, stock.OnOrderQty - qty);
            stock.UpdatedAt = DateTime.UtcNow;
            if (soLine is not null)
            {
                soLine.Status = "fulfilled";
                soLine.QuantityLocked = Math.Max(0, soLine.QuantityLocked - qty);
            }

            var product = await db.Products.AsNoTracking()
                .FirstAsync(p => p.Id == doLine.ProductId, cancellationToken);
            var channel = string.Equals(order.Source, "online_order", StringComparison.OrdinalIgnoreCase)
                ? "online"
                : "offline";

            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = doLine.ProductId,
                EntryType = ProductSaleInventoryService.ChannelToReferenceType(channel),
                Quantity = qty,
                ProductionDate = receivedDate,
                BatchNumber = deliveryOrder.DoNumber,
                UnitPrice = soLine?.Rrp ?? 0,
                LocationIdsJson = System.Text.Json.JsonSerializer.Serialize(new[] { doLine.LocationExternalId }),
                CompanyId = product.CompanyId ?? order.CompanyId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return order;
    }

    public async Task<int> ReleaseExpiredLocksAsync(CancellationToken cancellationToken = default)
    {
        var candidates = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .Where(o => o.Status == "issued"
                && o.LockPeriodDays > 0
                && o.LockExpiryDate != ""
                && o.Source != "online_order"
                && !o.DeliveryOrderIssued)
            .ToListAsync(cancellationToken);

        var companyIds = candidates.Select(o => o.CompanyId).Distinct().ToList();
        var countryByCompany = await db.Companies.AsNoTracking()
            .Where(c => companyIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.CountryCode, cancellationToken);

        var expiredOrders = candidates.Where(order =>
        {
            countryByCompany.TryGetValue(order.CompanyId, out var country);
            var today = OrgClock.TodayLocal(country ?? "MY").ToString("yyyy-MM-dd");
            return string.Compare(order.LockExpiryDate, today, StringComparison.Ordinal) < 0;
        }).ToList();

        var released = 0;
        foreach (var order in expiredOrders)
        {
            foreach (var line in order.Lines.Where(l => l.QuantityLocked > 0 && l.Status == "locked"))
            {
                if (line.IsCombo && line.PromotionId is int promoId)
                {
                    await ReleaseComboComponentsAsync(line, promoId, cancellationToken);
                    released++;
                    continue;
                }

                var stock = await db.ProductB2bLocationStocks
                    .FirstOrDefaultAsync(
                        s => s.ProductId == line.ProductId && s.LocationExternalId == line.LocationExternalId,
                        cancellationToken);
                if (stock is null)
                    continue;

                var qty = Math.Min(line.QuantityLocked, stock.OnOrderQty);
                stock.OnOrderQty = Math.Max(0, stock.OnOrderQty - qty);
                stock.InStock += qty;
                stock.UpdatedAt = DateTime.UtcNow;
                line.QuantityLocked = 0;
                line.Status = "released";
                released++;
            }

            order.Status = "expired";
            order.UpdatedAt = DateTime.UtcNow;
        }

        if (released > 0 || expiredOrders.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        return released;
    }

    async Task LockComboComponentsAsync(B2bSalesOrderLine line, int promotionId, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == promotionId, cancellationToken)
            ?? throw new InvalidOperationException($"Combo promotion not found for line: {line.ProductName}");

        if (!PromotionPricingService.IsCombo(promotion))
            throw new InvalidOperationException($"Promotion {promotion.Name} is not a combo.");

        var components = promotion.Products.Where(p => p.QtyPerCombo is > 0).ToList();
        if (components.Count < 2)
            throw new InvalidOperationException($"Combo {promotion.Name} needs at least two component products.");

        foreach (var component in components)
        {
            var need = component.QtyPerCombo!.Value * line.QuantityOrdered;
            var stock = await EnsureStockRowAsync(component.ProductId, line.LocationExternalId, cancellationToken);
            if (stock.InStock < need)
            {
                throw new InvalidOperationException(
                    $"Insufficient on-hand stock for combo component {component.ProductName} at {line.LocationExternalId} (need {need:0.##}, have {stock.InStock:0.##}).");
            }

            stock.InStock -= need;
            stock.OnOrderQty += need;
            stock.UpdatedAt = DateTime.UtcNow;
        }

        line.QuantityLocked = line.QuantityOrdered;
        line.Status = "locked";
        if (string.IsNullOrWhiteSpace(line.ProductName))
            line.ProductName = promotion.Name;
        if (line.Rrp <= 0 && promotion.ComboPrice is > 0)
            line.Rrp = promotion.ComboPrice.Value;
        if (string.IsNullOrWhiteSpace(line.Uom))
            line.Uom = "combo";
    }

    async Task FulfillComboComponentsAsync(
        B2bSalesOrder order,
        B2bSalesOrderLine line,
        int promotionId,
        CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == promotionId, cancellationToken);
        if (promotion is null) return;

        var packs = line.QuantityLocked;
        var channel = string.Equals(order.Source, "online_order", StringComparison.OrdinalIgnoreCase)
            ? "online"
            : "offline";

        foreach (var component in promotion.Products.Where(p => p.QtyPerCombo is > 0))
        {
            var qty = component.QtyPerCombo!.Value * packs;
            var stock = await EnsureStockRowAsync(component.ProductId, line.LocationExternalId, cancellationToken);
            var clear = Math.Min(qty, stock.OnOrderQty);
            stock.OnOrderQty = Math.Max(0, stock.OnOrderQty - clear);
            stock.UpdatedAt = DateTime.UtcNow;

            var doNumber = await ResolveDoNumberAsync(order, cancellationToken);
            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = component.ProductId,
                EntryType = ProductSaleInventoryService.ChannelToReferenceType(channel),
                Quantity = clear,
                ProductionDate = order.FulfilledDate,
                BatchNumber = doNumber,
                UnitPrice = 0,
                LocationIdsJson = System.Text.Json.JsonSerializer.Serialize(new[] { line.LocationExternalId }),
                CompanyId = order.CompanyId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        line.Status = "fulfilled";
    }

    async Task ReleaseComboComponentsAsync(B2bSalesOrderLine line, int promotionId, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions
            .Include(p => p.Products)
            .FirstOrDefaultAsync(p => p.Id == promotionId, cancellationToken);
        if (promotion is null)
        {
            line.QuantityLocked = 0;
            line.Status = "released";
            return;
        }

        var packs = line.QuantityLocked;
        foreach (var component in promotion.Products.Where(p => p.QtyPerCombo is > 0))
        {
            var qty = component.QtyPerCombo!.Value * packs;
            var stock = await db.ProductB2bLocationStocks
                .FirstOrDefaultAsync(
                    s => s.ProductId == component.ProductId && s.LocationExternalId == line.LocationExternalId,
                    cancellationToken);
            if (stock is null) continue;

            var restore = Math.Min(qty, stock.OnOrderQty);
            stock.OnOrderQty = Math.Max(0, stock.OnOrderQty - restore);
            stock.InStock += restore;
            stock.UpdatedAt = DateTime.UtcNow;
        }

        line.QuantityLocked = 0;
        line.Status = "released";
    }

    async Task<B2bSalesOrder> LoadOrderAsync(int orderId, CancellationToken cancellationToken)
    {
        return await db.B2bSalesOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken)
            ?? throw new InvalidOperationException("Sales order not found.");
    }

    async Task<ProductB2bLocationStock> EnsureStockRowAsync(
        int productId,
        string locationExternalId,
        CancellationToken cancellationToken)
    {
        var row = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == productId && s.LocationExternalId == locationExternalId,
                cancellationToken);
        if (row is not null)
            return row;

        row = new ProductB2bLocationStock
        {
            ProductId = productId,
            LocationExternalId = locationExternalId,
            UpdatedAt = DateTime.UtcNow,
        };
        db.ProductB2bLocationStocks.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return row;
    }

    static string ResolveProductUom(Product product)
    {
        if (!string.IsNullOrWhiteSpace(product.B2bPackageUnit))
            return product.B2bPackageUnit.Trim();
        if (!string.IsNullOrWhiteSpace(product.ParStockUom))
            return product.ParStockUom.Trim();
        if (!string.IsNullOrWhiteSpace(product.YieldUom))
            return product.YieldUom.Trim();
        return "pcs";
    }

    async Task<string> ResolveDoNumberAsync(B2bSalesOrder order, CancellationToken cancellationToken)
    {
        if (order.DeliveryOrderId is int doId)
        {
            var doNumber = await db.DeliveryOrders.AsNoTracking()
                .Where(d => d.Id == doId)
                .Select(d => d.DoNumber)
                .FirstOrDefaultAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(doNumber))
                return doNumber.Trim();
        }

        return order.OrderNumber;
    }
}
