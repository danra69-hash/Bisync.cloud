namespace Bisync.Api.Models;

using System.Text.Json.Serialization;

public class PurchaseOrder
{
    public int Id { get; set; }
    public string PoNumber { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    /// <summary>Operator-side vendor catalog id when known (preferred over name matching).</summary>
    public string VendorExternalId { get; set; } = string.Empty;
    public DateOnly OrderDate { get; set; }
    public DateOnly DeliveryDate { get; set; }
    public string DocumentType { get; set; } = "PO";
    public string Status { get; set; } = "Open";
    public int? CompanyId { get; set; }
    /// <summary>
    /// For regular POs: delivery / receiving locations.
    /// For pre-committed masters: locations allowed to draw down from this company-level commitment.
    /// </summary>
    public string LocationIdsJson { get; set; } = "[]";
    /// <summary>
    /// Optional ship-to <see cref="DeliveryLocation.ExternalId"/>. When set, PO/PDF show this
    /// address instead of the outlet <see cref="Location"/> address. Stock still uses LocationIdsJson.
    /// </summary>
    public string DeliveryLocationExternalId { get; set; } = string.Empty;
    public string InitiatedBy { get; set; } = string.Empty;
    public string ApprovedBy { get; set; } = string.Empty;
    public DateTime? ApprovedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime? ReconciledAt { get; set; }
    public string VendorShareToken { get; set; } = string.Empty;
    public DateTime? VendorAcceptedAt { get; set; }
    public string VendorAcceptedBy { get; set; } = string.Empty;
    /// <summary>Vendor delivery order (DO) number captured at receive. Optional if invoice number is provided.</summary>
    public string VendorDoNumber { get; set; } = string.Empty;
    /// <summary>Vendor invoice number captured at receive. Optional if DO number is provided.</summary>
    public string VendorInvoiceNumber { get; set; } = string.Empty;
    /// <summary>Customer input at receive/consolidate: satisfied | acceptable | poor.</summary>
    public string ProductQualityRating { get; set; } = string.Empty;
    /// <summary>Optional comment for product quality rating.</summary>
    public string ProductQualityComment { get; set; } = string.Empty;
    /// <summary>Customer input at receive/consolidate: satisfied | acceptable | poor.</summary>
    public string HygieneRating { get; set; } = string.Empty;
    /// <summary>Optional comment for hygiene & cleanliness rating.</summary>
    public string HygieneComment { get; set; } = string.Empty;
    /// <summary>Set when Final delivery completed is clicked (partial-delivery vendors).</summary>
    public DateTime? FinalDeliveryCompletedAt { get; set; }
    /// <summary>True for blanket/pre-committed POs that hold committed qty at a special price.</summary>
    public bool IsPreCommitted { get; set; }
    /// <summary>Commitment window start (inclusive). Only for pre-committed POs.</summary>
    public DateOnly? CommitmentStartDate { get; set; }
    /// <summary>Commitment window end (inclusive). Only for pre-committed POs.</summary>
    public DateOnly? CommitmentEndDate { get; set; }
    /// <summary>When a release PO draws from a pre-committed master, links back to that master.</summary>
    public int? SourceCommittedPurchaseOrderId { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
}

public class PurchaseOrderItem
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    [JsonIgnore]
    public PurchaseOrder? PurchaseOrder { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string VendorProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal IssuedUnitPrice { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string ComponentUom { get; set; } = string.Empty;
    public string DeliveryPackage { get; set; } = string.Empty;
    public decimal? ReceivedQuantity { get; set; }
    public decimal? ReceivedUnitPrice { get; set; }
    public decimal? ReconciledQuantity { get; set; }
    public decimal? ReconciledUnitPrice { get; set; }
    /// <summary>Cumulative qty consolidated into inventory across partial shipments.</summary>
    public decimal DeliveredQuantity { get; set; }
    /// <summary>Qty already drawn from a pre-committed (blanket) line via release orders.</summary>
    public decimal DrawnQuantity { get; set; }
    public decimal TaxAmount { get; set; }
    public string HalalCertNo { get; set; } = string.Empty;
    /// <summary>Optional vendor product expiry date (yyyy-MM-dd) captured at receive.</summary>
    public string ProductExpiryDate { get; set; } = string.Empty;
    /// <summary>Optional temperature check (°C) captured at receive/consolidate.</summary>
    public decimal? ReceivedTemperature { get; set; }
    /// <summary>True when this line is a returnable container deposit (not inventory stock).</summary>
    public bool IsReturnableDeposit { get; set; }
    /// <summary>Canonical returnable item name for deposit ledger grouping.</summary>
    public string ReturnableItemName { get; set; } = string.Empty;
}
