using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Seeds demo B2B sales orders: fulfilled (Sales Data), issued (on-order stock), and expired (released).
/// Idempotent: skips when demo orders already exist.
/// </summary>
public static class B2bSalesOrderSeeder
{
    const string DemoOrderPrefix = "SO-DEMO-";

    sealed record StockCandidate(Product Product, string LocationExternalId, decimal InStock);

    public static async Task EnsureDemoSalesOrdersAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        CancellationToken cancellationToken = default)
    {
        if (await db.B2bSalesOrders.AnyAsync(o => o.OrderNumber.StartsWith(DemoOrderPrefix), cancellationToken))
            return;

        var companyId = await db.Companies.Select(c => c.Id).FirstOrDefaultAsync(cancellationToken);
        if (companyId <= 0)
            return;

        var candidates = await LoadStockCandidatesAsync(db, cancellationToken);
        if (candidates.Count < 2)
        {
            await StockCardDummySeeder.EnsureAsync(db, companyId);
            candidates = await LoadStockCandidatesAsync(db, cancellationToken);
        }

        if (candidates.Count < 2)
            return;

        var metro = await db.B2bCustomers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.ExternalId == "B2BC-001" && c.CompanyId == companyId, cancellationToken);
        var greenLeaf = await db.B2bCustomers.AsNoTracking()
            .FirstOrDefaultAsync(c => c.ExternalId == "B2BC-002" && c.CompanyId == companyId, cancellationToken);
        if (metro is null || greenLeaf is null)
            return;

        var b2bProduct = candidates.FirstOrDefault(c => !c.Product.IsSubProduct) ?? candidates[0];
        var secondProduct = candidates.FirstOrDefault(c => !c.Product.IsSubProduct && c.Product.Id != b2bProduct.Product.Id)
            ?? candidates[1];
        var subProduct = candidates.FirstOrDefault(c => c.Product.IsSubProduct);

        var sequence = 1;
        await TryCreateIssueFulfillAsync(
            db,
            salesOrderService,
            companyId,
            $"{DemoOrderPrefix}{sequence++:D3}",
            metro.ExternalId,
            metro.CompanyName,
            "sales_order",
            b2bProduct,
            qty: 12,
            lockDays: 14,
            cancellationToken);

        await TryCreateIssueFulfillAsync(
            db,
            salesOrderService,
            companyId,
            $"{DemoOrderPrefix}{sequence++:D3}",
            greenLeaf.ExternalId,
            greenLeaf.CompanyName,
            "online_order",
            secondProduct,
            qty: 8,
            lockDays: 10,
            cancellationToken);

        if (subProduct is not null)
        {
            await TryCreateIssueFulfillAsync(
                db,
                salesOrderService,
                companyId,
                $"{DemoOrderPrefix}{sequence++:D3}",
                metro.ExternalId,
                metro.CompanyName,
                "sales_order",
                subProduct,
                qty: 6,
                lockDays: 7,
                cancellationToken);
        }

        var issuedCandidate = await ReloadCandidateAsync(db, b2bProduct.Product.Id, b2bProduct.LocationExternalId, cancellationToken)
            ?? b2bProduct;
        await TryCreateIssuedOnlyAsync(
            db,
            salesOrderService,
            companyId,
            $"{DemoOrderPrefix}{sequence++:D3}",
            metro.ExternalId,
            metro.CompanyName,
            issuedCandidate,
            qty: 5,
            lockDays: 14,
            cancellationToken);

        var expiredCandidate = await ReloadCandidateAsync(db, secondProduct.Product.Id, secondProduct.LocationExternalId, cancellationToken)
            ?? secondProduct;
        await TryCreateExpiredOrderAsync(
            db,
            salesOrderService,
            companyId,
            $"{DemoOrderPrefix}{sequence:D3}",
            greenLeaf.ExternalId,
            greenLeaf.CompanyName,
            expiredCandidate,
            qty: 4,
            cancellationToken);
    }

    static async Task<StockCandidate?> ReloadCandidateAsync(
        BisyncDbContext db,
        int productId,
        string locationExternalId,
        CancellationToken cancellationToken)
    {
        var row = await (
            from stock in db.ProductB2bLocationStocks.AsNoTracking()
            join product in db.Products.AsNoTracking() on stock.ProductId equals product.Id
            where product.Id == productId
                && stock.LocationExternalId == locationExternalId
                && product.Active
                && product.B2bEnabled
                && stock.InStock > 0
            select new StockCandidate(product, stock.LocationExternalId, stock.InStock))
            .FirstOrDefaultAsync(cancellationToken);

        return row;
    }

    static async Task TryCreateIssueFulfillAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        string source,
        StockCandidate candidate,
        decimal qty,
        int lockDays,
        CancellationToken cancellationToken)
    {
        try
        {
            var available = await CurrentInStockAsync(db, candidate.Product.Id, candidate.LocationExternalId, cancellationToken);
            var orderQty = Math.Min(qty, available);
            if (orderQty <= 0)
                return;

            await CreateIssueFulfillAsync(
                db,
                salesOrderService,
                companyId,
                orderNumber,
                customerExternalId,
                customerName,
                source,
                candidate,
                orderQty,
                lockDays,
                cancellationToken);
        }
        catch (InvalidOperationException)
        {
        }
    }

    static async Task TryCreateIssuedOnlyAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        StockCandidate candidate,
        decimal qty,
        int lockDays,
        CancellationToken cancellationToken)
    {
        try
        {
            var available = await CurrentInStockAsync(db, candidate.Product.Id, candidate.LocationExternalId, cancellationToken);
            var orderQty = Math.Min(qty, available);
            if (orderQty <= 0)
                return;

            await CreateIssuedOnlyAsync(
                db,
                salesOrderService,
                companyId,
                orderNumber,
                customerExternalId,
                customerName,
                candidate,
                orderQty,
                lockDays,
                cancellationToken);
        }
        catch (InvalidOperationException)
        {
        }
    }

    static async Task TryCreateExpiredOrderAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        StockCandidate candidate,
        decimal qty,
        CancellationToken cancellationToken)
    {
        try
        {
            var available = await CurrentInStockAsync(db, candidate.Product.Id, candidate.LocationExternalId, cancellationToken);
            var orderQty = Math.Min(qty, available);
            if (orderQty <= 0)
                return;

            await CreateExpiredOrderAsync(
                db,
                salesOrderService,
                companyId,
                orderNumber,
                customerExternalId,
                customerName,
                candidate,
                orderQty,
                cancellationToken);
        }
        catch (InvalidOperationException)
        {
        }
    }

    static async Task<decimal> CurrentInStockAsync(
        BisyncDbContext db,
        int productId,
        string locationExternalId,
        CancellationToken cancellationToken)
    {
        var stock = await db.ProductB2bLocationStocks.AsNoTracking()
            .FirstOrDefaultAsync(
                s => s.ProductId == productId && s.LocationExternalId == locationExternalId,
                cancellationToken);
        return stock?.InStock ?? 0;
    }

    static async Task<List<StockCandidate>> LoadStockCandidatesAsync(
        BisyncDbContext db,
        CancellationToken cancellationToken)
    {
        var rows = await (
            from stock in db.ProductB2bLocationStocks.AsNoTracking()
            join product in db.Products.AsNoTracking() on stock.ProductId equals product.Id
            where product.Active
                && product.B2bEnabled
                && stock.InStock >= 8
            orderby product.Name
            select new StockCandidate(product, stock.LocationExternalId, stock.InStock))
            .Take(12)
            .ToListAsync(cancellationToken);

        if (rows.Count >= 2)
            return rows;

        return await (
            from stock in db.ProductB2bLocationStocks.AsNoTracking()
            join product in db.Products.AsNoTracking() on stock.ProductId equals product.Id
            where product.Active && product.B2bEnabled && stock.InStock >= 4
            orderby stock.InStock descending
            select new StockCandidate(product, stock.LocationExternalId, stock.InStock))
            .Take(6)
            .ToListAsync(cancellationToken);
    }

    static async Task CreateIssueFulfillAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        string source,
        StockCandidate candidate,
        decimal qty,
        int lockDays,
        CancellationToken cancellationToken)
    {
        if (qty <= 0)
            return;

        var order = await CreateDraftOrderAsync(
            db,
            companyId,
            orderNumber,
            customerExternalId,
            customerName,
            source,
            candidate,
            qty,
            lockDays,
            cancellationToken);

        await salesOrderService.IssueAsync(order.Id, cancellationToken);
        await salesOrderService.FulfillAsync(order.Id, deliveryOrderIssued: true, invoiceIssued: true, cancellationToken);
    }

    static async Task CreateIssuedOnlyAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        StockCandidate candidate,
        decimal qty,
        int lockDays,
        CancellationToken cancellationToken)
    {
        if (qty <= 0)
            return;

        var order = await CreateDraftOrderAsync(
            db,
            companyId,
            orderNumber,
            customerExternalId,
            customerName,
            "sales_order",
            candidate,
            qty,
            lockDays,
            cancellationToken);

        await salesOrderService.IssueAsync(order.Id, cancellationToken);
    }

    static async Task CreateExpiredOrderAsync(
        BisyncDbContext db,
        B2bSalesOrderService salesOrderService,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        StockCandidate candidate,
        decimal qty,
        CancellationToken cancellationToken)
    {
        if (qty <= 0)
            return;

        var order = await CreateDraftOrderAsync(
            db,
            companyId,
            orderNumber,
            customerExternalId,
            customerName,
            "sales_order",
            candidate,
            qty,
            lockDays: 5,
            cancellationToken);

        await salesOrderService.IssueAsync(order.Id, cancellationToken);

        var issued = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .FirstAsync(o => o.Id == order.Id, cancellationToken);

        var expiredDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);
        issued.LockExpiryDate = expiredDate.ToString("yyyy-MM-dd");
        issued.IssuedDate = expiredDate.AddDays(-5).ToString("yyyy-MM-dd");
        issued.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        await salesOrderService.ReleaseExpiredLocksAsync(cancellationToken);
    }

    static async Task<B2bSalesOrder> CreateDraftOrderAsync(
        BisyncDbContext db,
        int companyId,
        string orderNumber,
        string customerExternalId,
        string customerName,
        string source,
        StockCandidate candidate,
        decimal qty,
        int lockDays,
        CancellationToken cancellationToken)
    {
        var product = candidate.Product;
        var order = new B2bSalesOrder
        {
            CompanyId = companyId,
            OrderNumber = orderNumber,
            CustomerExternalId = customerExternalId,
            CustomerName = customerName,
            Source = source,
            LockPeriodDays = lockDays,
            Status = "draft",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Lines =
            [
                new B2bSalesOrderLine
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    LocationExternalId = candidate.LocationExternalId,
                    QuantityOrdered = qty,
                    Uom = ResolveUom(product),
                    Rrp = product.Rrp,
                    Status = "open",
                },
            ],
        };

        db.B2bSalesOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        return order;
    }

    static string ResolveUom(Product product)
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
