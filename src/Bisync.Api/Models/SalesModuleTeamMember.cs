namespace Bisync.Api.Models;

/// <summary>Sales person whose Office 365 calendar is pulled into Sales Module.</summary>
public class SalesModuleTeamMember
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Microsoft 365 mailbox / UPN used for calendar sync.</summary>
    public string Email { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    /// <summary>When true, this person appears in Hunter selectors (Overview, Client Update, etc.).</summary>
    public bool IsHunter { get; set; } = true;
    /// <summary>When true, this person appears in Farmer selectors.</summary>
    public bool IsFarmer { get; set; } = false;
    /// <summary>When true, this member's Outlook calendar is merged into the Sales Module calendar.</summary>
    public bool CalendarSyncEnabled { get; set; } = true;
    public string LastSyncError { get; set; } = string.Empty;
    public DateTime? LastSyncedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
