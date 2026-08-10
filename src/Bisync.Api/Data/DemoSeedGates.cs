using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Shared gates so demo/catalog seeders never recreate residue.
/// Auto-seed is off by default; opt in with <c>BISYNC_ALLOW_DEMO_SEED=1</c>
/// (and only when no customer tenant exists). DevSeedController remains the
/// explicit Development-only path for SC Demo / FIFO demos.
/// </summary>
public static class DemoSeedGates
{
    public static bool IsDemoSandboxCompanyName(string? name) =>
        DemoResiduePurger.IsDemoSandboxCompanyName(name);

    /// <summary>True when at least one real customer company exists (e.g. Weissbrau).</summary>
    public static Task<bool> HasCustomerCompanyAsync(
        BisyncDbContext db,
        CancellationToken cancellationToken = default) =>
        db.Companies.AsNoTracking()
            .AnyAsync(c => !IsDemoSandboxCompanyName(c.Name), cancellationToken);

    static bool EnvAllowsDemoSeed()
    {
        var flag = (Environment.GetEnvironmentVariable("BISYNC_ALLOW_DEMO_SEED") ?? string.Empty).Trim();
        return flag is "1" or "true" or "TRUE" or "yes" or "YES";
    }

    /// <summary>True when demo catalog/customer/B2B seeders are allowed to run.</summary>
    public static async Task<bool> AllowDemoCatalogSeedAsync(
        BisyncDbContext db,
        CancellationToken cancellationToken = default)
    {
        if (!EnvAllowsDemoSeed())
            return false;
        return !await HasCustomerCompanyAsync(db, cancellationToken);
    }
}
