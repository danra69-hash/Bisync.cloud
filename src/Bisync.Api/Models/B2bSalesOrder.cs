namespace Bisync.Api.Models;

public class B2bSalesOrder
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerExternalId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    /// <summary>sales_order | online_order</summary>
    public string Source { get; set; } = "sales_order";
    /// <summary>When Source=online_order, the operator purchase order that produced this sales summary.</summary>
    public int? SourcePurchaseOrderId { get; set; }
    /// <summary>draft | issued | confirmed | fulfilled | expired | cancelled</summary>
    public string Status { get; set; } = "draft";
    public int LockPeriodDays { get; set; }
    public string IssuedDate { get; set; } = string.Empty;
    public string LockExpiryDate { get; set; } = string.Empty;
    public bool DeliveryOrderIssued { get; set; }
    public bool InvoiceIssued { get; set; }
    public string FulfilledDate { get; set; } = string.Empty;
    /// <summary>Public share token for customer link / WhatsApp.</summary>
    public string ShareToken { get; set; } = string.Empty;
    public DateTime? CustomerAcceptedAt { get; set; }
    public string CustomerAcceptedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<B2bSalesOrderLine> Lines { get; set; } = [];
}

public class B2bSalesOrderLine
{
    public int Id { get; set; }
    public int SalesOrderId { get; set; }
    public B2bSalesOrder? SalesOrder { get; set; }
    public int ProductId { get; set; }
    public int? ProductAliasId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string LocationExternalId { get; set; } = string.Empty;
    public decimal QuantityOrdered { get; set; }
    public decimal QuantityLocked { get; set; }
    public string Uom { get; set; } = string.Empty;
    public decimal Rrp { get; set; }
    /// <summary>When set with IsCombo, this line is a combo pack from the promotion.</summary>
    public int? PromotionId { get; set; }
    public bool IsCombo { get; set; }
    /// <summary>open | locked | ready_to_ship | fulfilled | released</summary>
    public string Status { get; set; } = "open";
}
