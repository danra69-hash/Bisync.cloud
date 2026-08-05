namespace Bisync.Api.Models;

/// <summary>
/// Developer console account — separate from customer AppUsers / Access Control.
/// Managed by the permanent root (dra@cubevalue.com).
/// </summary>
public class DevTeamUser
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    /// <summary>Management | Hunter | Farmer | Accounts</summary>
    public string TeamType { get; set; } = "Management";
    /// <summary>JSON: { "tabs": ["overview", "sales-module", ...] }</summary>
    public string AccessJson { get; set; } = """{"tabs":["overview"]}""";
    public string PasswordHash { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    /// <summary>
    /// When true, the member must change away from the default team password after first login.
    /// </summary>
    public bool MustChangePassword { get; set; }
    /// <summary>Permanent root account; cannot be deleted or deactivated.</summary>
    public bool IsRoot { get; set; }
    public string? GoogleSubject { get; set; }
    public string? InviteToken { get; set; }
    public DateTime? InviteTokenExpiresAt { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedByEmail { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }

    public bool HasPassword => !string.IsNullOrWhiteSpace(PasswordHash);
    public bool InvitePending => !string.IsNullOrWhiteSpace(InviteToken);
}
