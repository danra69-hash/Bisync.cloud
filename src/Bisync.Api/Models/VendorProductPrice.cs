namespace Bisync.Api.Models;

public class VendorProductPrice
{
    public string ExternalId { get; set; } = string.Empty;
    public decimal DeliveryPrice { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int? LastPurchaseOrderId { get; set; }
}
