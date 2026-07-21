namespace Bisync.Api.Models;

public class Vendor
{
    public int Id { get; set; }
    /// <summary>Owning company. Required after Phase 0 tenancy hardening.</summary>
    public int? CompanyId { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "offline";
    public string Brn { get; set; } = string.Empty;
    public string Products { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPosition { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string ContactsJson { get; set; } = "[]";
    public bool Engaged { get; set; }
    /// <summary>none | pending | approved | rejected — online vendors require mutual engage approval.</summary>
    public string EngagementStatus { get; set; } = "none";
    /// <summary>Vendor's selling company in Bisync when Type=online (matched by BRN when omitted).</summary>
    public int? LinkedCompanyId { get; set; }
    public decimal? MinOrderAmount { get; set; }
    public decimal? DeliveryChargeBelowMin { get; set; }
    /// <summary>cod | prepaid | postpaid</summary>
    public string PaymentTerms { get; set; } = string.Empty;
    public DateTime? EngageRequestedAt { get; set; }
    public string EngageRequestedBy { get; set; } = string.Empty;
    public DateTime? EngageApprovedAt { get; set; }
    public string EngageApprovedBy { get; set; } = string.Empty;
    /// <summary>halal | muslim-friendly | non-halal — classifies products supplied by this vendor.</summary>
    public string ProductPolicyTag { get; set; } = "non-halal";
    /// <summary>Inactive vendors are hidden from new engage/order flows.</summary>
    public bool Active { get; set; } = true;
}
