namespace Bisync.Api.Models;

/// <summary>
/// Control-plane subscription activation for a company location (Dev Console billing).
/// Populated by Manual Subscription Activation (and future payment webhooks).
/// </summary>
public class LocationSubscription
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public DateTime? SubscribedSince { get; set; }
    public DateTime? LastPaymentDate { get; set; }
    public decimal? Amount { get; set; }
    public string Currency { get; set; } = "MYR";
    public DateTime? RenewalDate { get; set; }
    public bool Active { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
