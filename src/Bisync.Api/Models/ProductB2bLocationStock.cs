namespace Bisync.Api.Models;

public class ProductB2bLocationStock
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public decimal InStock { get; set; }
    /// <summary>Holdout bucket (reserved, not yet sold). API may expose as holdoutQty.</summary>
    public decimal OnOrderQty { get; set; }
    public decimal SalesPerDay { get; set; }
    public decimal ToProduceQty { get; set; }
    public decimal ProducedQty { get; set; }
    public string ExpiryDate { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
