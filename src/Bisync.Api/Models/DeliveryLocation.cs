namespace Bisync.Api.Models;

/// <summary>
/// Alternate ship-to address under an outlet <see cref="Location"/>.
/// Operational stock still posts against the parent outlet; POs may point here for delivery.
/// </summary>
public class DeliveryLocation
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    /// <summary>Parent outlet <see cref="Location.ExternalId"/>.</summary>
    public string LocationExternalId { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string AddressLine1 { get; set; } = string.Empty;
    public string AddressLine2 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string StateProvince { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
