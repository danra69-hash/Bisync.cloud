namespace Bisync.Api.Models;

public class SampleRequest
{
    public int Id { get; set; }
    public string RequestNumber { get; set; } = string.Empty;
    /// <summary>sample-request-flavours | sample-request</summary>
    public string TemplateType { get; set; } = "sample-request-flavours";
    public int CompanyId { get; set; }
    public DateOnly DateRequested { get; set; }
    public int? ContactEmployeeId { get; set; }
    public string ContactPersonName { get; set; } = string.Empty;
    public string CompanyRequested { get; set; } = string.Empty;
    public string CustomerExternalId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorAddress { get; set; } = string.Empty;
    public string VendorContactPerson { get; set; } = string.Empty;
    public string VendorContactMobile { get; set; } = string.Empty;
    public string VendorContactEmail { get; set; } = string.Empty;
    public string IngredientComponentId { get; set; } = string.Empty;
    /// <summary>halal | muslim-friendly | non-halal</summary>
    public string ProductPolicyTag { get; set; } = string.Empty;
    public DateTime? VendorAcceptedAt { get; set; }
    public string VendorAcceptedBy { get; set; } = string.Empty;
    public bool IsNewCustomer { get; set; }
    public string ProjectScope { get; set; } = "new"; // new | ongoing
    public string RequestType { get; set; } = "new_submission"; // new_submission | repeat | modification
    public string ModificationDetails { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string DeliveryUnit { get; set; } = string.Empty;
    public decimal ExpectedQtyPerYear { get; set; }
    public decimal ExpectedPrice { get; set; }
    public decimal ExpectedSalesAmountPerYear { get; set; }
    public string ProductCategory { get; set; } = string.Empty;
    public string ProductGroup { get; set; } = string.Empty;
    public string ProductSamplesJson { get; set; } = "[]";
    public bool WaterSoluble { get; set; }
    public bool OilSoluble { get; set; }
    public bool FlavourNatural { get; set; }
    public bool FlavourNaturalIdentical { get; set; }
    public bool FlavourArtificial { get; set; }
    public decimal QuantityRequested { get; set; }
    public string QuantityUom { get; set; } = string.Empty;
    public string TargetProducts { get; set; } = string.Empty;
    public string GmoStatus { get; set; } = "na"; // na | required | not_required
    public string AllergenStatus { get; set; } = "na"; // na | not_concerned | free_from
    public string AllergenFreeFromDetail { get; set; } = string.Empty;
    public string McpdHvpFreeDetail { get; set; } = string.Empty;
    public bool HalalCertified { get; set; }
    public bool HalalCompliantAccepted { get; set; }
    public string CountryRdSite { get; set; } = string.Empty;
    public string CountryManufacturing { get; set; } = string.Empty;
    public string CountryInUse { get; set; } = string.Empty;
    public string RegulatoryRequirement { get; set; } = "na"; // na | yes
    public string RegulatoryRequirementDetail { get; set; } = string.Empty;
    public DateOnly? CustomerDeadline { get; set; }
    public string ShareToken { get; set; } = string.Empty;
    public string Status { get; set; } = "submitted";
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
