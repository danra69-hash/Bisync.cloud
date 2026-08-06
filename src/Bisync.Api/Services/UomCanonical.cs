namespace Bisync.Api.Services;

/// <summary>
/// Canonical UOM keys so aliases compare equal (g / Gr / Gram → GR).
/// Mirrors client <c>fromApiUom</c> / <c>toApiUom</c> mass-volume aliases.
/// </summary>
public static class UomCanonical
{
    public static string Normalize(string? uom)
    {
        var trimmed = (uom ?? string.Empty).Trim();
        if (trimmed.Length == 0) return string.Empty;

        var lower = trimmed.ToLowerInvariant();
        if (Aliases.TryGetValue(lower, out var canonical))
            return canonical;
        if (Aliases.TryGetValue(trimmed, out canonical))
            return canonical;

        return trimmed.ToUpperInvariant();
    }

    public static bool Equals(string? a, string? b)
        => string.Equals(Normalize(a), Normalize(b), StringComparison.Ordinal);

    static readonly Dictionary<string, string> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["mg"] = "MG",
        ["g"] = "GR",
        ["gr"] = "GR",
        ["gram"] = "GR",
        ["grams"] = "GR",
        ["kg"] = "KG",
        ["t"] = "TONNE",
        ["tonne"] = "TONNE",
        ["ton"] = "TONNE",
        ["ml"] = "ML",
        ["cl"] = "CL",
        ["l"] = "LTR",
        ["lt"] = "LTR",
        ["ltr"] = "LTR",
        ["litre"] = "LTR",
        ["liter"] = "LTR",
        ["litres"] = "LTR",
        ["liters"] = "LTR",
        ["pcs"] = "EACH",
        ["each"] = "EACH",
        ["pc"] = "EACH",
        ["btl"] = "BOTTLE",
        ["bottle"] = "BOTTLE",
        ["oz"] = "OZ",
        ["lb"] = "LB",
        ["lbs"] = "LB",
        ["fl oz"] = "FLOZ",
        ["floz"] = "FLOZ",
        ["gal"] = "GAL",
    };
}
