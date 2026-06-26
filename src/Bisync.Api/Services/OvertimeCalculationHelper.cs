using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class OvertimeCalculationHelper
{
    public const string ModeCalculated = "Calculated";
    public const string ModeFixed = "Fixed";

    public static decimal CalcOvertimeAmount(
        PayStructure payStructure,
        decimal monthlyBaseSalary,
        decimal workingHoursPerDay,
        int workingDaysInPeriod,
        double overtimeHours)
    {
        if (overtimeHours <= 0 || monthlyBaseSalary <= 0) return 0m;

        var mode = NormalizeMode(payStructure.OvertimeCalculationMode);
        if (mode == ModeFixed)
        {
            var fixedRate = payStructure.OvertimeFixedHourlyRate ?? 0m;
            return fixedRate <= 0 ? 0m : Math.Round((decimal)overtimeHours * fixedRate, 2);
        }

        var hourlyRate = CalcDerivedHourlyRate(
            monthlyBaseSalary,
            payStructure.PayCycle,
            workingDaysInPeriod,
            workingHoursPerDay);
        var multiplier = payStructure.OvertimeRateMultiplier > 0 ? payStructure.OvertimeRateMultiplier : 1.5m;
        return Math.Round((decimal)overtimeHours * hourlyRate * multiplier, 2);
    }

    public static decimal CalcDerivedHourlyRate(
        decimal monthlyBaseSalary,
        string payCycle,
        int workingDaysInPeriod,
        decimal workingHoursPerDay)
    {
        var hoursPerDay = Math.Max(workingHoursPerDay, 1m);
        var (periodSalary, workDays) = ResolveSalaryAndWorkDays(monthlyBaseSalary, payCycle, workingDaysInPeriod);
        var denominator = workDays * hoursPerDay;
        return denominator > 0 ? periodSalary / denominator : 0m;
    }

    static (decimal PeriodSalary, decimal WorkDays) ResolveSalaryAndWorkDays(
        decimal monthlyBaseSalary,
        string payCycle,
        int workingDaysInPeriod)
    {
        return payCycle switch
        {
            "Weekly" => (monthlyBaseSalary * 12m / 52m, 5m),
            _ => (monthlyBaseSalary, workingDaysInPeriod),
        };
    }

    static string NormalizeMode(string? mode) =>
        string.Equals(mode, ModeFixed, StringComparison.OrdinalIgnoreCase) ? ModeFixed : ModeCalculated;
}
