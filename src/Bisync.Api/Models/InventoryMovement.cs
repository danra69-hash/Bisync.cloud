namespace Bisync.Api.Models;

public class InventoryMovement
{
    public int Id { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string LocationExternalId { get; set; } = string.Empty;
    public decimal QtyDelta { get; set; }
    public string Uom { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string ReferenceType { get; set; } = string.Empty;
    public int ReferenceId { get; set; }
    public int? CompanyId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
