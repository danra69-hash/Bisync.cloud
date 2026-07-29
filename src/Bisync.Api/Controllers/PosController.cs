using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>
/// POS Test operational data — foundation for wiring register / EOD into Bisync.cloud.
/// Tables follow CompanyId + LocationExternalId tenancy (SchemaPatcher EnsureCreated).
/// </summary>
[ApiController]
[Route("api/pos")]
public class PosController(BisyncDbContext db, ITenantContext tenant) : ControllerBase
{
    [HttpGet("test-tap/status")]
    public async Task<ActionResult<object>> GetTestTapStatus(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
        {
            return Ok(new
            {
                ready = false,
                message = "Select a company to inspect POS Test Tap data.",
                tables = Array.Empty<object>(),
            });
        }

        var loc = (locationExternalId ?? string.Empty).Trim();

        IQueryable<PosOpenCheck> openQ = db.PosOpenChecks.AsNoTracking();
        IQueryable<PosClosedCheck> closedQ = db.PosClosedChecks.AsNoTracking();
        IQueryable<PosPayment> payQ = db.PosPayments.AsNoTracking();
        IQueryable<PosVoid> voidQ = db.PosVoids.AsNoTracking();
        IQueryable<PosEodSession> eodQ = db.PosEodSessions.AsNoTracking();

        if (cid is int company)
        {
            openQ = openQ.Where(x => x.CompanyId == company);
            closedQ = closedQ.Where(x => x.CompanyId == company);
            payQ = payQ.Where(x => x.CompanyId == company);
            voidQ = voidQ.Where(x => x.CompanyId == company);
            eodQ = eodQ.Where(x => x.CompanyId == company);
        }

        if (!string.IsNullOrEmpty(loc))
        {
            openQ = openQ.Where(x => x.LocationExternalId == loc);
            closedQ = closedQ.Where(x => x.LocationExternalId == loc);
            payQ = payQ.Where(x => x.LocationExternalId == loc);
            voidQ = voidQ.Where(x => x.LocationExternalId == loc);
            eodQ = eodQ.Where(x => x.LocationExternalId == loc);
        }

        var openCount = await openQ.CountAsync(x => x.Active);
        var closedCount = await closedQ.CountAsync();
        var paymentCount = await payQ.CountAsync();
        var voidCount = await voidQ.CountAsync();
        var eodCount = await eodQ.CountAsync();
        var openBlocksEod = openCount > 0;

        return Ok(new
        {
            ready = true,
            companyId = cid,
            locationExternalId = loc,
            openBlocksEod,
            tables = new object[]
            {
                new { name = "PosOpenChecks", count = openCount, purpose = "Outstanding bills (block EOD)" },
                new { name = "PosClosedChecks", count = closedCount, purpose = "Gross / net / discount / tax detail" },
                new { name = "PosPayments", count = paymentCount, purpose = "Cash, Credit & QR, Non-revenue tenders" },
                new { name = "PosVoids", count = voidCount, purpose = "Void lines + reasons" },
                new { name = "PosEodSessions", count = eodCount, purpose = "EOD confirm checklist per business date" },
            },
        });
    }

    [HttpGet("open-checks")]
    public async Task<ActionResult<IEnumerable<PosOpenCheck>>> ListOpenChecks(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<PosOpenCheck>());

        IQueryable<PosOpenCheck> q = db.PosOpenChecks.AsNoTracking().Where(x => x.Active);
        if (cid is int id) q = q.Where(x => x.CompanyId == id);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(loc)) q = q.Where(x => x.LocationExternalId == loc);

        return Ok(await q.OrderByDescending(x => x.UpdatedAt).Take(200).ToListAsync());
    }

    [HttpGet("eod-sessions")]
    public async Task<ActionResult<IEnumerable<PosEodSession>>> ListEodSessions(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(Array.Empty<PosEodSession>());

        IQueryable<PosEodSession> q = db.PosEodSessions.AsNoTracking();
        if (cid is int id) q = q.Where(x => x.CompanyId == id);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(loc)) q = q.Where(x => x.LocationExternalId == loc);

        return Ok(await q.OrderByDescending(x => x.BusinessDate).Take(60).ToListAsync());
    }
}
