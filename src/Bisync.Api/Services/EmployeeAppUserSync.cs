using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class EmployeeAppUserSync
{
    public static async Task SyncAsync(
        BisyncDbContext db,
        Employee employee,
        int? companyId = null,
        CancellationToken cancellationToken = default)
    {
        var appUser = await db.AppUsers
            .FirstOrDefaultAsync(u => u.EmployeeId == employee.Id, cancellationToken);

        if (!employee.Active)
        {
            if (appUser is not null)
            {
                appUser.Active = false;
                employee.BisyncEnabled = false;
                await db.SaveChangesAsync(cancellationToken);
            }
            return;
        }

        // Platform access is granted via the Users / Platform Access APIs only.
        // Never auto-create an AppUser or attach by email here — that hijacked
        // Super Admin when an employee shared dra@cubevalue.com and forced
        // Active=false whenever BisyncEnabled was false on Save Changes.
        if (appUser is null)
        {
            if (employee.BisyncEnabled)
            {
                employee.BisyncEnabled = false;
                await db.SaveChangesAsync(cancellationToken);
            }
            return;
        }

        // Never demote / re-email the platform owner from an HR employee save.
        if (SuperAdminAccess.IsPlatformOwnerEmail(appUser.Email)
            || SuperAdminAccess.IsPlatformOwnerEmail(employee.Email))
        {
            appUser.FullName = string.IsNullOrWhiteSpace(employee.Name) ? appUser.FullName : employee.Name;
            if (!string.IsNullOrWhiteSpace(employee.Mobile))
                appUser.Phone = employee.Mobile;
            appUser.Email = SuperAdminAccess.SuperAdminEmail;
            appUser.Role = "Super Admin";
            appUser.AccessJson = SuperAdminAccess.BuildJson();
            appUser.Active = true;
            employee.Email = SuperAdminAccess.SuperAdminEmail;
            employee.BisyncEnabled = true;
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        appUser.FullName = employee.Name;
        appUser.Email = employee.Email;
        appUser.Role = employee.Position;
        appUser.Phone = employee.Mobile;
        employee.BisyncEnabled = appUser.Active;

        if (companyId is int resolvedCompanyId)
            appUser.CompanyId = resolvedCompanyId;

        if (string.IsNullOrWhiteSpace(appUser.AccessJson) || appUser.AccessJson == "{}")
            appUser.AccessJson = """{"modules":[]}""";

        await db.SaveChangesAsync(cancellationToken);
    }

    public static async Task RemoveAsync(BisyncDbContext db, int employeeId, CancellationToken cancellationToken = default)
    {
        var appUser = await db.AppUsers
            .FirstOrDefaultAsync(u => u.EmployeeId == employeeId, cancellationToken);
        if (appUser is null) return;
        db.AppUsers.Remove(appUser);
        await db.SaveChangesAsync(cancellationToken);
    }
}
