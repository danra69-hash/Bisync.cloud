using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public record PayrollLineResult(
    int EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string Department,
    string Position,
    decimal PresentDays,
    decimal WorkingDays,
    decimal TotalHours,
    decimal OvertimeHours,
    decimal AttendanceRatio,
    decimal BaseSalary,
    decimal ServiceAllowance,
    decimal AccommodationAllowance,
    decimal TransportAllowance,
    decimal MobileAllowance,
    decimal BonusAmount,
    decimal OvertimeAmount,
    decimal EpfEmployeeAmount,
    decimal EpfEmployerAmount,
    decimal SocsoEmployeeAmount,
    decimal SocsoEmployerAmount,
    decimal IncomeTaxAmount,
    decimal GrossPay,
    decimal TotalPayout);

public record PayrollPreviewResult(
    int CompanyId,
    string CompanyName,
    int Year,
    int Month,
    string PayCycle,
    string PayType,
    string CountryCode,
    string PeriodLabel,
    string PeriodStart,
    string PeriodEnd,
    decimal TotalGross,
    decimal TotalPayout,
    int EmployeeCount,
    bool AlreadyProcessed,
    int? ExistingRunId,
    IReadOnlyList<PayrollLineResult> Lines);

public class PayrollCalculationService(BisyncDbContext db)
{
    static readonly string[] MonthNames =
        ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    public async Task<PayrollPreviewResult?> BuildPreviewAsync(int companyId, int year, int month, CancellationToken ct = default)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
        if (company is null) return null;

        var payStructure = await db.PayStructures.AsNoTracking()
            .Include(p => p.ProvidentFundBrackets)
            .Include(p => p.SocsoBrackets)
            .FirstOrDefaultAsync(p => p.CompanyId == companyId, ct);

        var payCycle = payStructure?.PayCycle ?? "Monthly";
        var payType = payStructure?.PayType ?? "Fixed Salary";
        var countryCode = payStructure?.CountryCode ?? company.CountryCode;

        var periodStart = new DateOnly(year, month, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);
        var workingDays = CountWeekdays(periodStart, periodEnd);

        var employeeIds = await ResolveCompanyEmployeeIdsAsync(companyId, ct);
        if (employeeIds.Count == 0)
        {
            return new PayrollPreviewResult(
                companyId, company.Name, year, month, payCycle, payType, countryCode,
                BuildPeriodLabel(year, month, payCycle), periodStart.ToString("yyyy-MM-dd"), periodEnd.ToString("yyyy-MM-dd"),
                0, 0, 0, false, null, []);
        }

        var employees = await db.Employees.AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id) && e.Active)
            .OrderBy(e => e.Name)
            .ToListAsync(ct);

        var attendance = await db.AttendanceRecords.AsNoTracking()
            .Where(a => employeeIds.Contains(a.EmployeeId) && a.Date >= periodStart && a.Date <= periodEnd)
            .ToListAsync(ct);

        var structureForCalc = payStructure ?? new PayStructure
        {
            CompanyId = companyId,
            CountryCode = countryCode,
            PayType = payType,
            PayCycle = payCycle,
        };

        var taxSchedule = await db.IncomeTaxYears.AsNoTracking()
            .Include(s => s.Brackets)
            .Include(s => s.Reliefs)
            .Include(s => s.Rebates)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Year == year && s.Active, ct);
        var taxBrackets = taxSchedule?.Brackets
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.MinAnnualChargeableIncome)
            .ToList() ?? [];
        var taxReliefs = taxSchedule?.Reliefs
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Id)
            .ToList() ?? [];
        var taxRebateTotal = taxSchedule?.Rebates.Sum(r => r.Amount) ?? 0m;

        var lines = employees.Select(employee =>
            BuildLine(employee, attendance, structureForCalc, payType, year, month, workingDays, taxBrackets, taxReliefs, taxRebateTotal))
            .ToList();

        var existing = await db.PayrollRuns.AsNoTracking()
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Year == year && r.Month == month, ct);

        return new PayrollPreviewResult(
            companyId,
            company.Name,
            year,
            month,
            payCycle,
            payType,
            countryCode,
            BuildPeriodLabel(year, month, payCycle),
            periodStart.ToString("yyyy-MM-dd"),
            periodEnd.ToString("yyyy-MM-dd"),
            lines.Sum(l => l.GrossPay),
            lines.Sum(l => l.TotalPayout),
            lines.Count,
            existing is not null,
            existing?.Id,
            lines);
    }

    static PayrollLineResult BuildLine(
        Employee employee,
        List<AttendanceRecord> attendance,
        PayStructure payStructure,
        string payType,
        int year,
        int month,
        int workingDays,
        IReadOnlyList<IncomeTaxBracket> taxBrackets,
        IReadOnlyList<IncomeTaxRelief> taxReliefs,
        decimal taxRebateTotal)
    {
        var records = attendance.Where(a => a.EmployeeId == employee.Id).ToList();
        var presentDays = records.Count(r => r.Status is AttendanceStatus.Present or AttendanceStatus.Late)
            + records.Count(r => r.Status == AttendanceStatus.HalfDay) * 0.5m;
        var totalHours = records.Sum(r => CalcActualHours(r));
        var overtimeHours = records.Sum(r => CalcOvertimeHours(r));
        var attendanceRatio = workingDays > 0 ? Math.Min(1m, presentDays / workingDays) : 0m;

        var monthlyBase = employee.BaseSalary ?? 0m;
        var monthlyService = employee.ServiceAllowance ?? 0m;
        var monthlyAccommodation = employee.AccommodationAllowance ?? 0m;
        var monthlyTransport = employee.TransportAllowance ?? 0m;
        var monthlyMobile = employee.MobileAllowance ?? 0m;
        var bonus = CalcMonthlyBonus(employee, monthlyBase, monthlyService);

        var basePay = CalcComponentPay(monthlyBase, payType, presentDays, totalHours, attendanceRatio);
        var servicePay = CalcAllowancePay(monthlyService, payType, attendanceRatio);
        var accommodationPay = CalcAllowancePay(monthlyAccommodation, payType, attendanceRatio);
        var transportPay = CalcAllowancePay(monthlyTransport, payType, attendanceRatio);
        var mobilePay = CalcAllowancePay(monthlyMobile, payType, attendanceRatio);
        var bonusPay = CalcAllowancePay(bonus, payType, attendanceRatio);

        var overtimeAmount = employee.OvertimeAllowanceEnabled
            ? OvertimeCalculationHelper.CalcOvertimeAmount(
                payStructure,
                monthlyBase,
                employee.WorkingHoursPerDay,
                workingDays,
                overtimeHours)
            : 0m;

        var gross = Math.Round(basePay + servicePay + accommodationPay + transportPay + mobilePay + bonusPay + overtimeAmount, 2);
        var contributableWage = Math.Round(basePay + servicePay, 2);

        var (epfEmployer, epfEmployee) = PayrollContributionCalculator.CalcEpf(
            payStructure, employee, contributableWage, year, month);
        var (socsoEmployer, socsoEmployee) = PayrollContributionCalculator.CalcSocso(
            payStructure, employee, contributableWage, year, month);

        var incomeTax = CalcMonthlyIncomeTax(employee, payStructure, year, month, taxBrackets, taxReliefs, taxRebateTotal);
        var totalPayout = Math.Round(gross - epfEmployee - socsoEmployee - incomeTax, 2);

        return new PayrollLineResult(
            employee.Id,
            employee.EmployeeCode,
            employee.Name,
            employee.Department,
            employee.Position,
            presentDays,
            workingDays,
            Math.Round((decimal)totalHours, 2),
            Math.Round((decimal)overtimeHours, 2),
            Math.Round(attendanceRatio, 4),
            basePay,
            servicePay,
            accommodationPay,
            transportPay,
            mobilePay,
            bonusPay,
            overtimeAmount,
            epfEmployee,
            epfEmployer,
            socsoEmployee,
            socsoEmployer,
            incomeTax,
            gross,
            totalPayout);
    }

    static decimal CalcComponentPay(
        decimal monthlyAmount,
        string payType,
        decimal presentDays,
        double totalHours,
        decimal attendanceRatio) =>
        payType switch
        {
            "Hourly" => Math.Round((decimal)totalHours * monthlyAmount, 2),
            "Daily" => Math.Round(monthlyAmount * presentDays, 2),
            _ => Math.Round(monthlyAmount * attendanceRatio, 2),
        };

    static decimal CalcAllowancePay(decimal monthlyAmount, string payType, decimal attendanceRatio) =>
        payType is "Hourly" or "Daily"
            ? Math.Round(monthlyAmount * attendanceRatio, 2)
            : Math.Round(monthlyAmount * attendanceRatio, 2);

    async Task<List<int>> ResolveCompanyEmployeeIdsAsync(int companyId, CancellationToken ct)
    {
        var users = await db.AppUsers.AsNoTracking()
            .Where(u => u.CompanyId == companyId && u.EmployeeId != null)
            .Select(u => new { u.EmployeeId, u.Email })
            .ToListAsync(ct);

        var linkedIds = users.Where(u => u.EmployeeId.HasValue).Select(u => u.EmployeeId!.Value).ToHashSet();
        var emails = users.Select(u => u.Email.ToLowerInvariant()).ToHashSet();

        var byEmail = await db.Employees.AsNoTracking()
            .Where(e => emails.Contains(e.Email.ToLower()))
            .Select(e => e.Id)
            .ToListAsync(ct);

        foreach (var id in byEmail) linkedIds.Add(id);
        return linkedIds.ToList();
    }

    static decimal CalcMonthlyIncomeTax(
        Employee employee,
        PayStructure payStructure,
        int year,
        int month,
        IReadOnlyList<IncomeTaxBracket> taxBrackets,
        IReadOnlyList<IncomeTaxRelief> taxReliefs,
        decimal taxRebateTotal)
    {
        if (taxBrackets.Count == 0) return 0m;

        var monthlyGross = CalcProjectedMonthlyGross(employee);
        if (monthlyGross <= 0) return 0m;

        var monthlyContributable = Math.Round((employee.BaseSalary ?? 0m) + (employee.ServiceAllowance ?? 0m), 2);
        var (_, epfEmployee) = PayrollContributionCalculator.CalcEpf(
            payStructure, employee, monthlyContributable, year, month);

        var annualGross = Math.Round(monthlyGross * 12m, 2);
        var annualEpf = Math.Round(epfEmployee * 12m, 2);
        var annualTaxRelief = IncomeTaxCalculator.CalcEmployeeReliefTotal(employee, taxReliefs);
        return IncomeTaxCalculator.CalcMonthlyPcb(annualGross, annualEpf, annualTaxRelief, taxRebateTotal, taxBrackets);
    }

    static decimal CalcProjectedMonthlyGross(Employee employee)
    {
        var baseSalary = employee.BaseSalary ?? 0m;
        var service = employee.ServiceAllowance ?? 0m;
        var accommodation = employee.AccommodationAllowance ?? 0m;
        var transport = employee.TransportAllowance ?? 0m;
        var mobile = employee.MobileAllowance ?? 0m;
        var bonus = CalcMonthlyBonus(employee, baseSalary, service);
        return Math.Round(baseSalary + service + accommodation + transport + mobile + bonus, 2);
    }

    static decimal CalcMonthlyBonus(Employee employee, decimal baseSalary, decimal serviceAllowance)
    {
        if (!employee.BonusEnabled || !employee.BonusMonthly) return 0m;
        decimal total = 0m;
        if (employee.BonusAmount is > 0) total += employee.BonusAmount.Value;
        if (employee.BonusByBasicSalary) total += baseSalary;
        if (employee.BonusByService) total += serviceAllowance;
        return total;
    }

    static double CalcActualHours(AttendanceRecord record)
    {
        if (record.ActualIn is null || record.ActualOut is null) return 0;
        return (record.ActualOut.Value - record.ActualIn.Value).TotalHours;
    }

    static double CalcOvertimeHours(AttendanceRecord record)
    {
        if (record.ScheduledIn is null || record.ScheduledOut is null || record.ActualIn is null || record.ActualOut is null)
            return 0;
        var scheduled = (record.ScheduledOut.Value - record.ScheduledIn.Value).TotalHours;
        var actual = (record.ActualOut.Value - record.ActualIn.Value).TotalHours;
        return Math.Max(0, actual - scheduled);
    }

    static int CountWeekdays(DateOnly start, DateOnly end)
    {
        var count = 0;
        for (var d = start; d <= end; d = d.AddDays(1))
        {
            if (d.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday) count++;
        }
        return count;
    }

    static string BuildPeriodLabel(int year, int month, string payCycle) =>
        payCycle switch
        {
            "Weekly" => $"{MonthNames[month]} {year} · Weekly cycle",
            "Bi-Weekly" => $"{MonthNames[month]} {year} · Bi-weekly cycle",
            "Semi-Monthly" => $"{MonthNames[month]} {year} · Semi-monthly cycle",
            _ => $"{MonthNames[month]} {year} · Monthly",
        };
}
