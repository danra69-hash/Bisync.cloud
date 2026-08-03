namespace Bisync.Api.Models;

/// <summary>
/// Company-scoped POS lookup: payment, entertainment, or discount type.
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
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
