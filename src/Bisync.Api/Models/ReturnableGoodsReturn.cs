namespace Bisync.Api.Models;

/// <summary>
/// Credit for returned returnable containers / deposits.
/// Incoming deposits are tracked on PurchaseOrderItems with IsReturnableDeposit = true.
/// </summary>
public class ReturnableGoodsReturn
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string ReturnableItemName { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Amount { get; set; }
    public DateOnly ReturnDate { get; set; }
    public string CreditNoteNumber { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
