namespace Bisync.Api.Models;

public class DevelopmentMilestone
{
    public int Id { get; set; }
    public string Phase { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public int ProgressPercent { get; set; }
    public string? Notes { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
