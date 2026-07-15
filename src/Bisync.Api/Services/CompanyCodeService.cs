using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class CompanyCodeService
{
    public static async Task EnsureCodeAsync(BisyncDbContext db, Company company)
    {
        if (company.Code is { Length: ComponentIdentityRules.CompanyCodeLength }
            && company.Code.All(char.IsLetter))
        {
            company.Code = company.Code.ToUpperInvariant();
            return;
        }

        var existing = await db.Companies
            .AsNoTracking()
            .Where(c => c.Id != company.Id && c.Code != null && c.Code != "")
            .Select(c => c.Code!)
            .ToListAsync();

        company.Code = ComponentIdentityRules.AllocateUniqueCompanyCode(company.Name, existing, company.Id);
    }

    public static async Task<string> ResolveCodeAsync(BisyncDbContext db, int companyId)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == companyId)
            ?? throw new InvalidOperationException($"Company {companyId} was not found.");
        await EnsureCodeAsync(db, company);
        if (db.Entry(company).State == EntityState.Modified)
            await db.SaveChangesAsync();
        return company.Code!;
    }
}
