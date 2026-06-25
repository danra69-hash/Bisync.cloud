using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class EmployeeAppUserSync
{
    public static async Task SyncAsync(BisyncDbContext db, Employee employee, CancellationToken cancellationToken = default)
    {
        var appUser = await db.AppUsers
            .FirstOrDefaultAsync(u => u.EmployeeId == employee.Id, cancellationToken);

        if (!employee.BisyncEnabled || !employee.Active)
        {
            if (appUser is not null)
            {
                appUser.Active = false;
                await db.SaveChangesAsync(cancellationToken);
            }
            return;
        }

        if (appUser is null)
        {
            appUser = await db.AppUsers
                .FirstOrDefaultAsync(u => u.Email == employee.Email, cancellationToken);

            if (appUser is null)
            {
                appUser = new AppUser { EmployeeId = employee.Id };
                db.AppUsers.Add(appUser);
            }
            else
            {
                appUser.EmployeeId = employee.Id;
            }
        }

        appUser.FullName = employee.Name;
        appUser.Email = employee.Email;
        appUser.Role = employee.Position;
        appUser.Phone = employee.Mobile;
        appUser.Active = true;

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
