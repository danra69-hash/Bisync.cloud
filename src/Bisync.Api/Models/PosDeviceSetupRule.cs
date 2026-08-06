namespace Bisync.Api.Models;

/// <summary>
/// POS Config — Device Set up: routes product (or category/group) orders to primary / secondary / concurrent devices.
/// Empty category/group and null ProductId mean “All” for that scope.
/// </summary>
public class PosDeviceSetupRule
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>Optional location scope; empty = all locations for the company.</summary>
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>Product category filter; empty = All.</summary>
    public string ProductCategory { get; set; } = string.Empty;
    /// <summary>Product group filter; empty = All.</summary>
    public string ProductGroup { get; set; } = string.Empty;
    /// <summary>Specific product; null = All products matching category/group.</summary>
    public int? ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    /// <summary>Primary destination (kitchen printer, KDS, bar printer, etc.).</summary>
    public int? PrimaryDeviceId { get; set; }
    /// <summary>Fallback when primary is unavailable.</summary>
    public int? SecondaryDeviceId { get; set; }
    /// <summary>Also receives the order at the same time as primary.</summary>
    public int? ConcurrentDeviceId { get; set; }
    public int Sequence { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
