namespace Bisync.Api.Models;

public class QuoteRequest
{
    public int Id { get; set; }
    public string RfqNumber { get; set; } = string.Empty;
    public int CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public string Status { get; set; } = "open";
    public string Notes { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<QuoteRequestVendor> Vendors { get; set; } = [];
    public List<QuoteRequestLine> Lines { get; set; } = [];
}

public class QuoteRequestVendor
{
    public int Id { get; set; }
    public int QuoteRequestId { get; set; }
    public QuoteRequest? QuoteRequest { get; set; }

    public int? VendorId { get; set; }
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public bool IsNewVendor { get; set; }

    public string ShareToken { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public DateTime? SubmittedAt { get; set; }
    public string SubmittedBy { get; set; } = string.Empty;
}

public class QuoteRequestLine
{
    public int Id { get; set; }
    public int QuoteRequestId { get; set; }
    public QuoteRequest? QuoteRequest { get; set; }

    public string Kind { get; set; } = "principal"; // principal | other
    public int SortOrder { get; set; }

    public int? ComponentId { get; set; }
    public string ComponentExternalId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string Specification { get; set; } = string.Empty;
    public string PrincipalUom { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }

    /// <summary>JSON map of vendorExternalId → { deliveryUnitText, rrp, notes }.</summary>
    public string VendorResponsesJson { get; set; } = "{}";
}
