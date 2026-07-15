using Bisync.Api.Data;
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
        if (companyId is int cid)
            query = query.Where(i => i.CompanyId == cid);
        if (excludeId is int eid)
            query = query.Where(i => i.Id != eid);

        var existing = await query
            .Where(i => i.ComponentId.StartsWith(prefix))
            .Select(i => i.ComponentId)
            .ToListAsync();

        var suffix = ComponentIdentityRules.GenerateSuffix(existing, code);
        return ComponentIdentityRules.BuildComponentId(code, suffix);
    }
}
