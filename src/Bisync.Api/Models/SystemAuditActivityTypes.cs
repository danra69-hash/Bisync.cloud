using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Bisync.Api.Models;

/// <summary>
/// Human-readable Audit Trail activity types (title only).
/// Stored in <see cref="SystemAuditEvent.Category"/>.
/// </summary>
public static class SystemAuditActivityTypes
{
    public const string Login = "Login";
    public const string Logout = "Logout";
    public const string PrIssueApproval = "PR issue / approval";
    public const string PoAdjustmentIssue = "PO adjustment / issue";
    public const string ReceivedConsolidation = "Received / Consolidation / adjustment";
    public const string StockIssueReceive = "Stock issue / receive";
    public const string WastageTransfer = "Wastage / Transfer";
    public const string CreditNote = "Credit note";
    public const string CashPurchase = "Cash purchase";
    public const string InventoryCount = "Inventory count / adjustment";
    public const string Computation = "Computation";
    /// <summary>Catch-all for any other persisted DB change.</summary>
    public const string DatabaseChange = "Database change";

    /// <summary>Legacy interceptor category — mapped to <see cref="DatabaseChange"/> in UI.</summary>
    public const string LegacyDbUpdate = "DbUpdate";

    public static string ClassifyEntity(string entityType, string? statusHint = null)
    {
        var type = (entityType ?? string.Empty).Trim();
        if (type.Length == 0) return DatabaseChange;

        if (Is(type, "StoreRequisition", "StoreRequisitionLine", "PurchaseRequest"))
            return PrIssueApproval;

        if (Is(type, "PurchaseOrder", "PurchaseOrderItem"))
            return ClassifyPurchaseOrderStatus(statusHint);

        if (Is(type,
                "WastageEntry", "WastageEntryLine", "WastageLine",
                "TransferEntry", "TransferEntryLine", "TransferLine"))
            return WastageTransfer;

        if (Is(type, "CreditNote", "CreditNoteLine", "CreditNoteItem"))
            return CreditNote;

        if (Is(type, "CashPurchase", "CashPurchaseItem", "CashPurchaseLine"))
            return CashPurchase;

        if (Is(type,
                "InventoryCountSession", "InventoryCountSessionLine",
                "InventoryCountHistory", "InventoryCountHistoryLine"))
            return InventoryCount;

        if (Is(type,
                "InventoryPurchase", "InventoryMovement", "InventoryAlert",
                "ComponentStock", "StockCard", "StockLedger"))
            return StockIssueReceive;

        return DatabaseChange;
    }

    public static string ClassifyPurchaseOrderStatus(string? statusHint)
    {
        var status = (statusHint ?? string.Empty).Trim();
        if (status.Length == 0) return PoAdjustmentIssue;

        if (Contains(status, "Pending Approval"))
            return PrIssueApproval;
        if (Contains(status, "Received", "Partially Delivered", "Reconciled", "Consolidat"))
            return ReceivedConsolidation;
        if (Contains(status, "Committed", "Commitment"))
            return PoAdjustmentIssue;
        return PoAdjustmentIssue;
    }

    public static string NormalizeDisplay(string? category)
    {
        var value = (category ?? string.Empty).Trim();
        if (value.Length == 0) return DatabaseChange;
        if (string.Equals(value, LegacyDbUpdate, StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "DB update", StringComparison.OrdinalIgnoreCase))
            return DatabaseChange;
        return value;
    }

    public static string ReadStatusHint(EntityEntry entry)
    {
        try
        {
            var prop = entry.Properties.FirstOrDefault(p =>
                string.Equals(p.Metadata.Name, "Status", StringComparison.OrdinalIgnoreCase));
            if (prop is null) return string.Empty;
            return (prop.CurrentValue ?? prop.OriginalValue)?.ToString()?.Trim() ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    static bool Is(string type, params string[] names) =>
        names.Any(n => string.Equals(type, n, StringComparison.OrdinalIgnoreCase));

    static bool Contains(string status, params string[] needles) =>
        needles.Any(n => status.Contains(n, StringComparison.OrdinalIgnoreCase));
}

/// <summary>Backward-compatible aliases used by existing callers.</summary>
public static class SystemAuditCategories
{
    public const string Login = SystemAuditActivityTypes.Login;
    public const string Logout = SystemAuditActivityTypes.Logout;
    public const string DbUpdate = SystemAuditActivityTypes.LegacyDbUpdate;
    public const string Computation = SystemAuditActivityTypes.Computation;
}
