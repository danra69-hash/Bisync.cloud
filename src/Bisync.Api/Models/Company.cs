namespace Bisync.Api.Models;

public class Company
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Immutable 4-letter company code used as the component ID prefix.</summary>
    public string Code { get; set; } = string.Empty;
    public string Brn { get; set; } = string.Empty;
    public string GstTin { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "MY";
    public string AddressLine1 { get; set; } = string.Empty;
    public string AddressLine2 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string StateProvince { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Fax { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    /// <summary>UTC timestamp when the company tenant was first registered.</summary>
    public DateTime? RegisteredAt { get; set; }

    // --- Outbound email (SMTP) for Purchase Order / vendor mail ---
    /// <summary>auto | microsoft | google | custom</summary>
    public string SmtpProviderMode { get; set; } = "auto";
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool SmtpUseSsl { get; set; } = true;
    public string SmtpUsername { get; set; } = string.Empty;
    /// <summary>SMTP auth password. Never return plaintext on GET; only update when a new value is posted.</summary>
    public string SmtpPassword { get; set; } = string.Empty;
    public string SmtpFromEmail { get; set; } = string.Empty;
    public string SmtpFromName { get; set; } = string.Empty;

    /// <summary>JSON array of business type labels.</summary>
    public string BusinessTypesJson { get; set; } = "[]";
    /// <summary>JSON array of vendor policy tag ids: halal, muslim-friendly, non-halal.</summary>
    public string VendorPolicyTagsJson { get; set; } = "[]";
    /// <summary>JSON array of enabled platform modules: RMS, POS, HRM, Accounting.</summary>
    public string ModulesJson { get; set; } = "[]";
    public ICollection<Location> Locations { get; set; } = new List<Location>();
}
