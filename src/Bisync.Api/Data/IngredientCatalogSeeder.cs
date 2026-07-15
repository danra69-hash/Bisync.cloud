using System.Text.Json;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Ensures food &amp; beverage smart components exist for compare-price and tagging demos.
/// Inserts only when the component name is not already in the database.
/// </summary>
public static class IngredientCatalogSeeder
{
    private static readonly IngredientSeedRecord[] CatalogIngredients =
    [
        new("Lamb Rack", "Food", "Proteins", "g", "kg", ["Chiller"], 0.95m, 95m, 1.8m, 4),
        new("Duck Breast", "Food", "Proteins", "g", "kg", ["Chiller"], 0.42m, 42m, 2.2m, 3),
        new("Pork Belly", "Food", "Proteins", "g", "kg", ["Chiller"], 0.28m, 28m, 3.5m, 3),
        new("Chicken Thigh", "Food", "Proteins", "g", "kg", ["Chiller"], 0.18m, 18m, 5m, 2),
        new("Tiger Prawns", "Food", "Seafood", "g", "kg", ["Freezer"], 0.65m, 65m, 2.8m, 3),
        new("Bluefin Tuna", "Food", "Seafood", "g", "kg", ["Freezer"], 1.20m, 120m, 1.5m, 4),
        new("Atlantic Cod", "Food", "Seafood", "g", "kg", ["Chiller"], 0.38m, 38m, 2.4m, 3),
        new("Mozzarella Fior di Latte", "Food", "Dairy", "g", "kg", ["Chiller"], 0.045m, 45m, 2m, 2),
        new("Parmesan Reggiano", "Food", "Dairy", "g", "kg", ["Chiller"], 0.12m, 120m, 0.8m, 7),
        new("Unsalted Butter", "Food", "Dairy", "g", "kg", ["Chiller"], 0.035m, 35m, 1.2m, 5),
        new("Heavy Cream", "Food", "Dairy", "ml", "l", ["Chiller"], 0.018m, 18m, 3.5m, 3),
        new("Free Range Eggs", "Food", "Dairy", "pcs", "pcs", ["Chiller"], 0.85m, 0.85m, 120m, 2),
        new("Rocket Arugula", "Food", "Produce", "g", "kg", ["Chiller"], 0.022m, 22m, 1.5m, 2),
        new("Roma Tomatoes", "Food", "Produce", "g", "kg", ["Chiller"], 0.008m, 8m, 4m, 2),
        new("Yellow Onions", "Food", "Produce", "g", "kg", ["Dry Store"], 0.004m, 4m, 3m, 3),
        new("Peeled Garlic", "Food", "Produce", "g", "kg", ["Chiller"], 0.015m, 15m, 0.6m, 5),
        new("Russet Potatoes", "Food", "Produce", "g", "kg", ["Dry Store"], 0.003m, 3m, 8m, 4),
        new("Basmati Rice", "Food", "Dry Goods", "g", "kg", ["Dry Store"], 0.006m, 6m, 2.5m, 7),
        new("Penne Pasta", "Food", "Dry Goods", "g", "kg", ["Dry Store"], 0.005m, 5m, 3m, 10),
        new("00 Flour", "Food", "Dry Goods", "g", "kg", ["Dry Store"], 0.003m, 3m, 4m, 14),
        new("Olive Oil Extra Virgin", "Food", "Dry Goods", "ml", "l", ["Dry Store"], 0.012m, 12m, 0.8m, 14),
        new("Balsamic Vinegar", "Food", "Dry Goods", "ml", "l", ["Dry Store"], 0.025m, 25m, 0.3m, 21),
        new("Sea Salt Flakes", "Food", "Dry Goods", "g", "kg", ["Dry Store"], 0.008m, 8m, 0.4m, 30),
        new("Black Peppercorns", "Food", "Dry Goods", "g", "kg", ["Dry Store"], 0.035m, 35m, 0.2m, 30),
        new("Tomato Passata", "Food", "Dry Goods", "ml", "l", ["Dry Store"], 0.006m, 6m, 2.2m, 7),
        new("Fresh Orange Juice", "Beverage", "Beverages", "ml", "l", ["Chiller"], 0.008m, 8m, 6m, 2),
        new("Craft IPA Beer", "Beverage", "Spirits", "ml", "l", ["Bar"], 0.015m, 15m, 12m, 5),
        new("House Red Wine", "Beverage", "Spirits", "ml", "l", ["Wine Cellar"], 0.012m, 12m, 4m, 7),
        new("Tonic Water", "Beverage", "Beverages", "ml", "l", ["Bar"], 0.005m, 5m, 8m, 4),
        new("Oat Milk Barista", "Beverage", "Beverages", "ml", "l", ["Chiller"], 0.007m, 7m, 5m, 3),
    ];

    public static async Task EnsureCatalogIngredientsAsync(BisyncDbContext db)
    {
        var defaultCompanyId = await db.Companies.AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();
        if (defaultCompanyId is null)
            return;

        var existingNames = await db.Ingredients
            .Where(i => i.CompanyId == defaultCompanyId)
            .Select(i => i.Name.ToLower())
            .ToListAsync();

        var existing = new HashSet<string>(existingNames);
        var added = false;

        foreach (var seed in CatalogIngredients)
        {
            if (existing.Contains(seed.Name.ToLower()))
                continue;

            var code = await CompanyCodeService.ResolveCodeAsync(db, defaultCompanyId.Value);
            var componentId = await ComponentIdGenerator.GenerateAsync(db, code, defaultCompanyId);
            db.Ingredients.Add(seed.ToIngredient(componentId, defaultCompanyId.Value));
            added = true;
        }

        if (added)
            await db.SaveChangesAsync();
    }

    private sealed record IngredientSeedRecord(
        string Name,
        string Category,
        string Group,
        string RecipeUom,
        string InventoryUom,
        string[] Storage,
        decimal LastPriceRecipe,
        decimal LastPriceInventory,
        decimal DailyUsage,
        int OrderFreqDays)
    {
        public Ingredient ToIngredient(string componentId, int companyId) => new()
        {
            CompanyId = companyId,
            ComponentId = componentId,
            Name = Name,
            Category = Category,
            Group = Group,
            RecipeUom = RecipeUom,
            InventoryUom = InventoryUom,
            LastPriceRecipe = LastPriceRecipe,
            LastPriceInventory = LastPriceInventory,
            DailyUsage = DailyUsage,
            OrderFreqDays = OrderFreqDays,
            StorageJson = JsonSerializer.Serialize(Storage),
            StorageNote = string.Empty,
            DetailConfigJson = "{}",
            AttachedProducts = 0,
            AttachedVendors = 0,
            Active = true,
            LocationsJson = JsonSerializer.Serialize(new[] { "all" }),
        };
    }
}
