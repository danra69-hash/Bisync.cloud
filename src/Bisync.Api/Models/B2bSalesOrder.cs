namespace Bisync.Api.Models;

public class B2bSalesOrder
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerExternalId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    /// <summary>sales_order | online_order (future)</summary>
    public string Source { get; set; } = "sales_order";
    /// <summary>draft | issued | fulfilled | expired | cancelled</summary>
    public string Status { get; set; } = "draft";
    public int LockPeriodDays { get; set; }
    public string IssuedDate { get; set; } = string.Empty;
    public string LockExpiryDate { get; set; } = string.Empty;
    public bool DeliveryOrderIssued { get; set; }
    public bool InvoiceIssued { get; set; }
    public string FulfilledDate { get; set; } = string.Empty;
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
    public string ProductName { get; set; } = string.Empty;
    public string LocationExternalId { get; set; } = string.Empty;
    public decimal QuantityOrdered { get; set; }
    public decimal QuantityLocked { get; set; }
    public string Uom { get; set; } = string.Empty;
    public decimal Rrp { get; set; }
    /// <summary>open | locked | fulfilled | released</summary>
    public string Status { get; set; } = "open";
}
