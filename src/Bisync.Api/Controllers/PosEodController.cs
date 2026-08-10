using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>End-of-day session, summary, and close-day for POS Test.</summary>
[ApiController]
[Route("api/pos/eod")]
public class PosEodController(BisyncDbContext db, ITenantContext tenant) : ControllerBase
{
    static readonly HashSet<string> CreditQrMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "credit-card", "qr-pay", "card", "qr",
        "card-emv", "emv", "emv-chip", "tap", "tap-to-pay",
        "gift-card", "giftcard",
    };

    static readonly HashSet<string> NonRevenueMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "entertainment", "duty-meals", "compliment", "comp", "non-revenue",
    };

    [HttpGet("summary")]
    public async Task<ActionResult<object>> GetSummary(
        [FromQuery] int companyId,
        [FromQuery] string locationExternalId,
        [FromQuery] DateOnly? businessDate = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null)
            return BadRequest(new { error = "companyId is required." });

        var loc = (locationExternalId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(loc))
            return BadRequest(new { error = "locationExternalId is required." });

        var date = businessDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var session = await GetOrCreateSessionAsync(cid.Value, loc, date);
        var summary = await BuildSummaryAsync(cid.Value, loc, date);

        // Keep cash expected in sync with live tender totals while day is open.
        if (!session.DayClosed && session.CashExpectedCents != summary.CashExpectedCents)
        {
            session.CashExpectedCents = summary.CashExpectedCents;
            session.UpdatedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        return Ok(new
        {
            session = MapSession(session),
            summary,
        });
    }

    [HttpPut("session")]
    public async Task<ActionResult<object>> UpsertSession([FromBody] UpsertPosEodSessionRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { error = "companyId is required." });

        var loc = (request.LocationExternalId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(loc))
            return BadRequest(new { error = "locationExternalId is required." });

        var date = request.BusinessDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var session = await GetOrCreateSessionAsync(cid.Value, loc, date);
        if (session.DayClosed)
            return Conflict(new { error = "Business day is already closed." });

        if (request.CashConfirmed is bool cashConfirmed)
            session.CashConfirmed = cashConfirmed;
        if (request.CashCountedCents is long counted)
            session.CashCountedCents = Math.Max(0, counted);
        if (request.CashCountQtysJson is not null)
            session.CashCountQtysJson = NormalizeCashCountJson(request.CashCountQtysJson);
        if (request.CreditQrConfirmed is bool credit)
            session.CreditQrConfirmed = credit;
        if (request.NonRevenueConfirmed is bool nonRev)
            session.NonRevenueConfirmed = nonRev;
        if (request.VoidsConfirmed is bool voids)
            session.VoidsConfirmed = voids;
        if (request.DiscountConfirmed is bool discount)
            session.DiscountConfirmed = discount;

        var summary = await BuildSummaryAsync(cid.Value, loc, date);
        session.CashExpectedCents = summary.CashExpectedCents;
        session.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new
        {
            session = MapSession(session),
            summary,
        });
    }

    [HttpPost("close")]
    public async Task<ActionResult<object>> CloseDay([FromBody] ClosePosEodSessionRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { error = "companyId is required." });

        var loc = (request.LocationExternalId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(loc))
            return BadRequest(new { error = "locationExternalId is required." });

        var date = request.BusinessDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var session = await GetOrCreateSessionAsync(cid.Value, loc, date);
        if (session.DayClosed)
            return Ok(new { session = MapSession(session), alreadyClosed = true });

        var openCount = await db.PosOpenChecks.AsNoTracking()
            .CountAsync(x => x.CompanyId == cid.Value && x.LocationExternalId == loc && x.Active);
        if (openCount > 0 && !request.Force)
        {
            return Conflict(new
            {
                error = $"Cannot close day: {openCount} open check(s) remain.",
                openChecks = openCount,
            });
        }

        if (!session.CashConfirmed || !session.CreditQrConfirmed || !session.NonRevenueConfirmed
            || !session.VoidsConfirmed || !session.DiscountConfirmed)
        {
            return BadRequest(new
            {
                error = "Confirm cash, credit/QR, non-revenue, voids, and discounts before closing.",
            });
        }

        var summary = await BuildSummaryAsync(cid.Value, loc, date);
        session.CashExpectedCents = summary.CashExpectedCents;
        session.DayClosed = true;
        session.ClosedAt = DateTimeOffset.UtcNow;
        session.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new
        {
            session = MapSession(session),
            summary,
            closed = true,
        });
    }

    [HttpPost("record-check")]
    public async Task<ActionResult<object>> RecordClosedCheck([FromBody] RecordPosClosedCheckRequest request)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (cid is null)
            return BadRequest(new { error = "companyId is required." });

        var loc = (request.LocationExternalId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(loc))
            return BadRequest(new { error = "locationExternalId is required." });

        var now = DateTimeOffset.UtcNow;
        var externalId = $"chk-{Guid.NewGuid():N}";
        var method = string.IsNullOrWhiteSpace(request.PaymentMethod) ? "cash" : request.PaymentMethod.Trim();
        var isEntertainment = string.Equals(method, "entertainment", StringComparison.OrdinalIgnoreCase);
        var purpose = (request.PaymentPurpose ?? string.Empty).Trim();
        if (isEntertainment && purpose.Length == 0)
            return BadRequest(new { error = "Entertainment settlement requires employee name and reason (paymentPurpose)." });

        // Entertainment settles the full check amount with no tax / service.
        var taxCents = isEntertainment ? 0L : Math.Max(0, request.TaxCents);
        var payAmount = request.PaymentAmountCents
            ?? Math.Max(0, request.GrossCents - request.DiscountCents);
        if (purpose.Length > 240)
            purpose = purpose[..240];

        var closed = new PosClosedCheck
        {
            CompanyId = cid.Value,
            LocationExternalId = loc,
            ExternalId = externalId,
            CheckNumber = request.CheckNumber > 0 ? request.CheckNumber : Random.Shared.Next(1000, 9999),
            CheckLabel = (request.CheckLabel ?? string.Empty).Trim(),
            Covers = Math.Max(1, request.Covers),
            DiscountCents = Math.Max(0, request.DiscountCents),
            TaxCents = taxCents,
            VoidCents = Math.Max(0, request.VoidCents),
            GrossCents = Math.Max(0, request.GrossCents),
            PaidAt = now,
        };
        db.PosClosedChecks.Add(closed);

        db.PosPayments.Add(new PosPayment
        {
            CompanyId = cid.Value,
            LocationExternalId = loc,
            ExternalId = $"pay-{externalId}",
            CheckNumber = closed.CheckNumber,
            PaidAt = now,
            Method = method,
            AmountCents = Math.Max(0, payAmount),
            Purpose = purpose,
        });

        await db.SaveChangesAsync();
        return Ok(new { closedCheckId = closed.Id, checkNumber = closed.CheckNumber, paidAt = closed.PaidAt });
    }

    async Task<PosEodSession> GetOrCreateSessionAsync(int companyId, string locationId, DateOnly date)
    {
        var existing = await db.PosEodSessions
            .FirstOrDefaultAsync(x =>
                x.CompanyId == companyId
                && x.LocationExternalId == locationId
                && x.BusinessDate == date);
        if (existing is not null)
            return existing;

        var created = new PosEodSession
        {
            CompanyId = companyId,
            LocationExternalId = locationId,
            ExternalId = $"eod-{companyId}-{locationId}-{date:yyyyMMdd}",
            BusinessDate = date,
            CashCountQtysJson = "{}",
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.PosEodSessions.Add(created);
        try
        {
            await db.SaveChangesAsync();
            return created;
        }
        catch (DbUpdateException)
        {
            db.Entry(created).State = EntityState.Detached;
            var raced = await db.PosEodSessions
                .FirstAsync(x =>
                    x.CompanyId == companyId
                    && x.LocationExternalId == locationId
                    && x.BusinessDate == date);
            return raced;
        }
    }

    async Task<EodSummaryDto> BuildSummaryAsync(int companyId, string locationId, DateOnly date)
    {
        var start = new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var end = start.AddDays(1);

        var closed = await db.PosClosedChecks.AsNoTracking()
            .Where(x =>
                x.CompanyId == companyId
                && x.LocationExternalId == locationId
                && x.PaidAt >= start
                && x.PaidAt < end)
            .ToListAsync();

        var payments = await db.PosPayments.AsNoTracking()
            .Where(x =>
                x.CompanyId == companyId
                && x.LocationExternalId == locationId
                && x.PaidAt >= start
                && x.PaidAt < end)
            .ToListAsync();

        var voids = await db.PosVoids.AsNoTracking()
            .Where(x =>
                x.CompanyId == companyId
                && x.LocationExternalId == locationId
                && x.VoidedAt >= start
                && x.VoidedAt < end)
            .ToListAsync();

        var openChecks = await db.PosOpenChecks.AsNoTracking()
            .CountAsync(x => x.CompanyId == companyId && x.LocationExternalId == locationId && x.Active);

        long cash = 0, creditQr = 0, nonRevenue = 0;
        foreach (var pay in payments)
        {
            if (string.Equals(pay.Method, "cash", StringComparison.OrdinalIgnoreCase))
                cash += pay.AmountCents;
            else if (CreditQrMethods.Contains(pay.Method))
                creditQr += pay.AmountCents;
            else if (NonRevenueMethods.Contains(pay.Method))
                nonRevenue += pay.AmountCents;
            else
                creditQr += pay.AmountCents;
        }

        var gross = closed.Sum(c => c.GrossCents);
        var discount = closed.Sum(c => c.DiscountCents);
        var tax = closed.Sum(c => c.TaxCents);
        var voidCents = voids.Sum(v => v.AmountCents) + closed.Sum(c => c.VoidCents);
        var net = Math.Max(0, gross - discount);

        return new EodSummaryDto(
            BusinessDate: date.ToString("yyyy-MM-dd"),
            OpenChecks: openChecks,
            ClosedChecks: closed.Count,
            GrossSalesCents: gross,
            NetSalesCents: net,
            DiscountCents: discount,
            TaxCents: tax,
            VoidCents: voidCents,
            CashExpectedCents: cash,
            CreditQrCents: creditQr,
            NonRevenueCents: nonRevenue,
            TipsOwedCents: 0);
    }

    static object MapSession(PosEodSession s) => new
    {
        s.Id,
        s.CompanyId,
        s.LocationExternalId,
        s.ExternalId,
        businessDate = s.BusinessDate.ToString("yyyy-MM-dd"),
        s.CashConfirmed,
        s.CashExpectedCents,
        s.CashCountedCents,
        s.CashCountQtysJson,
        s.CreditQrConfirmed,
        s.NonRevenueConfirmed,
        s.VoidsConfirmed,
        s.DiscountConfirmed,
        s.DayClosed,
        s.ClosedAt,
        s.UpdatedAt,
        allConfirmed = s.CashConfirmed && s.CreditQrConfirmed && s.NonRevenueConfirmed
            && s.VoidsConfirmed && s.DiscountConfirmed,
        cashVarianceCents = s.CashCountedCents - s.CashExpectedCents,
    };

    static string NormalizeCashCountJson(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(raw) ? "{}" : raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return "{}";
            return doc.RootElement.GetRawText();
        }
        catch
        {
            return "{}";
        }
    }

    sealed record EodSummaryDto(
        string BusinessDate,
        int OpenChecks,
        int ClosedChecks,
        long GrossSalesCents,
        long NetSalesCents,
        long DiscountCents,
        long TaxCents,
        long VoidCents,
        long CashExpectedCents,
        long CreditQrCents,
        long NonRevenueCents,
        long TipsOwedCents);
}
