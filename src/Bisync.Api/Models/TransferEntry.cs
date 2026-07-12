namespace Bisync.Api.Models;

/// <summary>
/// Inter-location stock transfer.
/// Initiate creates a pending transfer and alerts the receiving location.
/// Confirm-receive depletes source inventory and posts inbound at destination.
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
    /// <summary>pending | received | cancelled</summary>
    public string Status { get; set; } = StatusPending;
    public string InitiatedBy { get; set; } = string.Empty;
    public string ReceivedBy { get; set; } = string.Empty;
    public DateTime? ReceivedAt { get; set; }
    public decimal? ReceivedQuantity { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public const string StatusPending = "pending";
    public const string StatusReceived = "received";
    public const string StatusCancelled = "cancelled";
}
