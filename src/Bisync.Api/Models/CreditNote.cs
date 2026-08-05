namespace Bisync.Api.Models;

/// <summary>
/// Vendor credit note for short / missing PO deliveries.
/// Confirm posts stock outbound (ReferenceType = credit_note). Cancel revalues
/// zero-cost replacement receipts — it does not reverse the outbound quantity.
/// </summary>
public class CreditNote
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;

    /// <summary>Vendor credit note document # — may be filled in later.</summary>
    public string CreditNoteNumber { get; set; } = string.Empty;
    public DateOnly CreditNoteDate { get; set; }

    public int PurchaseOrderId { get; set; }
    public string PoNumber { get; set; } = string.Empty;
    public int PurchaseOrderItemId { get; set; }

    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string VendorProductId { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;

    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;

    /// <summary>Delivery UOM / price from the source PO line.</summary>
    public string DeliveryUom { get; set; } = string.Empty;
    public decimal DeliveryUnitPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Amount { get; set; }

    /// <summary>Quantity / UOM / unit price written to stock card (inventory preferred).</summary>
    public decimal StockQuantity { get; set; }
    public string StockUom { get; set; } = string.Empty;
    public decimal StockUnitPrice { get; set; }

    /// <summary>confirmed | cancelled</summary>
    public string Status { get; set; } = "confirmed";

    public int? CancelPurchaseOrderId { get; set; }
    public string CancelPoNumber { get; set; } = string.Empty;
    public string CancelDoOrInvoiceNumber { get; set; } = string.Empty;
    public DateTime? CancelledAt { get; set; }
    public string CancelledBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
