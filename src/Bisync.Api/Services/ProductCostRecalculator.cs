using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class ProductCostRecalculator
{
    private static readonly Dictionary<string, string> UomAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["g"] = "g",
        ["gr"] = "g",
        ["kg"] = "kg",
        ["mg"] = "mg",
        ["l"] = "l",
        ["ltr"] = "l",
        ["ml"] = "ml",
        ["cl"] = "cl",
        ["pcs"] = "pcs",
        ["each"] = "pcs",
    };

    public static async Task RecalculateForComponentAsync(BisyncDbContext db, string componentId)
    {
        if (string.IsNullOrWhiteSpace(componentId))
            return;

        var ingredient = await db.Ingredients
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.ComponentId == componentId);

        if (ingredient is null || ingredient.LastPriceRecipe <= 0)
            return;

        var unitPrice = ingredient.LastPriceRecipe;
        var recipeUom = ingredient.RecipeUom?.Trim() ?? string.Empty;
        var productIds = new HashSet<int>();
        var changed = false;

        var componentItems = await db.ProductComponentItems
            .Where(i => i.ComponentId == componentId)
            .ToListAsync();

        foreach (var item in componentItems)
        {
            if (!ShouldUpdateLinePrice(item.ComponentUom, recipeUom))
                continue;

            if (item.ComponentUomPrice == unitPrice && item.Subtotal == item.Quantity * unitPrice)
                continue;

            item.ComponentUomPrice = unitPrice;
            item.Subtotal = item.Quantity * unitPrice;
            productIds.Add(item.ProductId);
            changed = true;
        }

        var packagingItems = await db.ProductPackagingItems
            .Where(i => i.ComponentId == componentId)
            .ToListAsync();

        foreach (var item in packagingItems)
        {
            if (!ShouldUpdateLinePrice(item.ComponentUom, recipeUom))
                continue;

            if (item.ComponentUomPrice == unitPrice && item.Subtotal == item.Quantity * unitPrice)
                continue;

            item.ComponentUomPrice = unitPrice;
            item.Subtotal = item.Quantity * unitPrice;
            productIds.Add(item.ProductId);
            changed = true;
        }

        if (!changed || productIds.Count == 0)
            return;

        var products = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync();

        foreach (var product in products)
        {
            var newTotalCost = product.Items.Sum(i => i.Subtotal);
            var newPackagingCost = product.PackagingItems.Sum(i => i.Subtotal);
            ProductCogsSnapshot.CaptureIfChanged(product, newTotalCost, newPackagingCost, product.Rrp);
            product.TotalCost = newTotalCost;
            product.PackagingCost = newPackagingCost;
            product.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }

    private static bool ShouldUpdateLinePrice(string lineUom, string recipeUom)
    {
        if (string.IsNullOrWhiteSpace(lineUom))
            return true;

        if (string.IsNullOrWhiteSpace(recipeUom))
            return true;

        return NormalizeUom(lineUom) == NormalizeUom(recipeUom);
    }

    private static string NormalizeUom(string uom)
    {
        var trimmed = uom.Trim();
        return UomAliases.TryGetValue(trimmed, out var normalized)
            ? normalized
            : trimmed.ToLowerInvariant();
    }
}
