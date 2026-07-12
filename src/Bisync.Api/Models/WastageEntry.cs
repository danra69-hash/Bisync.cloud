namespace Bisync.Api.Models;

/// <summary>
/// Manual or POS (void/refund) wastage record. Component depletion is written to InventoryMovements
/// with ReferenceType = "wastage" and ReferenceId = this Id.
/// </summary>
public class WastageEntry
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>manual | pos</summary>
    public string Source { get; set; } = "manual";
    /// <summary>component | product | sub-product</summary>
    public string ItemType { get; set; } = "component";
    public string ItemKey { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Uom { get; set; } = string.Empty;
    public DateOnly WastedDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    /// <summary>POS check / ticket number when Source = pos.</summary>
    public string PosCheckNo { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
