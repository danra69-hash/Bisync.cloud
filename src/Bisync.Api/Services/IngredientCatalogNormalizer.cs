using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Canonicalizes ingredient Category / Group labels so UI filters (Food / Beverage)
/// match uploaded catalogs that often arrive as FOOD / BEVERAGE.
/// </summary>
public static class IngredientCatalogNormalizer
{
    static readonly string[] CanonicalCategories =
    [
        "Assets",
        "Ops Expenses",
        "FF&E",
        "Maintenance",
        "MarComm",
        "Food",
        "Beverage",
        "Retail",
    ];

    static readonly string[] CanonicalGroups =
    [
        "Proteins",
        "Dairy",
        "Produce",
        "Dry Goods",
        "Beverages",
        "Spirits",
        "Cleaning",
        "Equipment",
        "Packaging",
    ];

    static readonly Dictionary<string, string> CategoryAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["food"] = "Food",
        ["beverage"] = "Beverage",
        ["beverages"] = "Beverage",
        ["bev"] = "Beverage",
        ["retail"] = "Retail",
        ["assets"] = "Assets",
        ["ops expenses"] = "Ops Expenses",
        ["ops expense"] = "Ops Expenses",
        ["opex"] = "Ops Expenses",
        ["ff&e"] = "FF&E",
        ["ffe"] = "FF&E",
        ["maintenance"] = "Maintenance",
        ["marcomm"] = "MarComm",
        ["mar comm"] = "MarComm",
    };

    static readonly Dictionary<string, string> GroupAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["beer draft"] = "Draught Beer",
        ["draft beer"] = "Draught Beer",
        ["draught beer"] = "Draught Beer",
        ["bottle beer"] = "Bottled Beer",
        ["beer bottle"] = "Bottled Beer",
        ["bottled beer"] = "Bottled Beer",
    };

    public static string NormalizeCategory(string? raw)
    {
        var trimmed = (raw ?? string.Empty).Trim();
        if (trimmed.Length == 0) return trimmed;
        if (CategoryAliases.TryGetValue(trimmed, out var alias))
            return alias;
        foreach (var canonical in CanonicalCategories)
        {
            if (string.Equals(canonical, trimmed, StringComparison.OrdinalIgnoreCase))
                return canonical;
        }
        return trimmed;
    }

    public static string NormalizeGroup(string? raw)
    {
        var trimmed = (raw ?? string.Empty).Trim();
        if (trimmed.Length == 0) return trimmed;
        if (GroupAliases.TryGetValue(trimmed, out var alias))
            return alias;
        foreach (var canonical in CanonicalGroups)
        {
            if (string.Equals(canonical, trimmed, StringComparison.OrdinalIgnoreCase))
                return canonical;
        }
        return trimmed;
    }

    public static void ApplyTo(Ingredient ingredient)
    {
        ingredient.Category = NormalizeCategory(ingredient.Category);
        ingredient.Group = NormalizeGroup(ingredient.Group);
    }

    public static async Task NormalizeExistingAsync(BisyncDbContext db, CancellationToken cancellationToken = default)
    {
        var rows = await db.Ingredients.ToListAsync(cancellationToken);
        var dirty = false;
        foreach (var row in rows)
        {
            var category = NormalizeCategory(row.Category);
            var group = NormalizeGroup(row.Group);
            if (string.Equals(category, row.Category, StringComparison.Ordinal)
                && string.Equals(group, row.Group, StringComparison.Ordinal))
            {
                continue;
            }

            row.Category = category;
            row.Group = group;
            row.UpdatedAt = DateTime.UtcNow;
            dirty = true;
        }

        if (dirty)
            await db.SaveChangesAsync(cancellationToken);
    }
}
