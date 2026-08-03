using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Ensures canonical venue floor plans (committed under data/floor-plans) are present
/// in the control-plane DB so deploy/DB resets cannot leave stations on the T1–T8 demo.
/// </summary>
public static class PosFloorPlanCanonicalSeeder
{
    public const int WeissbrauCompanyId = 5;

    public static readonly string[] WeissbrauLocations =
    [
        "weissbrau-pavilion-kuala-lumpur",
        "weissbrau-pavilion",
    ];

    public static async Task EnsureCanonicalAsync(
        BisyncDbContext db,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        await SchemaPatcher.EnsurePosFloorPlansTableAsync(db);
        await SchemaPatcher.EnsurePosFloorPlanVersionsTableAsync(db);

        var layoutJson = TryLoadWeissbrauLayoutJson();
        if (string.IsNullOrWhiteSpace(layoutJson) || !PosFloorPlanGuard.IsCustomLayout(layoutJson))
        {
            logger?.LogWarning("Canonical Weissbrau floor plan JSON missing or invalid; skip seed.");
            return;
        }

        var now = DateTime.UtcNow;
        foreach (var loc in WeissbrauLocations)
        {
            var row = await db.PosFloorPlans
                .FirstOrDefaultAsync(
                    x => x.CompanyId == WeissbrauCompanyId && x.LocationExternalId == loc,
                    cancellationToken);

            if (row is null)
            {
                db.PosFloorPlans.Add(new PosFloorPlan
                {
                    CompanyId = WeissbrauCompanyId,
                    LocationExternalId = loc,
                    LayoutJson = layoutJson,
                    UpdatedAt = now,
                });
                logger?.LogInformation("Seeded canonical floor plan for {CompanyId}/{Location}", WeissbrauCompanyId, loc);
                continue;
            }

            if (PosFloorPlanGuard.IsCustomLayout(row.LayoutJson)
                && !PosFloorPlanGuard.IsStockDefaultLayout(row.LayoutJson)
                && !PosFloorPlanGuard.IsEmptyLayout(row.LayoutJson))
            {
                // Keep an existing custom design; still mirror identical payload to sister location below.
                continue;
            }

            // Empty or stock demo — replace with canonical pavilion layout.
            if (!string.Equals(row.LayoutJson, layoutJson, StringComparison.Ordinal))
            {
                db.PosFloorPlanVersions.Add(new PosFloorPlanVersion
                {
                    CompanyId = row.CompanyId,
                    LocationExternalId = row.LocationExternalId,
                    LayoutJson = row.LayoutJson,
                    CapturedAt = now,
                    Source = "canonical-seed",
                });
            }

            row.LayoutJson = layoutJson;
            row.UpdatedAt = now;
            logger?.LogInformation("Restored canonical floor plan over empty/stock for {CompanyId}/{Location}", WeissbrauCompanyId, loc);
        }

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(cancellationToken);

        // If one alias already has a custom layout, mirror it to the other so activation cannot hit empty.
        await MirrorSisterLayoutsAsync(db, cancellationToken);
    }

    static async Task MirrorSisterLayoutsAsync(BisyncDbContext db, CancellationToken cancellationToken)
    {
        var rows = await db.PosFloorPlans
            .Where(x => x.CompanyId == WeissbrauCompanyId && WeissbrauLocations.Contains(x.LocationExternalId))
            .ToListAsync(cancellationToken);

        var best = rows
            .Where(r => PosFloorPlanGuard.IsCustomLayout(r.LayoutJson))
            .OrderByDescending(r => r.UpdatedAt)
            .FirstOrDefault();
        if (best is null) return;

        var now = DateTime.UtcNow;
        foreach (var loc in WeissbrauLocations)
        {
            var row = rows.FirstOrDefault(r => r.LocationExternalId == loc);
            if (row is null)
            {
                db.PosFloorPlans.Add(new PosFloorPlan
                {
                    CompanyId = WeissbrauCompanyId,
                    LocationExternalId = loc,
                    LayoutJson = best.LayoutJson,
                    UpdatedAt = now,
                });
                continue;
            }

            if (string.Equals(row.LayoutJson, best.LayoutJson, StringComparison.Ordinal))
                continue;

            if (PosFloorPlanGuard.IsCustomLayout(row.LayoutJson)
                && row.UpdatedAt >= best.UpdatedAt
                && row.Id != best.Id)
            {
                continue;
            }

            if (!PosFloorPlanGuard.IsCustomLayout(row.LayoutJson)
                || row.UpdatedAt < best.UpdatedAt)
            {
                row.LayoutJson = best.LayoutJson;
                row.UpdatedAt = now;
            }
        }

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(cancellationToken);
    }

    public static string? TryLoadWeissbrauLayoutJson()
    {
        foreach (var path in CandidatePaths())
        {
            try
            {
                if (!File.Exists(path)) continue;
                var text = File.ReadAllText(path);
                if (string.IsNullOrWhiteSpace(text)) continue;
                // Normalize to compact JSON string for storage.
                using var doc = JsonDocument.Parse(text);
                return JsonSerializer.Serialize(doc.RootElement);
            }
            catch
            {
                /* try next */
            }
        }
        return null;
    }

    static IEnumerable<string> CandidatePaths()
    {
        var content = AppContext.BaseDirectory;
        yield return Path.Combine(content, "data", "floor-plans", "weissbrau-pavilion-kuala-lumpur.json");
        yield return Path.Combine(content, "..", "data", "floor-plans", "weissbrau-pavilion-kuala-lumpur.json");
        // Repo-root relative when running from src/Bisync.Api
        yield return Path.GetFullPath(Path.Combine(content, "..", "..", "..", "..", "..", "data", "floor-plans", "weissbrau-pavilion-kuala-lumpur.json"));
        var cwd = Directory.GetCurrentDirectory();
        yield return Path.Combine(cwd, "data", "floor-plans", "weissbrau-pavilion-kuala-lumpur.json");
        yield return Path.Combine(cwd, "..", "data", "floor-plans", "weissbrau-pavilion-kuala-lumpur.json");
    }
}
