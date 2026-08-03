using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
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

    public record UpsertFloorPlanRequest(
        int CompanyId,
        string LocationExternalId,
        string LayoutJson,
        bool Force = false);

    public record JoinWaitlistRequest(
        int CompanyId,
        string LocationExternalId,
        string Name,
        string Mobile,
        int Pax);

    public record UpdateWaitlistStatusRequest(string Status);

    public record QrOrderItemRequest(int ProductId, string Name, decimal Quantity, string? Detail, decimal UnitPrice);

    public record PlaceQrOrderRequest(
        int CompanyId,
        string LocationExternalId,
        string? TableLabel,
        string? GuestName,
        List<QrOrderItemRequest> Items);

    public record UpdateQrOrderStatusRequest(string Status);

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
            var aliases = PosFloorPlanGuard.LocationAliases(loc);
            var rows = await db.PosFloorPlans.AsNoTracking()
                .Where(x => x.CompanyId == cid.Value && aliases.Contains(x.LocationExternalId))
                .ToListAsync();

            var row = rows
                .Where(r => PosFloorPlanGuard.IsCustomLayout(r.LayoutJson))
                .OrderByDescending(r => r.UpdatedAt)
                .FirstOrDefault()
                ?? rows.OrderByDescending(r => r.UpdatedAt).FirstOrDefault();

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
            await SchemaPatcher.EnsurePosFloorPlanVersionsTableAsync(db);

            var aliases = PosFloorPlanGuard.LocationAliases(loc);
            var rows = await db.PosFloorPlans
                .Where(x => x.CompanyId == cid.Value && aliases.Contains(x.LocationExternalId))
                .ToListAsync();
            var row = rows.FirstOrDefault(x => x.LocationExternalId == loc)
                ?? rows.OrderByDescending(x => x.UpdatedAt).FirstOrDefault();

            var incomingStockOrEmpty = PosFloorPlanGuard.IsStockDefaultLayout(layoutJson)
                || PosFloorPlanGuard.IsEmptyLayout(layoutJson);

            // Never let the stock demo layout land — not even as a first write — unless force.
            if (!body.Force && incomingStockOrEmpty)
            {
                var existingCustom = rows.FirstOrDefault(r => PosFloorPlanGuard.IsCustomLayout(r.LayoutJson));
                if (existingCustom is not null || row is null)
                {
                    return Conflict(new
                    {
                        message = existingCustom is not null
                            ? "Refused to overwrite a custom floor plan with the stock/empty demo layout. Pass force=true to override."
                            : "Refused to save the stock/empty demo floor plan as the first layout. Design a custom plan, or pass force=true.",
                        companyId = cid.Value,
                        locationExternalId = loc,
                        updatedAt = existingCustom?.UpdatedAt ?? row?.UpdatedAt,
                    });
                }
            }

            // Never let the stock demo layout silently replace a custom venue design.
            if (row is not null
                && !body.Force
                && PosFloorPlanGuard.IsCustomLayout(row.LayoutJson)
                && incomingStockOrEmpty)
            {
                return Conflict(new
                {
                    message = "Refused to overwrite a custom floor plan with the stock/empty demo layout. Pass force=true to override.",
                    companyId = row.CompanyId,
                    locationExternalId = row.LocationExternalId,
                    updatedAt = row.UpdatedAt,
                });
            }

            var now = DateTime.UtcNow;
            PosFloorPlan? primary = null;

            // Custom saves replace the plan on every sister location alias so activation
            // against either externalId always sees the same layout.
            var targets = PosFloorPlanGuard.IsCustomLayout(layoutJson) ? aliases : new[] { loc };
            foreach (var targetLoc in targets)
            {
                var target = rows.FirstOrDefault(x => x.LocationExternalId == targetLoc);
                if (target is null)
                {
                    target = new PosFloorPlan
                    {
                        CompanyId = cid.Value,
                        LocationExternalId = targetLoc,
                        LayoutJson = layoutJson,
                        UpdatedAt = now,
                    };
                    db.PosFloorPlans.Add(target);
                    rows.Add(target);
                }
                else
                {
                    if (!string.Equals(target.LayoutJson, layoutJson, StringComparison.Ordinal))
                    {
                        db.PosFloorPlanVersions.Add(new PosFloorPlanVersion
                        {
                            CompanyId = target.CompanyId,
                            LocationExternalId = target.LocationExternalId,
                            LayoutJson = target.LayoutJson,
                            CapturedAt = now,
                            Source = body.Force ? "force-overwrite" : "overwrite",
                        });
                    }

                    target.LayoutJson = layoutJson;
                    target.UpdatedAt = now;
                }

                if (string.Equals(targetLoc, loc, StringComparison.OrdinalIgnoreCase))
                    primary = target;
            }

            primary ??= rows.FirstOrDefault(x => x.LocationExternalId == loc) ?? rows.FirstOrDefault();
            await db.SaveChangesAsync();

            return Ok(new
            {
                companyId = primary!.CompanyId,
                locationExternalId = loc,
                layoutJson = primary.LayoutJson,
                updatedAt = primary.UpdatedAt,
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

    [HttpGet("floor-plan/versions")]
    public async Task<ActionResult<object>> ListFloorPlanVersions(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null,
        [FromQuery] int take = 20)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (cid is null || string.IsNullOrEmpty(loc))
            return Ok(Array.Empty<object>());

        try
        {
            await SchemaPatcher.EnsurePosFloorPlanVersionsTableAsync(db);
            var limit = Math.Clamp(take, 1, 50);
            var rows = await db.PosFloorPlanVersions.AsNoTracking()
                .Where(x => x.CompanyId == cid.Value && x.LocationExternalId == loc)
                .OrderByDescending(x => x.CapturedAt)
                .Take(limit)
                .Select(x => new
                {
                    x.Id,
                    x.CompanyId,
                    x.LocationExternalId,
                    x.Source,
                    x.CapturedAt,
                    tableCount = 0,
                    layoutJson = x.LayoutJson,
                })
                .ToListAsync();

            var shaped = rows.Select(r =>
            {
                var tables = 0;
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(r.layoutJson ?? "{}");
                    if (doc.RootElement.TryGetProperty("tables", out var t)
                        && t.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        tables = t.GetArrayLength();
                    }
                }
                catch { /* ignore */ }

                return new
                {
                    r.Id,
                    r.CompanyId,
                    r.LocationExternalId,
                    r.Source,
                    r.CapturedAt,
                    tableCount = tables,
                    isStockDefault = PosFloorPlanGuard.IsStockDefaultLayout(r.layoutJson),
                    isCustom = PosFloorPlanGuard.IsCustomLayout(r.layoutJson),
                    layoutJson = r.layoutJson,
                };
            });

            return Ok(shaped);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not list floor plan versions.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    [HttpPost("floor-plan/restore-version/{versionId:int}")]
    public async Task<ActionResult<object>> RestoreFloorPlanVersion(
        int versionId,
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (cid is null || string.IsNullOrEmpty(loc))
            return BadRequest(new { message = "companyId and locationExternalId are required." });

        try
        {
            await SchemaPatcher.EnsurePosFloorPlansTableAsync(db);
            await SchemaPatcher.EnsurePosFloorPlanVersionsTableAsync(db);

            var version = await db.PosFloorPlanVersions.AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.Id == versionId
                    && x.CompanyId == cid.Value
                    && x.LocationExternalId == loc);
            if (version is null)
                return NotFound(new { message = "Floor plan version not found." });

            return await UpsertFloorPlan(new UpsertFloorPlanRequest(
                cid.Value,
                loc,
                version.LayoutJson,
                Force: true));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not restore floor plan version.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    [HttpGet("waitlist")]
    public async Task<ActionResult<object>> ListWaitlist(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null,
        [FromQuery] bool includeClosed = false)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (cid is null || string.IsNullOrEmpty(loc))
            return Ok(Array.Empty<object>());

        try
        {
            await SchemaPatcher.EnsurePosWaitlistEntriesTableAsync(db);
            IQueryable<PosWaitlistEntry> q = db.PosWaitlistEntries.AsNoTracking()
                .Where(x => x.CompanyId == cid.Value && x.LocationExternalId == loc);
            if (!includeClosed)
                q = q.Where(x => x.Status == "waiting");

            var rows = await q.OrderBy(x => x.CreatedAt).Take(200).ToListAsync();
            return Ok(rows.Select(x => new
            {
                id = x.Id,
                companyId = x.CompanyId,
                locationExternalId = x.LocationExternalId,
                name = x.Name,
                mobile = x.Mobile,
                pax = x.Pax,
                status = x.Status,
                createdAt = x.CreatedAt,
                updatedAt = x.UpdatedAt,
            }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Waitlist storage is not ready.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    /// <summary>Public join from customer QR form — company + location in body.</summary>
    [HttpPost("waitlist")]
    public async Task<ActionResult<object>> JoinWaitlist([FromBody] JoinWaitlistRequest body)
    {
        var cid = body.CompanyId;
        var loc = (body.LocationExternalId ?? string.Empty).Trim();
        var name = (body.Name ?? string.Empty).Trim();
        var mobile = (body.Mobile ?? string.Empty).Trim();
        var pax = body.Pax;

        if (cid <= 0 || string.IsNullOrEmpty(loc))
            return BadRequest(new { message = "companyId and locationExternalId are required." });
        if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(mobile))
            return BadRequest(new { message = "Name and mobile number are required." });
        if (pax < 1 || pax > 99)
            return BadRequest(new { message = "Pax must be between 1 and 99." });
        if (name.Length > 120 || mobile.Length > 40)
            return BadRequest(new { message = "Name or mobile is too long." });

        try
        {
            await SchemaPatcher.EnsurePosWaitlistEntriesTableAsync(db);
            var row = new PosWaitlistEntry
            {
                CompanyId = cid,
                LocationExternalId = loc,
                Name = name,
                Mobile = mobile,
                Pax = pax,
                Status = "waiting",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            db.PosWaitlistEntries.Add(row);
            await db.SaveChangesAsync();

            return Ok(new
            {
                id = row.Id,
                companyId = row.CompanyId,
                locationExternalId = row.LocationExternalId,
                name = row.Name,
                mobile = row.Mobile,
                pax = row.Pax,
                status = row.Status,
                createdAt = row.CreatedAt,
                updatedAt = row.UpdatedAt,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not join waitlist.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    [HttpPatch("waitlist/{id:int}")]
    public async Task<ActionResult<object>> UpdateWaitlistStatus(
        int id,
        [FromBody] UpdateWaitlistStatusRequest body)
    {
        var status = (body.Status ?? string.Empty).Trim().ToLowerInvariant();
        if (status is not ("waiting" or "seated" or "cancelled"))
            return BadRequest(new { message = "Status must be waiting, seated, or cancelled." });

        try
        {
            await SchemaPatcher.EnsurePosWaitlistEntriesTableAsync(db);
            var row = await db.PosWaitlistEntries.FirstOrDefaultAsync(x => x.Id == id);
            if (row is null) return NotFound(new { message = "Waitlist entry not found." });

            row.Status = status;
            row.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Ok(new
            {
                id = row.Id,
                companyId = row.CompanyId,
                locationExternalId = row.LocationExternalId,
                name = row.Name,
                mobile = row.Mobile,
                pax = row.Pax,
                status = row.Status,
                createdAt = row.CreatedAt,
                updatedAt = row.UpdatedAt,
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not update waitlist entry.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    /// <summary>Public POS menu for guest QR order (B2C + POS enabled + RRP).</summary>
    [HttpGet("qr-order/menu")]
    public async Task<ActionResult<object>> QrOrderMenu(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null)
    {
        var cid = companyId is int id && id > 0 ? id : TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null || cid <= 0)
            return BadRequest(new { message = "companyId is required." });

        var loc = (locationExternalId ?? string.Empty).Trim();
        IQueryable<Product> q = db.Products.AsNoTracking()
            .Where(p => p.Active
                && !p.IsSubProduct
                && p.B2cEnabled
                && p.PosEnabled
                && p.Rrp > 0
                && (p.CompanyId == null || p.CompanyId == cid.Value));

        var rows = await q.OrderBy(p => p.Category).ThenBy(p => p.Group).ThenBy(p => p.Name).Take(500).ToListAsync();
        if (!string.IsNullOrEmpty(loc))
        {
            rows = rows.Where(p =>
            {
                var locs = ParseLocationIds(p.LocationIdsJson);
                return locs.Count == 0 || locs.Contains(loc, StringComparer.OrdinalIgnoreCase);
            }).ToList();
        }

        var locationName = string.Empty;
        if (!string.IsNullOrEmpty(loc))
        {
            locationName = await db.Locations.AsNoTracking()
                .Where(l => l.ExternalId == loc && (l.CompanyId == null || l.CompanyId == cid.Value))
                .Select(l => l.Name)
                .FirstOrDefaultAsync() ?? string.Empty;
        }

        return Ok(new
        {
            locationName = string.IsNullOrWhiteSpace(locationName) ? loc : locationName,
            locationExternalId = loc,
            items = rows.Select(p => new
            {
                id = p.Id,
                productId = p.ProductId,
                name = p.Name,
                category = p.Category,
                group = p.Group,
                rrp = p.Rrp,
                // Reserved for product photos when catalog images are available.
                imageUrl = (string?)null,
            }),
        });
    }

    [HttpGet("qr-order")]
    public async Task<ActionResult<object>> ListQrOrders(
        [FromQuery] int? companyId = null,
        [FromQuery] string? locationExternalId = null,
        [FromQuery] bool includeClosed = false)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (cid is null || string.IsNullOrEmpty(loc))
            return Ok(Array.Empty<object>());

        try
        {
            await SchemaPatcher.EnsurePosQrOrdersTableAsync(db);
            IQueryable<PosQrOrder> q = db.PosQrOrders.AsNoTracking()
                .Where(x => x.CompanyId == cid.Value && x.LocationExternalId == loc);
            if (!includeClosed)
                q = q.Where(x => x.Status == "open");

            var rows = await q.OrderByDescending(x => x.CreatedAt).Take(100).ToListAsync();
            return Ok(rows.Select(MapQrOrder));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "QR order storage is not ready.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    /// <summary>Public place-order from guest /QR e-menu.</summary>
    [HttpPost("qr-order")]
    public async Task<ActionResult<object>> PlaceQrOrder([FromBody] PlaceQrOrderRequest body)
    {
        var cid = body.CompanyId;
        var loc = (body.LocationExternalId ?? string.Empty).Trim();
        var table = (body.TableLabel ?? string.Empty).Trim();
        var guest = (body.GuestName ?? string.Empty).Trim();
        var items = (body.Items ?? [])
            .Where(i => i.ProductId > 0 && !string.IsNullOrWhiteSpace(i.Name) && i.Quantity > 0)
            .Select(i => new
            {
                productId = i.ProductId,
                name = i.Name.Trim(),
                quantity = Math.Round(i.Quantity, 3),
                detail = (i.Detail ?? string.Empty).Trim(),
                unitPrice = Math.Max(0, i.UnitPrice),
            })
            .ToList();

        if (cid <= 0 || string.IsNullOrEmpty(loc))
            return BadRequest(new { message = "companyId and locationExternalId are required." });
        if (items.Count == 0)
            return BadRequest(new { message = "Add at least one menu item." });
        if (table.Length > 64 || guest.Length > 120)
            return BadRequest(new { message = "Table or guest name is too long." });

        try
        {
            await SchemaPatcher.EnsurePosQrOrdersTableAsync(db);
            var total = items.Sum(i => i.quantity * i.unitPrice);
            var row = new PosQrOrder
            {
                CompanyId = cid,
                LocationExternalId = loc,
                TableLabel = string.IsNullOrEmpty(table) ? "QR" : table,
                GuestName = guest,
                Status = "open",
                ItemsJson = JsonSerializer.Serialize(items),
                TotalValue = total,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            db.PosQrOrders.Add(row);
            await db.SaveChangesAsync();
            return Ok(MapQrOrder(row));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not place QR order.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    [HttpPatch("qr-order/{id:int}")]
    public async Task<ActionResult<object>> UpdateQrOrderStatus(
        int id,
        [FromBody] UpdateQrOrderStatusRequest body)
    {
        var status = (body.Status ?? string.Empty).Trim().ToLowerInvariant();
        if (status is not ("open" or "sent" or "cancelled"))
            return BadRequest(new { message = "Status must be open, sent, or cancelled." });

        try
        {
            await SchemaPatcher.EnsurePosQrOrdersTableAsync(db);
            var row = await db.PosQrOrders.FirstOrDefaultAsync(x => x.Id == id);
            if (row is null) return NotFound(new { message = "QR order not found." });

            row.Status = status;
            row.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Ok(MapQrOrder(row));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not update QR order.",
                detail = ex.GetBaseException().Message,
            });
        }
    }

    public record RecordPosVoidRequest(
        int CompanyId,
        string LocationExternalId,
        int CheckNumber,
        string ProductName,
        long AmountCents,
        string Reason,
        string? AuthorizedBy = null);

    public record RecordPosCancelRequest(
        int CompanyId,
        string LocationExternalId,
        int CheckNumber,
        string ProductName,
        long AmountCents,
        string? Reason = null,
        string? CanceledBy = null);

    /// <summary>Record a voided fired line (≥5 minutes) for EOD / audit.</summary>
    [HttpPost("voids")]
    public async Task<ActionResult<object>> RecordVoid([FromBody] RecordPosVoidRequest body)
    {
        var loc = (body.LocationExternalId ?? string.Empty).Trim();
        var productName = (body.ProductName ?? string.Empty).Trim();
        var reason = (body.Reason ?? string.Empty).Trim();
        if (body.CompanyId <= 0 || string.IsNullOrEmpty(loc))
            return BadRequest(new { message = "companyId and locationExternalId are required." });
        if (string.IsNullOrEmpty(productName))
            return BadRequest(new { message = "productName is required." });
        if (string.IsNullOrEmpty(reason))
            return BadRequest(new { message = "reason is required for void." });

        var row = new PosVoid
        {
            CompanyId = body.CompanyId,
            LocationExternalId = loc,
            ExternalId = $"void-{body.CompanyId}-{body.CheckNumber}-{Guid.NewGuid():N}"[..48],
            CheckNumber = body.CheckNumber,
            ProductName = productName,
            AmountCents = Math.Max(0, body.AmountCents),
            Reason = reason,
            AuthorizedBy = (body.AuthorizedBy ?? string.Empty).Trim(),
            VoidedAt = DateTimeOffset.UtcNow,
        };
        db.PosVoids.Add(row);
        await db.SaveChangesAsync();
        return Ok(new
        {
            id = row.Id,
            externalId = row.ExternalId,
            checkNumber = row.CheckNumber,
            productName = row.ProductName,
            amountCents = row.AmountCents,
            reason = row.Reason,
            authorizedBy = row.AuthorizedBy,
            voidedAt = row.VoidedAt,
        });
    }

    /// <summary>Record a canceled fired line (&lt;5 minutes) — reference only, no stock impact.</summary>
    [HttpPost("cancels")]
    public async Task<ActionResult<object>> RecordCancel([FromBody] RecordPosCancelRequest body)
    {
        var loc = (body.LocationExternalId ?? string.Empty).Trim();
        var productName = (body.ProductName ?? string.Empty).Trim();
        if (body.CompanyId <= 0 || string.IsNullOrEmpty(loc))
            return BadRequest(new { message = "companyId and locationExternalId are required." });
        if (string.IsNullOrEmpty(productName))
            return BadRequest(new { message = "productName is required." });

        var row = new PosCancel
        {
            CompanyId = body.CompanyId,
            LocationExternalId = loc,
            ExternalId = $"cancel-{body.CompanyId}-{body.CheckNumber}-{Guid.NewGuid():N}"[..48],
            CheckNumber = body.CheckNumber,
            ProductName = productName,
            AmountCents = Math.Max(0, body.AmountCents),
            Reason = (body.Reason ?? string.Empty).Trim(),
            CanceledBy = (body.CanceledBy ?? string.Empty).Trim(),
            CanceledAt = DateTimeOffset.UtcNow,
        };
        db.PosCancels.Add(row);
        await db.SaveChangesAsync();
        return Ok(new
        {
            id = row.Id,
            externalId = row.ExternalId,
            checkNumber = row.CheckNumber,
            productName = row.ProductName,
            amountCents = row.AmountCents,
            reason = row.Reason,
            canceledBy = row.CanceledBy,
            canceledAt = row.CanceledAt,
        });
    }

    static object MapQrOrder(PosQrOrder row)
    {
        object items;
        try
        {
            items = JsonSerializer.Deserialize<JsonElement>(row.ItemsJson);
        }
        catch
        {
            items = Array.Empty<object>();
        }

        return new
        {
            id = row.Id,
            companyId = row.CompanyId,
            locationExternalId = row.LocationExternalId,
            tableLabel = row.TableLabel,
            guestName = row.GuestName,
            status = row.Status,
            items,
            totalValue = row.TotalValue,
            createdAt = row.CreatedAt,
            updatedAt = row.UpdatedAt,
        };
    }

    static List<string> ParseLocationIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
