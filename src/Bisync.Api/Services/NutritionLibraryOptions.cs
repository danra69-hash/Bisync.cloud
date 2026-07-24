namespace Bisync.Api.Services;

public sealed class NutritionLibraryOptions
{
    public const string SectionName = "NutritionLibrary";

    /// <summary>How often to check USDA for library updates (hours). Default weekly.</summary>
    public int CheckIntervalHours { get; set; } = 24 * 7;

    /// <summary>Run a sync check shortly after API startup.</summary>
    public bool RunOnStartup { get; set; } = true;

    /// <summary>Force sync when the library table is empty.</summary>
    public bool SyncWhenEmpty { get; set; } = true;

    public string FoundationZipUrl { get; set; } =
        "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip";

    public string SrLegacyZipUrl { get; set; } =
        "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip";
}
