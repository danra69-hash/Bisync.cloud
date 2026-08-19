namespace Bisync.Api.Models;

/// <summary>
/// Saved mapping from uploaded POS export column headers → Bisync POS sales fields.
/// One row per company (latest mapping wins for matching header fingerprints).
/// </summary>
public class PosSalesHeaderMap
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>Stable hash of sorted uploaded header names.</summary>
    public string HeaderFingerprint { get; set; } = string.Empty;
    /// <summary>JSON object: { "File Header": "saleDate", ... }. Empty string / omit = ignore.</summary>
    public string MappingJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = string.Empty;
}

/// <summary>One uploaded POS detailed-sales file.</summary>
public class PosSalesImportBatch
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string FileKind { get; set; } = string.Empty;
    /// <summary>Business day the upload covers (user-selected or inferred).</summary>
    public DateOnly BusinessDate { get; set; }
    public string HeaderFingerprint { get; set; } = string.Empty;
    public int RowCount { get; set; }
    public int ImportedCount { get; set; }
    public int SkippedCount { get; set; }
    public decimal TotalQuantity { get; set; }
    public decimal TotalGross { get; set; }
    public string Status { get; set; } = "imported";
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedBy { get; set; } = string.Empty;
}

/// <summary>Line from an uploaded POS detailed sales file after header mapping.</summary>
public class PosSalesImportLine
{
    public int Id { get; set; }
    public int BatchId { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public DateOnly BusinessDate { get; set; }
    public DateTime? SaleAt { get; set; }
    public string CheckNumber { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public int? ResolvedProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public int Covers { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string TableLabel { get; set; } = string.Empty;
    public int SourceRowNumber { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
