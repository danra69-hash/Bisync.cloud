using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

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

    /// <summary>
    /// Shared DU→PCU principal resolution used by receive, healer, credit notes, and Stock Card display.
    /// Prefer VendorProduct.DeliveryJson, then slash-path delivery basis.
    /// </summary>
    public static async Task<(decimal? Principal, string? Uom)> ResolvePathPrincipalAsync(
        BisyncDbContext db,
        Ingredient ingredient,
        string? vendorProductId,
        string? deliveryBasis,
        CancellationToken cancellationToken = default)
    {
        var vpId = (vendorProductId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(vpId))
        {
            var vendorProduct = await db.VendorProducts.AsNoTracking()
                .FirstOrDefaultAsync(v => v.ExternalId == vpId, cancellationToken);
            if (TryResolveFromVendorProduct(
                    vendorProduct,
                    ingredient,
                    out var resolvedPrincipal,
                    out var resolvedUom))
                return (resolvedPrincipal, resolvedUom);
        }

        if (TryResolveFromDeliveryPath(
                deliveryBasis,
                ingredient,
                out var pathPrincipal,
                out var pathUom))
            return (pathPrincipal, pathUom);

        return (null, null);
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

        var oq = orderQty > 0 ? orderQty : 1m;
        var pq = packQty > 0 ? packQty : 1m;
        var uq = unitQty > 0 ? unitQty : 1m;
        var smallestTotal = oq * pq * uq;
        var smallestUnit = string.IsNullOrWhiteSpace(unitUnit)
            ? (string.IsNullOrWhiteSpace(packUnit) ? orderUnit : packUnit)
            : unitUnit;

        // Prefer Recipe UOM, then Inventory, then alternate recipe units, then SI base of the
        // delivery content family (ml for keg/ltr beer when RecipeUom was wrongly set to g).
        foreach (var target in BuildTargetUomCandidates(ingredient, smallestUnit))
        {
            if (TryConvertMeasure(smallestTotal, smallestUnit, target, out var fromSmallest)
                && fromSmallest > 0)
            {
                // Per delivery package = content of one order unit (drop orderQty).
                principalPerPackage = fromSmallest / oq;
                principalUom = target;
                return principalPerPackage > 0;
            }

            if (pq == 1m && uq == 1m
                && TryConvertMeasure(oq, orderUnit, target, out var fromOrder)
                && fromOrder > 0)
            {
                principalPerPackage = fromOrder / oq;
                principalUom = target;
                return principalPerPackage > 0;
            }
        }

        return false;
    }

    /// <summary>
    /// Target UOMs to express delivery content in, in priority order.
    /// When RecipeUom is mass but keg content is volume, Inventory / alt / SI ml still resolve.
    /// </summary>
    public static IReadOnlyList<string> BuildTargetUomCandidates(Ingredient ingredient, string contentUnit)
    {
        var list = new List<string>();
        void Add(string? raw)
        {
            var trimmed = (raw ?? string.Empty).Trim();
            if (trimmed.Length == 0) return;
            if (list.Any(existing => UomCanonical.Equals(existing, trimmed))) return;
            list.Add(trimmed);
        }

        if (ingredient is not null)
        {
            Add(ingredient.RecipeUom);
            Add(ingredient.InventoryUom);
            foreach (var alt in ReadAltRecipeUnits(ingredient.DetailConfigJson))
                Add(alt);
        }

        // Last resort: SI base of the delivery content family so keg/30ltr still converts.
        if (TryGetSiFamily(contentUnit, out var family))
            Add(family == "volume" ? "ml" : "g");

        return list;
    }

    public static IReadOnlyList<string> ReadAltRecipeUnits(string? detailConfigJson)
    {
        var result = new List<string>();
        if (string.IsNullOrWhiteSpace(detailConfigJson))
            return result;

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("altRecipeUnits", out var alts)
                || alts.ValueKind != JsonValueKind.Array)
                return result;

            foreach (var alt in alts.EnumerateArray())
            {
                if (alt.ValueKind != JsonValueKind.Object) continue;
                var unit = alt.TryGetProperty("unit", out var unitEl) && unitEl.ValueKind == JsonValueKind.String
                    ? unitEl.GetString()?.Trim() ?? string.Empty
                    : string.Empty;
                if (unit.Length > 0) result.Add(unit);
            }
        }
        catch
        {
            // ignore malformed detail config
        }

        return result;
    }

    public static bool TryGetSiFamily(string? uom, out string family)
    {
        family = string.Empty;
        var key = UomCanonical.Normalize(uom);
        if (string.IsNullOrEmpty(key)) return false;
        if (!SiFactors.TryGetValue(key, out var factor)) return false;
        family = factor.Family;
        return true;
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
