using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class PublicHoliday
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public DateOnly Date { get; set; }
    /// <summary>Whether the company recognizes this holiday.</summary>
    public bool IsRecognized { get; set; }
    /// <summary>ISO 3166-1 alpha-2 country code for this holiday entry.</summary>
    public string? CountryCode { get; set; }
    /// <summary>Stable key from the public holiday catalog (country + date + name).</summary>
    public string? CatalogKey { get; set; }
    /// <summary>When true, this holiday repeats on the same month/day every year.</summary>
    public bool IsRecurringAnnually { get; set; }
    /// <summary>Whether this is an officially gazetted public holiday.</summary>
    public bool IsGazetted { get; set; }
}

/// <summary>Leave and overtime entitlements per employee level (Admin settings).</summary>
public class EmployeeLevel
{
    public int Id { get; set; }
    public string LevelName { get; set; } = null!;
    public int AnnualLeaveDays { get; set; }
    public int SickLeaveDays { get; set; }
    public bool OvertimeEligible { get; set; }
    public decimal WorkingHoursPerDay { get; set; } = 8;
    public decimal BreakHoursPerShift { get; set; } = 1;
    public bool PublicHolidayEligible { get; set; }
    public bool IsShift { get; set; }
    public string? ShiftType { get; set; }
    public bool Active { get; set; } = true;
}

public class Division
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Code { get; set; }
    [JsonIgnore]
    public ICollection<Department> Departments { get; set; } = [];
}

public class Department
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public int DivisionId { get; set; }
    [JsonIgnore]
    public Division Division { get; set; } = null!;
}

/// <summary>Single-row table for company-wide settings.</summary>
public class CompanySetting
{
    public int Id { get; set; }
    /// <summary>Pay multiplier when working on a public holiday, e.g. 1.5.</summary>
    public decimal PublicHolidayPayMultiplier { get; set; } = 1.5m;
    /// <summary>When enabled, employees who work on a recognized public holiday earn RPH balance.</summary>
    public bool ReplacementPublicHolidayEnabled { get; set; }
    /// <summary>ISO 3166-1 alpha-2 code for the company's operating country (public holiday source).</summary>
    public string OperatingCountryCode { get; set; } = "MY";
    public bool GazettedPhReplacementDayEnabled { get; set; }
    public decimal GazettedPhNormalHoursRate { get; set; } = 1.5m;
    public decimal GazettedPhOvertimeHoursRate { get; set; } = 2.0m;
    public bool NonGazettedPhReplacementDayEnabled { get; set; }
}
