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
    public string PasswordHash { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    /// <summary>Permanent root account; cannot be deleted or deactivated.</summary>
    public bool IsRoot { get; set; }
    public string? GoogleSubject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedByEmail { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
}
