namespace Bisync.Api.Models;

public class DevQaRun
{
    public int Id { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string Status { get; set; } = "running"; // running | passed | failed | warning
    public string TriggeredBy { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string ResultsJson { get; set; } = "[]";
}
