namespace Bisync.Api.Services;

public static class InventoryCountWorkflow
{
    public const string TypeSpot = "spot";
    public const string TypeFull = "full";

    public const string StatusSaved = "saved";
    public const string StatusPendingConfirmation = "pending_confirmation";
    public const string StatusConfirmed = "confirmed";
    public const string StatusAutoConfirmed = "auto_confirmed";

    public static readonly TimeSpan FullConfirmWindow = TimeSpan.FromHours(72);

    public static bool IsFullTerminal(string status) =>
        status is StatusConfirmed or StatusAutoConfirmed;

    public static bool CanManualConfirm(string sessionType, string status, DateTime? confirmDeadlineAt, DateTime utcNow)
    {
        if (!string.Equals(sessionType, TypeFull, StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.Equals(status, StatusPendingConfirmation, StringComparison.OrdinalIgnoreCase))
            return false;
        return confirmDeadlineAt is null || utcNow <= confirmDeadlineAt.Value;
    }

    public static bool ShouldAutoConfirm(string sessionType, string status, DateTime? confirmDeadlineAt, DateTime utcNow)
    {
        if (!string.Equals(sessionType, TypeFull, StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.Equals(status, StatusPendingConfirmation, StringComparison.OrdinalIgnoreCase))
            return false;
        return confirmDeadlineAt is not null && utcNow > confirmDeadlineAt.Value;
    }
}

public sealed class InventoryCountResult
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public InventoryCountSessionDto? Session { get; init; }

    public static InventoryCountResult Ok(InventoryCountSessionDto session) =>
        new() { Success = true, Session = session };

    public static InventoryCountResult Fail(string message) =>
        new() { Success = false, Message = message };
}

public sealed class InventoryCountSessionDto
{
    public int Id { get; init; }
    public string SessionType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string PeriodMonth { get; init; } = string.Empty;
    public string UomMode { get; init; } = "inventory";
    public string ItemTypeFilter { get; init; } = "all";
    public string GroupFilter { get; init; } = "All";
    public string CountDate { get; init; } = string.Empty;
    public string EffectiveDate { get; init; } = string.Empty;
    public DateTime? AdjustmentsAppliedAt { get; init; }
    public DateTime SavedAt { get; init; }
    public string SavedBy { get; init; } = string.Empty;
    public DateTime? ConfirmDeadlineAt { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public string ConfirmedBy { get; init; } = string.Empty;
    public bool IsAutoConfirmed { get; init; }
    public bool CanSave { get; init; }
    public bool CanConfirm { get; init; }
    public bool IsReadOnly { get; init; }
    public IReadOnlyList<InventoryCountSessionLineDto> Lines { get; init; } = [];
}

public sealed class InventoryCountSessionSummaryDto
{
    public int Id { get; init; }
    public string SessionType { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string PeriodMonth { get; init; } = string.Empty;
    public string UomMode { get; init; } = "inventory";
    public string ItemTypeFilter { get; init; } = "all";
    public string GroupFilter { get; init; } = "All";
    public string CountDate { get; init; } = string.Empty;
    public string EffectiveDate { get; init; } = string.Empty;
    public DateTime SavedAt { get; init; }
    public string SavedBy { get; init; } = string.Empty;
    public DateTime? ConfirmDeadlineAt { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public string ConfirmedBy { get; init; } = string.Empty;
    public bool IsAutoConfirmed { get; init; }
    public bool CanConfirm { get; init; }
    public int LineCount { get; init; }
    public decimal TotalVarianceQty { get; init; }
    public decimal? VariancePct { get; init; }
}

public sealed class InventoryCountSessionLineDto
{
    public string ItemType { get; init; } = string.Empty;
    public string ItemKey { get; init; } = string.Empty;
    public string ItemName { get; init; } = string.Empty;
    public string GroupName { get; init; } = string.Empty;
    public string Uom { get; init; } = string.Empty;
    public decimal SystemQty { get; init; }
    public decimal? CountedQty { get; init; }
    public decimal? VarianceQty { get; init; }
    public decimal? VariancePct { get; init; }
}

public sealed class InventoryCountSaveLineRequest
{
    public string ItemType { get; set; } = string.Empty;
    public string ItemKey { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal SystemQty { get; set; }
    public decimal? CountedQty { get; set; }
}
