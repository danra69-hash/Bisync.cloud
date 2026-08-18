namespace Bisync.Api.Models;

/// <summary>
/// Company-scoped POS lookup: payment, entertainment, or discount type.
/// Entertainment and discount rows may carry exception product groups/items and an Include-all override.
/// Discount rows also carry a user-defined percentage.
/// </summary>
public class PosConfigType
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>payment | entertainment | discount</summary>
    public string Kind { get; set; } = "payment";
    public string Name { get; set; } = string.Empty;
    /// <summary>Stable short code unique per company + kind (e.g. CASH, COMP).</summary>
    public string Code { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public bool Active { get; set; } = true;
    /// <summary>
    /// Entertainment / discount: when true, override exception groups/items so every product is allowed.
    /// </summary>
    public bool IncludeAll { get; set; }
    /// <summary>Entertainment / discount: JSON string[] of product group names that are not allowed.</summary>
    public string ExceptionGroupsJson { get; set; } = "[]";
    /// <summary>Entertainment / discount: JSON int[] of product ids that are not allowed.</summary>
    public string ExceptionProductIdsJson { get; set; } = "[]";
    /// <summary>Discount only: user-defined percentage (0–100).</summary>
    public decimal Percentage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
