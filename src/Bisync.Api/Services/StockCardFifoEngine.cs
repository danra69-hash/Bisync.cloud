namespace Bisync.Api.Services;

/// <summary>
/// First-in / first-out (FIFO) costing for stock card layers.
/// Basis matches Bisync STOCK Analyzer (<c>computeIngredientFIFO</c>):
/// perpetual multi-tranche layers (no monthly average collapse),
/// uncovered outbound at zero COGS with deficit registry,
/// inbound pays earliest shortfalls first at the arriving layer price (retro COGS),
/// then surplus becomes a new available layer.
/// </summary>
public static class StockCardFifoEngine
{
    /// <summary>Qty comparisons — Analyzer uses 1e-9.</summary>
    public const decimal QtyEpsilon = 0.000000001m;

    /// <summary>Unit prices at Analyzer display scale (4dp).</summary>
    public static decimal RoundUnitPrice(decimal value) => DecimalRounding.ToDb(value);

    public static decimal ComputeAverageCogs(IReadOnlyList<FifoLayer> layers)
    {
        if (layers.Count == 0)
            return 0;

        var totalQty = layers.Sum(l => l.Quantity);
        if (totalQty <= QtyEpsilon)
            return 0;

        var totalValue = layers.Sum(l => l.Quantity * l.UnitPrice);
        return RoundUnitPrice(totalValue / totalQty);
    }

    public static FifoConsumeResult Consume(ref List<FifoLayer> layers, decimal quantity)
    {
        if (quantity <= QtyEpsilon)
            return new FifoConsumeResult();

        var remaining = quantity;
        var totalCost = 0m;
        var parts = new List<(decimal Qty, decimal UnitPrice, bool IsShortage)>();

        foreach (var layer in layers.OrderBy(l => l.ReceivedAt).ThenBy(l => l.SourceId))
        {
            if (remaining <= QtyEpsilon)
                break;
            if (layer.Quantity <= QtyEpsilon)
                continue;

            var take = Math.Min(layer.Quantity, remaining);
            totalCost += take * layer.UnitPrice;
            layer.Quantity -= take;
            remaining -= take;
            parts.Add((take, layer.UnitPrice, IsShortage: false));
        }

        var consumed = quantity - remaining;
        if (remaining > QtyEpsilon)
            parts.Add((remaining, 0m, IsShortage: true));
        else
            remaining = 0;

        // Blended unit price over the full requested qty (shortfall contributes 0),
        // so callers that do unitPrice × qty match TotalCost (Analyzer fifoCost).
        var unitPrice = quantity > QtyEpsilon
            ? RoundUnitPrice(totalCost / quantity)
            : 0m;

        var detailParts = parts
            .Select(p => p.IsShortage
                ? $"{FormatQty(p.Qty)} @ RM 0.0000 (short)"
                : $"{FormatQty(p.Qty)} @ RM {p.UnitPrice:F4}")
            .ToList();

        layers.RemoveAll(l => l.Quantity <= QtyEpsilon);

        return new FifoConsumeResult
        {
            ConsumedQty = consumed,
            ShortfallQty = remaining,
            TotalCost = RoundUnitPrice(totalCost),
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

    public static void AddLayer(
        List<FifoLayer> layers,
        DateTime receivedAt,
        int sourceId,
        decimal quantity,
        decimal unitPrice,
        string sourceLabel)
    {
        if (quantity <= QtyEpsilon)
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

    /// <summary>
    /// Simulate perpetual FIFO (STOCK Analyzer basis). Month-boundary collapse is off by default.
    /// </summary>
    public static FifoSimulationResult Simulate(IReadOnlyList<FifoEvent> events) =>
        Simulate(events, collapseAtMonthBoundaries: false);

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
                unitPrice = layerPrice;
                if (entryType == "adjustment_in")
                {
                    fifoDetail = evt.UnitPrice > 0
                        ? $"Adjustment in at asserted RM {layerPrice:F4}"
                        : lastAdjustmentOutUnitPrice is decimal matchedPrice && matchedPrice > 0
                            ? $"Adjustment in at RM {layerPrice:F4} (matches count short)"
                            : $"Adjustment in at FIFO layer RM {layerPrice:F4}";
                    lastAdjustmentOutUnitPrice = null;
                }

                // Analyzer pushLayer: pay earliest shortfalls at arriving price, then surplus layer.
                AcceptInboundPayingShortfalls(
                    enriched,
                    layers,
                    evt.OccurredAt,
                    evt.Id,
                    evt.Quantity,
                    layerPrice,
                    evt.SourceLabel);

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
        bool collapseAtMonthBoundaries = false)
    {
        var layers = new List<FifoLayer>();
        decimal? lastAdjustmentOutUnitPrice = null;
        DateTime? currentMonth = null;
        var sink = new List<FifoEnrichedEvent>();

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
                AcceptInboundPayingShortfalls(
                    sink,
                    layers,
                    evt.OccurredAt,
                    evt.Id,
                    evt.Quantity,
                    layerPrice,
                    evt.SourceLabel);
                if (entryType == "adjustment_in")
                    lastAdjustmentOutUnitPrice = null;
                continue;
            }

            if (IsOutboundConsume(entryType) || entryType == "adjustment_out")
            {
                var consumed = Consume(ref layers, evt.Quantity);
                // Track shortage on sink so later inbound pays at arrival price (Analyzer).
                if (consumed.ShortfallQty > QtyEpsilon)
                {
                    sink.Add(new FifoEnrichedEvent
                    {
                        Event = new FifoEvent
                        {
                            Id = evt.Id,
                            OccurredAt = evt.OccurredAt,
                            EntryType = entryType,
                            Quantity = consumed.ShortfallQty,
                            SignedQty = -consumed.ShortfallQty,
                            Uom = evt.Uom,
                            UnitPrice = 0,
                            Reason = evt.Reason,
                            ReferenceNumber = evt.ReferenceNumber,
                            SourceLabel = evt.SourceLabel,
                        },
                        UnitPrice = 0,
                        IsShortage = true,
                        RunningBalance = 0,
                    });
                }
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
            .Where(l => l.Quantity > QtyEpsilon)
            .OrderBy(l => l.ReceivedAt)
            .ThenBy(l => l.SourceId)
            .FirstOrDefault();

        if (oldest is null)
            return 0;

        return oldest.UnitPrice;
    }

    /// <summary>
    /// Analyzer <c>pushLayer</c>: pay earliest uncovered outbounds at the arriving
    /// layer price (retro COGS), then push any leftover qty as a new FIFO layer.
    /// Does not drain older on-hand layers to price shortfalls.
    /// </summary>
    static void AcceptInboundPayingShortfalls(
        List<FifoEnrichedEvent> enriched,
        List<FifoLayer> layers,
        DateTime receivedAt,
        int sourceId,
        decimal quantity,
        decimal unitPrice,
        string sourceLabel)
    {
        if (quantity <= QtyEpsilon)
            return;

        var price = RoundUnitPrice(unitPrice);
        var remainingInbound = quantity;

        for (var i = 0; i < enriched.Count && remainingInbound > QtyEpsilon; i++)
        {
            var row = enriched[i];
            if (!row.IsShortage || row.Event.Quantity <= QtyEpsilon || row.UnitPrice > 0)
                continue;

            var need = row.Event.Quantity;
            var take = Math.Min(need, remainingInbound);
            remainingInbound -= take;
            var remainShort = need - take;

            var balanceAfter = row.RunningBalance;
            var avgAfter = row.AverageCogsAfter;
            var insertAt = i;
            enriched.RemoveAt(i);

            var balanceBeforeShortage = balanceAfter + row.Event.Quantity;
            var progressiveBalance = balanceBeforeShortage - take;

            enriched.Insert(insertAt++, new FifoEnrichedEvent
            {
                Event = CloneEvent(row.Event, take, -take),
                UnitPrice = price,
                FifoDetail = $"FIFO backfill: {FormatQty(take)} @ RM {price:F4}",
                RunningBalance = progressiveBalance,
                AverageCogsAfter = avgAfter,
                SplitIndex = row.SplitIndex,
                IsShortage = false,
                IsCogsBackfilled = true,
                IsNegativeBalance = progressiveBalance < 0,
            });

            if (remainShort > QtyEpsilon)
            {
                progressiveBalance = balanceBeforeShortage - take - remainShort;
                enriched.Insert(insertAt++, new FifoEnrichedEvent
                {
                    Event = CloneEvent(row.Event, remainShort, -remainShort),
                    UnitPrice = 0,
                    FifoDetail = $"FIFO: {FormatQty(remainShort)} @ RM 0.0000 (short — awaiting inbound)",
                    RunningBalance = progressiveBalance,
                    AverageCogsAfter = avgAfter,
                    SplitIndex = row.SplitIndex + 1,
                    IsShortage = true,
                    IsCogsBackfilled = false,
                    IsNegativeBalance = progressiveBalance < 0,
                });
            }

            i = insertAt - 1;
        }

        if (remainingInbound > QtyEpsilon)
        {
            AddLayer(layers, receivedAt, sourceId, remainingInbound, price, sourceLabel);
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
                        ? $"FIFO: {FormatQty(part.Quantity)} @ RM 0.0000 (short — negative stock)"
                        : consumed.Detail)
                    : $"{fifoDetailPrefix}{(part.IsShortage ? $"FIFO: {FormatQty(part.Quantity)} @ RM 0.0000 (short — negative stock)" : consumed.Detail)}",
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
                    ? $"{fifoDetailPrefix}FIFO: {FormatQty(part.Quantity)} @ RM 0.0000 (short — negative stock)"
                    : $"{fifoDetailPrefix}FIFO: {FormatQty(part.Quantity)} @ RM {part.UnitPrice:F4}",
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
            if (part.Quantity <= QtyEpsilon)
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

    /// <summary>Optional hybrid — off by default (Analyzer uses perpetual layers).</summary>
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
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound" or "balance_forward" or "split_use_in";

    static bool IsOutboundConsume(string entryType) =>
        // split_use reduces parent on-hand to Component Nett after composition (not a sale).
        entryType is "production" or "pos_sale" or "online_order" or "offline_order" or "wastage" or "transfer_out" or "outbound" or "split_use";

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
