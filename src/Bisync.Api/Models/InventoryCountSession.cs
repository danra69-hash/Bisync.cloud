namespace Bisync.Api.Models;

public class InventoryCountSession
{
    public int Id { get; set; }
    public string SessionType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public string PeriodMonth { get; set; } = string.Empty;
    public string UomMode { get; set; } = "inventory";
    public string ItemTypeFilter { get; set; } = "all";
    public string GroupFilter { get; set; } = "All";
    public string CountDate { get; set; } = string.Empty;
    public string EffectiveDate { get; set; } = string.Empty;
    public DateTime? AdjustmentsAppliedAt { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    public string SavedBy { get; set; } = string.Empty;
    public DateTime? ConfirmDeadlineAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public string ConfirmedBy { get; set; } = string.Empty;
    public bool IsAutoConfirmed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<InventoryCountSessionLine> Lines { get; set; } = [];
}
