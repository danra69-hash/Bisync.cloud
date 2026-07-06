using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public class InventoryCountService(BisyncDbContext db, StockCardService stockCardService)
{
    public async Task<int> ProcessAutoConfirmationsAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = DateTime.UtcNow;
        var expired = await db.InventoryCountSessions
            .Where(s => s.SessionType == InventoryCountWorkflow.TypeFull
                && s.Status == InventoryCountWorkflow.StatusPendingConfirmation
                && s.ConfirmDeadlineAt != null
                && s.ConfirmDeadlineAt < utcNow)
            .ToListAsync(cancellationToken);

        foreach (var session in expired)
        {
            await db.Entry(session).Collection(s => s.Lines).LoadAsync(cancellationToken);
            var finalized = await TryFinalizeFullSessionAsync(
                session,
                confirmedBy: "System",
                effectiveDate: null,
                isAutoConfirm: true,
                utcNow,
                cancellationToken);
            if (!finalized.Success)
                continue;
        }

        if (expired.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        return expired.Count;
    }

    public async Task<InventoryCountSessionDto?> GetActiveSessionAsync(
        string sessionType,
        int? companyId,
        IReadOnlyList<string> locationIds,
        string periodMonth,
        string uomMode,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0 || string.IsNullOrWhiteSpace(periodMonth))
            return null;

        await ProcessAutoConfirmationsAsync(cancellationToken);

        var normalizedType = NormalizeSessionType(sessionType);
        var sessions = await db.InventoryCountSessions
            .Include(s => s.Lines)
            .Where(s => s.SessionType == normalizedType
                && s.PeriodMonth == periodMonth
                && s.UomMode == NormalizeUomMode(uomMode))
            .OrderByDescending(s => s.SavedAt)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            sessions = sessions.Where(s => s.CompanyId == cid).ToList();

        sessions = sessions
            .Where(s => LocationSetsMatch(s.LocationIdsJson, locationIds))
            .ToList();

        if (sessions.Count == 0)
            return null;

        InventoryCountSession? selected = normalizedType == InventoryCountWorkflow.TypeSpot
            ? sessions[0]
            : sessions.FirstOrDefault(s => s.Status == InventoryCountWorkflow.StatusPendingConfirmation)
                ?? sessions.FirstOrDefault(s => InventoryCountWorkflow.IsFullTerminal(s.Status));

        return selected is null ? null : MapSession(selected, DateTime.UtcNow);
    }

    public async Task<InventoryCountResult> SaveAsync(
        string sessionType,
        int? companyId,
        IReadOnlyList<string> locationIds,
        string periodMonth,
        string uomMode,
        string itemTypeFilter,
        string groupFilter,
        string countDate,
        string savedBy,
        IReadOnlyList<InventoryCountSaveLineRequest> lines,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return InventoryCountResult.Fail("Select at least one location.");

        if (string.IsNullOrWhiteSpace(periodMonth))
            return InventoryCountResult.Fail("Select a month.");

        if (lines.Count == 0)
            return InventoryCountResult.Fail("Enter at least one counted quantity.");

        var normalizedType = NormalizeSessionType(sessionType);
        var utcNow = DateTime.UtcNow;
        await ProcessAutoConfirmationsAsync(cancellationToken);

        if (normalizedType == InventoryCountWorkflow.TypeFull)
        {
            var existingTerminal = await FindFullSessionAsync(
                companyId, locationIds, periodMonth, NormalizeUomMode(uomMode), cancellationToken);
            if (existingTerminal is not null && InventoryCountWorkflow.IsFullTerminal(existingTerminal.Status))
                return InventoryCountResult.Fail("This full inventory count is already confirmed for the selected month.");
        }

        var session = normalizedType == InventoryCountWorkflow.TypeSpot
            ? new InventoryCountSession()
            : await FindOrCreateFullSessionAsync(
                companyId, locationIds, periodMonth, NormalizeUomMode(uomMode), cancellationToken);

        session.SessionType = normalizedType;
        session.CompanyId = companyId;
        session.LocationIdsJson = SerializeLocationIds(locationIds);
        session.PeriodMonth = periodMonth;
        session.UomMode = NormalizeUomMode(uomMode);
        session.ItemTypeFilter = string.IsNullOrWhiteSpace(itemTypeFilter) ? "all" : itemTypeFilter.Trim().ToLowerInvariant();
        session.GroupFilter = string.IsNullOrWhiteSpace(groupFilter) ? "All" : groupFilter.Trim();
        session.CountDate = ResolveCountDate(normalizedType, countDate, periodMonth, utcNow);
        session.SavedAt = utcNow;
        session.SavedBy = savedBy.Trim();
        session.UpdatedAt = utcNow;

        if (normalizedType == InventoryCountWorkflow.TypeSpot)
        {
            session.Status = InventoryCountWorkflow.StatusSaved;
            session.ConfirmDeadlineAt = null;
            session.ConfirmedAt = null;
            session.ConfirmedBy = string.Empty;
            session.IsAutoConfirmed = false;
            db.InventoryCountSessions.Add(session);
        }
        else
        {
            session.Status = InventoryCountWorkflow.StatusPendingConfirmation;
            session.ConfirmDeadlineAt = utcNow.Add(InventoryCountWorkflow.FullConfirmWindow);
            session.ConfirmedAt = null;
            session.ConfirmedBy = string.Empty;
            session.IsAutoConfirmed = false;
            if (session.Id == 0)
                db.InventoryCountSessions.Add(session);
        }

        ReplaceLines(session, lines);
        await db.SaveChangesAsync(cancellationToken);

        await db.Entry(session).Collection(s => s.Lines).LoadAsync(cancellationToken);
        return InventoryCountResult.Ok(MapSession(session, utcNow));
    }

    public async Task<InventoryCountResult> ConfirmAsync(
        int sessionId,
        string confirmedBy,
        string? effectiveDate,
        CancellationToken cancellationToken = default)
    {
        var session = await db.InventoryCountSessions
            .Include(s => s.Lines)
            .FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session is null)
            return InventoryCountResult.Fail("Inventory count not found.");

        var utcNow = DateTime.UtcNow;
        await ProcessAutoConfirmationsAsync(cancellationToken);

        if (!string.Equals(session.SessionType, InventoryCountWorkflow.TypeFull, StringComparison.OrdinalIgnoreCase))
            return InventoryCountResult.Fail("Only full inventory counts can be confirmed.");

        if (InventoryCountWorkflow.IsFullTerminal(session.Status))
            return InventoryCountResult.Fail("This inventory count is already confirmed.");

        if (!InventoryCountWorkflow.CanManualConfirm(session.SessionType, session.Status, session.ConfirmDeadlineAt, utcNow))
            return InventoryCountResult.Fail("The 72-hour confirmation window has expired. This count will be auto-confirmed.");

        if (string.IsNullOrWhiteSpace(effectiveDate))
            return InventoryCountResult.Fail("Select an effective date for this inventory confirmation.");

        return await TryFinalizeFullSessionAsync(
            session,
            confirmedBy,
            effectiveDate,
            isAutoConfirm: false,
            utcNow,
            cancellationToken);
    }

    public async Task<IReadOnlyList<InventoryCountSessionSummaryDto>> ListHistoryAsync(
        string? sessionType,
        int? companyId,
        IReadOnlyList<string> locationIds,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return [];

        await ProcessAutoConfirmationsAsync(cancellationToken);

        var sessions = await db.InventoryCountSessions
            .Include(s => s.Lines)
            .OrderByDescending(s => s.SavedAt)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            sessions = sessions.Where(s => s.CompanyId == cid).ToList();

        sessions = sessions
            .Where(s => LocationSetsMatch(s.LocationIdsJson, locationIds))
            .ToList();

        if (!string.IsNullOrWhiteSpace(sessionType))
        {
            var normalizedType = NormalizeSessionType(sessionType);
            sessions = sessions.Where(s => s.SessionType == normalizedType).ToList();
        }

        var utcNow = DateTime.UtcNow;
        return sessions
            .OrderByDescending(s => IsPendingConfirmation(s.Status) ? 1 : 0)
            .ThenByDescending(s => s.SavedAt)
            .Select(s => MapSummary(s, utcNow))
            .ToList();
    }

    public async Task<InventoryCountSessionDto?> GetSessionAsync(
        int sessionId,
        int? companyId,
        IReadOnlyList<string> locationIds,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return null;

        await ProcessAutoConfirmationsAsync(cancellationToken);

        var session = await db.InventoryCountSessions
            .Include(s => s.Lines)
            .FirstOrDefaultAsync(s => s.Id == sessionId, cancellationToken);

        if (session is null)
            return null;

        if (companyId is int cid && session.CompanyId is not null && session.CompanyId != cid)
            return null;

        if (!LocationSetsMatch(session.LocationIdsJson, locationIds))
            return null;

        return MapSession(session, DateTime.UtcNow);
    }

    async Task<InventoryCountSession?> FindFullSessionAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string periodMonth,
        string uomMode,
        CancellationToken cancellationToken)
    {
        var sessions = await db.InventoryCountSessions
            .Where(s => s.SessionType == InventoryCountWorkflow.TypeFull
                && s.PeriodMonth == periodMonth
                && s.UomMode == uomMode)
            .OrderByDescending(s => s.SavedAt)
            .ToListAsync(cancellationToken);

        if (companyId is int cid)
            sessions = sessions.Where(s => s.CompanyId == cid).ToList();

        return sessions.FirstOrDefault(s => LocationSetsMatch(s.LocationIdsJson, locationIds));
    }

    async Task<InventoryCountSession> FindOrCreateFullSessionAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string periodMonth,
        string uomMode,
        CancellationToken cancellationToken)
    {
        var existing = await FindFullSessionAsync(companyId, locationIds, periodMonth, uomMode, cancellationToken);
        if (existing is not null && !InventoryCountWorkflow.IsFullTerminal(existing.Status))
        {
            db.InventoryCountSessionLines.RemoveRange(existing.Lines);
            return existing;
        }

        return new InventoryCountSession
        {
            SessionType = InventoryCountWorkflow.TypeFull,
            CreatedAt = DateTime.UtcNow,
        };
    }

    static void ReplaceLines(InventoryCountSession session, IReadOnlyList<InventoryCountSaveLineRequest> lines)
    {
        session.Lines.Clear();
        foreach (var line in lines)
        {
            var counted = line.CountedQty;
            session.Lines.Add(new InventoryCountSessionLine
            {
                ItemType = line.ItemType.Trim().ToLowerInvariant(),
                ItemKey = line.ItemKey.Trim(),
                ItemName = line.ItemName.Trim(),
                GroupName = line.GroupName.Trim(),
                Uom = line.Uom.Trim(),
                SystemQty = line.SystemQty,
                CountedQty = counted,
                VarianceQty = counted is decimal qty ? qty - line.SystemQty : null,
            });
        }
    }

    static void ApplyAutoConfirm(InventoryCountSession session, DateTime utcNow)
    {
        session.Status = InventoryCountWorkflow.StatusAutoConfirmed;
        session.ConfirmedAt = utcNow;
        session.ConfirmedBy = "System";
        session.IsAutoConfirmed = true;
        session.UpdatedAt = utcNow;
    }

    async Task<InventoryCountResult> TryFinalizeFullSessionAsync(
        InventoryCountSession session,
        string confirmedBy,
        string? effectiveDate,
        bool isAutoConfirm,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        if (session.AdjustmentsAppliedAt is not null)
            return InventoryCountResult.Ok(MapSession(session, utcNow));

        var resolvedEffectiveDate = ResolveEffectiveDate(session, effectiveDate, utcNow);
        if (resolvedEffectiveDate is null)
            return InventoryCountResult.Fail("Select a valid effective date for this inventory confirmation.");

        var adjustmentError = await ApplyStockAdjustmentsAsync(session, resolvedEffectiveDate.Value, cancellationToken);
        if (adjustmentError is not null)
            return InventoryCountResult.Fail(adjustmentError);

        if (isAutoConfirm)
            ApplyAutoConfirm(session, utcNow);
        else
        {
            session.Status = InventoryCountWorkflow.StatusConfirmed;
            session.ConfirmedAt = utcNow;
            session.ConfirmedBy = confirmedBy.Trim();
            session.IsAutoConfirmed = false;
            session.UpdatedAt = utcNow;
        }

        session.EffectiveDate = resolvedEffectiveDate.Value.ToString("yyyy-MM-dd");
        session.AdjustmentsAppliedAt = utcNow;
        await db.SaveChangesAsync(cancellationToken);

        return InventoryCountResult.Ok(MapSession(session, utcNow));
    }

    async Task<string?> ApplyStockAdjustmentsAsync(
        InventoryCountSession session,
        DateOnly effectiveDate,
        CancellationToken cancellationToken)
    {
        var locationIds = PurchaseOrderWorkflow.DeserializeLocationIds(session.LocationIdsJson);
        if (locationIds.Count == 0)
            return "No locations on this inventory count.";

        var reason = $"Full inventory count #{session.Id} ({session.PeriodMonth})";
        var asOfDate = effectiveDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        foreach (var line in session.Lines)
        {
            if (line.VarianceQty is not decimal variance || variance == 0)
                continue;

            var allocations = await AllocateLineVarianceAsync(
                line,
                variance,
                session.CompanyId,
                locationIds,
                session.UomMode,
                asOfDate,
                cancellationToken);

            if (allocations.Count == 0)
                return $"Unable to allocate stock adjustment for {line.ItemName}.";

            foreach (var (locationId, quantity) in allocations)
            {
                if (quantity <= 0)
                    continue;

                var direction = variance > 0 ? "in" : "out";
                var result = await stockCardService.CreateAdjustmentAsync(
                    line.ItemType,
                    line.ItemKey,
                    session.CompanyId,
                    locationId,
                    locationIds,
                    session.UomMode,
                    effectiveDate,
                    quantity,
                    direction,
                    reason,
                    inboundUom: variance > 0 ? line.Uom : null,
                    cancellationToken: cancellationToken);

                if (!result.Success)
                    return result.Message ?? $"Stock adjustment failed for {line.ItemName}.";
            }
        }

        return null;
    }

    async Task<IReadOnlyList<(string LocationId, decimal Quantity)>> AllocateLineVarianceAsync(
        InventoryCountSessionLine line,
        decimal variance,
        int? companyId,
        IReadOnlyList<string> locationIds,
        string uomMode,
        DateTime asOfDate,
        CancellationToken cancellationToken)
    {
        var onHandByLocation = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var locationId in locationIds)
        {
            var snapshot = await stockCardService.GetAsOfSnapshotAsync(
                line.ItemType,
                line.ItemKey,
                companyId,
                locationId,
                locationIds,
                uomMode,
                asOfDate,
                cancellationToken);
            onHandByLocation[locationId] = snapshot?.OnHandQty ?? 0;
        }

        var absVariance = Math.Abs(variance);
        var totalOnHand = onHandByLocation.Values.Sum();

        if (variance > 0)
        {
            if (totalOnHand <= 0)
                return SplitEvenly(locationIds, absVariance);

            return ProportionalSplit(locationIds, onHandByLocation, absVariance);
        }

        if (totalOnHand < absVariance)
            return [];

        if (locationIds.Count == 1)
            return [(locationIds[0], absVariance)];

        return ProportionalSplit(locationIds, onHandByLocation, absVariance);
    }

    static IReadOnlyList<(string LocationId, decimal Quantity)> SplitEvenly(
        IReadOnlyList<string> locationIds,
        decimal totalQuantity)
    {
        if (locationIds.Count == 0 || totalQuantity <= 0)
            return [];

        var perLocation = Math.Round(totalQuantity / locationIds.Count, 3, MidpointRounding.AwayFromZero);
        var allocations = new List<(string LocationId, decimal Quantity)>();
        var allocated = 0m;

        for (var i = 0; i < locationIds.Count; i++)
        {
            var qty = i == locationIds.Count - 1
                ? Math.Round(totalQuantity - allocated, 3, MidpointRounding.AwayFromZero)
                : perLocation;
            if (qty > 0)
                allocations.Add((locationIds[i], qty));
            allocated += qty;
        }

        return allocations;
    }

    static IReadOnlyList<(string LocationId, decimal Quantity)> ProportionalSplit(
        IReadOnlyList<string> locationIds,
        IReadOnlyDictionary<string, decimal> onHandByLocation,
        decimal totalQuantity)
    {
        var totalOnHand = onHandByLocation.Values.Sum();
        if (totalOnHand <= 0 || totalQuantity <= 0)
            return [];

        var allocations = new List<(string LocationId, decimal Quantity)>();
        var allocated = 0m;

        for (var i = 0; i < locationIds.Count; i++)
        {
            var locationId = locationIds[i];
            var onHand = onHandByLocation.TryGetValue(locationId, out var qty) ? qty : 0;
            var share = i == locationIds.Count - 1
                ? Math.Round(totalQuantity - allocated, 3, MidpointRounding.AwayFromZero)
                : Math.Round(totalQuantity * (onHand / totalOnHand), 3, MidpointRounding.AwayFromZero);

            if (share > 0)
                allocations.Add((locationId, share));
            allocated += share;
        }

        return allocations;
    }

    static DateOnly? ResolveEffectiveDate(InventoryCountSession session, string? effectiveDate, DateTime utcNow)
    {
        if (!string.IsNullOrWhiteSpace(effectiveDate) && DateOnly.TryParse(effectiveDate, out var parsed))
        {
            if (parsed > DateOnly.FromDateTime(utcNow))
                return null;
            return parsed;
        }

        if (DateOnly.TryParse(session.CountDate, out var countDate))
            return countDate <= DateOnly.FromDateTime(utcNow) ? countDate : DateOnly.FromDateTime(utcNow);

        if (DateOnly.TryParse($"{session.PeriodMonth}-01", out var monthStart))
        {
            var lastDay = monthStart.AddMonths(1).AddDays(-1);
            return lastDay <= DateOnly.FromDateTime(utcNow) ? lastDay : DateOnly.FromDateTime(utcNow);
        }

        return DateOnly.FromDateTime(utcNow);
    }

    static InventoryCountSessionDto MapSession(InventoryCountSession session, DateTime utcNow)
    {
        var isFull = string.Equals(session.SessionType, InventoryCountWorkflow.TypeFull, StringComparison.OrdinalIgnoreCase);
        var isTerminal = isFull && InventoryCountWorkflow.IsFullTerminal(session.Status);
        var canConfirm = InventoryCountWorkflow.CanManualConfirm(
            session.SessionType, session.Status, session.ConfirmDeadlineAt, utcNow);
        var canSave = !isTerminal;

        return new InventoryCountSessionDto
        {
            Id = session.Id,
            SessionType = session.SessionType,
            Status = session.Status,
            PeriodMonth = session.PeriodMonth,
            UomMode = session.UomMode,
            ItemTypeFilter = session.ItemTypeFilter,
            GroupFilter = session.GroupFilter,
            CountDate = session.CountDate,
            EffectiveDate = session.EffectiveDate,
            AdjustmentsAppliedAt = session.AdjustmentsAppliedAt,
            SavedAt = session.SavedAt,
            SavedBy = session.SavedBy,
            ConfirmDeadlineAt = session.ConfirmDeadlineAt,
            ConfirmedAt = session.ConfirmedAt,
            ConfirmedBy = session.ConfirmedBy,
            IsAutoConfirmed = session.IsAutoConfirmed,
            CanSave = canSave,
            CanConfirm = canConfirm,
            IsReadOnly = isTerminal,
            Lines = session.Lines
                .OrderBy(l => l.ItemName, StringComparer.OrdinalIgnoreCase)
                .Select(l => new InventoryCountSessionLineDto
                {
                    ItemType = l.ItemType,
                    ItemKey = l.ItemKey,
                    ItemName = l.ItemName,
                    GroupName = l.GroupName,
                    Uom = l.Uom,
                    SystemQty = l.SystemQty,
                    CountedQty = l.CountedQty,
                    VarianceQty = l.VarianceQty,
                    VariancePct = ComputeVariancePct(l.SystemQty, l.VarianceQty),
                })
                .ToList(),
        };
    }

    static InventoryCountSessionSummaryDto MapSummary(InventoryCountSession session, DateTime utcNow)
    {
        var totalSystemQty = session.Lines.Sum(l => l.SystemQty);
        var totalVarianceQty = session.Lines
            .Where(l => l.VarianceQty is not null)
            .Sum(l => l.VarianceQty!.Value);

        return new InventoryCountSessionSummaryDto
        {
            Id = session.Id,
            SessionType = session.SessionType,
            Status = session.Status,
            PeriodMonth = session.PeriodMonth,
            UomMode = session.UomMode,
            ItemTypeFilter = session.ItemTypeFilter,
            GroupFilter = session.GroupFilter,
            CountDate = session.CountDate,
            EffectiveDate = session.EffectiveDate,
            SavedAt = session.SavedAt,
            SavedBy = session.SavedBy,
            ConfirmDeadlineAt = session.ConfirmDeadlineAt,
            ConfirmedAt = session.ConfirmedAt,
            ConfirmedBy = session.ConfirmedBy,
            IsAutoConfirmed = session.IsAutoConfirmed,
            CanConfirm = InventoryCountWorkflow.CanManualConfirm(
                session.SessionType, session.Status, session.ConfirmDeadlineAt, utcNow),
            LineCount = session.Lines.Count,
            TotalVarianceQty = totalVarianceQty,
            VariancePct = ComputeVariancePct(totalSystemQty, totalVarianceQty),
        };
    }

    static decimal? ComputeVariancePct(decimal systemQty, decimal? varianceQty)
    {
        if (varianceQty is not decimal variance || systemQty == 0)
            return null;

        return Math.Round((variance / systemQty) * 100m, 2, MidpointRounding.AwayFromZero);
    }

    static bool IsPendingConfirmation(string status) =>
        string.Equals(status, InventoryCountWorkflow.StatusPendingConfirmation, StringComparison.OrdinalIgnoreCase);

    static string NormalizeSessionType(string sessionType)
    {
        var normalized = sessionType.Trim().ToLowerInvariant();
        return normalized switch
        {
            "full" or "full inventory" => InventoryCountWorkflow.TypeFull,
            _ => InventoryCountWorkflow.TypeSpot,
        };
    }

    static string NormalizeUomMode(string uomMode) =>
        string.Equals(uomMode, "recipe", StringComparison.OrdinalIgnoreCase) ? "recipe" : "inventory";

    static string ResolveCountDate(string sessionType, string countDate, string periodMonth, DateTime utcNow)
    {
        if (DateOnly.TryParse(countDate, out var parsed))
            return parsed.ToString("yyyy-MM-dd");

        if (string.Equals(sessionType, InventoryCountWorkflow.TypeFull, StringComparison.OrdinalIgnoreCase)
            && DateOnly.TryParse($"{periodMonth}-01", out var monthStart))
        {
            var lastDay = monthStart.AddMonths(1).AddDays(-1);
            return lastDay.ToString("yyyy-MM-dd");
        }

        return DateOnly.FromDateTime(utcNow).ToString("yyyy-MM-dd");
    }

    static string SerializeLocationIds(IReadOnlyList<string> locationIds) =>
        JsonSerializer.Serialize(locationIds.OrderBy(id => id, StringComparer.OrdinalIgnoreCase).ToArray());

    static bool LocationSetsMatch(string locationIdsJson, IReadOnlyList<string> locationIds)
    {
        var stored = PurchaseOrderWorkflow.DeserializeLocationIds(locationIdsJson)
            .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var incoming = locationIds.OrderBy(id => id, StringComparer.OrdinalIgnoreCase).ToList();
        return stored.SequenceEqual(incoming, StringComparer.OrdinalIgnoreCase);
    }
}
