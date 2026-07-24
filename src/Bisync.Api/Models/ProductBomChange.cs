namespace Bisync.Api.Models;

/// <summary>
/// Durable history of product recipe (BOM) membership and quantity/UOM changes.
/// ChangeType: component_in | component_out | quantity_adjustment
/// </summary>
public class ProductBomChange
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    /// <summary>recipe | packaging</summary>
    public string LineKind { get; set; } = "recipe";
    /// <summary>component_in | component_out | quantity_adjustment</summary>
    public string ChangeType { get; set; } = string.Empty;
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string? OldComponentId { get; set; }
    public string? OldComponentName { get; set; }
    public string? OldComponentUom { get; set; }
    public decimal? OldQuantity { get; set; }
    public decimal? OldUnitPrice { get; set; }
    public string? NewComponentId { get; set; }
    public string? NewComponentName { get; set; }
    public string? NewComponentUom { get; set; }
    public decimal? NewQuantity { get; set; }
    public decimal? NewUnitPrice { get; set; }
    public int? ChangedByUserId { get; set; }
    public string ChangedByEmail { get; set; } = string.Empty;
    public string ChangedByName { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string Note { get; set; } = string.Empty;
}
