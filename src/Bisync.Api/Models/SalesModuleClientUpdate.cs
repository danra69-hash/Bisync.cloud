namespace Bisync.Api.Models;

/// <summary>Row from Instant Sales Update → Weekly Update sheet (Sales Module Client Update tab).</summary>
public class SalesModuleClientUpdate
{
    public int Id { get; set; }
    public DateTime? DateCreated { get; set; }
    public string Hunter { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public int? LocationCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? LastContactDate { get; set; }
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactType { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public DateTime? FollowUpReminder { get; set; }
    public string Appointment { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
}
