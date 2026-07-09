namespace Bisync.Api.Models;

public class VendorProduct
{
    public string ExternalId { get; set; } = string.Empty;
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string Specification { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public decimal DeliveryPrice { get; set; }
    public string DeliveryJson { get; set; } = "{}";
    public string ProductPolicyTag { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public string PrivateLocationIdsJson { get; set; } = "[]";
    public bool Active { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
}
