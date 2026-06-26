using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class PayStructure
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string CountryCode { get; set; } = "MY";
    public string PayType { get; set; } = "Fixed Salary";
    public string PayCycle { get; set; } = "Monthly";
    public decimal ProvidentFundEmployerPct { get; set; }
    public decimal ProvidentFundEmployeePct { get; set; }
    public decimal ForeignProvidentFundEmployerPct { get; set; } = 2;
    public decimal ForeignProvidentFundEmployeePct { get; set; } = 2;
    public decimal ForeignSocsoEmployerPct { get; set; } = 1.25m;
    /// <summary>Multiplier applied to derived hourly rate for overtime (e.g. 1.5 = time-and-a-half).</summary>
    public decimal OvertimeRateMultiplier { get; set; } = 1.5m;
    /// <summary>Calculated = salary / (work days × hours). Fixed = flat rate per OT hour.</summary>
    public string OvertimeCalculationMode { get; set; } = "Calculated";
    public decimal? OvertimeFixedHourlyRate { get; set; }
    public bool Active { get; set; } = true;

    [JsonIgnore]
    public Company? Company { get; set; }
    public List<ProvidentFundBracket> ProvidentFundBrackets { get; set; } = [];
    public List<SocsoBracket> SocsoBrackets { get; set; } = [];
    public List<MandatoryContribution> MandatoryContributions { get; set; } = [];
}

public class ProvidentFundBracket
{
    public int Id { get; set; }
    public int PayStructureId { get; set; }
    [JsonIgnore]
    public PayStructure? PayStructure { get; set; }
    public int SortOrder { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public decimal? MinMonthlySalary { get; set; }
    public decimal? MaxMonthlySalary { get; set; }
    public decimal EmployerPct { get; set; }
    public decimal EmployeePct { get; set; }
    public bool NoContribution { get; set; }
}

public class MandatoryContribution
{
    public int Id { get; set; }
    public int PayStructureId { get; set; }
    [JsonIgnore]
    public PayStructure? PayStructure { get; set; }
    public string Name { get; set; } = null!;
    public decimal EmployerPct { get; set; }
    public decimal EmployeePct { get; set; }
}

public class SocsoBracket
{
    public int Id { get; set; }
    public int PayStructureId { get; set; }
    [JsonIgnore]
    public PayStructure? PayStructure { get; set; }
    public int SortOrder { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
    public decimal? MinMonthlySalary { get; set; }
    public decimal? MaxMonthlySalary { get; set; }
    public decimal EmployerAmount { get; set; }
    public decimal EmployeeAmount { get; set; }
}
