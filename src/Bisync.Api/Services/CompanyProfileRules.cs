using System.Text.Json;

namespace Bisync.Api.Services;

public static class CompanyProfileRules
{
    public static readonly string[] BusinessTypes =
    [
        "Restaurant / Cafe / Bistro / Kiosk",
        "Central Kitchen / Warehouse (supply only)",
        "Retail",
        "Manufacturer",
        "Distributor",
    ];

    public static readonly HashSet<string> VendorPolicyTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "halal",
        "muslim-friendly",
        "non-halal",
    };

    public static List<string> ParseStringArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            var parsed = JsonSerializer.Deserialize<List<string>>(json);
            return parsed?
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static string? Validate(string? businessTypesJson, string? vendorPolicyTagsJson)
    {
        var businessTypes = ParseStringArray(businessTypesJson);
        var vendorPolicyTags = ParseStringArray(vendorPolicyTagsJson)
            .Select(tag => tag.ToLowerInvariant())
            .Distinct()
            .ToList();

        if (businessTypes.Count == 0)
            return "Select at least one Type of Business.";

        if (businessTypes.Any(type => !BusinessTypes.Contains(type)))
            return "One or more business types are invalid.";

        if (vendorPolicyTags.Count == 0)
            return "Select at least one vendor policy (Halal, Muslim Friendly, or Non-halal).";

        if (vendorPolicyTags.Count > 2)
            return "Select at most two vendor policies.";

        if (vendorPolicyTags.Any(tag => !VendorPolicyTags.Contains(tag)))
            return "One or more vendor policies are invalid.";

        if (vendorPolicyTags.Contains("non-halal") && vendorPolicyTags.Count > 1)
            return "Non-halal cannot be combined with Halal or Muslim Friendly.";

        return null;
    }

    public static bool InheritsCompanyProfile(string? json) =>
        ParseStringArray(json).Count == 0;

    public static bool ProfilesEquivalent(string? leftJson, string? rightJson) =>
        ProfilesEquivalent(leftJson, rightJson, ignoreCase: false);

    public static bool ProfilesEquivalent(string? leftJson, string? rightJson, bool ignoreCase)
    {
        var left = ParseStringArray(leftJson);
        var right = ParseStringArray(rightJson);
        if (left.Count != right.Count) return false;

        var comparer = ignoreCase ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
        return left.Select(value => ignoreCase ? value.ToLowerInvariant() : value)
            .Order(comparer)
            .SequenceEqual(
                right.Select(value => ignoreCase ? value.ToLowerInvariant() : value).Order(comparer),
                comparer);
    }

    public static string NormalizeLocationProfileForStorage(string? submittedJson, string? companyJson, bool ignoreCase = false)
    {
        if (InheritsCompanyProfile(submittedJson) || ProfilesEquivalent(submittedJson, companyJson, ignoreCase))
            return "[]";
        return submittedJson ?? "[]";
    }

    public static string ResolveProfileJson(string? locationJson, string? companyJson) =>
        InheritsCompanyProfile(locationJson) ? companyJson ?? "[]" : locationJson ?? "[]";

    public static bool LocationProfileIsOverridden(string? businessTypesJson, string? vendorPolicyTagsJson) =>
        !InheritsCompanyProfile(businessTypesJson) || !InheritsCompanyProfile(vendorPolicyTagsJson);
}
