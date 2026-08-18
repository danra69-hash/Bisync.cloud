namespace Bisync.Api.Services;

/// <summary>
/// Splits production batch cost across primary + bi-product outputs.
/// Locked rule: bi unit = base × (pct/100); primary residual share / primary qty.
/// Example: base 10, total 20, primary 10, bi 10 @ 50% → primary 15, bi 5.
/// When every bi line is 100%, split batch total equally across all outputs.
/// </summary>
public static class ProductionCostAttribution
{
    public sealed record BiLine(string Key, decimal Quantity, decimal AttributionPct);

    public sealed record BiLineResult(string Key, decimal Quantity, decimal AttributionPct, decimal UnitCost, decimal Share);

    public sealed record Result(
        decimal BatchTotalCost,
        decimal PrimaryQty,
        decimal PrimaryUnitCost,
        decimal PrimaryShare,
        IReadOnlyList<BiLineResult> BiLines);

    public static Result Allocate(
        decimal baseUnitCost,
        decimal totalQty,
        decimal primaryQty,
        IReadOnlyList<BiLine> biLines)
    {
        baseUnitCost = baseUnitCost < 0 ? 0 : baseUnitCost;
        totalQty = totalQty < 0 ? 0 : totalQty;
        primaryQty = primaryQty < 0 ? 0 : primaryQty;
        var lines = (biLines ?? Array.Empty<BiLine>())
            .Where(l => l.Quantity > 0)
            .ToList();
        var batchTotal = baseUnitCost * totalQty;

        if (totalQty <= 0)
        {
            return new Result(
                0,
                primaryQty,
                0,
                0,
                lines.Select(l => new BiLineResult(l.Key, l.Quantity, l.AttributionPct, 0, 0)).ToList());
        }

        var allHundred = lines.Count > 0
            && lines.All(l => Math.Abs(l.AttributionPct - 100m) < 0.0001m);

        if (allHundred)
        {
            var outputs = new List<(string Key, decimal Qty)>();
            if (primaryQty > 0) outputs.Add(("primary", primaryQty));
            outputs.AddRange(lines.Select(l => (l.Key, l.Quantity)));
            var n = Math.Max(1, outputs.Count);
            var shareEach = batchTotal / n;
            var primaryShare = primaryQty > 0 ? shareEach : 0;
            return new Result(
                batchTotal,
                primaryQty,
                primaryQty > 0 ? primaryShare / primaryQty : 0,
                primaryShare,
                lines.Select(l =>
                {
                    var share = l.Quantity > 0 ? shareEach : 0;
                    return new BiLineResult(
                        l.Key,
                        l.Quantity,
                        l.AttributionPct,
                        l.Quantity > 0 ? share / l.Quantity : 0,
                        share);
                }).ToList());
        }

        var attributed = lines.Select(l =>
        {
            var pct = l.AttributionPct < 0 ? 0 : l.AttributionPct;
            var unit = baseUnitCost * (pct / 100m);
            var share = unit * l.Quantity;
            return new BiLineResult(l.Key, l.Quantity, pct, unit, share);
        }).ToList();
        var biShare = attributed.Sum(l => l.Share);
        var primaryShareResidual = Math.Max(0, batchTotal - biShare);
        var primaryUnit = primaryQty > 0 ? primaryShareResidual / primaryQty : 0;
        return new Result(batchTotal, primaryQty, primaryUnit, primaryShareResidual, attributed);
    }
}
