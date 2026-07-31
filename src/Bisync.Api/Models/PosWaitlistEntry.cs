namespace Bisync.Api.Models;

/// <summary>Customer waitlist party joined via public QR form.</summary>
public class PosWaitlistEntry
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public int Pax { get; set; } = 1;
    public string Status { get; set; } = "waiting"; // waiting | seated | cancelled
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
