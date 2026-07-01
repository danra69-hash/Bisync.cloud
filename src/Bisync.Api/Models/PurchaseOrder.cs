namespace Bisync.Api.Models;

using System.Text.Json.Serialization;

public class PurchaseOrder
{
    public int Id { get; set; }
    public string PoNumber { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public DateOnly OrderDate { get; set; }
    public DateOnly DeliveryDate { get; set; }
    public string DocumentType { get; set; } = "PO";
    public string Status { get; set; } = "Open";
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public string InitiatedBy { get; set; } = string.Empty;
    public string ApprovedBy { get; set; } = string.Empty;
    public DateTime? ApprovedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime? ReconciledAt { get; set; }
    public string VendorShareToken { get; set; } = string.Empty;
    public DateTime? VendorAcceptedAt { get; set; }
    public string VendorAcceptedBy { get; set; } = string.Empty;
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
}

public class PurchaseOrderItem
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    [JsonIgnore]
    public PurchaseOrder? PurchaseOrder { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string VendorProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal IssuedUnitPrice { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string ComponentUom { get; set; } = string.Empty;
    public string DeliveryPackage { get; set; } = string.Empty;
    public decimal? ReceivedQuantity { get; set; }
    public decimal? ReceivedUnitPrice { get; set; }
    public decimal? ReconciledQuantity { get; set; }
    public decimal? ReconciledUnitPrice { get; set; }
}
