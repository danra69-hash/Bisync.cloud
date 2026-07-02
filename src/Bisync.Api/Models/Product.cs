namespace Bisync.Api.Models;

public class Product
{
    public int Id { get; set; }
    public string ProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public bool IsSubProduct { get; set; }
    public bool B2cEnabled { get; set; }
    public bool B2bEnabled { get; set; }
    public decimal TotalCost { get; set; }
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<ProductComponentItem> Items { get; set; } = [];
}

public class ProductComponentItem
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string ComponentUom { get; set; } = string.Empty;
    public decimal ComponentUomPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Subtotal { get; set; }
    public int SortOrder { get; set; }
}
