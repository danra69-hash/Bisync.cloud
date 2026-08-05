namespace Bisync.Api.Models;

public class Location
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;

    public int? CompanyId { get; set; }
    public Company? Company { get; set; }
    /// <summary>Inactive locations stay in Platform Config but are hidden from day-to-day selection.</summary>
    public bool Active { get; set; } = true;
    public string AddressLine1 { get; set; } = string.Empty;
    public string AddressLine2 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string StateProvince { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public int? PrincipalContactUserId { get; set; }
    public AppUser? PrincipalContact { get; set; }
    public int? SecondaryContactUserId { get; set; }
    public AppUser? SecondaryContact { get; set; }

    public decimal SalesToday { get; set; }
    public decimal SalesWtd { get; set; }
    public decimal SalesMtd { get; set; }
    public decimal SalesYtd { get; set; }
    public decimal SalesPrevToday { get; set; }
    public decimal SalesPrevWtd { get; set; }
    public decimal SalesPrevMtd { get; set; }
    public decimal SalesPrevYtd { get; set; }
    public int CoversToday { get; set; }
    public int CoversWtd { get; set; }
    public int CoversMtd { get; set; }
    public int CoversYtd { get; set; }
    public int CoversPrevToday { get; set; }
    public int CoversPrevWtd { get; set; }
    public int CoversPrevMtd { get; set; }
    public int CoversPrevYtd { get; set; }
    public int ChecksToday { get; set; }
    public int ChecksWtd { get; set; }
    public int ChecksMtd { get; set; }
    public int ChecksYtd { get; set; }
    public int ChecksPrevToday { get; set; }
    public int ChecksPrevWtd { get; set; }
    public int ChecksPrevMtd { get; set; }
    public int ChecksPrevYtd { get; set; }
    /// <summary>JSON array of business type labels (inherits from company on create; overridable per location).</summary>
    public string BusinessTypesJson { get; set; } = "[]";
    /// <summary>JSON array of vendor policy tag ids (inherits from company on create; overridable per location).</summary>
    public string VendorPolicyTagsJson { get; set; } = "[]";
    /// <summary>JSON array of enabled modules (inherits from company when empty; Accounting not allowed).</summary>
    public string ModulesJson { get; set; } = "[]";
    /// <summary>
    /// Weekly opening hours + last-order times (JSON).
    /// Shape: { monday: { openFrom, openTo, lastOrder, closed }, … sunday }.
    /// Times are HH:mm (24h).
    /// </summary>
    public string OpeningHoursJson { get; set; } = "{}";
    /// <summary>When true, deliveries are only accepted during DeliveryAllowPeriodsJson windows.</summary>
    public bool DeliveryAllowTimeEnabled { get; set; }
    /// <summary>
    /// JSON array of allowed delivery periods: [{ "from": "09:00", "to": "12:00" }, …].
    /// Used when DeliveryAllowTimeEnabled is true.
    /// </summary>
    public string DeliveryAllowPeriodsJson { get; set; } = "[]";
    /// <summary>
    /// IANA/Windows timezone for this location (from company country + state/province).
    /// Business calendar dates follow this zone; instant timestamps stay UTC.
    /// </summary>
    public string TimeZoneId { get; set; } = string.Empty;

    /// <summary>
    /// Shared key for concept-locations that operate in one physical site
    /// (e.g. two brands under one company at the same mall address). Empty = standalone.
    /// </summary>
    public string PhysicalSiteKey { get; set; } = string.Empty;

    /// <summary>Brand / concept label shown on POS menu (falls back to Name when empty).</summary>
    public string ConceptLabel { get; set; } = string.Empty;

    /// <summary>Sort order among sibling concepts on the same physical site.</summary>
    public int ConceptSortOrder { get; set; }
}
