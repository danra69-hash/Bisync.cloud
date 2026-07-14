namespace Bisync.Api.Models;

public class DevConsoleSession
{
    public int Id { get; set; }
    public string Token { get; set; } = string.Empty;
    public int DevTeamUserId { get; set; }
    public DevTeamUser? DevTeamUser { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public string GoogleEmail { get; set; } = string.Empty;
}
