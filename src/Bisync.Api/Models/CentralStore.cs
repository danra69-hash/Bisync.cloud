namespace Bisync.Api.Models;

/// <summary>
/// Company-level Central Store activation: store buys/holds components;
/// kitchen receives issued stock as production hold until Produced.
/// </summary>
public class CentralStoreConfig
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public bool Active { get; set; }
    public string StoreLocationExternalId { get; set; } = string.Empty;
    public string KitchenLocationExternalId { get; set; } = string.Empty;
    public DateTime? ActivatedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Production request for components from Central Store (created by To Produce).
/// </summary>
public class StoreRequisition
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string RequisitionNumber { get; set; } = string.Empty;
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public bool IsSubProduct { get; set; }
    public decimal BatchQty { get; set; }
    public string StoreLocationExternalId { get; set; } = string.Empty;
    public string KitchenLocationExternalId { get; set; } = string.Empty;
    /// <summary>pending | issued | cancelled</summary>
    public string Status { get; set; } = StatusPending;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? IssuedAt { get; set; }
    public string IssuedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<StoreRequisitionLine> Lines { get; set; } = [];

    public const string StatusPending = "pending";
    public const string StatusIssued = "issued";
    public const string StatusCancelled = "cancelled";
}

public class StoreRequisitionLine
{
    public int Id { get; set; }
    public int StoreRequisitionId { get; set; }
    public StoreRequisition? StoreRequisition { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal RequiredQty { get; set; }
    public decimal IssuedQty { get; set; }
    public decimal UnitPrice { get; set; }
}

/// <summary>
/// Components issued from Central Store to Production Kitchen, awaiting produce depletion.
/// </summary>
public class ProductionStockHold
{
    public int Id { get; set; }
    public int? CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public int StoreRequisitionId { get; set; }
    public int StoreRequisitionLineId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    /// <summary>held | depleted</summary>
    public string Status { get; set; } = StatusHeld;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DepletedAt { get; set; }

    public const string StatusHeld = "held";
    public const string StatusDepleted = "depleted";
}
