using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>
/// Dev Team console APIs. Enabled when DEV_CONSOLE_ENABLED=true, or always in Development.
/// Usage and rollups fan out across shared + provisioned company DBs.
/// </summary>
[ApiController]
[Route("api/dev-console")]
public class DevConsoleController(
    BisyncDbContext db,
    IConfiguration config,
    IWebHostEnvironment env,
    TenantRollupService rollupService) : ControllerBase
{
    bool IsEnabled()
    {
        if (env.IsDevelopment()) return true;
        return string.Equals(config["DEV_CONSOLE_ENABLED"], "true", StringComparison.OrdinalIgnoreCase);
    }

    ActionResult? Guard() => IsEnabled() ? null : NotFound();

    [HttpGet("status")]
    public ActionResult<object> Status()
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;
        return Ok(new
        {
            enabled = true,
            usageSource = "tenant-fanout-rollup",
            environment = env.EnvironmentName,
        });
    }

    /// <summary>
    /// System usage snapshot via tenant fan-out rollup (shared + provisioned DBs).
    /// </summary>
    [HttpGet("usage")]
    public async Task<ActionResult<object>> Usage(CancellationToken ct)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        var rollup = await rollupService.GetOrRefreshAsync(ct);
        return Ok(ToUsageResponse(rollup));
    }

    /// <summary>
    /// Latest persisted tenant rollup snapshot, or refresh if none exists.
    /// </summary>
    [HttpGet("rollups")]
    public async Task<ActionResult<object>> GetRollups(CancellationToken ct)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        var latest = await rollupService.GetLatestAsync(ct);
        if (latest is null)
            latest = await rollupService.RefreshAndPersistAsync(ct);
        return Ok(ToUsageResponse(latest));
    }

    /// <summary>
    /// Force a fresh fan-out rollup and persist the snapshot.
    /// </summary>
    [HttpPost("rollups/refresh")]
    public async Task<ActionResult<object>> RefreshRollups(CancellationToken ct)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        var rollup = await rollupService.RefreshAndPersistAsync(ct);
        return Ok(ToUsageResponse(rollup));
    }

    static object ToUsageResponse(TenantRollupResult rollup) => new
    {
        generatedAt = rollup.GeneratedAt,
        source = rollup.Source,
        sourceNote = rollup.SourceNote,
        status = rollup.Status,
        tenantCount = rollup.TenantCount,
        provisionedCount = rollup.ProvisionedCount,
        sharedCount = rollup.SharedCount,
        errors = rollup.Errors,
        overall = rollup.Overall,
        trend14d = rollup.Trend14d,
        byCompany = rollup.ByCompany.Select(c => new
        {
            companyId = c.CompanyId,
            companyName = c.CompanyName,
            active = c.Active,
            databaseMode = c.DatabaseMode,
            databaseName = c.DatabaseName,
            locations = c.Locations,
            products = c.Products,
            components = c.Components,
            vendors = c.Vendors,
            purchaseOrders = c.PurchaseOrders,
            salesOrders = c.SalesOrders,
            inventoryMovements = c.InventoryMovements,
            activeUsers = c.ActiveUsers,
            apiCalls30d = c.ApiCalls30d,
            error = c.Error,
        }),
        byLocation = rollup.ByLocation.Select(l => new
        {
            locationExternalId = l.LocationExternalId,
            locationName = l.LocationName,
            companyId = l.CompanyId,
            companyName = l.CompanyName,
            inventoryMovements = l.InventoryMovements,
            apiCalls30d = l.ApiCalls30d,
        }),
    };

    [HttpGet("qa/history")]
    public async Task<ActionResult<IEnumerable<object>>> QaHistory([FromQuery] int take = 30, CancellationToken ct = default)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        take = Math.Clamp(take, 1, 100);
        var runs = await db.DevQaRuns.AsNoTracking()
            .OrderByDescending(r => r.StartedAt)
            .Take(take)
            .Select(r => new
            {
                r.Id,
                r.StartedAt,
                r.FinishedAt,
                r.Status,
                r.TriggeredBy,
                r.Summary,
                r.ResultsJson,
            })
            .ToListAsync(ct);
        return Ok(runs);
    }

    public record CreateQaRunRequest(string? TriggeredBy, string? Status, string? Summary, string? ResultsJson);
    public record CompleteQaRunRequest(string Status, string? Summary, string? ResultsJson);

    [HttpPost("qa/runs")]
    public async Task<ActionResult<object>> StartQaRun([FromBody] CreateQaRunRequest request, CancellationToken ct)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        var run = new DevQaRun
        {
            StartedAt = DateTime.UtcNow,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "running" : request.Status.Trim(),
            TriggeredBy = (request.TriggeredBy ?? "").Trim(),
            Summary = (request.Summary ?? "").Trim(),
            ResultsJson = string.IsNullOrWhiteSpace(request.ResultsJson) ? "[]" : request.ResultsJson,
        };
        db.DevQaRuns.Add(run);
        await db.SaveChangesAsync(ct);
        return Ok(new { run.Id, run.StartedAt, run.Status });
    }

    [HttpPut("qa/runs/{id:int}")]
    public async Task<ActionResult<object>> CompleteQaRun(int id, [FromBody] CompleteQaRunRequest request, CancellationToken ct)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        var run = await db.DevQaRuns.FindAsync([id], ct);
        if (run is null) return NotFound();

        run.Status = string.IsNullOrWhiteSpace(request.Status) ? run.Status : request.Status.Trim();
        run.Summary = (request.Summary ?? run.Summary).Trim();
        if (!string.IsNullOrWhiteSpace(request.ResultsJson))
            run.ResultsJson = request.ResultsJson;
        run.FinishedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(new { run.Id, run.Status, run.FinishedAt, run.Summary });
    }

    public record CleanupQaRequest(int[]? CompanyIds, bool PurgeAllQaPower = false);

    /// <summary>
    /// Deletes disposable Power-user QA operational records (companies, locations, users, inventory, POs, products, vendors).
    /// DevQaRuns history rows are retained for the History tab.
    /// </summary>
    [HttpPost("qa/cleanup")]
    public async Task<ActionResult<object>> CleanupQaData([FromBody] CleanupQaRequest? request, CancellationToken ct)
    {
        var blocked = Guard();
        if (blocked is not null) return blocked;

        request ??= new CleanupQaRequest(null, false);
        var companyIds = (request.CompanyIds ?? [])
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        if (request.PurgeAllQaPower || companyIds.Count == 0)
        {
            var qaCompanyIds = await db.Companies.AsNoTracking()
                .Where(c => c.Name.StartsWith("QA Power Co"))
                .Select(c => c.Id)
                .ToListAsync(ct);
            companyIds = companyIds.Union(qaCompanyIds).Distinct().ToList();
        }

        if (companyIds.Count == 0)
        {
            var historyKeptEmpty = await db.DevQaRuns.CountAsync(ct);
            return Ok(new
            {
                companiesDeleted = 0,
                companyNames = Array.Empty<string>(),
                deletedCounts = new Dictionary<string, int>(),
                historyRowsKept = historyKeptEmpty,
                note = "No QA Power companies found to purge.",
            });
        }

        var companies = await db.Companies
            .Where(c => companyIds.Contains(c.Id))
            .ToListAsync(ct);
        var companyNames = companies.Select(c => c.Name).ToList();
        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        var locations = await db.Locations
            .Where(l => l.CompanyId != null && companyIds.Contains(l.CompanyId.Value))
            .ToListAsync(ct);
        var locationExternalIds = locations.Select(l => l.ExternalId).Where(id => !string.IsNullOrWhiteSpace(id)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var locationIds = locations.Select(l => l.Id).ToHashSet();

        async Task TrackAsync(string key, Func<Task<int>> action)
        {
            counts[key] = await action();
        }

        await TrackAsync("inventoryMovements", () => db.InventoryMovements
            .Where(m => (m.CompanyId != null && companyIds.Contains(m.CompanyId.Value))
                || locationExternalIds.Contains(m.LocationExternalId))
            .ExecuteDeleteAsync(ct));

        await TrackAsync("cashPurchases", () => db.CashPurchases
            .Where(c => c.CompanyId != null && companyIds.Contains(c.CompanyId.Value))
            .ExecuteDeleteAsync(ct));

        await TrackAsync("inventoryPurchases", () => db.InventoryPurchases
            .Where(p => p.CompanyId != null && companyIds.Contains(p.CompanyId.Value))
            .ExecuteDeleteAsync(ct));

        await TrackAsync("productProductionLogs", () => db.ProductProductionLogs
            .Where(p => p.CompanyId != null && companyIds.Contains(p.CompanyId.Value))
            .ExecuteDeleteAsync(ct));

        var poIds = await db.PurchaseOrders.AsNoTracking()
            .Where(p => p.CompanyId != null && companyIds.Contains(p.CompanyId.Value))
            .Select(p => p.Id)
            .ToListAsync(ct);
        if (poIds.Count > 0)
        {
            await TrackAsync("purchaseOrderItems", () => db.PurchaseOrderItems
                .Where(i => poIds.Contains(i.PurchaseOrderId))
                .ExecuteDeleteAsync(ct));
            await TrackAsync("purchaseOrders", () => db.PurchaseOrders
                .Where(p => poIds.Contains(p.Id))
                .ExecuteDeleteAsync(ct));
        }
        else
        {
            counts["purchaseOrderItems"] = 0;
            counts["purchaseOrders"] = 0;
        }

        var productIds = await db.Products.AsNoTracking()
            .Where(p => p.CompanyId != null && companyIds.Contains(p.CompanyId.Value))
            .Select(p => p.Id)
            .ToListAsync(ct);
        if (productIds.Count > 0)
        {
            await TrackAsync("productComponentItems", () => db.ProductComponentItems
                .Where(i => productIds.Contains(i.ProductId))
                .ExecuteDeleteAsync(ct));
            await TrackAsync("productPackagingItems", () => db.ProductPackagingItems
                .Where(i => productIds.Contains(i.ProductId))
                .ExecuteDeleteAsync(ct));
            await TrackAsync("productAliases", () => db.ProductAliases
                .Where(i => productIds.Contains(i.ProductId))
                .ExecuteDeleteAsync(ct));
            await TrackAsync("productB2bLocationStocks", () => db.ProductB2bLocationStocks
                .Where(s => productIds.Contains(s.ProductId))
                .ExecuteDeleteAsync(ct));
            await TrackAsync("productProductionLogsByProduct", () => db.ProductProductionLogs
                .Where(p => productIds.Contains(p.ProductId))
                .ExecuteDeleteAsync(ct));
            await TrackAsync("products", () => db.Products
                .Where(p => productIds.Contains(p.Id))
                .ExecuteDeleteAsync(ct));
        }
        else
        {
            counts["productComponentItems"] = 0;
            counts["productPackagingItems"] = 0;
            counts["productAliases"] = 0;
            counts["productB2bLocationStocks"] = 0;
            counts["productProductionLogsByProduct"] = 0;
            counts["products"] = 0;
        }

        // QA-tagged catalog / components / vendors (group or name / external id markers)
        await TrackAsync("ingredients", () => db.Ingredients
            .Where(i => i.Group == "QA Power" || i.Name.StartsWith("QA Flour") || i.Name.StartsWith("QA Butter")
                || i.Name.StartsWith("QA Yeast") || i.Name.StartsWith("QA Salt") || i.Name.StartsWith("QA Sugar"))
            .ExecuteDeleteAsync(ct));

        var vendorExternalIds = await db.Vendors.AsNoTracking()
            .Where(v => v.ExternalId.StartsWith("QA-V-") || v.Name.StartsWith("QA Vendor"))
            .Select(v => v.ExternalId)
            .ToListAsync(ct);
        if (vendorExternalIds.Count > 0)
        {
            var catalogIds = await db.VendorProducts.AsNoTracking()
                .Where(vp => vendorExternalIds.Contains(vp.VendorExternalId) || vp.Group == "QA Power")
                .Select(vp => vp.ExternalId)
                .ToListAsync(ct);
            if (catalogIds.Count > 0)
            {
                await TrackAsync("vendorProductPrices", () => db.VendorProductPrices
                    .Where(vp => catalogIds.Contains(vp.ExternalId))
                    .ExecuteDeleteAsync(ct));
            }
            else
            {
                counts["vendorProductPrices"] = 0;
            }

            await TrackAsync("vendorProducts", () => db.VendorProducts
                .Where(vp => vendorExternalIds.Contains(vp.VendorExternalId) || vp.Group == "QA Power")
                .ExecuteDeleteAsync(ct));
            await TrackAsync("vendors", () => db.Vendors
                .Where(v => vendorExternalIds.Contains(v.ExternalId))
                .ExecuteDeleteAsync(ct));
        }
        else
        {
            var catalogIds = await db.VendorProducts.AsNoTracking()
                .Where(vp => vp.Group == "QA Power")
                .Select(vp => vp.ExternalId)
                .ToListAsync(ct);
            if (catalogIds.Count > 0)
            {
                await TrackAsync("vendorProductPrices", () => db.VendorProductPrices
                    .Where(vp => catalogIds.Contains(vp.ExternalId))
                    .ExecuteDeleteAsync(ct));
            }
            else
            {
                counts["vendorProductPrices"] = 0;
            }

            await TrackAsync("vendorProducts", () => db.VendorProducts
                .Where(vp => vp.Group == "QA Power")
                .ExecuteDeleteAsync(ct));
            counts["vendors"] = 0;
        }

        var appUsers = await db.AppUsers
            .Where(u => (u.CompanyId != null && companyIds.Contains(u.CompanyId.Value))
                || u.Email.StartsWith("qa.admin.")
                || u.FullName.StartsWith("QA System Admin"))
            .ToListAsync(ct);
        var employeeIds = appUsers
            .Where(u => u.EmployeeId != null)
            .Select(u => u.EmployeeId!.Value)
            .Distinct()
            .ToList();

        var qaEmployees = await db.Employees
            .Where(e => e.Email.StartsWith("qa.admin.") || e.Name.StartsWith("QA System Admin") || employeeIds.Contains(e.Id))
            .ToListAsync(ct);
        employeeIds = qaEmployees.Select(e => e.Id).Distinct().ToList();

        if (employeeIds.Count > 0)
        {
            await TrackAsync("leaveRequests", () => db.LeaveRequests.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("leaveBalances", () => db.LeaveBalances.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("shiftSchedules", () => db.ShiftSchedules.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("attendanceRecords", () => db.AttendanceRecords.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("educationRecords", () => db.EducationRecords.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("previousEmployments", () => db.PreviousEmployments.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("employeeMovements", () => db.EmployeeMovements.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
            await TrackAsync("performanceAppraisals", () => db.PerformanceAppraisals.Where(x => employeeIds.Contains(x.EmployeeId)).ExecuteDeleteAsync(ct));
        }

        counts["appUsers"] = appUsers.Count;
        db.AppUsers.RemoveRange(appUsers);
        counts["employees"] = qaEmployees.Count;
        db.Employees.RemoveRange(qaEmployees);

        counts["locations"] = locations.Count;
        db.Locations.RemoveRange(locations);
        counts["companies"] = companies.Count;
        db.Companies.RemoveRange(companies);

        await db.SaveChangesAsync(ct);

        // Deleting rows does not advance identity sequences; keep them ahead of MAX(Id).
        await DatabaseSchemaHelper.ResyncCoreIdentitySequencesAsync(db);
        await DatabaseSchemaHelper.ResyncProductIdentitySequencesAsync(db);

        // Clear optional location refs that pointed at deleted location numeric ids (best-effort)
        _ = locationIds;

        var historyRowsKept = await db.DevQaRuns.CountAsync(ct);
        return Ok(new
        {
            companiesDeleted = companies.Count,
            companyNames,
            deletedCounts = counts,
            historyRowsKept,
            note = "Operational QA records deleted. DevQaRuns history retained.",
        });
    }
}
