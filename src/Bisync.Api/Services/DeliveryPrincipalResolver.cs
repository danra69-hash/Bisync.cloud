using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Resolves Principal Component qty-per-delivery-package from a vendor product
/// delivery breakdown (or slash path) when component tags are missing or placeholder.
/// Mirrors client <c>resolvePrincipalQty</c> / <c>parseDeliveryUnitPath</c>.
/// </summary>
public static class DeliveryPrincipalResolver
{
    static readonly Regex SegmentRegex = new(
        @"^(?<qty>\d*\.?\d+)\s*(?<unit>.+)$|^(?<unitOnly>[A-Za-z].*)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static bool TryResolveFromVendorProduct(
        VendorProduct? vendorProduct,
        Ingredient ingredient,
        out decimal principalPerPackage,
        out string principalUom)
    {
        principalPerPackage = 0m;
        principalUom = string.Empty;
        if (vendorProduct is null || ingredient is null)
            return false;

        if (TryParseDeliveryJson(vendorProduct.DeliveryJson, out var orderQty, out var orderUnit,
                out var packQty, out var packUnit, out var unitQty, out var unitUnit))
        {
            return TryResolvePrincipal(
                ingredient,
                orderQty,
                orderUnit,
                packQty,
                packUnit,
                unitQty,
                unitUnit,
                out principalPerPackage,
                out principalUom);
        }

        return false;
    }

    public static bool TryResolveFromDeliveryPath(
        string? deliveryPath,
        Ingredient ingredient,
        out decimal principalPerPackage,
        out string principalUom)
    {
        principalPerPackage = 0m;
        principalUom = string.Empty;
        if (string.IsNullOrWhiteSpace(deliveryPath) || ingredient is null)
            return false;

        if (!TryParseDeliveryPath(deliveryPath, out var orderQty, out var orderUnit,
                out var packQty, out var packUnit, out var unitQty, out var unitUnit))
            return false;

        return TryResolvePrincipal(
            ingredient,
            orderQty,
            orderUnit,
            packQty,
            packUnit,
            unitQty,
            unitUnit,
            out principalPerPackage,
            out principalUom);
    }

    public static bool TryResolvePrincipal(
        Ingredient ingredient,
        decimal orderQty,
        string orderUnit,
        decimal packQty,
        string packUnit,
        decimal unitQty,
        string unitUnit,
        out decimal principalPerPackage,
        out string principalUom)
    {
        principalPerPackage = 0m;
        principalUom = string.Empty;

        var recipeLabel = (ingredient.RecipeUom ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(recipeLabel))
            return false;

        var oq = orderQty > 0 ? orderQty : 1m;
        var pq = packQty > 0 ? packQty : 1m;
        var uq = unitQty > 0 ? unitQty : 1m;
        var smallestTotal = oq * pq * uq;
        var smallestUnit = string.IsNullOrWhiteSpace(unitUnit)
            ? (string.IsNullOrWhiteSpace(packUnit) ? orderUnit : packUnit)
            : unitUnit;

        if (TryConvertMeasure(smallestTotal, smallestUnit, recipeLabel, out var fromSmallest)
            && fromSmallest > 0)
        {
            // Per delivery package = content of one order unit (drop orderQty).
            principalPerPackage = fromSmallest / oq;
            principalUom = recipeLabel;
            return principalPerPackage > 0;
        }

        if (pq == 1m && uq == 1m
            && TryConvertMeasure(oq, orderUnit, recipeLabel, out var fromOrder)
            && fromOrder > 0)
        {
            principalPerPackage = fromOrder / oq;
            principalUom = recipeLabel;
            return principalPerPackage > 0;
        }

        return false;
    }

    public static bool TryConvertMeasure(
        decimal quantity,
        string fromUom,
        string toUom,
        out decimal converted)
    {
        converted = quantity;
        var from = UomCanonical.Normalize(fromUom);
        var to = UomCanonical.Normalize(toUom);
        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to))
            return false;
        if (from == to)
            return true;

        if (SiFactors.TryGetValue(from, out var fromFactor)
            && SiFactors.TryGetValue(to, out var toFactor)
            && fromFactor.Family == toFactor.Family
            && toFactor.ToBase > 0)
        {
            converted = quantity * (fromFactor.ToBase / toFactor.ToBase);
            return converted > 0;
        }

        return false;
    }

    static bool TryParseDeliveryJson(
        string? deliveryJson,
        out decimal orderQty,
        out string orderUnit,
        out decimal packQty,
        out string packUnit,
        out decimal unitQty,
        out string unitUnit)
    {
        orderQty = 1m;
        orderUnit = string.Empty;
        packQty = 1m;
        packUnit = string.Empty;
        unitQty = 1m;
        unitUnit = string.Empty;
        if (string.IsNullOrWhiteSpace(deliveryJson) || deliveryJson.Trim() == "{}")
            return false;

        try
        {
            using var doc = JsonDocument.Parse(deliveryJson);
            var root = doc.RootElement;
            orderUnit = ReadString(root, "orderUnit", "OrderUnit");
            packUnit = ReadString(root, "packUnit", "PackUnit");
            unitUnit = ReadString(root, "unitUnit", "UnitUnit");
            orderQty = ReadDecimal(root, "orderQty", "OrderQty", 1m);
            packQty = ReadDecimal(root, "packQty", "PackQty", 1m);
            unitQty = ReadDecimal(root, "unitQty", "UnitQty", 1m);
            if (string.IsNullOrWhiteSpace(orderUnit))
                return false;
            if (string.IsNullOrWhiteSpace(packUnit))
                packUnit = orderUnit;
            if (string.IsNullOrWhiteSpace(unitUnit))
                unitUnit = packUnit;
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static bool TryParseDeliveryPath(
        string input,
        out decimal orderQty,
        out string orderUnit,
        out decimal packQty,
        out string packUnit,
        out decimal unitQty,
        out string unitUnit)
    {
        orderQty = 1m;
        orderUnit = string.Empty;
        packQty = 1m;
        packUnit = string.Empty;
        unitQty = 1m;
        unitUnit = string.Empty;

        var segments = input.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0)
            return false;

        if (!TryParseSegment(segments[0], out orderQty, out orderUnit))
            return false;

        if (segments.Length == 1)
        {
            packUnit = orderUnit;
            unitUnit = orderUnit;
            packQty = 1m;
            unitQty = 1m;
            return true;
        }

        if (!TryParseSegment(segments[1], out packQty, out packUnit))
            return false;

        if (segments.Length == 2)
        {
            // 2-segment: content once (1tub/3.75ltr) — do not square.
            unitUnit = packUnit;
            unitQty = 1m;
            return true;
        }

        if (!TryParseSegment(segments[2], out unitQty, out unitUnit))
            return false;

        return true;
    }

    static bool TryParseSegment(string seg, out decimal qty, out string unit)
    {
        qty = 1m;
        unit = string.Empty;
        var m = SegmentRegex.Match(seg.Trim());
        if (!m.Success)
            return false;

        if (m.Groups["unitOnly"].Success)
        {
            unit = m.Groups["unitOnly"].Value.Trim();
            qty = 1m;
            return unit.Length > 0;
        }

        if (!decimal.TryParse(m.Groups["qty"].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out qty)
            || qty <= 0)
            qty = 1m;
        unit = m.Groups["unit"].Value.Trim();
        return unit.Length > 0;
    }

    static string ReadString(JsonElement root, string camel, string pascal)
    {
        if (root.TryGetProperty(camel, out var el) || root.TryGetProperty(pascal, out el))
            return el.ValueKind == JsonValueKind.String ? el.GetString()?.Trim() ?? string.Empty : string.Empty;
        return string.Empty;
    }

    static decimal ReadDecimal(JsonElement root, string camel, string pascal, decimal fallback)
    {
        if (!(root.TryGetProperty(camel, out var el) || root.TryGetProperty(pascal, out el)))
            return fallback;
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDecimal(out var n))
            return n > 0 ? n : fallback;
        if (el.ValueKind == JsonValueKind.String
            && decimal.TryParse(el.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var s)
            && s > 0)
            return s;
        return fallback;
    }

    readonly record struct SiUnit(string Family, decimal ToBase);

    /// <summary>Base: mass → grams, volume → millilitres.</summary>
    static readonly Dictionary<string, SiUnit> SiFactors = new(StringComparer.Ordinal)
    {
        ["MG"] = new("mass", 0.001m),
        ["GR"] = new("mass", 1m),
        ["KG"] = new("mass", 1000m),
        ["TONNE"] = new("mass", 1_000_000m),
        ["OZ"] = new("mass", 28.3495m),
        ["LB"] = new("mass", 453.592m),
        ["ML"] = new("volume", 1m),
        ["CL"] = new("volume", 10m),
        ["LTR"] = new("volume", 1000m),
        ["FLOZ"] = new("volume", 29.5735m),
        ["GAL"] = new("volume", 3785.41m),
    };
}
