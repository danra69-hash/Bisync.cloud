using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class PayrollDemoSeeder
{
    sealed record PayrollDemo(
        string Email,
        decimal BaseSalary,
        decimal Service,
        decimal Transport,
        decimal Accommodation,
        decimal Mobile,
        bool OvertimeEnabled = false,
        DateOnly? DateOfBirth = null);

    static readonly PayrollDemo[] HospitalityPayroll =
    [
        new("james.dubois@bisync.cloud", 8500m, 500m, 300m, 0m, 200m, true, new DateOnly(1988, 4, 12)),
        new("sarah.chen@bisync.cloud", 12000m, 800m, 400m, 600m, 300m, false, new DateOnly(1985, 9, 3)),
        new("ahmad.razali@bisync.cloud", 7000m, 400m, 300m, 0m, 150m, false, new DateOnly(1992, 2, 20)),
        new("melissa.tan@bisync.cloud", 5500m, 300m, 200m, 0m, 100m, false, new DateOnly(1994, 11, 8)),
        new("daniel.ong@bisync.cloud", 6000m, 350m, 250m, 0m, 150m, true, new DateOnly(1996, 7, 15)),
    ];

    public static async Task SeedAsync(BisyncDbContext db)
    {
        await EnsurePayStructureAsync(db);
        await SeedSalariesAsync(db);
        await SeedJune2026AttendanceAsync(db);
    }

    static async Task EnsurePayStructureAsync(BisyncDbContext db)
    {
        var existing = await db.PayStructures
            .Include(p => p.ProvidentFundBrackets)
            .Include(p => p.SocsoBrackets)
            .FirstOrDefaultAsync(p => p.CompanyId == 1);
        if (existing is not null)
        {
            if (existing.SocsoBrackets.Count == 0)
            {
                existing.SocsoBrackets = DefaultSocsoBrackets();
                await db.SaveChangesAsync();
            }
            return;
        }

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == 1);
        if (company is null) return;

        var structure = new PayStructure
        {
            CompanyId = 1,
            CountryCode = company.CountryCode,
            PayType = "Fixed Salary",
            PayCycle = "Monthly",
            OvertimeRateMultiplier = 1.5m,
            ForeignProvidentFundEmployerPct = 2m,
            ForeignProvidentFundEmployeePct = 2m,
            ForeignSocsoEmployerPct = 1.25m,
            Active = true,
            ProvidentFundBrackets =
            [
                new ProvidentFundBracket { SortOrder = 0, MaxAge = 59, MaxMonthlySalary = 5000m, EmployerPct = 13m, EmployeePct = 11m },
                new ProvidentFundBracket { SortOrder = 1, MaxAge = 59, MinMonthlySalary = 5000.01m, EmployerPct = 13m, EmployeePct = 11m },
                new ProvidentFundBracket { SortOrder = 2, MinAge = 60, EmployerPct = 0m, EmployeePct = 0m, NoContribution = true },
            ],
            SocsoBrackets = DefaultSocsoBrackets(),
        };

        db.PayStructures.Add(structure);
        await db.SaveChangesAsync();
    }

    static List<SocsoBracket> DefaultSocsoBrackets() =>
    [
        new SocsoBracket { SortOrder = 0, MaxAge = 59, MaxMonthlySalary = 5000m, EmployerAmount = 86.65m, EmployeeAmount = 61.90m },
        new SocsoBracket { SortOrder = 1, MaxAge = 59, MinMonthlySalary = 5000.01m, MaxMonthlySalary = 10000m, EmployerAmount = 104.15m, EmployeeAmount = 74.40m },
        new SocsoBracket { SortOrder = 2, MaxAge = 59, MinMonthlySalary = 10000.01m, EmployerAmount = 104.15m, EmployeeAmount = 74.40m },
        new SocsoBracket { SortOrder = 3, MinAge = 60, MaxMonthlySalary = 5000m, EmployerAmount = 71.90m, EmployeeAmount = 43.15m },
        new SocsoBracket { SortOrder = 4, MinAge = 60, MinMonthlySalary = 5000.01m, EmployerAmount = 74.40m, EmployeeAmount = 44.65m },
    ];

    static async Task SeedSalariesAsync(BisyncDbContext db)
    {
        foreach (var demo in HospitalityPayroll)
        {
            var employee = await db.Employees.FirstOrDefaultAsync(e => e.Email == demo.Email);
            if (employee is null) continue;
            if (employee.BaseSalary is not null) continue;

            employee.BaseSalary = demo.BaseSalary;
            employee.ServiceAllowance = demo.Service;
            employee.TransportAllowance = demo.Transport;
            employee.AccommodationAllowance = demo.Accommodation;
            employee.MobileAllowance = demo.Mobile;
            employee.OvertimeAllowanceEnabled = demo.OvertimeEnabled;
            employee.DateOfBirth ??= demo.DateOfBirth;
            employee.Nationality ??= "Malaysian";
        }

        await db.SaveChangesAsync();
    }

    static async Task SeedJune2026AttendanceAsync(BisyncDbContext db)
    {
        const int year = 2026;
        const int month = 6;
        var periodStart = new DateOnly(year, month, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);

        var hospitalityIds = await db.AppUsers.AsNoTracking()
            .Where(u => u.CompanyId == 1 && u.EmployeeId != null)
            .Select(u => u.EmployeeId!.Value)
            .ToListAsync();

        var hasAny = await db.AttendanceRecords.AnyAsync(a =>
            hospitalityIds.Contains(a.EmployeeId) && a.Date >= periodStart && a.Date <= periodEnd);
        if (hasAny) return;

        foreach (var employeeId in hospitalityIds)
        {
            for (var date = periodStart; date <= periodEnd; date = date.AddDays(1))
            {
                if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;

                var isLateFriday = date.DayOfWeek == DayOfWeek.Friday && employeeId % 2 == 0;
                var record = new AttendanceRecord
                {
                    EmployeeId = employeeId,
                    Date = date,
                    Status = isLateFriday ? AttendanceStatus.Late : AttendanceStatus.Present,
                    ScheduledIn = new TimeOnly(9, 0),
                    ScheduledOut = new TimeOnly(18, 0),
                    ActualIn = new TimeOnly(9, 0),
                    ActualOut = new TimeOnly(18, 0),
                };

                if (employeeId == 1 && date == new DateOnly(2026, 6, 10))
                    record.ActualOut = new TimeOnly(20, 0);

                db.AttendanceRecords.Add(record);
            }
        }

        await db.SaveChangesAsync();
    }
}
