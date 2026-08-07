namespace Bisync.Api.Models;

/// <summary>
/// Platform-wide (cross-tenant) component → vendor-product tag suggestion catalog.
/// Stored in a dedicated database; rebuilt daily around 03:00 local time per country.
/// </summary>
public class TagSuggestionComponent
{
    public int Id { get; set; }
    /// <summary>ISO country code the rebuild was scoped to (e.g. MY).</summary>
    public string CountryCode { get; set; } = "MY";
    /// <summary>Normalized component name key (lower-case).</summary>
    public string ComponentNameKey { get; set; } = string.Empty;
    /// <summary>Display component name (normalized casing/spacing).</summary>
    public string ComponentName { get; set; } = string.Empty;
    /// <summary>How many tagged component observations contributed to this name.</summary>
    public int ObservationCount { get; set; }
    public DateTime BuiltAtUtc { get; set; } = DateTime.UtcNow;

    public List<TagSuggestionVendorProduct> VendorProducts { get; set; } = [];
}

public class TagSuggestionVendorProduct
{
    public int Id { get; set; }
    public int TagSuggestionComponentId { get; set; }
    public TagSuggestionComponent? Component { get; set; }
    public string VendorProductNameKey { get; set; } = string.Empty;
    public string VendorProductName { get; set; } = string.Empty;
    public string VendorNameKey { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    /// <summary>Observations that tagged this vendor product name under the component.</summary>
    public int TagCount { get; set; }
    /// <summary>0–100; only rows ≥ 50 are retained after rebuild.</summary>
    public decimal Probability { get; set; }
    public DateTime BuiltAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>Tracks the last successful daily rebuild per country (local calendar date).</summary>
public class TagSuggestionRebuildLog
{
    public int Id { get; set; }
    public string CountryCode { get; set; } = "MY";
    /// <summary>Local calendar date the rebuild was intended for (yyyy-MM-dd).</summary>
    public string LocalDate { get; set; } = string.Empty;
    public DateTime BuiltAtUtc { get; set; } = DateTime.UtcNow;
    public int ComponentCount { get; set; }
    public int ProductCount { get; set; }
    public int ObservationCount { get; set; }
    public string Status { get; set; } = "ok";
    public string Message { get; set; } = string.Empty;
}
