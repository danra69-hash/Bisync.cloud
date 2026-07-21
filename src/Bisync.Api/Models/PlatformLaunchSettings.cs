namespace Bisync.Api.Models;

/// <summary>
/// Control-plane launch mode for the cloud site.
/// Single-row table (Id = 1). While DemoMode (not GoLive), public registration is limited to demo email domains.
/// Per-module Go live flags gate which platform modules are available to customers.
/// </summary>
public class PlatformLaunchSettings
{
    public int Id { get; set; } = 1;
    /// <summary>Demo site mode (default true on new environments).</summary>
    public bool DemoMode { get; set; } = true;
    /// <summary>When true, public registration accepts any email domain.</summary>
    public bool GoLive { get; set; }
    /// <summary>
    /// JSON object of module go-live flags, e.g.
    /// {"RMS":true,"POS":false,"HRM":false,"Accounting":false,"SystemConfig":false}.
    /// </summary>
    public string ModulesGoLiveJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedByEmail { get; set; } = string.Empty;
}
