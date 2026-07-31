namespace Bisync.Api.Models;

/// <summary>Guest e-menu order placed via public /QR link.</summary>
public class PosQrOrder
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string TableLabel { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    /// <summary>open | sent | cancelled</summary>
    public string Status { get; set; } = "open";
    /// <summary>JSON array of { productId, name, quantity, detail? }.</summary>
    public string ItemsJson { get; set; } = "[]";
    public decimal TotalValue { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
