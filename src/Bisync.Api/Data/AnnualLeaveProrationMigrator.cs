using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Data;

/// <summary>
/// Idempotent heal: replace full-year lumpsum AL balances with operating-year pro-rated
/// opening balances (minus approved AL already taken).
/// </summary>
public static class AnnualLeaveProrationMigrator
{
    public static async Task<int> ApplyAsync(
        BisyncDbContext db,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        if (!await DatabaseSchemaHelper.TableExistsAsync(db, "LeaveBalances")
            || !await DatabaseSchemaHelper.TableExistsAsync(db, "Employees"))
            return 0;

        var asOf = DateOnly.FromDateTime(DateTime.UtcNow);
        var employees = await db.Employees
            .Include(e => e.LeaveBalance)
            .Include(e => e.EmployeeLevel)
            .Where(e => e.LeaveBalance != null)
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
            return 0;

        var employeeIds = employees.Select(e => e.Id).ToList();
        var approvedAl = await db.LeaveRequests.AsNoTracking()
            .Where(r => employeeIds.Contains(r.EmployeeId)
                && r.Type == LeaveType.AL
                && r.Status == LeaveStatus.Approved)
            .Select(r => new { r.EmployeeId, r.StartDate, r.EndDate })
            .ToListAsync(cancellationToken);

        var takenByEmployee = approvedAl
            .GroupBy(r => r.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(r => AnnualLeaveEntitlement.CalendarDays(r.StartDate, r.EndDate)));

        var changed = 0;
        foreach (var employee in employees)
        {
            var balance = employee.LeaveBalance;
            if (balance is null) continue;

            var level = employee.EmployeeLevel;
            var annualEnabled = level?.AnnualLeaveEnabled ?? true;
            var rulesJson = level?.AnnualLeaveRulesJson;
            var fallback = level?.AnnualLeaveDays ?? 0;

            var full = AnnualLeaveEntitlement.ResolveFullYearDays(
                rulesJson,
                employee.JoinDate,
                fallback,
                annualEnabled,
                asOf);
            var prorated = AnnualLeaveEntitlement.ResolveOpeningBalanceDays(
                rulesJson,
                employee.JoinDate,
                fallback,
                annualEnabled,
                asOf);

            takenByEmployee.TryGetValue(employee.Id, out var taken);
            var expected = Math.Max(0, prorated - taken);
            var remainingIfLumpsum = Math.Max(0, full - taken);

            // Only rewrite clear lumpsum / doubled-lumpsum fingerprints so manual edits stay.
            var isLumpsumFingerprint =
                balance.AlBalance == full
                || balance.AlBalance == full * 2m
                || balance.AlBalance == 56m
                || (full > 0
                    && full != prorated
                    && balance.AlBalance == remainingIfLumpsum);

            if (!isLumpsumFingerprint)
                continue;
            if (balance.AlBalance == expected)
                continue;

            var previous = balance.AlBalance;
            balance.AlBalance = expected;
            changed++;
            logger?.LogInformation(
                "Pro-rated annual leave for Employee {EmployeeId} ({Email}): {Previous} → {Expected} (full {Full}, prorated {Prorated}, taken {Taken})",
                employee.Id,
                employee.Email,
                previous,
                expected,
                full,
                prorated,
                taken);
        }

        if (changed > 0)
            await db.SaveChangesAsync(cancellationToken);

        return changed;
    }
}
