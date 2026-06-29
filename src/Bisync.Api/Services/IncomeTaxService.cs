using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public record IncomeTaxEmployeeLine(
    int EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string Position,
    decimal AnnualGross,
    decimal AnnualEpfEmployee,
    decimal AnnualTaxRelief,
    decimal BaseTaxAmount,
    decimal AnnualRebate,
    decimal AnnualTax,
    decimal MonthlyPcb);

public record IncomeTaxYearPreview(
    int CompanyId,
    string CompanyName,
    int Year,
    string CountryCode,
    bool Configured,
    decimal TotalAnnualGross,
    decimal TotalAnnualTax,
    decimal TotalMonthlyPcb,
    int EmployeeCount,
    IReadOnlyList<IncomeTaxEmployeeLine> Lines);

public class IncomeTaxService(BisyncDbContext db)
{
    public async Task<IncomeTaxYear?> LoadScheduleAsync(int companyId, int year, CancellationToken ct = default) =>
        await db.IncomeTaxYears
            .AsNoTracking()
            .Include(s => s.Brackets)
            .Include(s => s.Reliefs)
            .Include(s => s.Rebates)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Year == year, ct);

    public async Task<IncomeTaxYear> GetOrCreateScheduleAsync(int companyId, int year, CancellationToken ct = default)
    {
        var existing = await db.IncomeTaxYears
            .Include(s => s.Brackets)
            .Include(s => s.Reliefs)
            .Include(s => s.Rebates)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Year == year, ct);
        if (existing is not null)
        {
            if (existing.Brackets.Count > 0 && existing.Brackets.All(b => b.BaseMinTaxAmount == 0)
                && year == 2026 && existing.CountryCode == "MY")
            {
                await ResetMalaysia2026BracketsAsync(existing, ct);
            }
            if (existing.Reliefs.Count == 0 && year == 2026 && existing.CountryCode == "MY")
            {
                await SeedMalaysia2026ReliefsAsync(existing, ct);
            }
            return existing;
        }

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct)
            ?? throw new InvalidOperationException($"Company {companyId} not found.");

        var payStructure = await db.PayStructures.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CompanyId == companyId, ct);
        var countryCode = payStructure?.CountryCode ?? company.CountryCode;
        var isMalaysia2026 = countryCode == "MY" && year == 2026;

        var schedule = new IncomeTaxYear
        {
            CompanyId = companyId,
            Year = year,
            CountryCode = countryCode,
            Active = true,
            Brackets = isMalaysia2026
                ? IncomeTaxCalculator.ToBracketEntities(IncomeTaxCalculator.DefaultMalaysiaBrackets2026())
                : [],
            Reliefs = isMalaysia2026
                ? IncomeTaxCalculator.ToReliefEntities(IncomeTaxCalculator.DefaultMalaysiaReliefs2026())
                : [],
        };

        db.IncomeTaxYears.Add(schedule);
        await db.SaveChangesAsync(ct);
        return schedule;
    }

    async Task ResetMalaysia2026BracketsAsync(IncomeTaxYear schedule, CancellationToken ct)
    {
        db.IncomeTaxBrackets.RemoveRange(schedule.Brackets);
        schedule.Brackets = IncomeTaxCalculator.ToBracketEntities(IncomeTaxCalculator.DefaultMalaysiaBrackets2026());
        await db.SaveChangesAsync(ct);
    }

    async Task SeedMalaysia2026ReliefsAsync(IncomeTaxYear schedule, CancellationToken ct)
    {
        schedule.Reliefs = IncomeTaxCalculator.ToReliefEntities(IncomeTaxCalculator.DefaultMalaysiaReliefs2026());
        await db.SaveChangesAsync(ct);
    }

    public async Task<IncomeTaxYearPreview?> BuildYearlyPreviewAsync(int companyId, int year, CancellationToken ct = default)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
        if (company is null) return null;

        var schedule = await GetOrCreateScheduleAsync(companyId, year, ct);
        var payStructure = await db.PayStructures.AsNoTracking()
            .Include(p => p.ProvidentFundBrackets)
            .Include(p => p.SocsoBrackets)
            .FirstOrDefaultAsync(p => p.CompanyId == companyId, ct);

        var countryCode = payStructure?.CountryCode ?? company.CountryCode;
        var structureForCalc = payStructure ?? new PayStructure
        {
            CompanyId = companyId,
            CountryCode = countryCode,
        };

        var employeeIds = await ResolveCompanyEmployeeIdsAsync(companyId, ct);
        if (employeeIds.Count == 0)
        {
            return new IncomeTaxYearPreview(
                companyId, company.Name, year, countryCode,
                schedule.Brackets.Count > 0, 0, 0, 0, 0, []);
        }

        var employees = await db.Employees.AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id) && e.Active)
            .OrderBy(e => e.Name)
            .ToListAsync(ct);

        var brackets = schedule.Brackets.OrderBy(b => b.SortOrder).ThenBy(b => b.MinAnnualChargeableIncome).ToList();
        var reliefs = schedule.Reliefs.OrderBy(r => r.SortOrder).ThenBy(r => r.Id).ToList();
        var rebates = schedule.Rebates.OrderBy(r => r.SortOrder).ThenBy(r => r.Id).ToList();
        var configured = brackets.Count > 0;
        var defaultRebate = rebates.Sum(r => r.Amount);
        var projectionMonth = 12;

        var lines = employees.Select(employee =>
        {
            var monthlyGross = CalcProjectedMonthlyGross(employee);
            var monthlyContributable = Math.Round((employee.BaseSalary ?? 0m) + (employee.ServiceAllowance ?? 0m), 2);
            var (_, epfEmployee) = PayrollContributionCalculator.CalcEpf(
                structureForCalc, employee, monthlyContributable, year, projectionMonth);

            var annualGross = Math.Round(monthlyGross * 12m, 2);
            var annualEpf = Math.Round(epfEmployee * 12m, 2);
            var annualTaxRelief = IncomeTaxCalculator.CalcEmployeeReliefTotal(employee, reliefs);
            var baseTaxAmount = Math.Round(annualGross - annualEpf - annualTaxRelief, 2);
            var annualRebate = defaultRebate;
            var annualTax = configured
                ? IncomeTaxCalculator.CalcAnnualTax(annualGross, annualEpf, annualTaxRelief, annualRebate, brackets)
                : 0m;
            var monthlyPcb = configured
                ? IncomeTaxCalculator.CalcMonthlyPcb(annualGross, annualEpf, annualTaxRelief, annualRebate, brackets)
                : 0m;

            return new IncomeTaxEmployeeLine(
                employee.Id,
                employee.EmployeeCode,
                employee.Name,
                employee.Position,
                annualGross,
                annualEpf,
                annualTaxRelief,
                baseTaxAmount,
                annualRebate,
                annualTax,
                monthlyPcb);
        }).ToList();

        return new IncomeTaxYearPreview(
            companyId,
            company.Name,
            year,
            countryCode,
            configured,
            lines.Sum(l => l.AnnualGross),
            lines.Sum(l => l.AnnualTax),
            lines.Sum(l => l.MonthlyPcb),
            lines.Count,
            lines);
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
}
