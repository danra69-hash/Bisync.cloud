namespace Bisync.Api.Models;

/// <summary>Customer purchase of a POS prepaid promotion package.</summary>
public class PosPrepaidPurchase
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public int PosPromotionId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int? PosCustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerMobile { get; set; } = string.Empty;
    public DateTime PurchasedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public decimal PackageQty { get; set; }
    public string PackageUom { get; set; } = string.Empty;
    public decimal PackageRpp { get; set; }
    public decimal BalanceRemaining { get; set; }
    /// <summary>active | depleted | expired</summary>
    public string Status { get; set; } = "active";
    public int? CheckNumber { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<PosPrepaidLedger> LedgerEntries { get; set; } = [];
}

/// <summary>Balance movement against a prepaid purchase (purchase / deplete / adjust).</summary>
public class PosPrepaidLedger
{
    public int Id { get; set; }
    public int PosPrepaidPurchaseId { get; set; }
    public PosPrepaidPurchase? PosPrepaidPurchase { get; set; }
    /// <summary>purchase | deplete | adjust</summary>
    public string EntryType { get; set; } = string.Empty;
    /// <summary>Negative for deplete.</summary>
    public decimal QtyDelta { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitLabel { get; set; } = string.Empty;
    public decimal QtyPerUnit { get; set; } = 1m;
    public int? ProductId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public int? CheckNumber { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}
