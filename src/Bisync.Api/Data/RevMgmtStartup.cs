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
            await EnsureConfigAsync(db, companyId, RevMgmtConfigController.StorageAssignmentKey,
                JsonSerializer.Serialize(RevMgmtDefaults.StorageAssignment(), JsonOptions));
            await EnsureConfigAsync(db, companyId, RevMgmtConfigController.ComponentCatalogKey,
                JsonSerializer.Serialize(RevMgmtDefaults.ComponentCatalog(), JsonOptions));
        }
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
