using System.Globalization;
using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Product recipes always store nett usable quantity and nett unit cost.
///
/// Yield Loss: stock holds gross purchases; sale depletes gross = nett / (1 − loss%).
/// Split Use: inbound posts gross then moves outputs to child/waste cards; parent on-hand
/// is already Component Nett, so sale/production depletes parent (or child) 1:1.
/// Both paths expose LastPriceRecipe as the nett unit cost for product BOMs.
/// </summary>
public static class ComponentYieldLossRules
{
    public static decimal ResolvePrimaryYieldLossPercent(Ingredient? ingredient)
    {
        if (ingredient is null || string.IsNullOrWhiteSpace(ingredient.DetailConfigJson))
            return 0m;

        try
        {
            using var doc = JsonDocument.Parse(ingredient.DetailConfigJson);
            var root = doc.RootElement;

            if (IsSplitUseEnabled(root))
                return 0m;

            if (root.TryGetProperty("taggedVendorProductIds", out var tagged)
                && tagged.ValueKind == JsonValueKind.Array
                && tagged.GetArrayLength() > 0
                && root.TryGetProperty("vendorProductLossYield", out var lossMap)
                && lossMap.ValueKind == JsonValueKind.Object)
            {
                var primaryId = tagged[0].GetString()?.Trim() ?? string.Empty;
                if (primaryId.Length > 0
                    && lossMap.TryGetProperty(primaryId, out var lossEl))
                {
                    var fromMap = ParseDecimal(lossEl);
                    if (fromMap > 0)
                        return ClampPercent(fromMap);
                }
            }

            if (root.TryGetProperty("lossYield", out var lossYieldEl))
                return ClampPercent(ParseDecimal(lossYieldEl));
            if (root.TryGetProperty("LossYield", out var lossYieldPascal))
                return ClampPercent(ParseDecimal(lossYieldPascal));
        }
        catch (JsonException)
        {
            return 0m;
        }

        return 0m;
    }

    /// <summary>
    /// Converts a recipe/nett quantity into the gross stock quantity that must leave inventory.
    /// Yield Loss inflates; Split Use does not (cards already hold post-split quantities).
    /// </summary>
    public static decimal ToGrossQuantity(decimal nettQuantity, decimal yieldLossPercent)
    {
        if (nettQuantity <= 0)
            return 0m;

        var pct = ClampPercent(yieldLossPercent);
        if (pct <= 0)
            return nettQuantity;

        var keepFraction = 1m - pct / 100m;
        if (keepFraction <= 0)
            throw new InvalidOperationException("Yield Loss % must be less than 100.");

        return nettQuantity / keepFraction;
    }

    public static decimal ToGrossQuantity(Ingredient? ingredient, decimal nettQuantity)
        => ToGrossQuantity(nettQuantity, ResolvePrimaryYieldLossPercent(ingredient));

    static bool IsSplitUseEnabled(JsonElement root)
        => root.TryGetProperty("splitUse", out var splitUse)
            && splitUse.ValueKind == JsonValueKind.Object
            && ReadBool(splitUse, "enabled", "Enabled");

    static decimal ClampPercent(decimal pct) => pct < 0 ? 0m : pct;

    static bool ReadBool(JsonElement obj, string camel, string pascal)
    {
        if (obj.TryGetProperty(camel, out var el) || obj.TryGetProperty(pascal, out el))
        {
            if (el.ValueKind == JsonValueKind.True) return true;
            if (el.ValueKind == JsonValueKind.False) return false;
            if (el.ValueKind == JsonValueKind.String
                && bool.TryParse(el.GetString(), out var parsed))
                return parsed;
        }
        return false;
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
}
