using System.Text.Json.Serialization;

namespace Bisync.Api.Models;

public class IncomeTaxYear
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int Year { get; set; }
    public string CountryCode { get; set; } = "MY";
    public bool Active { get; set; } = true;

    [JsonIgnore]
    public Company? Company { get; set; }
    public List<IncomeTaxBracket> Brackets { get; set; } = [];
    public List<IncomeTaxRelief> Reliefs { get; set; } = [];
    public List<IncomeTaxRebate> Rebates { get; set; } = [];
}

public class IncomeTaxBracket
{
    public int Id { get; set; }
    public int IncomeTaxYearId { get; set; }
    [JsonIgnore]
    public IncomeTaxYear? IncomeTaxYear { get; set; }
    public int SortOrder { get; set; }
    /// <summary>Lower chargeable income threshold (inclusive for first band).</summary>
    public decimal MinAnnualChargeableIncome { get; set; }
    /// <summary>Upper chargeable income threshold (inclusive). Null = no upper limit.</summary>
    public decimal? MaxAnnualChargeableIncome { get; set; }
    public decimal RatePct { get; set; }
    /// <summary>Minimum cumulative tax at the start of this band.</summary>
    public decimal BaseMinTaxAmount { get; set; }
}

public class IncomeTaxRelief
{
    public int Id { get; set; }
    public int IncomeTaxYearId { get; set; }
    [JsonIgnore]
    public IncomeTaxYear? IncomeTaxYear { get; set; }
    public int SortOrder { get; set; }
    public string Name { get; set; } = null!;
    public decimal Amount { get; set; }
    /// <summary>When true, amount is a maximum cap (displayed as "Up to").</summary>
    public bool IsMaximum { get; set; }
    /// <summary>e.g. Married — relief only applies when employee meets this condition.</summary>
    public string? ApplyCondition { get; set; }
}

public class IncomeTaxRebate
{
    public int Id { get; set; }
    public int IncomeTaxYearId { get; set; }
    [JsonIgnore]
    public IncomeTaxYear? IncomeTaxYear { get; set; }
    public int SortOrder { get; set; }
    public string Name { get; set; } = null!;
    public decimal Amount { get; set; }
}
