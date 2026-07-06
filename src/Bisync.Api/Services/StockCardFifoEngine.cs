namespace Bisync.Api.Services;

/// <summary>
/// First-in / first-out (FIFO) costing for stock card layers.
/// </summary>
public static class StockCardFifoEngine
{
    public static decimal ComputeAverageCogs(IReadOnlyList<FifoLayer> layers)
    {
        if (layers.Count == 0)
            return 0;

        var totalQty = layers.Sum(l => l.Quantity);
        if (totalQty <= 0)
            return 0;

        var totalValue = layers.Sum(l => l.Quantity * l.UnitPrice);
        return Math.Round(totalValue / totalQty, 4);
    }

    public static FifoConsumeResult Consume(ref List<FifoLayer> layers, decimal quantity)
    {
        if (quantity <= 0)
            return new FifoConsumeResult();

        var remaining = quantity;
        var totalCost = 0m;
        var parts = new List<string>();

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
            parts.Add($"{FormatQty(take)} @ RM {layer.UnitPrice:F2}");
        }

        if (remaining > 0)
            parts.Add($"{FormatQty(remaining)} @ RM 0.00 (short)");

        var consumed = quantity - remaining;
        var unitPrice = consumed > 0 ? Math.Round(totalCost / consumed, 4) : 0;

        layers.RemoveAll(l => l.Quantity <= 0);

        return new FifoConsumeResult
        {
            ConsumedQty = consumed,
            TotalCost = totalCost,
            UnitPrice = unitPrice,
            Detail = parts.Count > 0 ? $"FIFO: {string.Join(" + ", parts)}" : string.Empty,
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
        if (quantity <= 0)
            return;

        layers.Add(new FifoLayer
        {
            ReceivedAt = receivedAt,
            SourceId = sourceId,
            Quantity = quantity,
            UnitPrice = unitPrice,
            SourceLabel = sourceLabel,
        });
    }

    public static FifoSimulationResult Simulate(IReadOnlyList<FifoEvent> events)
    {
        var layers = new List<FifoLayer>();
        var enriched = new List<FifoEnrichedEvent>(events.Count);
        decimal runningQty = 0;

        foreach (var evt in events.OrderBy(e => e.OccurredAt).ThenBy(e => e.Id))
        {
            decimal unitPrice = evt.UnitPrice;
            string fifoDetail = string.Empty;
            var entryType = evt.EntryType;

            if (IsInboundLayer(entryType))
            {
                var layerPrice = entryType is "adjustment_in"
                    ? ComputeAverageCogs(layers)
                    : unitPrice;
                AddLayer(layers, evt.OccurredAt, evt.Id, evt.Quantity, layerPrice, evt.SourceLabel);
                unitPrice = layerPrice;
                if (entryType == "adjustment_in")
                    fifoDetail = $"Adjustment in at avg COGS RM {layerPrice:F2}";
            }
            else if (IsOutboundConsume(entryType))
            {
                var consumed = Consume(ref layers, evt.Quantity);
                unitPrice = consumed.UnitPrice;
                fifoDetail = consumed.Detail;
            }
            else if (entryType == "adjustment_out")
            {
                var consumed = Consume(ref layers, evt.Quantity);
                unitPrice = consumed.UnitPrice;
                fifoDetail = $"Adjustment out — {consumed.Detail}";
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

        return new FifoSimulationResult
        {
            Events = enriched,
            RemainingLayers = layers,
            AverageCogs = ComputeAverageCogs(layers),
            OnHandQty = runningQty,
        };
    }

    static bool IsInboundLayer(string entryType) =>
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound";

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
}

public sealed class FifoSimulationResult
{
    public IReadOnlyList<FifoEnrichedEvent> Events { get; init; } = [];
    public IReadOnlyList<FifoLayer> RemainingLayers { get; init; } = [];
    public decimal AverageCogs { get; init; }
    public decimal OnHandQty { get; init; }
}
