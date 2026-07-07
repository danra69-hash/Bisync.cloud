namespace Bisync.Api.Services;

using Bisync.Api.Models;

public static class VendorPolicyRules
{
    public static readonly HashSet<string> AllowedTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "halal",
        "muslim-friendly",
        "non-halal",
    };

    public static string? ValidateProductPolicyTag(string? tag)
    {
        if (string.IsNullOrWhiteSpace(tag))
            return "Product policy type is required (Halal, Muslim Friendly, or Non-halal).";
        var normalized = tag.Trim().ToLowerInvariant();
        if (!AllowedTags.Contains(normalized))
            return "Invalid product policy type.";
        return null;
    }

    public static bool OrgRequiresHalalCertOnReceive(IEnumerable<string> orgTags)
    {
        var tags = orgTags.Select(t => t.Trim().ToLowerInvariant()).ToList();
        return tags.Contains("halal") && !tags.Contains("non-halal");
    }

    public static List<string> ResolveStrictestOrgVendorPolicyTags(Company? company, IEnumerable<Location> locations)
    {
        if (company is null) return [];

        var tagSets = locations
            .Select(location => CompanyProfileRules.ParseStringArray(
                CompanyProfileRules.ResolveProfileJson(location.VendorPolicyTagsJson, company.VendorPolicyTagsJson)))
            .Where(tags => tags.Count > 0)
            .ToList();

        if (tagSets.Count == 0)
            tagSets.Add(CompanyProfileRules.ParseStringArray(company.VendorPolicyTagsJson));

        if (tagSets.Any(tags => tags.Any(tag => string.Equals(tag, "non-halal", StringComparison.OrdinalIgnoreCase))))
            return ["non-halal"];
        if (tagSets.Any(tags => tags.Any(tag => string.Equals(tag, "halal", StringComparison.OrdinalIgnoreCase))
            && !tags.Any(tag => string.Equals(tag, "muslim-friendly", StringComparison.OrdinalIgnoreCase))))
            return ["halal"];
        if (tagSets.Any(tags => tags.Any(tag => string.Equals(tag, "halal", StringComparison.OrdinalIgnoreCase))))
            return ["halal"];
        if (tagSets.Any(tags => tags.Any(tag => string.Equals(tag, "muslim-friendly", StringComparison.OrdinalIgnoreCase))))
            return ["muslim-friendly"];

        return tagSets.FirstOrDefault() ?? [];
    }

    public static string InferProductPolicyTag(string name, string products)
    {
        var text = $"{name} {products}".ToLowerInvariant();
        if (text.Contains("wine") || text.Contains("spirit") || text.Contains("beer")
            || text.Contains("pork") || text.Contains("craft brew"))
            return "non-halal";
        return "halal";
    }

    public static string? ValidateHalalCertNumbers(bool requiresCert, IEnumerable<(string ProductName, string? HalalCertNo)> lines)
    {
        if (!requiresCert) return null;
        var missing = lines
            .Where(line => string.IsNullOrWhiteSpace(line.HalalCertNo))
            .Select(line => line.ProductName)
            .ToList();
        if (missing.Count == 0) return null;
        return missing.Count == 1
            ? $"Halal certificate number is required for {missing[0]}."
            : "Halal certificate number is required for all received products.";
    }
}
