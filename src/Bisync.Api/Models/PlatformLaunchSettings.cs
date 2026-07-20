namespace Bisync.Api.Models;

/// <summary>
/// Control-plane launch mode for the cloud site (Demo vs Go live).
/// Single-row table (Id = 1). While not GoLive, public registration is limited to demo email domains.
/// </summary>
public class PlatformLaunchSettings
{
    public int Id { get; set; } = 1;
    /// <summary>Demo site mode (default true on new environments).</summary>
    public bool DemoMode { get; set; } = true;
    /// <summary>When true, public registration accepts any email domain.</summary>
    public bool GoLive { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedByEmail { get; set; } = string.Empty;
}
