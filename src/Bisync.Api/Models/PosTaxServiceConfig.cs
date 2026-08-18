namespace Bisync.Api.Models;

/// <summary>
/// Company-scoped POS tax and service-charge setup (line defs + per sales-type rules).
/// </summary>
public class PosTaxServiceConfig
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>
    /// JSON: { taxes[], services[], salesTypes[] }.
    /// </summary>
    public string ConfigJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
