using System.Text.Json;
using System.Text.RegularExpressions;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-prepaid")]
public class PosPrepaidController(
    BisyncDbContext db,
    ProductSaleInventoryService productSaleInventory) : ControllerBase
{
    [HttpGet("purchases")]
    public async Task<ActionResult<IEnumerable<object>>> ListPurchases(
        [FromQuery] int companyId,
        [FromQuery] string? mobile,
        [FromQuery] string? status,
        [FromQuery] string? locationExternalId,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        await RefreshExpiredPurchasesAsync(companyId, cancellationToken);

        var q = db.PosPrepaidPurchases.AsNoTracking()
            .Where(p => p.CompanyId == companyId);

        if (!string.IsNullOrWhiteSpace(mobile))
        {
            var needle = NormalizeMobile(mobile);
            q = q.Where(p => p.CustomerMobile == needle
                || p.CustomerMobile.Replace(" ", "") == needle.Replace(" ", ""));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusNeedle = status.Trim().ToLowerInvariant();
            q = q.Where(p => p.Status.ToLower() == statusNeedle);
        }

        if (!string.IsNullOrWhiteSpace(locationExternalId))
        {
            var loc = locationExternalId.Trim();
            q = q.Where(p => p.LocationExternalId == loc);
        }

        var purchases = await q
            .OrderByDescending(p => p.PurchasedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync(cancellationToken);

        var promoIds = purchases.Select(p => p.PosPromotionId).Distinct().ToList();
        var promoNames = await db.PosPromotions.AsNoTracking()
            .Where(p => promoIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Name, cancellationToken);

        return Ok(purchases.Select(p => MapPurchase(
            p,
            promoNames.GetValueOrDefault(p.PosPromotionId, string.Empty),
            ledger: null)));
    }

    [HttpGet("purchases/{id:int}")]
    public async Task<ActionResult<object>> GetPurchase(
        int id,
        [FromQuery] int? companyId,
        CancellationToken cancellationToken)
    {
        var purchase = await db.PosPrepaidPurchases
            .Include(p => p.LedgerEntries)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (purchase is null)
            return NotFound(new { message = "Prepaid purchase not found." });
        if (companyId is int cid && cid > 0 && purchase.CompanyId != cid)
            return NotFound(new { message = "Prepaid purchase not found." });

        await MaybeExpirePurchaseAsync(purchase, cancellationToken);

        var promoName = await db.PosPromotions.AsNoTracking()
            .Where(p => p.Id == purchase.PosPromotionId)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

        return Ok(MapPurchase(purchase, promoName, purchase.LedgerEntries));
    }

    [HttpPost("purchase")]
    public async Task<ActionResult<object>> Purchase(
        [FromBody] CreatePosPrepaidPurchaseRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "Company is required." });
        if (string.IsNullOrWhiteSpace(request.LocationExternalId))
            return BadRequest(new { message = "Location is required." });
        if (request.PromotionId <= 0)
            return BadRequest(new { message = "Promotion is required." });
        if (request.ProductId <= 0)
            return BadRequest(new { message = "Product is required." });

        var customerName = (request.CustomerName ?? string.Empty).Trim();
        var customerMobile = NormalizeMobile(request.CustomerMobile);
        if (string.IsNullOrWhiteSpace(customerMobile))
            return BadRequest(new { message = "Customer mobile is required." });
        if (string.IsNullOrWhiteSpace(customerName))
            customerName = customerMobile;

        var locationExternalId = request.LocationExternalId.Trim();
        var locationExists = await db.Locations.AsNoTracking()
            .AnyAsync(
                l => l.CompanyId == request.CompanyId && l.ExternalId == locationExternalId,
                cancellationToken);
        if (!locationExists)
            return BadRequest(new { message = "Location was not found for this company." });

        var promotion = await db.PosPromotions
            .Include(p => p.Products)
            .FirstOrDefaultAsync(
                p => p.Id == request.PromotionId && p.CompanyId == request.CompanyId,
                cancellationToken);
        if (promotion is null)
            return NotFound(new { message = "POS promotion not found." });
        if (!promotion.Active)
            return BadRequest(new { message = "Promotion is not active." });
        if (!string.Equals(promotion.PromotionKind, "prepaid", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Promotion is not a prepaid package." });

        var (_, _, localNow) = await PosPromotionPricingService.ResolveLocalNowAsync(
            db, request.CompanyId, locationExternalId, cancellationToken);
        var statusLabel = PosPromotionPricingService.ResolveStatusLabel(promotion, localNow);
        if (!string.Equals(statusLabel, "Active", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = $"Promotion is {statusLabel.ToLowerInvariant()}, not available for purchase." });

        var promoProduct = promotion.Products.FirstOrDefault(p => p.ProductId == request.ProductId);
        if (promoProduct is null)
            return BadRequest(new { message = "Product is not part of this prepaid promotion." });

        if (promotion.PackageQty <= 0)
            return BadRequest(new { message = "Promotion package quantity is invalid." });

        var posCustomer = await UpsertPosCustomerByPhoneAsync(
            request.CompanyId,
            customerName,
            customerMobile,
            cancellationToken);

        var now = DateTime.UtcNow;
        var expiresAt = ComputeExpiresAt(now, promotion.ValidityPeriodValue, promotion.ValidityPeriodUnit);
        var purchase = new PosPrepaidPurchase
        {
            CompanyId = request.CompanyId,
            LocationExternalId = locationExternalId,
            PosPromotionId = promotion.Id,
            ProductId = promoProduct.ProductId,
            ProductName = promoProduct.ProductName,
            PosCustomerId = posCustomer?.Id,
            CustomerName = customerName,
            CustomerMobile = customerMobile,
            PurchasedAt = now,
            ExpiresAt = expiresAt,
            PackageQty = promotion.PackageQty,
            PackageUom = promotion.PackageUom,
            PackageRpp = promotion.PackageRpp,
            BalanceRemaining = promotion.PackageQty,
            Status = "active",
            CheckNumber = request.CheckNumber,
            CreatedAt = now,
            UpdatedAt = now,
            LedgerEntries =
            [
                new PosPrepaidLedger
                {
                    EntryType = "purchase",
                    QtyDelta = promotion.PackageQty,
                    UnitCode = promotion.PackageUom,
                    UnitLabel = promotion.PackageUom,
                    QtyPerUnit = 1m,
                    ProductId = promoProduct.ProductId,
                    LocationExternalId = locationExternalId,
                    CheckNumber = request.CheckNumber,
                    Note = $"Prepaid purchase — {promotion.Name}",
                    CreatedAt = now,
                    CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
                },
            ],
        };

        db.PosPrepaidPurchases.Add(purchase);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(MapPurchase(purchase, promotion.Name, purchase.LedgerEntries));
    }

    [HttpPost("deplete")]
    public async Task<ActionResult<object>> Deplete(
        [FromBody] DepletePosPrepaidRequest request,
        CancellationToken cancellationToken)
    {
        if (request.PurchaseId <= 0)
            return BadRequest(new { message = "purchaseId is required." });
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "companyId is required." });
        if (string.IsNullOrWhiteSpace(request.LocationExternalId))
            return BadRequest(new { message = "Location is required." });
        if (request.Qty <= 0)
            return BadRequest(new { message = "Quantity must be greater than zero." });

        var purchase = await db.PosPrepaidPurchases
            .Include(p => p.LedgerEntries)
            .FirstOrDefaultAsync(
                p => p.Id == request.PurchaseId && p.CompanyId == request.CompanyId,
                cancellationToken);
        if (purchase is null)
            return NotFound(new { message = "Prepaid purchase not found." });

        await MaybeExpirePurchaseAsync(purchase, cancellationToken);
        if (string.Equals(purchase.Status, "expired", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Prepaid package has expired." });
        if (string.Equals(purchase.Status, "depleted", StringComparison.OrdinalIgnoreCase)
            || purchase.BalanceRemaining <= 0)
            return BadRequest(new { message = "Prepaid package has no remaining balance." });

        var promotion = await db.PosPromotions.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == purchase.PosPromotionId, cancellationToken);
        if (promotion is null)
            return BadRequest(new { message = "Linked promotion was not found." });

        var locationExternalId = request.LocationExternalId.Trim();
        var depletionMethod = string.Equals(
            promotion.DepletionMethod,
            "weight",
            StringComparison.OrdinalIgnoreCase)
            ? "weight"
            : "salesUnit";

        decimal qtyPerUnit = 1m;
        var unitCode = (request.UnitCode ?? string.Empty).Trim();
        var unitLabel = unitCode;

        if (depletionMethod == "salesUnit")
        {
            var units = ReadDepletionUnits(promotion.DepletionUnitsJson);
            DepletionUnit? matched = null;
            if (!string.IsNullOrEmpty(unitCode))
                matched = units.FirstOrDefault(u =>
                    string.Equals(u.Code, unitCode, StringComparison.OrdinalIgnoreCase));
            matched ??= units.FirstOrDefault();

            if (matched is not null)
            {
                unitCode = matched.Code;
                unitLabel = string.IsNullOrWhiteSpace(matched.Label) ? matched.Code : matched.Label;
                qtyPerUnit = matched.QtyPerUnit > 0 ? matched.QtyPerUnit : 1m;
            }
            else if (string.IsNullOrEmpty(unitCode))
            {
                unitCode = promotion.PackageUom;
                unitLabel = promotion.PackageUom;
                qtyPerUnit = 1m;
            }
        }
        else
        {
            // weight: qty is consumed as-is in package UOM
            if (string.IsNullOrEmpty(unitCode))
                unitCode = promotion.PackageUom;
            unitLabel = unitCode;
            qtyPerUnit = 1m;
        }

        var depleteQty = depletionMethod == "salesUnit"
            ? request.Qty * qtyPerUnit
            : request.Qty;

        depleteQty = Math.Round(depleteQty, 4, MidpointRounding.AwayFromZero);
        if (depleteQty <= 0)
            return BadRequest(new { message = "Depletion quantity must be greater than zero." });
        if (depleteQty > purchase.BalanceRemaining)
            return BadRequest(new
            {
                message = $"Insufficient balance. Remaining {purchase.BalanceRemaining} {purchase.PackageUom}.",
            });

        var inventoryProductId = request.ProductId is > 0
            ? request.ProductId.Value
            : purchase.ProductId;

        var now = DateTime.UtcNow;
        var unitRpp = purchase.PackageQty > 0
            ? Math.Round(purchase.PackageRpp / purchase.PackageQty, 4, MidpointRounding.AwayFromZero)
            : 0m;
        var lineValue = Math.Round(depleteQty * unitRpp, 2, MidpointRounding.AwayFromZero);

        purchase.BalanceRemaining = Math.Round(
            purchase.BalanceRemaining - depleteQty,
            4,
            MidpointRounding.AwayFromZero);
        if (purchase.BalanceRemaining <= 0)
        {
            purchase.BalanceRemaining = 0;
            purchase.Status = "depleted";
        }

        purchase.UpdatedAt = now;
        var note =
            $"POS prepaid consumption — {promotion.Name} — {purchase.CustomerName}"
            + $" — QTY {depleteQty:0.####} {purchase.PackageUom}"
            + $" — RPP {unitRpp:0.####}"
            + $" — value {lineValue:0.##}"
            + $" — left {purchase.BalanceRemaining:0.####} {purchase.PackageUom}";
        if (!string.IsNullOrWhiteSpace(unitLabel) && depletionMethod == "salesUnit")
            note += $" — serve {unitLabel} × {request.Qty:0.####}";

        var ledger = new PosPrepaidLedger
        {
            PosPrepaidPurchaseId = purchase.Id,
            EntryType = "deplete",
            QtyDelta = -depleteQty,
            UnitCode = unitCode,
            UnitLabel = unitLabel,
            QtyPerUnit = qtyPerUnit,
            ProductId = inventoryProductId,
            LocationExternalId = locationExternalId,
            CheckNumber = request.CheckNumber,
            Note = note,
            CreatedAt = now,
            CreatedBy = request.CreatedBy?.Trim() ?? string.Empty,
        };
        db.PosPrepaidLedgers.Add(ledger);

        // Inventory depletes on redeem (not at package purchase) so Stock Card shows Pre-paid consumption.
        await productSaleInventory.RecordProductSaleAsync(
            inventoryProductId,
            [locationExternalId],
            depleteQty,
            "pos",
            variableDetail: null,
            reasonOverride: note,
            cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        await db.Entry(purchase).Collection(p => p.LedgerEntries).LoadAsync(cancellationToken);

        return Ok(MapPurchase(purchase, promotion.Name, purchase.LedgerEntries));
    }

    async Task RefreshExpiredPurchasesAsync(int companyId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var stale = await db.PosPrepaidPurchases
            .Where(p =>
                p.CompanyId == companyId
                && p.Status == "active"
                && p.ExpiresAt != null
                && p.ExpiresAt < now)
            .ToListAsync(cancellationToken);
        if (stale.Count == 0) return;
        foreach (var row in stale)
        {
            row.Status = "expired";
            row.UpdatedAt = now;
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    async Task MaybeExpirePurchaseAsync(PosPrepaidPurchase purchase, CancellationToken cancellationToken)
    {
        if (!string.Equals(purchase.Status, "active", StringComparison.OrdinalIgnoreCase))
            return;
        if (purchase.ExpiresAt is DateTime exp && exp < DateTime.UtcNow)
        {
            purchase.Status = "expired";
            purchase.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    async Task<PosCustomer?> UpsertPosCustomerByPhoneAsync(
        int companyId,
        string name,
        string mobile,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(mobile))
            return null;

        var existing = await db.PosCustomers
            .FirstOrDefaultAsync(
                c => c.CompanyId == companyId
                    && (c.Phone == mobile
                        || c.Phone.Replace(" ", "") == mobile.Replace(" ", "")),
                cancellationToken);

        if (existing is not null)
        {
            if (!string.IsNullOrWhiteSpace(name)
                && !string.Equals(existing.Name, name, StringComparison.Ordinal))
            {
                existing.Name = name;
                await db.SaveChangesAsync(cancellationToken);
            }
            return existing;
        }

        var externalId = GeneratePosCustomerExternalId(companyId, mobile);
        // Avoid collision on ExternalId
        var collision = 0;
        while (await db.PosCustomers.AnyAsync(
                   c => c.ExternalId.ToLower() == externalId.ToLower(),
                   cancellationToken))
        {
            collision++;
            externalId = GeneratePosCustomerExternalId(companyId, mobile, collision);
        }

        var customer = new PosCustomer
        {
            CompanyId = companyId,
            ExternalId = externalId,
            Name = name,
            Phone = mobile,
            Active = true,
            LoyaltySummaryJson = "[]",
            CouponSummaryJson = "[]",
            ActivityHistoryJson = "[]",
        };
        db.PosCustomers.Add(customer);
        await db.SaveChangesAsync(cancellationToken);
        return customer;
    }

    static string GeneratePosCustomerExternalId(int companyId, string mobile, int suffix = 0)
    {
        var digits = Regex.Replace(mobile, @"\D", "");
        if (digits.Length > 8) digits = digits[^8..];
        var baseId = $"PP{companyId}-{digits}";
        return suffix > 0 ? $"{baseId}-{suffix}" : baseId;
    }

    static DateTime? ComputeExpiresAt(DateTime purchasedAt, int value, string? unit)
    {
        if (value <= 0) return null;
        return string.Equals(unit, "months", StringComparison.OrdinalIgnoreCase)
            ? purchasedAt.AddMonths(value)
            : purchasedAt.AddDays(value);
    }

    static string NormalizeMobile(string? mobile) =>
        (mobile ?? string.Empty).Trim();

    sealed record DepletionUnit(string Code, string Label, decimal QtyPerUnit);

    static List<DepletionUnit> ReadDepletionUnits(string? json)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "[]" : json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];
            var list = new List<DepletionUnit>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var code = el.TryGetProperty("code", out var c) ? c.GetString() ?? string.Empty : string.Empty;
                var label = el.TryGetProperty("label", out var l) ? l.GetString() ?? string.Empty : string.Empty;
                var qty = 1m;
                if (el.TryGetProperty("qtyPerUnit", out var q) && q.TryGetDecimal(out var parsed))
                    qty = parsed > 0 ? parsed : 1m;
                list.Add(new DepletionUnit(code.Trim(), label.Trim(), qty));
            }
            return list;
        }
        catch
        {
            return [];
        }
    }

    static object MapPurchase(
        PosPrepaidPurchase purchase,
        string promotionName,
        IEnumerable<PosPrepaidLedger>? ledger)
    {
        return new
        {
            id = purchase.Id,
            companyId = purchase.CompanyId,
            locationExternalId = purchase.LocationExternalId,
            posPromotionId = purchase.PosPromotionId,
            promotionName,
            productId = purchase.ProductId,
            productName = purchase.ProductName,
            posCustomerId = purchase.PosCustomerId,
            customerName = purchase.CustomerName,
            customerMobile = purchase.CustomerMobile,
            purchasedAt = purchase.PurchasedAt,
            expiresAt = purchase.ExpiresAt,
            packageQty = purchase.PackageQty,
            packageUom = purchase.PackageUom,
            packageRpp = purchase.PackageRpp,
            balanceRemaining = purchase.BalanceRemaining,
            status = purchase.Status,
            checkNumber = purchase.CheckNumber,
            createdAt = purchase.CreatedAt,
            updatedAt = purchase.UpdatedAt,
            ledger = ledger?
                .OrderBy(l => l.CreatedAt)
                .ThenBy(l => l.Id)
                .Select(l => new
                {
                    id = l.Id,
                    entryType = l.EntryType,
                    qtyDelta = l.QtyDelta,
                    unitCode = l.UnitCode,
                    unitLabel = l.UnitLabel,
                    qtyPerUnit = l.QtyPerUnit,
                    productId = l.ProductId,
                    locationExternalId = l.LocationExternalId,
                    checkNumber = l.CheckNumber,
                    note = l.Note,
                    createdAt = l.CreatedAt,
                    createdBy = l.CreatedBy,
                }),
        };
    }
}
