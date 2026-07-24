namespace Bisync.Api.Models;

/// <summary>
/// USDA FoodData Central food row used for product nutrient estimates.
/// Amounts are per 100 g edible portion.
/// </summary>
public class NutritionLibraryFood
{
    public int Id { get; set; }
    /// <summary>FDC food id.</summary>
    public long FdcId { get; set; }
    /// <summary>foundation | sr_legacy</summary>
    public string Source { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string? NdbNumber { get; set; }
    public decimal EnergyKcal { get; set; }
    public decimal ProteinG { get; set; }
    public decimal CarbG { get; set; }
    public decimal SugarsG { get; set; }
    public decimal FiberG { get; set; }
    public decimal FatG { get; set; }
    public decimal SatFatG { get; set; }
    public decimal SodiumMg { get; set; }
    public decimal CholesterolMg { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Singleton-ish sync metadata for the nutrition library (one active row).</summary>
public class NutritionLibraryMeta
{
    public int Id { get; set; } = 1;
    public string Version { get; set; } = string.Empty;
    public string SourceLabel { get; set; } = string.Empty;
    public string Citation { get; set; } = string.Empty;
    public string Basis { get; set; } = "per 100 g edible portion";
    public int EntryCount { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public DateTime? LastCheckedAt { get; set; }
    public string LastSyncStatus { get; set; } = "never";
    public string LastSyncError { get; set; } = string.Empty;
    public bool ChangedOnLastSync { get; set; }
}

/// <summary>Cached nutrient estimate for a product recipe (excludes packaging).</summary>
public class ProductNutrientEstimate
{
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public decimal EnergyKcal { get; set; }
    public decimal ProteinG { get; set; }
    public decimal CarbG { get; set; }
    public decimal SugarsG { get; set; }
    public decimal FiberG { get; set; }
    public decimal FatG { get; set; }
    public decimal SatFatG { get; set; }
    public decimal SodiumMg { get; set; }
    public decimal CholesterolMg { get; set; }
    public int MatchedCount { get; set; }
    public int TotalCount { get; set; }
    public decimal CoverageGrams { get; set; }
    public string DetailsJson { get; set; } = "[]";
    public string LibraryVersion { get; set; } = string.Empty;
    public bool IsStale { get; set; }
    public DateTime CalculatedAt { get; set; } = DateTime.UtcNow;
}
