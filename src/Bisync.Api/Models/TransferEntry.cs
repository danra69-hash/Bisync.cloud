namespace Bisync.Api.Models;

/// <summary>
/// Inter-location stock transfer. Component moves use InventoryMovements
/// (transfer_out / transfer_in). Product/sub-product moves use ProductProductionLogs
/// and ProductB2bLocationStocks.
/// </summary>
public class TransferEntry
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string FromLocationExternalId { get; set; } = string.Empty;
    public string ToLocationExternalId { get; set; } = string.Empty;
    /// <summary>component | product | sub-product</summary>
    public string ItemType { get; set; } = "component";
    public string ItemKey { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Uom { get; set; } = string.Empty;
    public DateOnly TransferDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
