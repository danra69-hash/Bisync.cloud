namespace Bisync.Api.Models;

public class CashPurchase
{
    public int Id { get; set; }
    public DateOnly DatePurchased { get; set; }
    public string StoreName { get; set; } = string.Empty;
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string StoreProductName { get; set; } = string.Empty;
    public string DeliveryUnit { get; set; } = string.Empty;
    public decimal DeliveryPrice { get; set; }
    public decimal Quantity { get; set; }
    public string ComponentUom { get; set; } = string.Empty;
    public string ReceiptNumber { get; set; } = string.Empty;
    public string ReceiptFileName { get; set; } = string.Empty;
    public string ReceiptFileBase64 { get; set; } = string.Empty;
    public int InventoryPurchaseId { get; set; }
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
