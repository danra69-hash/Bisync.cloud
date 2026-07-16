namespace Bisync.Api.Services;

/// <summary>
/// First-in / first-out (FIFO) costing for stock card layers.
/// Supports negative stock (zero COGS), multi-tranche splits, and retroactive
/// COGS backfill when inbound arrives after uncovered outbound.
/// </summary>
public static class StockCardFifoEngine
{
    public static decimal RoundUnitPrice(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal ComputeAverageCogs(IReadOnlyList<FifoLayer> layers)
    {
        if (layers.Count == 0)
            return 0;

        var totalQty = layers.Sum(l => l.Quantity);
        if (totalQty <= 0)
            return 0;

        var totalValue = layers.Sum(l => l.Quantity * l.UnitPrice);
        return RoundUnitPrice(totalValue / totalQty);
    }

    public static FifoConsumeResult Consume(ref List<FifoLayer> layers, decimal quantity)
    {
        if (quantity <= 0)
            return new FifoConsumeResult();

        var remaining = quantity;
        var totalCost = 0m;
        var parts = new List<(decimal Qty, decimal UnitPrice, bool IsShortage)>();

        foreach (var layer in layers.OrderBy(l => l.ReceivedAt).ThenBy(l => l.SourceId))
        {
            if (remaining <= 0)
                break;
            if (layer.Quantity <= 0)
                continue;

            var take = Math.Min(layer.Quantity, remaining);
            totalCost += take * layer.UnitPrice;
            layer.Quantity -= take;
            remaining -= take;
            parts.Add((take, layer.UnitPrice, IsShortage: false));
        }

        var consumed = quantity - remaining;
        if (remaining > 0)
            parts.Add((remaining, 0m, IsShortage: true));

        // Combined unit price ignores shortage slices (those stay at 0 on their own rows).
        var covered = parts.Where(p => !p.IsShortage).Select(p => (p.Qty, p.UnitPrice)).ToList();
        var coveredQty = covered.Sum(p => p.Qty);
        var coveredCost = covered.Sum(p => p.Qty * p.UnitPrice);
        var unitPrice = ResolveTrancheUnitPrice(covered, coveredQty, coveredCost);

        var detailParts = parts
            .Select(p => p.IsShortage
                ? $"{FormatQty(p.Qty)} @ RM 0.00 (short)"
                : $"{FormatQty(p.Qty)} @ RM {p.UnitPrice:F2}")
            .ToList();

        layers.RemoveAll(l => l.Quantity <= 0);

        return new FifoConsumeResult
        {
            ConsumedQty = consumed,
            ShortfallQty = remaining,
            TotalCost = totalCost,
            UnitPrice = unitPrice,
            Detail = detailParts.Count > 0 ? $"FIFO: {string.Join(" + ", detailParts)}" : string.Empty,
            Parts = parts
                .Select(p => new FifoConsumePart
                {
                    Quantity = p.Qty,
                    UnitPrice = RoundUnitPrice(p.UnitPrice),
                    IsShortage = p.IsShortage,
                })
                .ToList(),
        };
    }

    /// <summary>
    /// When stock is drawn from a single cost tranche, use that tranche's unit price.
    /// When an outbound spans multiple tranches, use the weighted average of priced parts only.
    /// </summary>
    static decimal ResolveTrancheUnitPrice(
        IReadOnlyList<(decimal Qty, decimal UnitPrice)> parts,
        decimal consumedQty,
        decimal totalCost)
    {
        if (consumedQty <= 0 || parts.Count == 0)
            return 0;

        if (parts.Count == 1)
            return RoundUnitPrice(parts[0].UnitPrice);

        var distinctPrices = parts.Select(p => p.UnitPrice).Distinct().ToList();
        if (distinctPrices.Count == 1)
            return RoundUnitPrice(distinctPrices[0]);

        return RoundUnitPrice(totalCost / consumedQty);
    }

    public static void AddLayer(
        List<FifoLayer> layers,
        DateTime receivedAt,
        int sourceId,
        decimal quantity,
        decimal unitPrice,
        string sourceLabel)
    {
        if (quantity <= 0)
            return;

        layers.Add(new FifoLayer
        {
            ReceivedAt = receivedAt,
            SourceId = sourceId,
            Quantity = quantity,
            UnitPrice = RoundUnitPrice(unitPrice),
            SourceLabel = sourceLabel,
        });
    }

    public static FifoSimulationResult Simulate(IReadOnlyList<FifoEvent> events) =>
        Simulate(events, collapseAtMonthBoundaries: true);

    public static FifoSimulationResult Simulate(
        IReadOnlyList<FifoEvent> events,
        bool collapseAtMonthBoundaries)
    {
        var layers = new List<FifoLayer>();
        var enriched = new List<FifoEnrichedEvent>(events.Count);
        decimal runningQty = 0;
        DateTime? currentMonth = null;
        decimal? lastAdjustmentOutUnitPrice = null;

        foreach (var evt in events.OrderBy(e => e.OccurredAt).ThenBy(e => e.Id))
        {
            var eventMonth = MonthStartUtc(evt.OccurredAt);
            if (collapseAtMonthBoundaries
                && currentMonth is not null
                && eventMonth > currentMonth)
            {
                CollapseLayersAtMonthStart(layers, eventMonth);
            }

            currentMonth = eventMonth;

            decimal unitPrice = evt.UnitPrice;
            string fifoDetail = string.Empty;
            var entryType = evt.EntryType;

            if (IsInboundLayer(entryType))
            {
                var layerPrice = entryType is "adjustment_in"
                    ? ResolveAdjustmentInUnitPrice(layers, lastAdjustmentOutUnitPrice, evt.UnitPrice)
                    : unitPrice;
                AddLayer(layers, evt.OccurredAt, evt.Id, evt.Quantity, layerPrice, evt.SourceLabel);
                unitPrice = layerPrice;
                if (entryType == "adjustment_in")
                {
                    fifoDetail = evt.UnitPrice > 0
                        ? $"Adjustment in at asserted RM {layerPrice:F2}"
                        : lastAdjustmentOutUnitPrice is decimal matchedPrice && matchedPrice > 0
                            ? $"Adjustment in at RM {layerPrice:F2} (matches count short)"
                            : $"Adjustment in at FIFO layer RM {layerPrice:F2}";
                    lastAdjustmentOutUnitPrice = null;
                }

                // Retroactive COGS: apply this inbound to earlier uncovered outbounds first.
                ApplyInboundToUncoveredClaims(enriched, layers);

                runningQty += evt.SignedQty;
                enriched.Add(new FifoEnrichedEvent
                {
                    Event = evt,
                    UnitPrice = unitPrice,
                    FifoDetail = fifoDetail,
                    RunningBalance = runningQty,
                    AverageCogsAfter = ComputeAverageCogs(layers),
                    IsNegativeBalance = runningQty < 0,
                });
            }
            else if (IsOutboundConsume(entryType))
            {
                AppendOutboundLedgerRows(
                    enriched,
                    ref runningQty,
                    layers,
                    evt,
                    evt.Quantity,
                    fifoDetailPrefix: string.Empty);
            }
            else if (entryType == "adjustment_out")
            {
                var adjOutPrice = AppendOutboundLedgerRows(
                    enriched,
                    ref runningQty,
                    layers,
                    evt,
                    evt.Quantity,
                    fifoDetailPrefix: "Adjustment out — ");
                if (adjOutPrice > 0)
                    lastAdjustmentOutUnitPrice = adjOutPrice;
            }
        }

        return new FifoSimulationResult
        {
            Events = enriched,
            RemainingLayers = layers,
            AverageCogs = ComputeAverageCogs(layers),
            OnHandQty = runningQty,
            HasNegativeStock = runningQty < 0 || enriched.Any(e => e.IsNegativeBalance || e.IsShortage),
        };
    }

    /// <summary>
    /// Resolves the unit price for a new adjustment-in at <paramref name="asOfEnd"/>,
    /// using FIFO layers and any unmatched adjustment-out price before that moment.
    /// </summary>
    public static decimal ResolveAdjustmentInUnitPriceAsOf(
        IReadOnlyList<FifoEvent> events,
        DateTime asOfEnd,
        bool collapseAtMonthBoundaries = true)
    {
        var layers = new List<FifoLayer>();
        decimal? lastAdjustmentOutUnitPrice = null;
        DateTime? currentMonth = null;

        foreach (var evt in events
                     .Where(e => e.OccurredAt <= asOfEnd)
                     .OrderBy(e => e.OccurredAt)
                     .ThenBy(e => e.Id))
        {
            var eventMonth = MonthStartUtc(evt.OccurredAt);
            if (collapseAtMonthBoundaries
                && currentMonth is not null
                && eventMonth > currentMonth)
            {
                CollapseLayersAtMonthStart(layers, eventMonth);
            }

            currentMonth = eventMonth;
            var entryType = evt.EntryType;

            if (IsInboundLayer(entryType))
            {
                var layerPrice = entryType is "adjustment_in"
                    ? ResolveAdjustmentInUnitPrice(layers, lastAdjustmentOutUnitPrice, evt.UnitPrice)
                    : evt.UnitPrice;
                AddLayer(layers, evt.OccurredAt, evt.Id, evt.Quantity, layerPrice, evt.SourceLabel);
                if (entryType == "adjustment_in")
                    lastAdjustmentOutUnitPrice = null;
                // Mirror Simulate: inbound first fills prior uncovered claims.
                var sink = new List<FifoEnrichedEvent>();
                ApplyInboundToUncoveredClaims(sink, layers);
                continue;
            }

            if (IsOutboundConsume(entryType) || entryType == "adjustment_out")
            {
                var consumed = Consume(ref layers, evt.Quantity);
                if (entryType == "adjustment_out" && consumed.UnitPrice > 0)
                    lastAdjustmentOutUnitPrice = consumed.UnitPrice;
            }
        }

        return ResolveAdjustmentInUnitPrice(layers, lastAdjustmentOutUnitPrice, assertedUnitPrice: null);
    }

    static decimal ResolveAdjustmentInUnitPrice(
        List<FifoLayer> layers,
        decimal? lastAdjustmentOutUnitPrice,
        decimal? assertedUnitPrice)
    {
        if (assertedUnitPrice is decimal asserted && asserted > 0)
            return RoundUnitPrice(asserted);

        if (lastAdjustmentOutUnitPrice is decimal matched && matched > 0)
            return matched;

        return GetOldestLayerUnitPrice(layers);
    }

    static decimal GetOldestLayerUnitPrice(List<FifoLayer> layers)
    {
        var oldest = layers
            .Where(l => l.Quantity > 0)
            .OrderBy(l => l.ReceivedAt)
            .ThenBy(l => l.SourceId)
            .FirstOrDefault();

        if (oldest is null)
            return 0;

        return oldest.UnitPrice;
    }

    /// <summary>
    /// Apply available FIFO layers to earlier shortage rows (oldest sale first).
    /// Mutates shortage rows in <paramref name="enriched"/> to carry backfilled COGS.
    /// </summary>
    static void ApplyInboundToUncoveredClaims(List<FifoEnrichedEvent> enriched, List<FifoLayer> layers)
    {
        if (enriched.Count == 0 || layers.Count == 0)
            return;

        // Process shortage rows in chronological order (earliest uncovered outbound first).
        for (var i = 0; i < enriched.Count; i++)
        {
            if (layers.Sum(l => l.Quantity) <= 0)
                break;

            var row = enriched[i];
            if (!row.IsShortage || row.Event.Quantity <= 0 || row.UnitPrice > 0)
                continue;

            var need = row.Event.Quantity;
            var fillParts = new List<(decimal Qty, decimal UnitPrice)>();

            foreach (var layer in layers.OrderBy(l => l.ReceivedAt).ThenBy(l => l.SourceId))
            {
                if (need <= 0)
                    break;
                if (layer.Quantity <= 0)
                    continue;

                var take = Math.Min(layer.Quantity, need);
                layer.Quantity -= take;
                need -= take;
                fillParts.Add((take, layer.UnitPrice));
            }

            layers.RemoveAll(l => l.Quantity <= 0);
            if (fillParts.Count == 0)
                continue;

            var filledQty = fillParts.Sum(p => p.Qty);
            var remainShort = row.Event.Quantity - filledQty;
            var displayParts = MergeConsecutiveConsumeParts(fillParts
                .Select(p => new FifoConsumePart { Quantity = p.Qty, UnitPrice = p.UnitPrice })
                .ToList());

            // Replace the shortage row with priced backfill row(s) (+ residual short if any).
            var balanceAfter = row.RunningBalance;
            var avgAfter = row.AverageCogsAfter;
            var insertAt = i;
            enriched.RemoveAt(i);

            var splitIndex = 0;
            decimal qtyCursor = 0;
            // Reconstruct progressive balances within this outbound's shortage slice.
            // balanceAfter is after the full original shortage qty; walk forward from before.
            var balanceBeforeShortage = balanceAfter + row.Event.Quantity;

            foreach (var part in displayParts)
            {
                qtyCursor += part.Quantity;
                var progressiveBalance = balanceBeforeShortage - qtyCursor;
                enriched.Insert(insertAt++, new FifoEnrichedEvent
                {
                    Event = CloneEvent(row.Event, part.Quantity, -part.Quantity),
                    UnitPrice = part.UnitPrice,
                    FifoDetail = $"FIFO backfill: {FormatQty(part.Quantity)} @ RM {part.UnitPrice:F2}",
                    RunningBalance = progressiveBalance,
                    AverageCogsAfter = avgAfter,
                    SplitIndex = row.SplitIndex + splitIndex,
                    IsShortage = false,
                    IsCogsBackfilled = true,
                    IsNegativeBalance = progressiveBalance < 0,
                });
                splitIndex++;
            }

            if (remainShort > 0)
            {
                qtyCursor += remainShort;
                var progressiveBalance = balanceBeforeShortage - qtyCursor;
                enriched.Insert(insertAt++, new FifoEnrichedEvent
                {
                    Event = CloneEvent(row.Event, remainShort, -remainShort),
                    UnitPrice = 0,
                    FifoDetail = $"FIFO: {FormatQty(remainShort)} @ RM 0.00 (short — awaiting inbound)",
                    RunningBalance = progressiveBalance,
                    AverageCogsAfter = avgAfter,
                    SplitIndex = row.SplitIndex + splitIndex,
                    IsShortage = true,
                    IsCogsBackfilled = false,
                    IsNegativeBalance = progressiveBalance < 0,
                });
            }

            // Continue scanning from the first inserted row.
            i = insertAt - 1;
        }
    }

    static decimal AppendOutboundLedgerRows(
        List<FifoEnrichedEvent> enriched,
        ref decimal runningQty,
        List<FifoLayer> layers,
        FifoEvent evt,
        decimal quantity,
        string fifoDetailPrefix)
    {
        var consumed = Consume(ref layers, quantity);
        var displayParts = MergeConsecutiveConsumeParts(consumed.Parts);
        var primaryUnitPrice = displayParts.FirstOrDefault(p => p.UnitPrice > 0)?.UnitPrice
            ?? 0m;

        // Always emit one row per distinct cost slice (including zero-cost shortfall).
        // Full quantity always reduces running balance — negative stock is allowed.
        if (displayParts.Count == 0)
        {
            runningQty += evt.SignedQty;
            enriched.Add(new FifoEnrichedEvent
            {
                Event = evt,
                UnitPrice = 0,
                FifoDetail = string.IsNullOrEmpty(fifoDetailPrefix)
                    ? "FIFO: no stock (short)"
                    : $"{fifoDetailPrefix}FIFO: no stock (short)",
                RunningBalance = runningQty,
                AverageCogsAfter = ComputeAverageCogs(layers),
                IsShortage = true,
                IsNegativeBalance = runningQty < 0,
            });
            return 0;
        }

        if (displayParts.Count == 1)
        {
            var part = displayParts[0];
            runningQty += evt.SignedQty;
            enriched.Add(new FifoEnrichedEvent
            {
                Event = CloneEvent(evt, part.Quantity, -part.Quantity),
                UnitPrice = part.UnitPrice,
                FifoDetail = string.IsNullOrEmpty(fifoDetailPrefix)
                    ? (part.IsShortage
                        ? $"FIFO: {FormatQty(part.Quantity)} @ RM 0.00 (short — negative stock)"
                        : consumed.Detail)
                    : $"{fifoDetailPrefix}{(part.IsShortage ? $"FIFO: {FormatQty(part.Quantity)} @ RM 0.00 (short — negative stock)" : consumed.Detail)}",
                RunningBalance = runningQty,
                AverageCogsAfter = ComputeAverageCogs(layers),
                IsShortage = part.IsShortage,
                IsNegativeBalance = runningQty < 0,
            });
            return primaryUnitPrice;
        }

        for (var i = 0; i < displayParts.Count; i++)
        {
            var part = displayParts[i];
            runningQty -= part.Quantity;
            enriched.Add(new FifoEnrichedEvent
            {
                Event = CloneEvent(evt, part.Quantity, -part.Quantity),
                UnitPrice = part.UnitPrice,
                FifoDetail = part.IsShortage
                    ? $"{fifoDetailPrefix}FIFO: {FormatQty(part.Quantity)} @ RM 0.00 (short — negative stock)"
                    : $"{fifoDetailPrefix}FIFO: {FormatQty(part.Quantity)} @ RM {part.UnitPrice:F2}",
                RunningBalance = runningQty,
                AverageCogsAfter = ComputeAverageCogs(layers),
                SplitIndex = i,
                IsShortage = part.IsShortage,
                IsNegativeBalance = runningQty < 0,
            });
        }

        return primaryUnitPrice;
    }

    static List<FifoConsumePart> MergeConsecutiveConsumeParts(IReadOnlyList<FifoConsumePart> parts)
    {
        var merged = new List<FifoConsumePart>();
        foreach (var part in parts)
        {
            if (part.Quantity <= 0)
                continue;

            if (merged.Count > 0
                && merged[^1].UnitPrice == part.UnitPrice
                && merged[^1].IsShortage == part.IsShortage)
            {
                var last = merged[^1];
                merged[^1] = new FifoConsumePart
                {
                    Quantity = last.Quantity + part.Quantity,
                    UnitPrice = last.UnitPrice,
                    IsShortage = last.IsShortage,
                };
            }
            else
            {
                merged.Add(new FifoConsumePart
                {
                    Quantity = part.Quantity,
                    UnitPrice = part.UnitPrice,
                    IsShortage = part.IsShortage,
                });
            }
        }

        return merged;
    }

    static FifoEvent CloneEvent(FifoEvent source, decimal quantity, decimal signedQty) =>
        new()
        {
            Id = source.Id,
            OccurredAt = source.OccurredAt,
            EntryType = source.EntryType,
            Quantity = quantity,
            SignedQty = signedQty,
            Uom = source.Uom,
            UnitPrice = source.UnitPrice,
            Reason = source.Reason,
            ReferenceNumber = source.ReferenceNumber,
            SourceLabel = source.SourceLabel,
        };

    static void CollapseLayersAtMonthStart(List<FifoLayer> layers, DateTime monthStart)
    {
        var totalQty = layers.Sum(l => l.Quantity);
        if (totalQty <= 0)
        {
            layers.Clear();
            return;
        }

        var avg = ComputeAverageCogs(layers);
        layers.Clear();
        AddLayer(layers, monthStart, 0, totalQty, avg, "B/F");
    }

    static DateTime MonthStartUtc(DateTime value) =>
        new(value.Year, value.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    static bool IsInboundLayer(string entryType) =>
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound" or "balance_forward";

    static bool IsOutboundConsume(string entryType) =>
        entryType is "production" or "pos_sale" or "online_order" or "offline_order" or "wastage" or "transfer_out" or "outbound";

    static string FormatQty(decimal qty)
    {
        var rounded = Math.Round(qty, 3);
        return rounded % 1 == 0 ? $"{rounded:0}" : $"{rounded:0.###}";
    }
}

public sealed class FifoLayer
{
    public DateTime ReceivedAt { get; init; }
    public int SourceId { get; init; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; init; }
    public string SourceLabel { get; init; } = string.Empty;
}

public sealed class FifoConsumeResult
{
    public decimal ConsumedQty { get; init; }
    public decimal ShortfallQty { get; init; }
    public decimal TotalCost { get; init; }
    public decimal UnitPrice { get; init; }
    public string Detail { get; init; } = string.Empty;
    public IReadOnlyList<FifoConsumePart> Parts { get; init; } = [];
}

public sealed class FifoConsumePart
{
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public bool IsShortage { get; init; }
}

public sealed class FifoEvent
{
    public int Id { get; init; }
    public DateTime OccurredAt { get; init; }
    public string EntryType { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal SignedQty { get; init; }
    public string Uom { get; init; } = string.Empty;
    public decimal UnitPrice { get; init; }
    public string Reason { get; init; } = string.Empty;
    public string ReferenceNumber { get; init; } = string.Empty;
    public string SourceLabel { get; init; } = string.Empty;
}

public sealed class FifoEnrichedEvent
{
    public FifoEvent Event { get; init; } = null!;
    public decimal UnitPrice { get; init; }
    public string FifoDetail { get; init; } = string.Empty;
    public decimal RunningBalance { get; init; }
    public decimal AverageCogsAfter { get; init; }
    public int SplitIndex { get; init; }
    /// <summary>Uncovered outbound qty awaiting inbound (zero COGS).</summary>
    public bool IsShortage { get; init; }
    /// <summary>COGS was applied later when inbound stock arrived.</summary>
    public bool IsCogsBackfilled { get; init; }
    /// <summary>Running balance is negative after this row.</summary>
    public bool IsNegativeBalance { get; init; }
}

public sealed class FifoSimulationResult
{
    public IReadOnlyList<FifoEnrichedEvent> Events { get; init; } = [];
    public IReadOnlyList<FifoLayer> RemainingLayers { get; init; } = [];
    public decimal AverageCogs { get; init; }
    public decimal OnHandQty { get; init; }
    public bool HasNegativeStock { get; init; }
}
