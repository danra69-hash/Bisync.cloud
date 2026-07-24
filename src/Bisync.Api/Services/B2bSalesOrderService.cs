using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class B2bSalesOrderService(BisyncDbContext db)
{
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

        var issuedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        order.IssuedDate = issuedDate.ToString("yyyy-MM-dd");
        order.LockExpiryDate = issuedDate.AddDays(order.LockPeriodDays).ToString("yyyy-MM-dd");
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
        order.FulfilledDate = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
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

            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = product.Id,
                EntryType = ProductSaleInventoryService.ChannelToReferenceType(channel),
                Quantity = qty,
                ProductionDate = order.FulfilledDate,
                UnitPrice = line.Rrp,
                LocationIdsJson = System.Text.Json.JsonSerializer.Serialize(new[] { line.LocationExternalId }),
                CompanyId = product.CompanyId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return order;
    }

    public async Task<int> ReleaseExpiredLocksAsync(CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
        var expiredOrders = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .Where(o => o.Status == "issued"
                && o.LockExpiryDate != ""
                && string.Compare(o.LockExpiryDate, today) < 0
                && (!o.DeliveryOrderIssued || !o.InvoiceIssued))
            .ToListAsync(cancellationToken);

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

            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = component.ProductId,
                EntryType = ProductSaleInventoryService.ChannelToReferenceType(channel),
                Quantity = clear,
                ProductionDate = order.FulfilledDate,
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
}
