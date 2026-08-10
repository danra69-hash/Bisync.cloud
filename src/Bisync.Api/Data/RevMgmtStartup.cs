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

        // Replace demo Food/Proteins/Beef hierarchy residue with live component categories/groups.
        await RebuildSeededComponentHierarchiesAsync(db);

        // Backfill My Storage for company locations that only have the old downtown/midtown/westend seed.
        await BackfillMissingLocationStorageAsync(db);
    }

    /// <summary>
    /// Legacy Component Hierarchy seeded Food/Beverage + sample groups with fake item counts.
    /// Rebuild those rows from each company's real Ingredients so Config matches user data.
    /// </summary>
    static async Task RebuildSeededComponentHierarchiesAsync(BisyncDbContext db)
    {
        var configs = await db.RevMgmtCompanyConfigs
            .Where(c => c.ConfigKey == RevMgmtConfigController.ComponentHierarchyKey)
            .ToListAsync();
        if (configs.Count == 0) return;

        var ingredients = await db.Ingredients.AsNoTracking()
            .Select(i => new { i.CompanyId, i.Category, i.Group })
            .ToListAsync();

        var changed = false;
        foreach (var config in configs)
        {
            if (!LooksLikeLegacySeedHierarchy(config.StateJson))
                continue;

            var companyIngredients = ingredients
                .Where(i => i.CompanyId == config.CompanyId)
                .Select(i => (Category: i.Category ?? "", Group: i.Group ?? ""))
                .ToList();

            config.StateJson = JsonSerializer.Serialize(
                BuildHierarchyFromComponents(companyIngredients),
                JsonOptions);
            config.UpdatedAt = DateTime.UtcNow;
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync();
    }

    static readonly HashSet<string> LegacySeedGroupNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Proteins", "Dairy", "Produce", "Spirits", "Dry Goods",
    };

    static readonly HashSet<string> LegacySeedSubGroupNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Beef", "Poultry", "Cheese", "Whisky",
    };

    static bool LooksLikeLegacySeedHierarchy(string? stateJson)
    {
        if (string.IsNullOrWhiteSpace(stateJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(stateJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("groups", out var groupsEl) || groupsEl.ValueKind != JsonValueKind.Array)
                return false;
            if (!root.TryGetProperty("subGroups", out var subsEl) || subsEl.ValueKind != JsonValueKind.Array)
                return false;

            var groupNames = groupsEl.EnumerateArray()
                .Select(g => g.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "")
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToList();
            var subNames = subsEl.EnumerateArray()
                .Select(g => g.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "")
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToList();

            // Only treat as disposable seed when every group/sub-group is from the demo tree
            // (user-created categories/groups are preserved and cleaned client-side).
            if (groupNames.Any(n => !LegacySeedGroupNames.Contains(n))) return false;
            if (subNames.Any(n => !LegacySeedSubGroupNames.Contains(n))) return false;

            var seedGroups = groupNames.Count(n => LegacySeedGroupNames.Contains(n));
            var seedSubs = subNames.Count(n => LegacySeedSubGroupNames.Contains(n));
            var fakeItems = groupsEl.EnumerateArray().Any(g =>
                g.TryGetProperty("items", out var items) && items.TryGetInt32(out var n) && n > 0)
                || subsEl.EnumerateArray().Any(g =>
                    g.TryGetProperty("items", out var items) && items.TryGetInt32(out var n) && n > 0);

            return (seedGroups >= 3 && seedSubs >= 2) || (seedGroups >= 4 && fakeItems);
        }
        catch
        {
            return false;
        }
    }

    static object BuildHierarchyFromComponents(IReadOnlyList<(string Category, string Group)> components)
    {
        var categoryIds = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var groupCounts = new Dictionary<(int CategoryId, string GroupName), int>(
            new CategoryGroupComparer());
        var nextCategoryId = 1;

        foreach (var (rawCategory, rawGroup) in components)
        {
            var category = (rawCategory ?? "").Trim();
            var group = (rawGroup ?? "").Trim();
            if (string.IsNullOrWhiteSpace(category)) continue;

            if (!categoryIds.TryGetValue(category, out var categoryId))
            {
                categoryId = nextCategoryId++;
                categoryIds[category] = categoryId;
            }

            if (string.IsNullOrWhiteSpace(group)) continue;
            var key = (categoryId, group);
            groupCounts[key] = groupCounts.TryGetValue(key, out var count) ? count + 1 : 1;
        }

        var categories = categoryIds
            .OrderBy(kv => kv.Value)
            .Select(kv => new { id = kv.Value, name = kv.Key })
            .ToList();

        var nextGroupId = 1;
        var groups = groupCounts
            .OrderBy(kv => kv.Key.CategoryId)
            .ThenBy(kv => kv.Key.GroupName, StringComparer.OrdinalIgnoreCase)
            .Select(kv => new
            {
                id = nextGroupId++,
                categoryId = kv.Key.CategoryId,
                name = kv.Key.GroupName,
                items = kv.Value,
            })
            .ToList();

        return new
        {
            categories,
            groups,
            subGroups = Array.Empty<object>(),
            nextCategoryId,
            nextGroupId,
            nextSubGroupId = 1,
        };
    }

    sealed class CategoryGroupComparer : IEqualityComparer<(int CategoryId, string GroupName)>
    {
        public bool Equals((int CategoryId, string GroupName) x, (int CategoryId, string GroupName) y) =>
            x.CategoryId == y.CategoryId
            && string.Equals(x.GroupName, y.GroupName, StringComparison.OrdinalIgnoreCase);

        public int GetHashCode((int CategoryId, string GroupName) obj) =>
            HashCode.Combine(obj.CategoryId, StringComparer.OrdinalIgnoreCase.GetHashCode(obj.GroupName));
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
