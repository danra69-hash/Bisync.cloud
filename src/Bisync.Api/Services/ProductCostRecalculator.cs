using System.Globalization;
using System.Text.RegularExpressions;
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

    /// <summary>
    /// When a sub-product recipe/identity changes, remount denormalized parent BOM lines that
    /// reference it (ComponentId / name / principal UOM / unit COGS) and resum parent totals.
    /// Cascades into parent sub-products so nested recipes stay linked.
    /// </summary>
    public static async Task RelinkParentsForSubProductAsync(
        BisyncDbContext db,
        Product subProduct,
        string? previousProductId = null,
        string? previousBatchLabel = null,
        HashSet<int>? visited = null)
    {
        if (subProduct is null || !subProduct.IsSubProduct)
            return;

        visited ??= new HashSet<int>();
        if (!visited.Add(subProduct.Id))
            return;

        var currentId = (subProduct.ProductId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(currentId))
            return;

        var idsToMatch = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { currentId };
        var previousId = previousProductId?.Trim();
        if (!string.IsNullOrWhiteSpace(previousId))
            idsToMatch.Add(previousId);

        var batchCogs = ResolveSubProductBatchCogs(subProduct);
        var batchLabel = FormatSubProductBatchLabel(subProduct);
        var principalUom = FormatPrincipalUom(subProduct.YieldUom);
        var unitCost = subProduct.YieldQuantity > 0 ? batchCogs / subProduct.YieldQuantity : 0m;
        var yieldUom = subProduct.YieldUom?.Trim() ?? string.Empty;
        var name = subProduct.Name?.Trim() ?? string.Empty;

        var componentItems = await db.ProductComponentItems
            .Where(i => idsToMatch.Contains(i.ComponentId))
            .ToListAsync();
        var packagingItems = await db.ProductPackagingItems
            .Where(i => idsToMatch.Contains(i.ComponentId))
            .ToListAsync();

        var parentIds = new HashSet<int>();

        foreach (var item in componentItems)
        {
            if (ApplySubProductLineLink(
                    item,
                    currentId,
                    name,
                    principalUom,
                    batchLabel,
                    previousBatchLabel,
                    yieldUom,
                    unitCost))
            {
                parentIds.Add(item.ProductId);
            }
        }

        foreach (var item in packagingItems)
        {
            if (ApplySubProductLineLink(
                    item,
                    currentId,
                    name,
                    principalUom,
                    batchLabel,
                    previousBatchLabel,
                    yieldUom,
                    unitCost))
            {
                parentIds.Add(item.ProductId);
            }
        }

        if (parentIds.Count == 0)
            return;

        // Exclude the sub-product itself if it somehow referenced its own code.
        parentIds.Remove(subProduct.Id);

        var parents = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => parentIds.Contains(p.Id))
            .ToListAsync();

        var nestedSubsToCascade = new List<Product>();

        foreach (var parent in parents)
        {
            var newTotalCost = parent.Items.Sum(i => i.Subtotal);
            if (parent.IsVariableProduct
                && string.Equals(parent.VariableMode, "combination", StringComparison.OrdinalIgnoreCase)
                && parent.Items.Count == 0)
            {
                newTotalCost = parent.VariableMinCost;
            }

            var newPackagingCost = parent.PackagingItems.Sum(i => i.Subtotal);
            var costChanged = parent.TotalCost != newTotalCost || parent.PackagingCost != newPackagingCost;
            ProductCogsSnapshot.CaptureIfChanged(parent, newTotalCost, newPackagingCost, parent.Rrp);
            parent.TotalCost = newTotalCost;
            parent.PackagingCost = newPackagingCost;
            parent.UpdatedAt = DateTime.UtcNow;

            if (costChanged && parent.IsSubProduct)
                nestedSubsToCascade.Add(parent);
        }

        await db.SaveChangesAsync();

        foreach (var nested in nestedSubsToCascade)
        {
            await RelinkParentsForSubProductAsync(
                db,
                nested,
                previousProductId: nested.ProductId,
                previousBatchLabel: null,
                visited: visited);
        }
    }

    /// <summary>
    /// One-shot/idempotent remount of parent recipe lines that still store whole-batch UOMs
    /// (e.g. 2000gr @ batch COGS) onto principal Batch Produce UOM + per-unit COGS.
    /// </summary>
    public static async Task RemountAllSubProductRecipeUnitsAsync(BisyncDbContext db)
    {
        var uoms = await db.ProductComponentItems
            .AsNoTracking()
            .Select(i => i.ComponentUom)
            .Distinct()
            .ToListAsync();
        var packagingUoms = await db.ProductPackagingItems
            .AsNoTracking()
            .Select(i => i.ComponentUom)
            .Distinct()
            .ToListAsync();

        var hasLegacyBatchLabel = uoms.Concat(packagingUoms)
            .Any(u => !string.IsNullOrWhiteSpace(u)
                && Regex.IsMatch(CompactUomKey(u), @"^\d+(\.\d+)?[a-z]+$"));
        if (!hasLegacyBatchLabel)
            return;

        var subs = await db.Products
            .Where(p => p.IsSubProduct)
            .OrderBy(p => p.Id)
            .ToListAsync();

        foreach (var sub in subs)
        {
            await RelinkParentsForSubProductAsync(db, sub);
        }
    }

    public static decimal ResolveSubProductBatchCogs(Product subProduct)
        => subProduct.TotalCost + subProduct.PackagingCost;

    /// <summary>Legacy whole-batch label (e.g. 10each, 2000gr) — used only to detect/migrate old rows.</summary>
    public static string FormatSubProductBatchLabel(Product subProduct)
    {
        if (subProduct.YieldQuantity <= 0 || string.IsNullOrWhiteSpace(subProduct.YieldUom))
            return string.Empty;

        var qty = FormatBatchQty(subProduct.YieldQuantity);
        if (string.IsNullOrWhiteSpace(qty))
            return string.Empty;

        return $"{qty}{NormalizeDisplayUom(subProduct.YieldUom)}";
    }

    /// <summary>Principal Batch Produce UOM for recipe usage (matches client <c>fromApiUom</c>).</summary>
    public static string FormatPrincipalUom(string? yieldUom)
    {
        var trimmed = (yieldUom ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return string.Empty;

        return trimmed.ToLowerInvariant() switch
        {
            "g" or "gr" or "gram" or "grams" => "Gr",
            "mg" => "Mg",
            "kg" => "Kg",
            "ml" => "Ml",
            "cl" => "Cl",
            "l" or "ltr" or "litre" or "liter" => "Ltr",
            "pcs" or "each" or "pc" => "Each",
            "btl" or "bottle" => "Bottle",
            "can" => "Can",
            "tin" => "Tin",
            "slice" => "Slice",
            "pack" => "Pack",
            "case" => "Case",
            "box" => "Box",
            "set" => "Set",
            _ => char.ToUpperInvariant(trimmed[0]) + trimmed[1..].ToLowerInvariant(),
        };
    }

    private static bool ApplySubProductLineLink(
        ProductComponentItem item,
        string currentId,
        string name,
        string principalUom,
        string batchLabel,
        string? previousBatchLabel,
        string yieldUom,
        decimal unitCost)
    {
        var changed = false;

        if (!string.Equals(item.ComponentId, currentId, StringComparison.OrdinalIgnoreCase))
        {
            item.ComponentId = currentId;
            changed = true;
        }

        if (!string.Equals(item.ComponentName ?? string.Empty, name, StringComparison.Ordinal))
        {
            item.ComponentName = name;
            changed = true;
        }

        var remountPrincipal = ShouldRemountToPrincipalUom(
            item.ComponentUom, principalUom, batchLabel, previousBatchLabel, yieldUom);
        if (remountPrincipal && !string.IsNullOrWhiteSpace(principalUom)
            && !string.Equals(item.ComponentUom, principalUom, StringComparison.Ordinal))
        {
            item.ComponentUom = principalUom;
            changed = true;
        }

        // Only rewrite price for principal/legacy-batch lines — leave alternate UOMs alone.
        if (!remountPrincipal
            && !string.IsNullOrWhiteSpace(item.ComponentUom)
            && !UomKeysMatch(item.ComponentUom, principalUom))
        {
            return changed;
        }

        var newPrice = unitCost;
        var newSubtotal = item.Quantity * newPrice;
        if (item.ComponentUomPrice != newPrice || item.Subtotal != newSubtotal)
        {
            item.ComponentUomPrice = newPrice;
            item.Subtotal = newSubtotal;
            changed = true;
        }

        return changed;
    }

    private static bool ApplySubProductLineLink(
        ProductPackagingItem item,
        string currentId,
        string name,
        string principalUom,
        string batchLabel,
        string? previousBatchLabel,
        string yieldUom,
        decimal unitCost)
    {
        var changed = false;

        if (!string.Equals(item.ComponentId, currentId, StringComparison.OrdinalIgnoreCase))
        {
            item.ComponentId = currentId;
            changed = true;
        }

        if (!string.Equals(item.ComponentName ?? string.Empty, name, StringComparison.Ordinal))
        {
            item.ComponentName = name;
            changed = true;
        }

        var remountPrincipal = ShouldRemountToPrincipalUom(
            item.ComponentUom, principalUom, batchLabel, previousBatchLabel, yieldUom);
        if (remountPrincipal && !string.IsNullOrWhiteSpace(principalUom)
            && !string.Equals(item.ComponentUom, principalUom, StringComparison.Ordinal))
        {
            item.ComponentUom = principalUom;
            changed = true;
        }

        if (!remountPrincipal
            && !string.IsNullOrWhiteSpace(item.ComponentUom)
            && !UomKeysMatch(item.ComponentUom, principalUom))
        {
            return changed;
        }

        var newPrice = unitCost;
        var newSubtotal = item.Quantity * newPrice;
        if (item.ComponentUomPrice != newPrice || item.Subtotal != newSubtotal)
        {
            item.ComponentUomPrice = newPrice;
            item.Subtotal = newSubtotal;
            changed = true;
        }

        return changed;
    }

    private static bool ShouldRemountToPrincipalUom(
        string? lineUom,
        string principalUom,
        string batchLabel,
        string? previousBatchLabel,
        string yieldUom)
    {
        if (string.IsNullOrWhiteSpace(lineUom))
            return true;
        if (!string.IsNullOrWhiteSpace(principalUom) && UomKeysMatch(lineUom, principalUom))
            return true;
        if (!string.IsNullOrWhiteSpace(batchLabel) && UomKeysMatch(lineUom, batchLabel))
            return true;
        if (!string.IsNullOrWhiteSpace(previousBatchLabel) && UomKeysMatch(lineUom, previousBatchLabel))
            return true;
        if (!string.IsNullOrWhiteSpace(yieldUom) && UomKeysMatch(lineUom, yieldUom))
            return true;
        // Any compact "1234uom" label is treated as a legacy whole-batch UOM.
        var compact = CompactUomKey(lineUom);
        return Regex.IsMatch(compact, @"^\d+(\.\d+)?[a-z]+$");
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

    private static string NormalizeDisplayUom(string uom)
    {
        var trimmed = uom.Trim();
        if (UomAliases.TryGetValue(trimmed, out var aliased))
            return aliased;
        // Mirror client fromApiUom for common recipe codes used in yield.
        return trimmed.ToLowerInvariant() switch
        {
            "g" or "gr" or "gram" or "grams" => "gr",
            "pcs" or "each" or "pc" => "each",
            "l" or "ltr" or "litre" or "liter" => "ltr",
            _ => trimmed.ToLowerInvariant(),
        };
    }

    private static string FormatBatchQty(decimal value)
    {
        if (value <= 0)
            return string.Empty;
        if (value == decimal.Truncate(value))
            return ((long)value).ToString(CultureInfo.InvariantCulture);

        var text = value.ToString("0.##", CultureInfo.InvariantCulture);
        return text.TrimEnd('0').TrimEnd('.');
    }

    private static bool UomKeysMatch(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right))
            return false;
        return CompactUomKey(left) == CompactUomKey(right);
    }

    private static string CompactUomKey(string uom)
    {
        var compact = Regex.Replace(uom.Trim().ToLowerInvariant(), @"\s+", string.Empty);
        // Normalize "10 each" / "10each" / "10pcs" loosely for primary batch compares.
        compact = compact.Replace("pcs", "each");
        compact = compact.Replace("gram", "gr").Replace("grams", "gr");
        if (compact.EndsWith("g", StringComparison.Ordinal) && !compact.EndsWith("gr", StringComparison.Ordinal)
            && Regex.IsMatch(compact, @"^\d+(\.\d+)?g$"))
        {
            compact = compact[..^1] + "gr";
        }
        return compact;
    }
}
