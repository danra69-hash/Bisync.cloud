namespace Bisync.Api.Services;

public class StockCardArchiveOptions
{
    public const string SectionName = "StockCardArchive";

    public int RetentionYears { get; set; } = 2;

    /// <summary>Folder that stores archive.db (e.g. data-archives/stock-card).</summary>
    public string Directory { get; set; } = string.Empty;

    public bool RunOnStartup { get; set; } = true;

    public int IntervalHours { get; set; } = 24;
}
