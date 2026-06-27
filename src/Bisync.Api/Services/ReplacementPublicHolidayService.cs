using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class ReplacementPublicHolidayService(BisyncDbContext db)
{
    public async Task SyncAccrualAsync(AttendanceRecord record, CancellationToken ct = default)
    {
        var previousAccrued = record.RphAccruedDays;
        var targetAccrued = await CalcTargetAccrualAsync(record, ct);
        var delta = targetAccrued - previousAccrued;
        if (delta == 0) return;

        var balance = await GetOrCreateBalanceAsync(record.EmployeeId, ct);
        balance.RphBalance = Math.Max(0, balance.RphBalance + delta);
        record.RphAccruedDays = targetAccrued;
    }

    public async Task ReverseAccrualAsync(AttendanceRecord record, CancellationToken ct = default)
    {
        if (record.RphAccruedDays <= 0) return;

        var balance = await db.LeaveBalances.FindAsync([record.EmployeeId], ct);
        if (balance is not null)
            balance.RphBalance = Math.Max(0, balance.RphBalance - record.RphAccruedDays);

        record.RphAccruedDays = 0;
    }

    async Task<decimal> CalcTargetAccrualAsync(AttendanceRecord record, CancellationToken ct)
    {
        var setting = await db.CompanySettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (setting is null) return 0m;

        var holiday = await db.PublicHolidays.AsNoTracking()
            .Where(h => h.IsRecognized && (
                h.Date == record.Date
                || (h.IsRecurringAnnually && h.Date.Month == record.Date.Month && h.Date.Day == record.Date.Day)))
            .FirstOrDefaultAsync(ct);
        if (holiday is null) return 0m;

        var replacementEnabled = holiday.IsGazetted
            ? setting.GazettedPhReplacementDayEnabled
            : setting.NonGazettedPhReplacementDayEnabled;
        if (!replacementEnabled) return 0m;

        return WorkingDayCredit(record.Status);
    }

    async Task<LeaveBalance> GetOrCreateBalanceAsync(int employeeId, CancellationToken ct)
    {
        var balance = await db.LeaveBalances.FindAsync([employeeId], ct);
        if (balance is not null) return balance;

        balance = new LeaveBalance { EmployeeId = employeeId };
        db.LeaveBalances.Add(balance);
        return balance;
    }

    public static decimal WorkingDayCredit(AttendanceStatus status) => status switch
    {
        AttendanceStatus.Present or AttendanceStatus.Late => 1m,
        AttendanceStatus.HalfDay => 0.5m,
        _ => 0m,
    };
}
