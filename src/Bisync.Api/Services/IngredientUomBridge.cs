using System.Globalization;
using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Converts quantities between an ingredient's recipe (Principal Component Unit) and inventory UOMs
/// using DetailConfigJson. Stock cards base on Principal Component Unit (recipe) and match
/// movements by UOM (with inventory↔recipe conversion), so inbound writes prefer PCU.
/// </summary>
public static class IngredientUomBridge
{
    public static (decimal Quantity, string Uom) ToInventoryPreferred(
        Ingredient ingredient,
        decimal quantity,
        string uom)
    {
        if (quantity <= 0 || ingredient is null)
            return (quantity, (uom ?? string.Empty).Trim());

        var selected = Normalize(uom);
        var inventory = Normalize(ingredient.InventoryUom);
        var recipe = Normalize(ingredient.RecipeUom);

        if (string.IsNullOrEmpty(selected))
            return (quantity, ingredient.InventoryUom?.Trim() ?? uom);

        if (!string.IsNullOrEmpty(inventory) && selected == inventory)
            return (quantity, ingredient.InventoryUom.Trim());

        if (!string.IsNullOrEmpty(recipe)
            && selected == recipe
            && !string.IsNullOrEmpty(inventory)
            && recipe != inventory
            && TryGetRatio(ingredient.DetailConfigJson, out var inventoryPer, out var recipePer)
            && recipePer > 0)
        {
            // inventoryPer inventoryUom = recipePer recipeUom
            var inventoryQty = quantity * (inventoryPer / recipePer);
            return (inventoryQty, ingredient.InventoryUom.Trim());
        }

        return (quantity, uom.Trim());
    }

    /// <summary>
    /// Prefer Principal Component Unit (RecipeUom) for stock card / on-hand writes.
    /// </summary>
    public static (decimal Quantity, string Uom) ToRecipePreferred(
        Ingredient ingredient,
        decimal quantity,
        string uom)
    {
        if (quantity <= 0 || ingredient is null)
            return (quantity, (uom ?? string.Empty).Trim());

        var selected = Normalize(uom);
        var inventory = Normalize(ingredient.InventoryUom);
        var recipe = Normalize(ingredient.RecipeUom);
        var recipeLabel = string.IsNullOrWhiteSpace(ingredient.RecipeUom)
            ? (uom ?? string.Empty).Trim()
            : ingredient.RecipeUom.Trim();

        if (string.IsNullOrEmpty(selected))
            return (quantity, recipeLabel);

        if (!string.IsNullOrEmpty(recipe) && selected == recipe)
            return (quantity, recipeLabel);

        if (!string.IsNullOrEmpty(inventory)
            && selected == inventory
            && !string.IsNullOrEmpty(recipe)
            && recipe != inventory
            && TryGetRatio(ingredient.DetailConfigJson, out var inventoryPer, out var recipePer)
            && inventoryPer > 0)
        {
            // inventoryPer inventoryUom = recipePer recipeUom
            var recipeQty = quantity * (recipePer / inventoryPer);
            return (recipeQty, recipeLabel);
        }

        return (quantity, (uom ?? string.Empty).Trim());
    }

    /// <summary>
    /// Converts a received delivery-package quantity into Principal Component Unit for stock posting.
    /// Uses tagged <c>vendorProductPrincipalQty</c> when available; otherwise converts inventory/component
    /// UOM → recipe. Unit price is scaled so total value is preserved.
    /// </summary>
    public static (decimal Quantity, string Uom, decimal UnitPrice) ToInboundPrincipal(
        Ingredient ingredient,
        decimal quantity,
        string uom,
        decimal unitPrice,
        string? vendorProductId = null,
        string? deliveryUom = null)
    {
        var sourceUom = (uom ?? string.Empty).Trim();
        if (quantity <= 0 || ingredient is null)
            return (quantity, sourceUom, unitPrice);

        var recipeLabel = string.IsNullOrWhiteSpace(ingredient.RecipeUom)
            ? sourceUom
            : ingredient.RecipeUom.Trim();
        var recipe = Normalize(ingredient.RecipeUom);
        var inventory = Normalize(ingredient.InventoryUom);
        var selected = Normalize(sourceUom);
        var delivery = Normalize(deliveryUom);

        // Prefer tagged principal qty: delivery packages × PCU-per-package.
        if (TryGetVendorPrincipalPerPackage(
                ingredient.DetailConfigJson,
                vendorProductId,
                out var principalPerPackage,
                out var taggedComponentUom)
            && principalPerPackage > 0)
        {
            var principalInRecipe = principalPerPackage;
            var tagged = Normalize(taggedComponentUom);
            if (!string.IsNullOrEmpty(tagged)
                && !string.IsNullOrEmpty(recipe)
                && tagged != recipe
                && TryConvertQuantity(ingredient, principalPerPackage, taggedComponentUom, recipeLabel, out var convertedPrincipal))
            {
                principalInRecipe = convertedPrincipal;
            }
            else if (!string.IsNullOrEmpty(tagged)
                     && !string.IsNullOrEmpty(inventory)
                     && tagged == inventory
                     && !string.IsNullOrEmpty(recipe)
                     && tagged != recipe)
            {
                var (converted, _) = ToRecipePreferred(ingredient, principalPerPackage, taggedComponentUom);
                principalInRecipe = converted;
            }

            if (principalInRecipe > 0)
            {
                var stockQty = quantity * principalInRecipe;
                var stockPrice = stockQty > 0
                    ? unitPrice / principalInRecipe
                    : unitPrice;
                return (stockQty, recipeLabel, stockPrice);
            }
        }

        // Already PCU (or convertible inventory → PCU).
        if (!string.IsNullOrEmpty(recipe) && selected == recipe)
            return (quantity, recipeLabel, unitPrice);

        if (!string.IsNullOrEmpty(inventory) && selected == inventory
            && !string.IsNullOrEmpty(recipe) && recipe != inventory)
        {
            var (convertedQty, convertedUom) = ToRecipePreferred(ingredient, quantity, sourceUom);
            if (convertedQty > 0 && quantity > 0 && ConvertedAwayFromSource(quantity, convertedQty, selected, Normalize(convertedUom)))
            {
                var stockPrice = unitPrice * (quantity / convertedQty);
                return (convertedQty, convertedUom, stockPrice);
            }
            return (convertedQty, convertedUom, unitPrice);
        }

        // Qty may still be labeled with delivery UOM while ComponentUom was empty.
        if (!string.IsNullOrEmpty(delivery)
            && delivery != recipe
            && delivery != inventory
            && selected == delivery)
        {
            // No principal factor — keep as-is but label PCU when recipe exists so stock card can show it.
            if (!string.IsNullOrEmpty(recipeLabel))
                return (quantity, recipeLabel, unitPrice);
        }

        var (fallbackQty, fallbackUom) = ToRecipePreferred(ingredient, quantity, sourceUom);
        return (fallbackQty, fallbackUom, unitPrice);
    }

    /// <summary>
    /// Converts quantity (and unit price) from <paramref name="fromUom"/> into <paramref name="toUom"/>
    /// when both are the ingredient's recipe/inventory principals (or identical).
    /// </summary>
    public static bool TryConvertToUom(
        Ingredient ingredient,
        decimal quantity,
        decimal unitPrice,
        string fromUom,
        string toUom,
        out decimal convertedQty,
        out decimal convertedPrice)
    {
        convertedQty = quantity;
        convertedPrice = unitPrice;
        if (ingredient is null) return false;

        var from = Normalize(fromUom);
        var to = Normalize(toUom);
        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to))
            return false;
        if (from == to)
            return true;

        if (!TryConvertQuantity(ingredient, quantity, fromUom, toUom, out convertedQty))
            return false;

        if (quantity > 0 && convertedQty > 0)
            convertedPrice = unitPrice * (quantity / convertedQty);
        return true;
    }

    public static bool TryConvertQuantity(
        Ingredient ingredient,
        decimal quantity,
        string fromUom,
        string toUom,
        out decimal convertedQty)
    {
        convertedQty = quantity;
        if (ingredient is null) return false;

        var from = Normalize(fromUom);
        var to = Normalize(toUom);
        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to))
            return false;
        if (from == to)
            return true;

        var inventory = Normalize(ingredient.InventoryUom);
        var recipe = Normalize(ingredient.RecipeUom);

        if (string.IsNullOrEmpty(inventory) || string.IsNullOrEmpty(recipe) || inventory == recipe)
            return false;

        if (!TryGetRatio(ingredient.DetailConfigJson, out var inventoryPer, out var recipePer)
            || inventoryPer <= 0
            || recipePer <= 0)
            return false;

        if (from == inventory && to == recipe)
        {
            convertedQty = quantity * (recipePer / inventoryPer);
            return true;
        }

        if (from == recipe && to == inventory)
        {
            convertedQty = quantity * (inventoryPer / recipePer);
            return true;
        }

        return false;
    }

    static bool TryGetVendorPrincipalPerPackage(
        string? detailConfigJson,
        string? vendorProductId,
        out decimal principalPerPackage,
        out string componentUom)
    {
        principalPerPackage = 0m;
        componentUom = string.Empty;
        var vpId = (vendorProductId ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(vpId) || string.IsNullOrWhiteSpace(detailConfigJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("vendorProductPrincipalQty", out var qtyMap)
                && qtyMap.ValueKind == JsonValueKind.Object)
            {
                if (TryGetMapDecimal(qtyMap, vpId, out var qty) && qty > 0)
                    principalPerPackage = qty;
            }

            if (root.TryGetProperty("vendorProductComponentUom", out var uomMap)
                && uomMap.ValueKind == JsonValueKind.Object)
            {
                componentUom = TryGetMapString(uomMap, vpId);
            }

            return principalPerPackage > 0;
        }
        catch
        {
            return false;
        }
    }

    static bool TryGetMapDecimal(JsonElement map, string key, out decimal value)
    {
        value = 0m;
        if (map.TryGetProperty(key, out var el))
        {
            value = ParseDecimal(el);
            return value > 0;
        }

        foreach (var prop in map.EnumerateObject())
        {
            if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                continue;
            value = ParseDecimal(prop.Value);
            return value > 0;
        }

        return false;
    }

    static string TryGetMapString(JsonElement map, string key)
    {
        if (map.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.String)
            return el.GetString()?.Trim() ?? string.Empty;

        foreach (var prop in map.EnumerateObject())
        {
            if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                continue;
            return prop.Value.ValueKind == JsonValueKind.String
                ? prop.Value.GetString()?.Trim() ?? string.Empty
                : string.Empty;
        }

        return string.Empty;
    }

    static bool TryGetRatio(string? detailConfigJson, out decimal inventoryPer, out decimal recipePer)
    {
        inventoryPer = 1m;
        recipePer = 1m;
        if (string.IsNullOrWhiteSpace(detailConfigJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("convertFromInventoryQty", out var fromEl))
                inventoryPer = ParseDecimal(fromEl);
            if (root.TryGetProperty("convertToRecipeQty", out var toEl))
                recipePer = ParseDecimal(toEl);
            return inventoryPer > 0 && recipePer > 0;
        }
        catch
        {
            return false;
        }
    }

    static decimal ParseDecimal(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDecimal(out var n))
            return n;
        if (el.ValueKind == JsonValueKind.String
            && decimal.TryParse(el.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var s))
            return s;
        return 0m;
    }

    static bool ConvertedAwayFromSource(
        decimal sourceQty,
        decimal convertedQty,
        string sourceUom,
        string convertedUom)
        => sourceUom != convertedUom || Math.Abs(sourceQty - convertedQty) > 0.0000001m;

    static string Normalize(string? uom) => (uom ?? string.Empty).Trim().ToUpperInvariant();
}
