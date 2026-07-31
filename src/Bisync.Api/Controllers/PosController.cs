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
                message = "Select a company to inspect POS Test data.",
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

    public record UpsertFloorPlanRequest(int CompanyId, string LocationExternalId, string LayoutJson);

    [HttpGet("floor-plan")]
    public async Task<ActionResult<object>> GetFloorPlan(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (cid is null || string.IsNullOrEmpty(loc))
        {
            return Ok(new
            {
                companyId = cid,
                locationExternalId = loc,
                layoutJson = """{"tables":[],"zones":[]}""",
                updatedAt = (DateTime?)null,
            });
        }

        try
        {
            await SchemaPatcher.EnsurePosFloorPlansTableAsync(db);
            var row = await db.PosFloorPlans.AsNoTracking()
                .FirstOrDefaultAsync(x => x.CompanyId == cid.Value && x.LocationExternalId == loc);

            return Ok(new
            {
                companyId = cid.Value,
                locationExternalId = loc,
                layoutJson = row?.LayoutJson ?? """{"tables":[],"zones":[]}""",
                updatedAt = row?.UpdatedAt,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                companyId = cid.Value,
                locationExternalId = loc,
                message = "Floor plan storage is not ready.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    [HttpPut("floor-plan")]
    public async Task<ActionResult<object>> UpsertFloorPlan([FromBody] UpsertFloorPlanRequest body)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, body.CompanyId);
        var loc = (body.LocationExternalId ?? string.Empty).Trim();
        if (cid is null || string.IsNullOrEmpty(loc))
            return BadRequest(new { message = "companyId and locationExternalId are required." });

        var layoutJson = string.IsNullOrWhiteSpace(body.LayoutJson)
            ? """{"tables":[],"zones":[]}"""
            : body.LayoutJson.Trim();
        if (layoutJson.Length > 1_500_000)
            return BadRequest(new { message = "Floor plan payload is too large." });

        try
        {
            await SchemaPatcher.EnsurePosFloorPlansTableAsync(db);

            var row = await db.PosFloorPlans
                .FirstOrDefaultAsync(x => x.CompanyId == cid.Value && x.LocationExternalId == loc);
            if (row is null)
            {
                row = new PosFloorPlan
                {
                    CompanyId = cid.Value,
                    LocationExternalId = loc,
                    LayoutJson = layoutJson,
                    UpdatedAt = DateTime.UtcNow,
                };
                db.PosFloorPlans.Add(row);
            }
            else
            {
                row.LayoutJson = layoutJson;
                row.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();

            return Ok(new
            {
                companyId = row.CompanyId,
                locationExternalId = row.LocationExternalId,
                layoutJson = row.LayoutJson,
                updatedAt = row.UpdatedAt,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not save floor plan.",
                detail = ex.GetBaseException().Message,
            });
        }
    }
}
