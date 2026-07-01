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
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
}
