namespace Bisync.Api.Models;

/// <summary>
/// Maps a Bisync catalog product to an external POS PLU / POS product number
/// for Sales → Promotion Scheduler → POS Mapping.
/// </summary>
public class PosProductMapping
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>Internal Products.Id.</summary>
    public int ProductId { get; set; }
    /// <summary>Snapshot of Products.ProductId (e.g. PRD-xxxx).</summary>
    public string ProductCode { get; set; } = string.Empty;
    /// <summary>Snapshot of product name at save time.</summary>
    public string ProductName { get; set; } = string.Empty;
    /// <summary>PLU / POS product number from the external POS.</summary>
    public string PluNumber { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
