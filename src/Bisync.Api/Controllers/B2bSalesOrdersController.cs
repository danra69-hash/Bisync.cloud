using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/b2b-sales-orders")]
public class B2bSalesOrdersController(
    BisyncDbContext db,
    B2bSalesOrderService salesOrderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId, CancellationToken cancellationToken)
    {
        IQueryable<B2bSalesOrder> query = db.B2bSalesOrders.AsNoTracking().Include(o => o.Lines);
        if (companyId is int id)
            query = query.Where(o => o.CompanyId == id);

        var orders = await query
            .OrderByDescending(o => o.UpdatedAt)
            .ThenByDescending(o => o.Id)
            .ToListAsync(cancellationToken);

        return Ok(orders.Select(MapOrder));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken cancellationToken)
    {
        var order = await db.B2bSalesOrders.AsNoTracking()
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (order is null)
            return NotFound(new { message = "Sales order not found." });
        return Ok(MapOrder(order));
    }

    [HttpGet("share/{token}")]
    public async Task<ActionResult<object>> GetByShareToken(string token, CancellationToken cancellationToken)
    {
        var normalized = (token ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Length != 32)
            return NotFound(new { message = "Sales order not found." });

        var order = await db.B2bSalesOrders.AsNoTracking()
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ShareToken == normalized, cancellationToken);
        if (order is null)
            return NotFound(new { message = "Sales order not found." });

        var company = await db.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == order.CompanyId, cancellationToken);
        var customer = await db.B2bCustomers.AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.CompanyId == order.CompanyId && c.ExternalId == order.CustomerExternalId,
                cancellationToken);

        return Ok(MapSharedOrder(order, company, customer));
    }

    [HttpPost("share/{token}/accept")]
    public async Task<ActionResult<object>> AcceptByShareToken(
        string token,
        [FromBody] AcceptB2bSalesOrderShareRequest? request,
        CancellationToken cancellationToken)
    {
        var normalized = (token ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Length != 32)
            return NotFound(new { message = "Sales order not found." });

        var order = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.ShareToken == normalized, cancellationToken);
        if (order is null)
            return NotFound(new { message = "Sales order not found." });

        if (order.CustomerAcceptedAt is not null)
        {
            var companyDone = await db.Companies.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == order.CompanyId, cancellationToken);
            var customerDone = await db.B2bCustomers.AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.CompanyId == order.CompanyId && c.ExternalId == order.CustomerExternalId,
                    cancellationToken);
            return Ok(MapSharedOrder(order, companyDone, customerDone));
        }

        if (!CanCustomerAccept(order))
            return Conflict(new { message = "This sales order can no longer be accepted." });

        var acceptedBy = request?.AcceptedBy?.Trim();
        if (string.IsNullOrWhiteSpace(acceptedBy))
            acceptedBy = order.CustomerName;

        order.CustomerAcceptedAt = DateTime.UtcNow;
        order.CustomerAcceptedBy = acceptedBy;
        order.Status = "confirmed";
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var company = await db.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == order.CompanyId, cancellationToken);
        var customer = await db.B2bCustomers.AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.CompanyId == order.CompanyId && c.ExternalId == order.CustomerExternalId,
                cancellationToken);
        return Ok(MapSharedOrder(order, company, customer));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateB2bSalesOrderRequest request, CancellationToken cancellationToken)
    {
        if (request.Lines.Count == 0)
            return BadRequest(new { message = "Add at least one order line." });

        var source = B2bSalesOrderService.ValidSources.Contains(request.Source)
            ? request.Source.Trim().ToLowerInvariant()
            : "sales_order";

        var customer = await db.B2bCustomers.AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.ExternalId == request.CustomerExternalId.Trim()
                    && c.CompanyId == request.CompanyId,
                cancellationToken);

        var productIds = request.Lines
            .Where(l => l.PromotionId is null or <= 0)
            .Select(l => l.ProductId)
            .Where(id => id > 0)
            .Distinct()
            .ToList();
        var products = await db.Products.AsNoTracking()
            .Include(p => p.Aliases)
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(cancellationToken);
        var productById = products.ToDictionary(p => p.Id);

        var comboPromotionIds = request.Lines
            .Where(l => l.PromotionId is > 0)
            .Select(l => l.PromotionId!.Value)
            .Distinct()
            .ToList();
        var comboPromotions = comboPromotionIds.Count == 0
            ? new Dictionary<int, Promotion>()
            : await db.Promotions
                .Include(p => p.Products)
                .Where(p => comboPromotionIds.Contains(p.Id) && p.CompanyId == request.CompanyId)
                .ToDictionaryAsync(p => p.Id, cancellationToken);

        var orderNumber = await GenerateOrderNumberAsync(request.CompanyId, cancellationToken);
        var lockPeriodDays = request.LockPeriodDays > 0
            ? request.LockPeriodDays
            : ResolveDefaultLockPeriodDays(productById.Values);
        var createdDate = DateOnly.FromDateTime(DateTime.UtcNow);

        var baseRrpByProduct = new Dictionary<int, decimal>();
        foreach (var line in request.Lines.Where(l => l.PromotionId is null or <= 0))
        {
            if (baseRrpByProduct.ContainsKey(line.ProductId)) continue;
            productById.TryGetValue(line.ProductId, out var product);
            var pricing = product is null
                ? new B2bProductPricing.ResolvedB2bPricing(line.Rrp ?? 0, line.Uom?.Trim() ?? string.Empty, line.ProductAliasId, null)
                : B2bProductPricing.ResolveForCustomerProduct(product, customer, line.ProductAliasId);
            baseRrpByProduct[line.ProductId] = pricing.Rrp > 0 ? pricing.Rrp : (line.Rrp ?? 0);
        }

        var promoHits = await PromotionPricingService.ResolvePromoRrpAsync(
            db,
            request.CompanyId,
            baseRrpByProduct,
            createdDate,
            cancellationToken);
        var promoQtyConsume = new Dictionary<int, decimal>();
        var comboPackConsume = new Dictionary<int, decimal>();
        var orderLines = new List<B2bSalesOrderLine>();

        foreach (var line in request.Lines)
        {
            if (line.PromotionId is int comboPromoId and > 0)
            {
                if (!comboPromotions.TryGetValue(comboPromoId, out var combo)
                    || !PromotionPricingService.IsCombo(combo)
                    || !PromotionPricingService.IsEffectivelyActive(combo, createdDate))
                    return BadRequest(new { message = "Selected combo promotion is not available." });

                var components = combo.Products.Where(p => p.QtyPerCombo is > 0).ToList();
                if (components.Count < 2)
                    return BadRequest(new { message = $"Combo {combo.Name} is incomplete." });

                if (combo.DurationMode == PromotionPricingService.DurationByQty
                    && combo.ComboPackRemaining is decimal remaining
                    && remaining < line.QuantityOrdered)
                {
                    return BadRequest(new { message = $"Only {remaining:0.##} packs remaining for combo {combo.Name}." });
                }

                var anchor = components[0];
                var comboRrp = line.Rrp is > 0 ? line.Rrp.Value : (combo.ComboPrice ?? 0);
                orderLines.Add(new B2bSalesOrderLine
                {
                    ProductId = anchor.ProductId,
                    ProductAliasId = null,
                    ProductName = combo.Name,
                    LocationExternalId = line.LocationExternalId.Trim(),
                    QuantityOrdered = line.QuantityOrdered,
                    Uom = "combo",
                    Rrp = comboRrp,
                    PromotionId = combo.Id,
                    IsCombo = true,
                    Status = "open",
                });

                if (combo.ComboPackRemaining is not null)
                {
                    comboPackConsume.TryGetValue(combo.Id, out var prior);
                    comboPackConsume[combo.Id] = prior + line.QuantityOrdered;
                }

                continue;
            }

            productById.TryGetValue(line.ProductId, out var product);
            var pricing = product is null
                ? new B2bProductPricing.ResolvedB2bPricing(line.Rrp ?? 0, line.Uom?.Trim() ?? string.Empty, line.ProductAliasId, null)
                : B2bProductPricing.ResolveForCustomerProduct(product, customer, line.ProductAliasId);

            var rrp = line.Rrp is > 0 ? line.Rrp.Value : pricing.Rrp;
            if (promoHits.TryGetValue(line.ProductId, out var promo))
            {
                rrp = promo.PromoRrp;
                if (promo.RemainingQty is not null)
                {
                    promoQtyConsume.TryGetValue(promo.PromotionProductId, out var prior);
                    promoQtyConsume[promo.PromotionProductId] = prior + line.QuantityOrdered;
                }
            }

            var uom = !string.IsNullOrWhiteSpace(line.Uom) ? line.Uom.Trim() : pricing.Uom;
            var aliasId = line.ProductAliasId ?? pricing.ProductAliasId;
            var productName = product?.Name ?? string.Empty;
            if (aliasId is int id && product is not null)
            {
                var alias = product.Aliases.FirstOrDefault(a => a.Id == id);
                if (alias is not null && !string.IsNullOrWhiteSpace(alias.Name))
                    productName = alias.Name;
            }

            orderLines.Add(new B2bSalesOrderLine
            {
                ProductId = line.ProductId,
                ProductAliasId = aliasId,
                ProductName = productName,
                LocationExternalId = line.LocationExternalId.Trim(),
                QuantityOrdered = line.QuantityOrdered,
                Uom = uom,
                Rrp = rrp,
                Status = "open",
            });
        }

        var order = new B2bSalesOrder
        {
            CompanyId = request.CompanyId,
            OrderNumber = orderNumber,
            CustomerExternalId = request.CustomerExternalId.Trim(),
            CustomerName = request.CustomerName.Trim(),
            Source = source,
            LockPeriodDays = lockPeriodDays,
            LockExpiryDate = createdDate.AddDays(lockPeriodDays).ToString("yyyy-MM-dd"),
            Status = "draft",
            ShareToken = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Lines = orderLines,
        };

        db.B2bSalesOrders.Add(order);
        await PromotionPricingService.ConsumePromoQtyAsync(db, promoQtyConsume, cancellationToken);
        await PromotionPricingService.ConsumeComboPacksAsync(db, comboPackConsume, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapOrder(order));
    }

    [HttpPost("{id:int}/issue")]
    public async Task<ActionResult<object>> Issue(int id, CancellationToken cancellationToken)
    {
        try
        {
            var order = await salesOrderService.IssueAsync(id, cancellationToken);
            return Ok(MapOrder(order));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/ensure-share-token")]
    public async Task<ActionResult<object>> EnsureShareToken(int id, CancellationToken cancellationToken)
    {
        var order = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
        if (order is null)
            return NotFound(new { message = "Sales order not found." });

        if (string.IsNullOrWhiteSpace(order.ShareToken))
        {
            order.ShareToken = Guid.NewGuid().ToString("N");
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Ok(MapOrder(order));
    }

    [HttpPost("{orderId:int}/lines/{lineId:int}/ready-to-ship")]
    public async Task<ActionResult<object>> MarkLineReadyToShip(int orderId, int lineId, CancellationToken cancellationToken)
    {
        var order = await db.B2bSalesOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);
        if (order is null)
            return NotFound(new { message = "Sales order not found." });

        if (!string.Equals(order.Status, "confirmed", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only confirmed sales orders can be marked ready to ship." });

        var line = order.Lines.FirstOrDefault(l => l.Id == lineId);
        if (line is null)
            return NotFound(new { message = "Sales order line not found." });

        if (string.Equals(line.Status, "ready_to_ship", StringComparison.OrdinalIgnoreCase)
            || string.Equals(line.Status, "fulfilled", StringComparison.OrdinalIgnoreCase))
            return Ok(MapOrder(order));

        line.Status = "ready_to_ship";
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapOrder(order));
    }

    [HttpPost("{id:int}/fulfill")]
    public async Task<ActionResult<object>> Fulfill(int id, [FromBody] FulfillB2bSalesOrderRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var order = await salesOrderService.FulfillAsync(
                id,
                request.DeliveryOrderIssued,
                request.InvoiceIssued,
                cancellationToken);
            return Ok(MapOrder(order));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("release-expired-locks")]
    public async Task<ActionResult<object>> ReleaseExpiredLocks(CancellationToken cancellationToken)
    {
        var released = await salesOrderService.ReleaseExpiredLocksAsync(cancellationToken);
        return Ok(new { released });
    }

    async Task<string> GenerateOrderNumberAsync(int companyId, CancellationToken cancellationToken)
    {
        var count = await db.B2bSalesOrders.CountAsync(o => o.CompanyId == companyId, cancellationToken);
        return $"SO-{companyId:D3}-{count + 1:D5}";
    }

    static int ResolveDefaultLockPeriodDays(IEnumerable<Product> products)
    {
        var days = products
            .Where(p => p.OrderLockPeriodDays > 0)
            .Select(p => p.OrderLockPeriodDays)
            .DefaultIfEmpty(7)
            .Max();
        return Math.Clamp(days, 1, 365);
    }

    static object MapOrder(B2bSalesOrder order) => new
    {
        id = order.Id,
        companyId = order.CompanyId,
        orderNumber = order.OrderNumber,
        customerExternalId = order.CustomerExternalId,
        customerName = order.CustomerName,
        source = order.Source,
        sourcePurchaseOrderId = order.SourcePurchaseOrderId,
        status = order.Status,
        lockPeriodDays = order.LockPeriodDays,
        issuedDate = order.IssuedDate,
        lockExpiryDate = order.LockExpiryDate,
        deliveryOrderIssued = order.DeliveryOrderIssued,
        invoiceIssued = order.InvoiceIssued,
        fulfilledDate = order.FulfilledDate,
        shareToken = order.ShareToken,
        customerAcceptedAt = order.CustomerAcceptedAt,
        customerAcceptedBy = order.CustomerAcceptedBy,
        createdAt = order.CreatedAt,
        updatedAt = order.UpdatedAt,
        lines = order.Lines.Select(line => new
        {
            id = line.Id,
            productId = line.ProductId,
            productAliasId = line.ProductAliasId,
            productName = line.ProductName,
            locationExternalId = line.LocationExternalId,
            quantityOrdered = line.QuantityOrdered,
            quantityLocked = line.QuantityLocked,
            uom = line.Uom,
            rrp = line.Rrp,
            promotionId = line.PromotionId,
            isCombo = line.IsCombo,
            status = line.Status,
        }),
    };

    static bool CanCustomerAccept(B2bSalesOrder order)
    {
        if (order.CustomerAcceptedAt is not null) return false;
        if (string.IsNullOrWhiteSpace(order.ShareToken)) return false;
        return string.Equals(order.Status, "issued", StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, "draft", StringComparison.OrdinalIgnoreCase);
    }

    static object MapSharedOrder(B2bSalesOrder order, Company? company, B2bCustomer? customer)
    {
        var mapped = MapOrder(order);
        return new
        {
            order = mapped,
            canAccept = CanCustomerAccept(order),
            customerAcceptedAt = order.CustomerAcceptedAt,
            customerAcceptedBy = order.CustomerAcceptedBy,
            company = company is null ? null : new
            {
                id = company.Id,
                name = company.Name,
                brn = company.Brn,
                gstTin = company.GstTin,
                countryCode = company.CountryCode,
                addressLine1 = company.AddressLine1,
                addressLine2 = company.AddressLine2,
                city = company.City,
                stateProvince = company.StateProvince,
                postcode = company.Postcode,
                phone = company.Phone,
                email = company.Email,
            },
            customer = customer is null ? null : new
            {
                companyName = customer.CompanyName,
                brn = customer.Brn,
                address = customer.Address,
                city = customer.City,
                state = customer.State,
                postcode = customer.Postcode,
                phone = customer.Phone,
                email = customer.Email,
                contactsJson = customer.ContactsJson,
            },
        };
    }
}

public class AcceptB2bSalesOrderShareRequest
{
    public string? AcceptedBy { get; set; }
}
