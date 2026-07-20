namespace Bisync.Api.Models;

/// <summary>
/// Control-plane subscription / trial state for a company location (Dev Console billing).
/// </summary>
public class LocationSubscription
{
    public const string StatusFreeTrial = "free-trial";
    public const string StatusSubscribed = "subscribed";
    public const string StatusRenewed = "renewed";
    public const string StatusLocked = "locked";

    public const string PaymentCheck = "check";
    public const string PaymentBankTransfer = "bank-transfer";

    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;

    /// <summary>free-trial | subscribed | renewed | locked</summary>
    public string Status { get; set; } = StatusFreeTrial;

    /// <summary>When the current status was last set.</summary>
    public DateTime? StatusDate { get; set; }

    /// <summary>Trial or paid period end (UTC date semantics).</summary>
    public DateTime? ExpiryDate { get; set; }

    /// <summary>UTC date when the location subscription was first activated (paid).</summary>
    public DateTime? SubscribedSince { get; set; }

    public DateTime? LastPaymentDate { get; set; }
    public decimal? Amount { get; set; }
    public string Currency { get; set; } = "MYR";

    /// <summary>Legacy alias used by older rollups; kept in sync with ExpiryDate for paid plans.</summary>
    public DateTime? RenewalDate { get; set; }

    /// <summary>Number of completed annual renewals after the first subscribe year.</summary>
    public int YearsRenewed { get; set; }

    /// <summary>check | bank-transfer</summary>
    public string? PaymentMethod { get; set; }

    /// <summary>Check number or bank transaction / reference number.</summary>
    public string? PaymentReference { get; set; }

    public string? BankName { get; set; }

    public bool Active { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
