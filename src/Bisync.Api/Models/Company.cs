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
    /// <summary>
    /// Immutable operating timezone for this company (IANA/Windows id), assigned at company creation
    /// from country + state/province. All posted dates/times for the company use this clock.
    /// </summary>
    public string TimeZoneId { get; set; } = string.Empty;
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

    /// <summary>Original filename for the company logo (optional).</summary>
    public string LogoFileName { get; set; } = string.Empty;
    /// <summary>MIME type of the company logo, e.g. image/png.</summary>
    public string LogoContentType { get; set; } = string.Empty;
    /// <summary>Raw base64 company logo bytes (no data-URL prefix).</summary>
    public string LogoBase64 { get; set; } = string.Empty;

    // --- Outbound email (SMTP / Microsoft Graph) for Purchase Order / vendor mail ---
    /// <summary>auto | microsoft | microsoft-graph | google | custom</summary>
    public string SmtpProviderMode { get; set; } = "auto";
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool SmtpUseSsl { get; set; } = true;
    public string SmtpUsername { get; set; } = string.Empty;
    /// <summary>SMTP auth password. Never return plaintext on GET; only update when a new value is posted.</summary>
    public string SmtpPassword { get; set; } = string.Empty;
    public string SmtpFromEmail { get; set; } = string.Empty;
    public string SmtpFromName { get; set; } = string.Empty;

    /// <summary>Azure AD directory (tenant) ID for Microsoft Graph send.</summary>
    public string GraphTenantId { get; set; } = string.Empty;
    /// <summary>Azure AD application (client) ID for Microsoft Graph send.</summary>
    public string GraphClientId { get; set; } = string.Empty;
    /// <summary>Azure AD client secret. Never return plaintext on GET; only update when a new value is posted.</summary>
    public string GraphClientSecret { get; set; } = string.Empty;

    /// <summary>JSON array of business type labels.</summary>
    public string BusinessTypesJson { get; set; } = "[]";
    /// <summary>JSON array of vendor policy tag ids: halal, muslim-friendly, non-halal.</summary>
    public string VendorPolicyTagsJson { get; set; } = "[]";
    /// <summary>JSON array of enabled platform modules: RMS, POS, HRM, Accounting.</summary>
    public string ModulesJson { get; set; } = "[]";
    public ICollection<Location> Locations { get; set; } = new List<Location>();
}
