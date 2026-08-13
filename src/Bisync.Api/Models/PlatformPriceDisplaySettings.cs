namespace Bisync.Api.Models;

/// <summary>
/// Control-plane defaults for how money is shown in the RMS catalog UI.
/// Single-row table (Id = 1). Editable only by the platform owner (dra@cubevalue.com).
/// </summary>
public class PlatformPriceDisplaySettings
{
    public int Id { get; set; } = 1;

    /// <summary>Principal / recipe Component UOM unit price decimals (default 4).</summary>
    public int PrincipalUomPriceDecimals { get; set; } = 4;

    /// <summary>Alternate Component UOM unit price decimals (default 2).</summary>
    public int AlternateUomPriceDecimals { get; set; } = 2;

    /// <summary>Vendor delivery unit price decimals (default 2).</summary>
    public int VendorDeliveryPriceDecimals { get; set; } = 2;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedByEmail { get; set; } = string.Empty;
}
