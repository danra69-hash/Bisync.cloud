namespace Bisync.Api.Models;

public class ArchivedInventoryMovement
{
    public int Id { get; set; }
    public int OriginalId { get; set; }
    public DateTime ArchivedAt { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string LocationExternalId { get; set; } = string.Empty;
    public decimal QtyDelta { get; set; }
    public string Uom { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string ReferenceType { get; set; } = string.Empty;
    public int ReferenceId { get; set; }
    public int? CompanyId { get; set; }
    public decimal UnitPrice { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ArchivedInventoryPurchase
{
    public int Id { get; set; }
    public int OriginalId { get; set; }
    public DateTime ArchivedAt { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Uom { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public DateOnly DateOrdered { get; set; }
    public DateTime DateCreatedInStock { get; set; }
    public int PurchaseOrderId { get; set; }
    public int PurchaseOrderItemId { get; set; }
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
}

public class ArchivedProductProductionLog
{
    public int Id { get; set; }
    public int OriginalId { get; set; }
    public DateTime ArchivedAt { get; set; }
    public int ProductId { get; set; }
    public string EntryType { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string ProductionDate { get; set; } = string.Empty;
    public string ExpiryDate { get; set; } = string.Empty;
    public string BatchNumber { get; set; } = string.Empty;
    public string LocationIdsJson { get; set; } = "[]";
    public int? CompanyId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class StockCardArchiveRun
{
    public int Id { get; set; }
    public DateTime RanAt { get; set; }
    public DateTime ArchiveCutoff { get; set; }
    public int MovementsArchived { get; set; }
    public int PurchasesArchived { get; set; }
    public int ProductionLogsArchived { get; set; }
    public int ConsolidationMovementsCreated { get; set; }
    public string Notes { get; set; } = string.Empty;
}
