namespace Bisync.Api.Models;

/// <summary>
/// Latest (and history) control-plane snapshot of fan-out tenant rollups for Dev Console.
/// </summary>
public class TenantRollupSnapshot
{
    public int Id { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "ok";
    public int TenantCount { get; set; }
    public int ProvisionedCount { get; set; }
    public int SharedCount { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public string ErrorsJson { get; set; } = "[]";
}
