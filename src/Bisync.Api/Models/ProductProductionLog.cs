namespace Bisync.Api.Models;

public class ProductProductionLog
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string EntryType { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string ProductionDate { get; set; } = string.Empty;
    public string ExpiryDate { get; set; } = string.Empty;
    public string BatchNumber { get; set; } = string.Empty;
    public string LocationIdsJson { get; set; } = "[]";
    public int? CompanyId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
