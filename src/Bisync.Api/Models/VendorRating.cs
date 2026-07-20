namespace Bisync.Api.Models;

/// <summary>
/// Operator-entered (Offline/Virtual) supplier rating measures for a vendor.
/// Online/Cloud vendor measures are system-generated from PO acceptance behaviour.
/// </summary>
public class VendorRating
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string VendorExternalId { get; set; } = string.Empty;

    /// <summary>satisfied | acceptable | unsatisfied — Delivery vs within-2-days target.</summary>
    public string Delivery { get; set; } = string.Empty;
    /// <summary>satisfied | acceptable | unsatisfied — Product accuracy (PO → DO → Invoice).</summary>
    public string ProductAccuracy { get; set; } = string.Empty;
    /// <summary>satisfied | acceptable | unsatisfied.</summary>
    public string ProductQuality { get; set; } = string.Empty;
    /// <summary>satisfied | acceptable | unsatisfied.</summary>
    public string HygieneCleanliness { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;
    public string UpdatedBy { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
