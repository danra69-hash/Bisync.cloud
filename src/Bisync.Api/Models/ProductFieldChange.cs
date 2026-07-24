namespace Bisync.Api.Models;

/// <summary>
/// Durable history of product header / metadata field changes.
/// </summary>
public class ProductFieldChange
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    /// <summary>Stable field key, e.g. Name, Rrp, Active.</summary>
    public string FieldName { get; set; } = string.Empty;
    /// <summary>Human-readable field label for audit UI.</summary>
    public string FieldLabel { get; set; } = string.Empty;
    public string OldValue { get; set; } = string.Empty;
    public string NewValue { get; set; } = string.Empty;
    public int? ChangedByUserId { get; set; }
    public string ChangedByEmail { get; set; } = string.Empty;
    public string ChangedByName { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public string Note { get; set; } = string.Empty;
}
