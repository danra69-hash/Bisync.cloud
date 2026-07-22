namespace Bisync.Api.Models;

/// <summary>
/// Platform (Cube Value) Office 365 calendar sync for Sales Module appointments.
/// Single-row table (Id = 1). Uses Microsoft Graph application permissions.
/// </summary>
public class SalesModuleCalendarSettings
{
    public int Id { get; set; } = 1;

    /// <summary>When true, create/delete appointments push to the Cubevalue mailbox calendar.</summary>
    public bool Enabled { get; set; }

    public string GraphTenantId { get; set; } = string.Empty;
    public string GraphClientId { get; set; } = string.Empty;
    public string GraphClientSecret { get; set; } = string.Empty;

    /// <summary>Microsoft 365 mailbox UPN that owns the Cubevalue calendar (e.g. sales@cubevalue.com).</summary>
    public string CalendarMailbox { get; set; } = string.Empty;

    /// <summary>Optional display label shown in Dev Console (defaults to Cubevalue).</summary>
    public string CalendarDisplayName { get; set; } = "Cubevalue";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedByEmail { get; set; } = string.Empty;
    public string LastTestAt { get; set; } = string.Empty;
    public string LastTestResult { get; set; } = string.Empty;
}
