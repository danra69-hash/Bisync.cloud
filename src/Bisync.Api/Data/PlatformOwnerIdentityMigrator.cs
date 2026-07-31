using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Idempotent merge: fold alias login emails (e.g. dra@test.com) into the
/// platform owner AppUser (dra@cubevalue.com) and a single HR Employee row,
/// preserving Weissbrau company assignment when present.
/// </summary>
public static class PlatformOwnerIdentityMigrator
{
    public static async Task ApplyAsync(BisyncDbContext db, ILogger? logger = null)
    {
        try
        {
            await ApplyCoreAsync(db, logger);
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "PlatformOwnerIdentityMigrator failed");
            throw;
        }
    }

    static async Task ApplyCoreAsync(BisyncDbContext db, ILogger? logger)
    {
        var canonical = SuperAdminAccess.SuperAdminEmail.Trim().ToLowerInvariant();
        var aliases = SuperAdminAccess.AliasEmails
            .Select(e => e.Trim().ToLowerInvariant())
            .Where(e => e.Length > 0 && e != canonical)
            .Distinct()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (aliases.Count == 0) return;

        // Load then filter in-memory — avoids EF translation issues with
        // array.Contains(email.ToLower()) on PostgreSQL.
        var allUsers = await db.AppUsers.ToListAsync();
        var keeper = allUsers.FirstOrDefault(u =>
            string.Equals(u.Email?.Trim(), canonical, StringComparison.OrdinalIgnoreCase));
        if (keeper is null)
        {
            logger?.LogWarning("Platform owner AppUser {Email} not found; skip identity merge", canonical);
            return;
        }

        var aliasUsers = allUsers
            .Where(u => u.Id != keeper.Id && aliases.Contains((u.Email ?? string.Empty).Trim()))
            .ToList();

        var allEmployees = await db.Employees.OrderBy(e => e.Id).ToListAsync();
        var employees = allEmployees
            .Where(e =>
            {
                var email = (e.Email ?? string.Empty).Trim();
                return string.Equals(email, canonical, StringComparison.OrdinalIgnoreCase)
                    || aliases.Contains(email);
            })
            .ToList();

        if (aliasUsers.Count == 0 && employees.Count <= 1)
        {
            if (keeper.EmployeeId is null or <= 0 && employees.Count == 1)
            {
                keeper.EmployeeId = employees[0].Id;
                employees[0].Email = SuperAdminAccess.SuperAdminEmail;
                employees[0].BisyncEnabled = true;
                employees[0].Active = true;
            }
            await EnsureWeissbrauHomeAsync(db, keeper, logger);
            await db.SaveChangesAsync();
            return;
        }

        Employee? hrKeeper = null;
        foreach (var aliasUser in aliasUsers.Where(u => u.EmployeeId is > 0))
        {
            hrKeeper = allEmployees.FirstOrDefault(e => e.Id == aliasUser.EmployeeId);
            if (hrKeeper is not null) break;
        }

        hrKeeper ??= employees.FirstOrDefault(e => aliases.Contains((e.Email ?? string.Empty).Trim()))
            ?? employees.FirstOrDefault()
            ?? allEmployees.FirstOrDefault(e =>
                string.Equals(e.Name, "Daniel Ra", StringComparison.OrdinalIgnoreCase));

        if (hrKeeper is null)
        {
            await EnsureWeissbrauHomeAsync(db, keeper, logger);
            await db.SaveChangesAsync();
            logger?.LogWarning("No HR employee found to link to platform owner {Email}", canonical);
            return;
        }

        var absorbEmployees = employees
            .Where(e => e.Id != hrKeeper.Id)
            .ToList();

        foreach (var aliasUser in aliasUsers)
        {
            await RemountAppUserReferencesAsync(db, aliasUser.Id, keeper.Id);
            aliasUser.EmployeeId = null;
            aliasUser.Active = false;
        }

        await db.SaveChangesAsync();

        foreach (var absorb in absorbEmployees)
        {
            await RemountEmployeeReferencesAsync(db, absorb.Id, hrKeeper.Id);
            absorb.Email = $"merged+{absorb.Id}.retired@bisync.local";
            absorb.Active = false;
            absorb.BisyncEnabled = false;
        }

        await db.SaveChangesAsync();

        foreach (var absorb in absorbEmployees)
            db.Employees.Remove(absorb);

        foreach (var aliasUser in aliasUsers)
            db.AppUsers.Remove(aliasUser);

        hrKeeper.Email = SuperAdminAccess.SuperAdminEmail;
        if (string.IsNullOrWhiteSpace(hrKeeper.Name))
            hrKeeper.Name = "Daniel Ra";
        hrKeeper.Active = true;
        hrKeeper.BisyncEnabled = true;
        if (string.IsNullOrWhiteSpace(hrKeeper.Position))
            hrKeeper.Position = "Chief Executive Officer";

        // Ensure no other AppUser still points at the HR keeper before linking.
        foreach (var other in allUsers.Where(u => u.Id != keeper.Id && u.EmployeeId == hrKeeper.Id))
            other.EmployeeId = null;

        keeper.EmployeeId = hrKeeper.Id;
        keeper.Email = SuperAdminAccess.SuperAdminEmail;
        keeper.FullName = "DRA Super Admin";
        keeper.Role = "Super Admin";
        keeper.Active = true;
        keeper.AccessJson = SuperAdminAccess.BuildJson();

        await EnsureWeissbrauHomeAsync(db, keeper, logger);
        await db.SaveChangesAsync();

        logger?.LogInformation(
            "Merged platform-owner identity into {Email} (AppUser {UserId}, Employee {EmployeeId}); removed {AliasCount} alias user(s) and {AbsorbCount} duplicate employee(s)",
            keeper.Email,
            keeper.Id,
            hrKeeper.Id,
            aliasUsers.Count,
            absorbEmployees.Count);
    }

    static async Task EnsureWeissbrauHomeAsync(BisyncDbContext db, AppUser keeper, ILogger? logger)
    {
        var weissbrau = await db.Companies.AsNoTracking()
            .Where(c => c.Name.ToLower().Contains("weissbrau"))
            .OrderBy(c => c.Id)
            .FirstOrDefaultAsync();

        if (weissbrau is null) return;

        var locationIds = await db.Locations.AsNoTracking()
            .Where(l => l.CompanyId == weissbrau.Id)
            .Select(l => l.Id)
            .OrderBy(id => id)
            .ToListAsync();

        var changed = false;
        if (keeper.CompanyId != weissbrau.Id)
        {
            keeper.CompanyId = weissbrau.Id;
            changed = true;
        }

        if (locationIds.Count > 0)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(locationIds);
            if (!string.Equals(keeper.LocationIdsJson, json, StringComparison.Ordinal))
            {
                keeper.LocationIdsJson = json;
                changed = true;
            }
        }

        if (changed)
        {
            logger?.LogInformation(
                "Pinned platform owner {Email} to company {CompanyId} ({CompanyName})",
                keeper.Email,
                weissbrau.Id,
                weissbrau.Name);
        }
    }

    static async Task RemountAppUserReferencesAsync(BisyncDbContext db, int fromUserId, int toUserId)
    {
        if (fromUserId == toUserId) return;

        var locations = await db.Locations
            .Where(l => l.PrincipalContactUserId == fromUserId || l.SecondaryContactUserId == fromUserId)
            .ToListAsync();
        foreach (var loc in locations)
        {
            if (loc.PrincipalContactUserId == fromUserId)
                loc.PrincipalContactUserId = toUserId;
            if (loc.SecondaryContactUserId == fromUserId)
                loc.SecondaryContactUserId = toUserId;
        }

        var notifications = await db.UserNotifications
            .Where(n => n.UserId == fromUserId)
            .ToListAsync();
        foreach (var n in notifications)
            n.UserId = toUserId;

        var fieldChanges = await db.ProductFieldChanges
            .Where(c => c.ChangedByUserId == fromUserId)
            .ToListAsync();
        foreach (var c in fieldChanges)
            c.ChangedByUserId = toUserId;

        var bomChanges = await db.ProductBomChanges
            .Where(c => c.ChangedByUserId == fromUserId)
            .ToListAsync();
        foreach (var c in bomChanges)
            c.ChangedByUserId = toUserId;

        var salesCustomers = await db.SalesModuleCustomers
            .Where(c => c.EngagedUserId == fromUserId)
            .ToListAsync();
        foreach (var c in salesCustomers)
        {
            c.EngagedUserId = toUserId;
            if (SuperAdminAccess.IsPlatformOwnerEmail(c.EngagedUserEmail))
                c.EngagedUserEmail = SuperAdminAccess.SuperAdminEmail;
        }

        var appointments = await db.SalesModuleAppointments
            .Where(c => c.EngagedUserId == fromUserId)
            .ToListAsync();
        foreach (var c in appointments)
        {
            c.EngagedUserId = toUserId;
            if (SuperAdminAccess.IsPlatformOwnerEmail(c.EngagedUserEmail))
                c.EngagedUserEmail = SuperAdminAccess.SuperAdminEmail;
        }
    }

    static async Task RemountEmployeeReferencesAsync(BisyncDbContext db, int fromEmployeeId, int toEmployeeId)
    {
        if (fromEmployeeId == toEmployeeId) return;

        async Task RemountAsync<T>(IQueryable<T> query, Action<T> assign) where T : class
        {
            var rows = await query.ToListAsync();
            foreach (var row in rows)
                assign(row);
        }

        await RemountAsync(
            db.AttendanceRecords.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.LeaveRequests.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);

        var absorbBalance = await db.LeaveBalances.FirstOrDefaultAsync(r => r.EmployeeId == fromEmployeeId);
        if (absorbBalance is not null)
        {
            var rdo = absorbBalance.RdoBalance;
            var rph = absorbBalance.RphBalance;
            var al = absorbBalance.AlBalance;
            var alCf = absorbBalance.AlCarryForward;
            var keeperBalance = await db.LeaveBalances.FirstOrDefaultAsync(r => r.EmployeeId == toEmployeeId);
            if (keeperBalance is null)
            {
                db.LeaveBalances.Remove(absorbBalance);
                await db.SaveChangesAsync();
                db.LeaveBalances.Add(new LeaveBalance
                {
                    EmployeeId = toEmployeeId,
                    RdoBalance = rdo,
                    RphBalance = rph,
                    AlBalance = al,
                    AlCarryForward = alCf,
                });
            }
            else
            {
                keeperBalance.RdoBalance += rdo;
                keeperBalance.RphBalance += rph;
                keeperBalance.AlBalance += al;
                keeperBalance.AlCarryForward += alCf;
                db.LeaveBalances.Remove(absorbBalance);
            }
        }

        await RemountAsync(
            db.ShiftSchedules.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.PayrollRunLines.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.EducationRecords.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.PreviousEmployments.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.EmployeeMovements.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.PerformanceAppraisals.Where(r => r.EmployeeId == fromEmployeeId),
            r => r.EmployeeId = toEmployeeId);
        await RemountAsync(
            db.SampleRequests.Where(r => r.ContactEmployeeId == fromEmployeeId),
            r => r.ContactEmployeeId = toEmployeeId);

        var reports = await db.Employees
            .Where(e => e.ReportsToId == fromEmployeeId)
            .ToListAsync();
        foreach (var e in reports)
            e.ReportsToId = toEmployeeId;

        var linkedUsers = await db.AppUsers
            .Where(u => u.EmployeeId == fromEmployeeId)
            .ToListAsync();
        foreach (var u in linkedUsers)
            u.EmployeeId = null;
    }
}
