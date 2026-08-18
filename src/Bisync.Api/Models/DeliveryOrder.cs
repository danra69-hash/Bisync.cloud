namespace Bisync.Api.Models;

/// <summary>
/// Price-less Delivery Order issued from B2B Holdout (OnOrderQty).
/// Confirm receipt moves Holdout → sold on the product stock card with this DO number.
/// </summary>
public class DeliveryOrder
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string DoNumber { get; set; } = string.Empty;
    public string IssueDate { get; set; } = string.Empty;
    public int SalesOrderId { get; set; }
    public B2bSalesOrder? SalesOrder { get; set; }
    public int? SourcePurchaseOrderId { get; set; }
    /// <summary>draft | issued | received | cancelled</summary>
    public string Status { get; set; } = "issued";
    public string ReceivedDate { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<DeliveryOrderLine> Lines { get; set; } = [];
}

public class DeliveryOrderLine
{
    public int Id { get; set; }
    public int DeliveryOrderId { get; set; }
    public DeliveryOrder? DeliveryOrder { get; set; }
    public int? SalesOrderLineId { get; set; }
    public int ProductId { get; set; }
    public int? ProductAliasId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string LocationExternalId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Uom { get; set; } = string.Empty;
}
