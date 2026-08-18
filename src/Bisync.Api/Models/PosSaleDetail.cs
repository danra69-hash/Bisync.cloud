namespace Bisync.Api.Models;

/// <summary>
/// Quantified POS (or channel) sale detail for variable products —
/// combination selections, replacement substitutions, or exact weight served.
/// Linked to products and/or components for stock depletion audit.
/// </summary>
public class PosSaleDetail
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>pos | online | offline</summary>
    public string SalesChannel { get; set; } = "pos";
    /// <summary>combination | replacement | weight | empty for plain products</summary>
    public string VariableMode { get; set; } = string.Empty;
    public decimal QuantitySold { get; set; }
    public decimal? EnteredWeight { get; set; }
    public string WeightUom { get; set; } = string.Empty;
    public decimal? ReferenceWeightQty { get; set; }
    /// <summary>
    /// Quantified selections JSON:
    /// combination → [{ productId, productCode, productName, quantity }]
    /// replacement → [{ baseComponentId, baseComponentName, chosenComponentId, chosenComponentName, componentUom, quantity }]
    /// weight → [{ kind:"weight", enteredWeight, weightUom, referenceWeightQty }]
    /// </summary>
    public string SelectionsJson { get; set; } = "[]";
    /// <summary>Resolved component/product usages applied to stock for this sale line.</summary>
    public string ComponentUsagesJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
