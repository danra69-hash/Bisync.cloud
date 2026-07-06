namespace Bisync.Api.Services;

/// <summary>
/// First-in / first-out (FIFO) costing for stock card layers.
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
        var parts = new List<(decimal Qty, decimal UnitPrice)>();

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
            parts.Add((take, layer.UnitPrice));
        }

        var consumed = quantity - remaining;
        var unitPrice = ResolveTrancheUnitPrice(parts, consumed, totalCost);
        var detailParts = parts
            .Select(p => $"{FormatQty(p.Qty)} @ RM {p.UnitPrice:F2}")
            .ToList();
        if (remaining > 0)
            detailParts.Add($"{FormatQty(remaining)} @ RM 0.00 (short)");

        layers.RemoveAll(l => l.Quantity <= 0);

        return new FifoConsumeResult
        {
            ConsumedQty = consumed,
            TotalCost = totalCost,
            UnitPrice = unitPrice,
            Detail = detailParts.Count > 0 ? $"FIFO: {string.Join(" + ", detailParts)}" : string.Empty,
            Parts = parts
                .Select(p => new FifoConsumePart { Quantity = p.Qty, UnitPrice = p.UnitPrice })
                .ToList(),
        };
    }

    /// <summary>
    /// When stock is drawn from a single cost tranche, use that tranche's unit price.
    /// When an outbound spans multiple tranches, use the weighted average cost.
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
                    ? ResolveAdjustmentInUnitPrice(layers, lastAdjustmentOutUnitPrice)
                    : unitPrice;
                AddLayer(layers, evt.OccurredAt, evt.Id, evt.Quantity, layerPrice, evt.SourceLabel);
                unitPrice = layerPrice;
                if (entryType == "adjustment_in")
                {
                    fifoDetail = lastAdjustmentOutUnitPrice is decimal matchedPrice && matchedPrice > 0
                        ? $"Adjustment in at RM {layerPrice:F2} (matches count short)"
                        : $"Adjustment in at FIFO layer RM {layerPrice:F2}";
                    lastAdjustmentOutUnitPrice = null;
                }

                runningQty += evt.SignedQty;
                enriched.Add(new FifoEnrichedEvent
                {
                    Event = evt,
                    UnitPrice = unitPrice,
                    FifoDetail = fifoDetail,
                    RunningBalance = runningQty,
                    AverageCogsAfter = ComputeAverageCogs(layers),
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
        };
    }

    static decimal ResolveAdjustmentInUnitPrice(List<FifoLayer> layers, decimal? lastAdjustmentOutUnitPrice)
    {
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
        var distinctPrices = displayParts.Select(p => p.UnitPrice).Distinct().Count();
        var primaryUnitPrice = displayParts.Count > 0
            ? displayParts[0].UnitPrice
            : consumed.UnitPrice;

        if (displayParts.Count <= 1 || distinctPrices <= 1)
        {
            runningQty += evt.SignedQty;
            enriched.Add(new FifoEnrichedEvent
            {
                Event = evt,
                UnitPrice = consumed.UnitPrice,
                FifoDetail = string.IsNullOrEmpty(fifoDetailPrefix)
                    ? consumed.Detail
                    : $"{fifoDetailPrefix}{consumed.Detail}",
                RunningBalance = runningQty,
                AverageCogsAfter = ComputeAverageCogs(layers),
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
                FifoDetail = $"{fifoDetailPrefix}FIFO: {FormatQty(part.Quantity)} @ RM {part.UnitPrice:F2}",
                RunningBalance = runningQty,
                AverageCogsAfter = ComputeAverageCogs(layers),
                SplitIndex = i,
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

            if (merged.Count > 0 && merged[^1].UnitPrice == part.UnitPrice)
            {
                var last = merged[^1];
                merged[^1] = new FifoConsumePart
                {
                    Quantity = last.Quantity + part.Quantity,
                    UnitPrice = last.UnitPrice,
                };
            }
            else
            {
                merged.Add(new FifoConsumePart
                {
                    Quantity = part.Quantity,
                    UnitPrice = part.UnitPrice,
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
    public decimal TotalCost { get; init; }
    public decimal UnitPrice { get; init; }
    public string Detail { get; init; } = string.Empty;
    public IReadOnlyList<FifoConsumePart> Parts { get; init; } = [];
}

public sealed class FifoConsumePart
{
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
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
}

public sealed class FifoSimulationResult
{
    public IReadOnlyList<FifoEnrichedEvent> Events { get; init; } = [];
    public IReadOnlyList<FifoLayer> RemainingLayers { get; init; } = [];
    public decimal AverageCogs { get; init; }
    public decimal OnHandQty { get; init; }
}
