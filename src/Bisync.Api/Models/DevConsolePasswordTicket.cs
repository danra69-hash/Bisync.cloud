namespace Bisync.Api.Models;

/// <summary>Short-lived ticket after password check, before Google verification completes login.</summary>
public class DevConsolePasswordTicket
{
    public int Id { get; set; }
    public string Ticket { get; set; } = string.Empty;
    public int DevTeamUserId { get; set; }
    public DevTeamUser? DevTeamUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public bool Consumed { get; set; }
}
