using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class PayrollContributionCalculator
{
    public static bool IsMalaysianEmployee(Employee employee)
    {
        var nationality = employee.Nationality?.Trim();
        if (string.IsNullOrEmpty(nationality)) return true;
        return nationality.Equals("Malaysia", StringComparison.OrdinalIgnoreCase)
            || nationality.Equals("Malaysian", StringComparison.OrdinalIgnoreCase)
            || nationality.Equals("MY", StringComparison.OrdinalIgnoreCase);
    }

    public static int? GetAgeAtMonthEnd(Employee employee, int year, int month)
    {
        if (employee.DateOfBirth is null) return null;
        var monthEnd = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        var dob = employee.DateOfBirth.Value;
        var age = monthEnd.Year - dob.Year;
        if (dob > monthEnd.AddYears(-age)) age--;
        return age;
    }

    public static (decimal Employer, decimal Employee) CalcEpf(
        PayStructure payStructure,
        Employee employee,
        decimal contributableWage,
        int year,
        int month)
    {
        if (contributableWage <= 0) return (0m, 0m);

        if (payStructure.CountryCode != "MY")
        {
            return (
                Round(contributableWage * payStructure.ProvidentFundEmployerPct / 100m),
                Round(contributableWage * payStructure.ProvidentFundEmployeePct / 100m));
        }

        if (!IsMalaysianEmployee(employee))
        {
            return (
                Round(contributableWage * payStructure.ForeignProvidentFundEmployerPct / 100m),
                Round(contributableWage * payStructure.ForeignProvidentFundEmployeePct / 100m));
        }

        var brackets = payStructure.ProvidentFundBrackets.Count > 0
            ? payStructure.ProvidentFundBrackets
            : DefaultMalaysiaProvidentFundBrackets();
        var age = GetAgeAtMonthEnd(employee, year, month);
        var bracket = FindProvidentFundBracket(brackets, age, contributableWage);
        if (bracket is null || bracket.NoContribution)
            return (0m, 0m);

        return (
            Round(contributableWage * bracket.EmployerPct / 100m),
            Round(contributableWage * bracket.EmployeePct / 100m));
    }

    public static (decimal Employer, decimal Employee) CalcSocso(
        PayStructure payStructure,
        Employee employee,
        decimal contributableWage,
        int year,
        int month)
    {
        if (contributableWage <= 0) return (0m, 0m);

        if (payStructure.CountryCode != "MY")
            return (0m, 0m);

        if (!IsMalaysianEmployee(employee))
            return (Round(contributableWage * payStructure.ForeignSocsoEmployerPct / 100m), 0m);

        var brackets = payStructure.SocsoBrackets.Count > 0
            ? payStructure.SocsoBrackets
            : [];
        var age = GetAgeAtMonthEnd(employee, year, month);
        var bracket = FindSocsoBracket(brackets, age, contributableWage);
        if (bracket is null) return (0m, 0m);

        return (bracket.EmployerAmount, bracket.EmployeeAmount);
    }

    static List<ProvidentFundBracket> DefaultMalaysiaProvidentFundBrackets() =>
    [
        new ProvidentFundBracket { SortOrder = 0, MaxAge = 59, MaxMonthlySalary = 5000m, EmployerPct = 13m, EmployeePct = 11m },
        new ProvidentFundBracket { SortOrder = 1, MaxAge = 59, MinMonthlySalary = 5000.01m, EmployerPct = 13m, EmployeePct = 11m },
        new ProvidentFundBracket { SortOrder = 2, MinAge = 60, EmployerPct = 0m, EmployeePct = 0m, NoContribution = true },
    ];

    static ProvidentFundBracket? FindProvidentFundBracket(
        IEnumerable<ProvidentFundBracket> brackets,
        int? age,
        decimal salary)
    {
        return brackets
            .OrderBy(b => b.SortOrder)
            .FirstOrDefault(b => MatchesProvidentFundBracket(b, age, salary));
    }

    static SocsoBracket? FindSocsoBracket(
        IEnumerable<SocsoBracket> brackets,
        int? age,
        decimal salary)
    {
        return brackets
            .OrderBy(b => b.SortOrder)
            .FirstOrDefault(b => MatchesSocsoBracket(b, age, salary));
    }

    static bool MatchesProvidentFundBracket(ProvidentFundBracket bracket, int? age, decimal salary)
    {
        if (age is not null)
        {
            if (bracket.MinAge is not null && age < bracket.MinAge.Value) return false;
            if (bracket.MaxAge is not null && age > bracket.MaxAge.Value) return false;
        }
        if (bracket.MinMonthlySalary is not null && salary < bracket.MinMonthlySalary.Value) return false;
        if (bracket.MaxMonthlySalary is not null && salary > bracket.MaxMonthlySalary.Value) return false;
        return true;
    }

    static bool MatchesSocsoBracket(SocsoBracket bracket, int? age, decimal salary)
    {
        if (age is not null)
        {
            if (bracket.MinAge is not null && age < bracket.MinAge.Value) return false;
            if (bracket.MaxAge is not null && age > bracket.MaxAge.Value) return false;
        }
        if (bracket.MinMonthlySalary is not null && salary < bracket.MinMonthlySalary.Value) return false;
        if (bracket.MaxMonthlySalary is not null && salary > bracket.MaxMonthlySalary.Value) return false;
        return true;
    }

    static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
