using System.Text.Json;

namespace Bisync.Api.Services;

public static class CompanyModuleRules
{
    public static readonly string[] AllModules = ["RMS", "POS", "HRM", "Accounting"];
    public static readonly string[] LocationModules = ["RMS", "POS", "HRM"];
    public static readonly HashSet<string> AllowedModules = new(AllModules, StringComparer.Ordinal);

    public static List<string> ParseModules(string? json) =>
        CompanyProfileRules.ParseStringArray(json)
            .Where(module => AllowedModules.Contains(module))
            .Distinct(StringComparer.Ordinal)
            .ToList();

    public static string? ValidateCompanyModules(string? modulesJson)
    {
        var modules = ParseModules(modulesJson);
        if (modules.Count == 0)
            return "Select at least one module under Modules.";
        return null;
    }

    public static string? ValidateLocationModules(string? modulesJson, string? companyModulesJson)
    {
        if (CompanyProfileRules.InheritsCompanyProfile(modulesJson))
            return null;

        var submitted = ParseModules(modulesJson);
        var companyEnabled = ParseModules(companyModulesJson);

        if (submitted.Any(module => !companyEnabled.Contains(module)))
            return "Location modules must be enabled at the company level first.";

        if (submitted.Any(module => module.Equals("Accounting", StringComparison.Ordinal)))
            return "Accounting is only available at the company level.";

        return null;
    }

    public static string? ValidateLocationBusinessTypesSubset(string? businessTypesJson, string? companyBusinessTypesJson)
    {
        if (CompanyProfileRules.InheritsCompanyProfile(businessTypesJson))
            return null;

        var companyTypes = CompanyProfileRules.ParseStringArray(companyBusinessTypesJson);
        var locationTypes = CompanyProfileRules.ParseStringArray(businessTypesJson);
        if (locationTypes.Any(type => !companyTypes.Contains(type)))
            return "Location business types must be selected from the company Type of Business list.";

        return null;
    }

    public static string NormalizeLocationModulesForStorage(string? submittedJson, string? companyJson)
    {
        if (CompanyProfileRules.InheritsCompanyProfile(submittedJson)
            || CompanyProfileRules.ProfilesEquivalent(submittedJson, companyJson))
            return "[]";
        return submittedJson ?? "[]";
    }

    public static string ResolveModulesJson(string? locationJson, string? companyJson) =>
        CompanyProfileRules.ResolveProfileJson(locationJson, companyJson);

    public static bool LocationModulesOverridden(string? modulesJson) =>
        !CompanyProfileRules.InheritsCompanyProfile(modulesJson);

    public static bool LocationProfileIsOverridden(
        string? businessTypesJson,
        string? vendorPolicyTagsJson,
        string? modulesJson) =>
        CompanyProfileRules.LocationProfileIsOverridden(businessTypesJson, vendorPolicyTagsJson)
        || LocationModulesOverridden(modulesJson);
}
