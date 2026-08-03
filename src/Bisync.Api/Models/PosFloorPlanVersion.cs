namespace Bisync.Api.Models;

/// <summary>Historical snapshot of a POS floor plan before an overwrite.</summary>
public class PosFloorPlanVersion
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string LayoutJson { get; set; } = """{"tables":[],"zones":[]}""";
    public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
    public string Source { get; set; } = "overwrite";
}
