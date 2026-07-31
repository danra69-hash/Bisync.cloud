using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Loads company/location and returns the cloud/org business calendar date
/// (never browser-local, never raw UTC midnight).
/// </summary>
public static class OrgBusinessDate
{
    public static async Task<(Company? Company, Location? Location, DateOnly Today)> ResolveAsync(
        BisyncDbContext db,
        int companyId,
        string? locationExternalId = null,
        CancellationToken cancellationToken = default)
    {
        var company = await db.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == companyId, cancellationToken);

        Location? location = null;
        var loc = (locationExternalId ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(loc))
        {
            location = await db.Locations.AsNoTracking()
                .FirstOrDefaultAsync(
                    l => l.CompanyId == companyId && l.ExternalId == loc,
                    cancellationToken);
        }

        return (company, location, OrgClock.TodayLocal(company, location));
    }

    public static async Task<DateOnly> TodayAsync(
        BisyncDbContext db,
        int companyId,
        string? locationExternalId = null,
        CancellationToken cancellationToken = default)
    {
        var (_, _, today) = await ResolveAsync(db, companyId, locationExternalId, cancellationToken);
        return today;
    }
}
