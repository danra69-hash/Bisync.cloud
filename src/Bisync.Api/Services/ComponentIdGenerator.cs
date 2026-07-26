using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class ComponentIdGenerator
{
    /// <summary>Legacy name-prefix helper retained for product / sub-product IDs.</summary>
    public static string BuildPrefix(string name)
    {
        var alpha = new string(name.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return alpha.Length <= 6 ? alpha : alpha[..6];
    }

    public static async Task<string> GenerateAsync(
        BisyncDbContext db,
        string companyCode,
        int? companyId = null,
        int? excludeId = null)
    {
        var code = companyCode.Trim().ToUpperInvariant();
        if (code.Length != ComponentIdentityRules.CompanyCodeLength)
            throw new InvalidOperationException("Company code must be exactly 4 letters.");

        var prefix = code + "-";
        var query = db.Ingredients.AsQueryable();
        if (companyId is int filterCompanyId)
            query = query.Where(i => i.CompanyId == filterCompanyId);
        if (excludeId is int filterExcludeId)
            query = query.Where(i => i.Id != filterExcludeId);

        var existing = await query
            .Where(i => i.ComponentId.StartsWith(prefix))
            .Select(i => i.ComponentId)
            .ToListAsync();

        // Include unsaved tracked ingredients so batch seeders don't collide.
        foreach (var entry in db.ChangeTracker.Entries<Ingredient>())
        {
            if (excludeId is int skipId && entry.Entity.Id == skipId) continue;
            if (companyId is int onlyCompany && entry.Entity.CompanyId != onlyCompany) continue;
            var pending = entry.Entity.ComponentId;
            if (!string.IsNullOrEmpty(pending)
                && pending.StartsWith(prefix, StringComparison.Ordinal)
                && !existing.Contains(pending))
            {
                existing.Add(pending);
            }
        }

        var suffix = ComponentIdentityRules.GenerateSuffix(existing, code);
        return ComponentIdentityRules.BuildComponentId(code, suffix);
    }
}
