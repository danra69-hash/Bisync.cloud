using System.Text.Json;
using Bisync.Api.Controllers;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class RevMgmtStartup
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static async Task InitializeAsync(BisyncDbContext db)
    {
        await SeedCompanyConfigsAsync(db);
        await SeedVendorProductsAsync(db);
    }

    static async Task SeedCompanyConfigsAsync(BisyncDbContext db)
    {
        var companyIds = await db.Companies.AsNoTracking().Select(c => c.Id).ToListAsync();
        if (companyIds.Count == 0)
            companyIds.Add(1);

        foreach (var companyId in companyIds)
        {
            await EnsureConfigAsync(db, companyId, RevMgmtConfigController.ComponentHierarchyKey,
                JsonSerializer.Serialize(RevMgmtDefaults.ComponentHierarchy(), JsonOptions));

            var locationIds = await db.Locations.AsNoTracking()
                .Where(l => l.CompanyId == companyId && !string.IsNullOrWhiteSpace(l.ExternalId))
                .Select(l => l.ExternalId!)
                .ToListAsync();
            await EnsureConfigAsync(db, companyId, RevMgmtConfigController.StorageAssignmentKey,
                JsonSerializer.Serialize(RevMgmtDefaults.StorageAssignmentForLocations(locationIds), JsonOptions));

            await EnsureConfigAsync(db, companyId, RevMgmtConfigController.ComponentCatalogKey,
                JsonSerializer.Serialize(RevMgmtDefaults.ComponentCatalog(), JsonOptions));
        }

        // Backfill My Storage for company locations that only have the old downtown/midtown/westend seed.
        await BackfillMissingLocationStorageAsync(db);
    }

    static async Task BackfillMissingLocationStorageAsync(BisyncDbContext db)
    {
        var configs = await db.RevMgmtCompanyConfigs
            .Where(c => c.ConfigKey == RevMgmtConfigController.StorageAssignmentKey)
            .ToListAsync();
        if (configs.Count == 0) return;

        var locationsByCompany = await db.Locations.AsNoTracking()
            .Where(l => l.CompanyId != null && !string.IsNullOrWhiteSpace(l.ExternalId))
            .Select(l => new { CompanyId = l.CompanyId!.Value, ExternalId = l.ExternalId! })
            .ToListAsync();

        foreach (var config in configs)
        {
            var companyLocationIds = locationsByCompany
                .Where(l => l.CompanyId == config.CompanyId)
                .Select(l => l.ExternalId.Trim().ToLowerInvariant())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();
            if (companyLocationIds.Count == 0) continue;

            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(config.StateJson) ? "{}" : config.StateJson);
            if (!doc.RootElement.TryGetProperty("entries", out var entriesEl) || entriesEl.ValueKind != JsonValueKind.Array)
                continue;

            var existingLocations = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in entriesEl.EnumerateArray())
            {
                if (entry.TryGetProperty("location", out var locEl))
                {
                    var loc = locEl.GetString()?.Trim().ToLowerInvariant();
                    if (!string.IsNullOrWhiteSpace(loc)) existingLocations.Add(loc);
                }
            }

            var missing = companyLocationIds.Where(id => !existingLocations.Contains(id)).ToList();
            if (missing.Count == 0) continue;

            // Rebuild a merged assignment: keep existing entries, append defaults for missing locations.
            var areas = doc.RootElement.TryGetProperty("areas", out var areasEl) && areasEl.ValueKind == JsonValueKind.Array
                ? areasEl.EnumerateArray().Select(a => a.GetString() ?? "").Where(a => !string.IsNullOrWhiteSpace(a)).ToList()
                : ["Dining Room", "Bar", "Kitchen"];

            var nextId = 1;
            if (doc.RootElement.TryGetProperty("nextEntryId", out var nextEl) && nextEl.TryGetInt32(out var parsedNext))
                nextId = Math.Max(1, parsedNext);

            var mergedEntries = new List<object>();
            foreach (var entry in entriesEl.EnumerateArray())
            {
                mergedEntries.Add(JsonSerializer.Deserialize<object>(entry.GetRawText(), JsonOptions)!);
                if (entry.TryGetProperty("id", out var idEl) && idEl.TryGetInt32(out var id) && id >= nextId)
                    nextId = id + 1;
            }

            var templates = new[]
            {
                new { area = "Kitchen", sourceStorageId = 1, name = "Walk-in Freezer", type = "Freezer", items = 0 },
                new { area = "Kitchen", sourceStorageId = 2, name = "Main Chiller", type = "Chiller", items = 0 },
                new { area = "Kitchen", sourceStorageId = 4, name = "Dry Store", type = "Dry Store", items = 0 },
            };
            foreach (var location in missing)
            {
                foreach (var template in templates)
                {
                    mergedEntries.Add(new
                    {
                        id = nextId++,
                        location,
                        template.area,
                        template.sourceStorageId,
                        template.name,
                        template.type,
                        template.items,
                    });
                }
            }

            config.StateJson = JsonSerializer.Serialize(new
            {
                areas,
                entries = mergedEntries,
                nextEntryId = nextId,
            }, JsonOptions);
            config.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }

    static async Task EnsureConfigAsync(BisyncDbContext db, int companyId, string configKey, string stateJson)
    {
        var exists = await db.RevMgmtCompanyConfigs
            .AnyAsync(c => c.CompanyId == companyId && c.ConfigKey == configKey);
        if (exists) return;

        db.RevMgmtCompanyConfigs.Add(new RevMgmtCompanyConfig
        {
            CompanyId = companyId,
            ConfigKey = configKey,
            StateJson = stateJson,
            UpdatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    static async Task SeedVendorProductsAsync(BisyncDbContext db)
    {
        if (await db.VendorProducts.AnyAsync())
            return;

        var seedPath = Path.Combine(AppContext.BaseDirectory, "Data", "Seeds", "vendor-products.seed.json");
        if (!File.Exists(seedPath))
        {
            seedPath = Path.Combine(Directory.GetCurrentDirectory(), "Data", "Seeds", "vendor-products.seed.json");
        }

        if (!File.Exists(seedPath))
        {
            Console.WriteLine($"Vendor product seed file not found: {seedPath}");
            return;
        }

        var json = await File.ReadAllTextAsync(seedPath);
        var items = JsonSerializer.Deserialize<List<VendorProductSeedDto>>(json, JsonOptions) ?? [];
        if (items.Count == 0) return;

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Id)) continue;

            db.VendorProducts.Add(new VendorProduct
            {
                ExternalId = item.Id.Trim().ToUpperInvariant(),
                VendorExternalId = item.VendorExternalId?.Trim() ?? string.Empty,
                VendorName = item.VendorName?.Trim() ?? string.Empty,
                ProductName = item.ProductName?.Trim() ?? string.Empty,
                Group = item.Group?.Trim() ?? "Dry Goods",
                Specification = item.Specification?.Trim() ?? string.Empty,
                ImageUrl = item.ImageUrl?.Trim() ?? string.Empty,
                DeliveryPrice = item.DeliveryPrice,
                DeliveryJson = item.Delivery is null
                    ? "{}"
                    : JsonSerializer.Serialize(item.Delivery, JsonOptions),
                ProductPolicyTag = item.ProductPolicyTag?.Trim() ?? string.Empty,
                IsPrivate = item.IsPrivate ?? false,
                PrivateLocationIdsJson = item.PrivateLocationIds is { Count: > 0 }
                    ? JsonSerializer.Serialize(item.PrivateLocationIds, JsonOptions)
                    : "[]",
                Active = item.Active ?? true,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
        Console.WriteLine($"Seeded {items.Count} vendor products.");
    }

    sealed class VendorProductSeedDto
    {
        public string? Id { get; set; }
        public string? VendorExternalId { get; set; }
        public string? VendorName { get; set; }
        public string? ProductName { get; set; }
        public string? Group { get; set; }
        public string? Specification { get; set; }
        public string? ImageUrl { get; set; }
        public decimal DeliveryPrice { get; set; }
        public object? Delivery { get; set; }
        public string? ProductPolicyTag { get; set; }
        public bool? IsPrivate { get; set; }
        public List<string>? PrivateLocationIds { get; set; }
        public bool? Active { get; set; }
    }
}
