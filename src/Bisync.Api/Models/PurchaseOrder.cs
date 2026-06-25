namespace Bisync.Api.Models;

using System.Text.Json.Serialization;

public class PurchaseOrder
{
    public int Id { get; set; }
    public string PoNumber { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public DateOnly OrderDate { get; set; }
    public DateOnly DeliveryDate { get; set; }
    public string Status { get; set; } = "Pending";
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
}

public class PurchaseOrderItem
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    [JsonIgnore]
    public PurchaseOrder? PurchaseOrder { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string DeliveryPackage { get; set; } = string.Empty;
}
