namespace Bisync.Api.Models;

/// <summary>POS floor plan layout (tables + zones) for one company location.</summary>
public class PosFloorPlan
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>JSON: { tables: [...], zones: [...] }.</summary>
    public string LayoutJson { get; set; } = """{"tables":[],"zones":[]}""";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
