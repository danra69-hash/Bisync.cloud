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
            line.ProductName = product.Name;
            if (line.Rrp <= 0)
                line.Rrp = product.Rrp;
            if (string.IsNullOrWhiteSpace(line.Uom))
                line.Uom = ResolveProductUom(product);
        }

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
        if (!string.Equals(order.Status, "issued", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Only issued sales orders can be fulfilled.");

        order.DeliveryOrderIssued = true;
        order.InvoiceIssued = true;
        order.FulfilledDate = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
        order.Status = "fulfilled";
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var line in order.Lines.Where(l => l.QuantityLocked > 0))
        {
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

            if (product.IsSubProduct)
            {
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
            else
            {
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
