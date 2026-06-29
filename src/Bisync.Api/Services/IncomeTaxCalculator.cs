using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class IncomeTaxCalculator
{
    public record BracketDefault(decimal Min, decimal? Max, decimal RatePct, decimal BaseMinTax);

    public static IReadOnlyList<BracketDefault> DefaultMalaysiaBrackets2026() =>
    [
        new(0m, 5_000m, 0m, 0m),
        new(5_000m, 20_000m, 1m, 150m),
        new(20_000m, 35_000m, 3m, 450m),
        new(35_000m, 50_000m, 6m, 900m),
        new(50_000m, 70_000m, 11m, 2_200m),
        new(70_000m, 100_000m, 19m, 5_700m),
        new(100_000m, 250_000m, 25m, 37_500m),
        new(250_000m, 400_000m, 26m, 39_000m),
        new(400_000m, 600_000m, 28m, 56_000m),
        new(600_000m, 1_000_000m, 30m, 120_000m),
        new(1_000_000m, null, 30m, 240_000m),
    ];

    /// <summary>
    /// Base tax amount before rebate: progressive tax on chargeable income using base-min brackets.
    /// </summary>
    public static decimal CalcProgressiveTax(decimal chargeableIncome, IEnumerable<IncomeTaxBracket> brackets)
    {
        if (chargeableIncome <= 0) return 0m;

        var ordered = brackets.OrderBy(b => b.SortOrder).ThenBy(b => b.MinAnnualChargeableIncome).ToList();
        var bracket = FindBracket(chargeableIncome, ordered);
        if (bracket is null) return 0m;

        var excess = chargeableIncome - bracket.MinAnnualChargeableIncome;
        if (bracket.MinAnnualChargeableIncome == 0 && chargeableIncome >= 0)
            excess = chargeableIncome;

        return Math.Round(bracket.BaseMinTaxAmount + excess * bracket.RatePct / 100m, 2);
    }

    public static decimal CalcAnnualTax(
        decimal annualGross,
        decimal annualEpfEmployee,
        decimal annualTaxRelief,
        decimal annualRebate,
        IEnumerable<IncomeTaxBracket> brackets)
    {
        var baseTaxAmount = Math.Round(annualGross - annualEpfEmployee - annualTaxRelief, 2);
        if (baseTaxAmount <= 0) return 0m;

        var progressiveTax = CalcProgressiveTax(baseTaxAmount, brackets);
        return Math.Max(0m, Math.Round(progressiveTax - annualRebate, 2));
    }

    public static decimal CalcMonthlyPcb(
        decimal annualGross,
        decimal annualEpfEmployee,
        decimal annualTaxRelief,
        decimal annualRebate,
        IEnumerable<IncomeTaxBracket> brackets) =>
        Math.Round(CalcAnnualTax(annualGross, annualEpfEmployee, annualTaxRelief, annualRebate, brackets) / 12m, 2);

    static IncomeTaxBracket? FindBracket(decimal chargeableIncome, List<IncomeTaxBracket> ordered)
    {
        for (var i = ordered.Count - 1; i >= 0; i--)
        {
            var bracket = ordered[i];
            var aboveMin = chargeableIncome > bracket.MinAnnualChargeableIncome
                || (bracket.MinAnnualChargeableIncome == 0 && chargeableIncome >= 0);
            if (!aboveMin) continue;

            if (bracket.MaxAnnualChargeableIncome is null || chargeableIncome <= bracket.MaxAnnualChargeableIncome)
                return bracket;
        }

        return ordered.FirstOrDefault();
    }

    public static List<IncomeTaxBracket> ToBracketEntities(IEnumerable<BracketDefault> defaults) =>
        defaults.Select((item, index) => new IncomeTaxBracket
        {
            SortOrder = index,
            MinAnnualChargeableIncome = item.Min,
            MaxAnnualChargeableIncome = item.Max,
            RatePct = item.RatePct,
            BaseMinTaxAmount = item.BaseMinTax,
        }).ToList();

    public record ReliefDefault(string Name, decimal Amount, bool IsMaximum, string? ApplyCondition);

    public static IReadOnlyList<ReliefDefault> DefaultMalaysiaReliefs2026() =>
    [
        new("Individual & Dependent Relative", 9_000m, false, IncomeTaxConditions.Married),
        new("Medical Treatment (serious illness / Parents)", 10_000m, true, null),
        new("Life Insurance", 7_000m, true, null),
        new("Education Fees (self)", 7_000m, false, null),
        new("Lifestyle (Reading materials, computers, sports equipment)", 2_500m, false, null),
        new("SSPN (Net deposit for child's education)", 8_000m, false, null),
    ];

    public static List<IncomeTaxRelief> ToReliefEntities(IEnumerable<ReliefDefault> defaults) =>
        defaults.Select((item, index) => new IncomeTaxRelief
        {
            SortOrder = index,
            Name = item.Name,
            Amount = item.Amount,
            IsMaximum = item.IsMaximum,
            ApplyCondition = item.ApplyCondition,
        }).ToList();

    public static decimal CalcEmployeeReliefTotal(Employee employee, IEnumerable<IncomeTaxRelief> reliefs) =>
        reliefs
            .Where(r => ReliefAppliesToEmployee(employee, r))
            .Sum(r => r.Amount);

    public static bool ReliefAppliesToEmployee(Employee employee, IncomeTaxRelief relief)
    {
        if (string.IsNullOrWhiteSpace(relief.ApplyCondition)) return true;
        if (relief.ApplyCondition.Equals(IncomeTaxConditions.Married, StringComparison.OrdinalIgnoreCase))
            return IsMarried(employee);
        return true;
    }

    static bool IsMarried(Employee employee) =>
        employee.MaritalStatus?.Equals("Married", StringComparison.OrdinalIgnoreCase) == true;
}

public static class IncomeTaxConditions
{
    public const string Married = "Married";
}
