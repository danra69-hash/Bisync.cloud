namespace Bisync.Api.Models;

public class InventoryPurchase
{
    public int Id { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Uom { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public DateOnly DateOrdered { get; set; }
    public DateTime DateCreatedInStock { get; set; }
    public int PurchaseOrderId { get; set; }
    public int PurchaseOrderItemId { get; set; }
    /// <summary>
    /// Product expiry date (yyyy-MM-dd) copied from the PO line at receive when provided.
    /// Empty when the receipt was posted without an expiry date.
    /// </summary>
    public string ProductExpiryDate { get; set; } = string.Empty;
    /// <summary>
    /// Ops receive remark shown on the stock card until accounting consolidates (then cleared).
    /// </summary>
    public string Remarks { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    /// <summary>Partition key (first LocationIdsJson element, or empty).</summary>
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>purchase-order | cash-purchase when this row was produced by Split Use.</summary>
    public string SplitSourceType { get; set; } = string.Empty;
    public int SplitSourceId { get; set; }
    /// <summary>Stable output line key, or __nett__ for the retained parent.</summary>
    public string SplitLineKey { get; set; } = string.Empty;
    public string SplitParentComponentId { get; set; } = string.Empty;
}
