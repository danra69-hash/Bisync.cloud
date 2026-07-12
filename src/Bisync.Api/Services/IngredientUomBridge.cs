using System.Globalization;
using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Converts quantities between an ingredient's recipe and inventory UOMs using DetailConfigJson.
/// Stock cards default to inventory UOM and match movements by exact UOM, so outbound writes
/// should prefer inventory units when a conversion is known.
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

    static string Normalize(string? uom) => (uom ?? string.Empty).Trim().ToUpperInvariant();
}
