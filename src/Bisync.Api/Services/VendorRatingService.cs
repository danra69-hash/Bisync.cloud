using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class VendorRatingRules
{
    public const string LevelSatisfied = "satisfied";
    public const string LevelAcceptable = "acceptable";
    public const string LevelPoor = "poor";
    /// <summary>Legacy alias stored before "poor" rename.</summary>
    public const string LevelUnsatisfied = "unsatisfied";

    public static readonly string[] CustomerLevels = [LevelSatisfied, LevelAcceptable, LevelPoor];

    public const decimal ScoreFull = 100m;
    public const decimal ScoreGood = 80m;
    public const decimal ScoreLow = 50m;

    public static bool IsOnlineVendor(string? type) =>
        string.Equals((type ?? "").Trim(), "online", StringComparison.OrdinalIgnoreCase);

    public static bool IsOfflineVendor(string? type) => !IsOnlineVendor(type);

    public static string? NormalizeCustomerLevel(string? raw)
    {
        var v = (raw ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(v)) return null;
        if (v == LevelUnsatisfied) return LevelPoor;
        return CustomerLevels.Contains(v) ? v : null;
    }

    public static decimal? CustomerLevelScore(string? level) => NormalizeCustomerLevel(level) switch
    {
        LevelSatisfied => ScoreFull,
        LevelAcceptable => ScoreGood,
        LevelPoor => ScoreLow,
        _ => null,
    };

    public static decimal? AverageScores(IEnumerable<decimal> scores)
    {
        var list = scores.Where(s => s >= 0).ToList();
        if (list.Count == 0) return null;
        return Math.Round(list.Average(), 1, MidpointRounding.AwayFromZero);
    }

    /// <summary>Smiley ≥80%, sweating 50–79%, red below 50%.</summary>
    public static string MoodFromAverage(decimal? average)
    {
        if (average is null) return "none";
        if (average >= 80m) return "green";
        if (average >= 50m) return "yellow";
        return "red";
    }

    /// <summary>Classify a received PO's line changes for product accuracy.</summary>
    public static decimal ProductAccuracyScore(int totalLines, int changedLines)
    {
        if (totalLines <= 0) return ScoreFull;
        if (changedLines <= 0) return ScoreFull;
        var ratio = (decimal)changedLines / totalLines;
        return ratio <= 0.30m ? ScoreGood : ScoreLow;
    }
}

public sealed class VendorRatingSummaryDto
{
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorType { get; set; } = "offline";
    public string VendorKind { get; set; } = "offline";
    /// <summary>Overall score as 0–100 percent.</summary>
    public decimal? OverallRating { get; set; }
    public bool HasRating { get; set; }
    public string Control { get; set; } = "operator";
    public string OverallMood { get; set; } = "none";
}

public sealed class ScoredBucketDto
{
    public int Count { get; set; }
    public decimal ScorePercent { get; set; }
    public int Weight { get; set; }
}

public sealed class OnlineOrderAcceptanceDto
{
    public int OrderCount { get; set; }
    public ScoredBucketDto Within4Hours { get; set; } = new() { ScorePercent = 100 };
    public ScoredBucketDto Within8Hours { get; set; } = new() { ScorePercent = 80 };
    public ScoredBucketDto Beyond9Hours { get; set; } = new() { ScorePercent = 50 };
    public decimal? AveragePercent { get; set; }
    public string Mood { get; set; } = "none"; // green | yellow | red | none
}

public sealed class OnlinePoAcceptanceDto
{
    public int OrderCount { get; set; }
    public ScoredBucketDto WithoutChanges { get; set; } = new() { ScorePercent = 100 };
    public ScoredBucketDto WithQuantityOrPriceChange { get; set; } = new() { ScorePercent = 80 };
    public ScoredBucketDto QuantityZeroOutOfStock { get; set; } = new() { ScorePercent = 50 };
    public decimal? AveragePercent { get; set; }
}

public sealed class OnlineProductAccuracyDto
{
    public int OrderCount { get; set; }
    public ScoredBucketDto WithoutChanges { get; set; } = new() { ScorePercent = 100 };
    public ScoredBucketDto ChangedLinesUnder30Pct { get; set; } = new() { ScorePercent = 80 };
    public ScoredBucketDto ChangedLinesOver30Pct { get; set; } = new() { ScorePercent = 50 };
    public decimal? AveragePercent { get; set; }
}

public sealed class CustomerInputAverageDto
{
    public int ResponseCount { get; set; }
    public decimal? AveragePercent { get; set; }
    public int Satisfied { get; set; }
    public int Acceptable { get; set; }
    public int Poor { get; set; }
}

public sealed class TemperatureReadingDto
{
    public string PoNumber { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string VendorProductId { get; set; } = string.Empty;
    public decimal Temperature { get; set; }
    public DateTime? RecordedAt { get; set; }
}

public sealed class VendorRatingDetailDto
{
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string VendorType { get; set; } = "offline";
    public string VendorKindLabel { get; set; } = "Offline Vendor";
    public string Control { get; set; } = "operator";
    public string ControlNote { get; set; } = string.Empty;
    public decimal? OverallRating { get; set; }
    public string OverallMood { get; set; } = "none";
    public bool HasRating { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = string.Empty;

    // Offline manual (virtual) — delivery still operator-entered when no receive history
    public string? Delivery { get; set; }
    public string Notes { get; set; } = string.Empty;

    public OnlineOrderAcceptanceDto? OrderAcceptance { get; set; }
    public OnlinePoAcceptanceDto? PoAcceptance { get; set; }
    public OnlineProductAccuracyDto? ProductAccuracy { get; set; }
    public CustomerInputAverageDto? ProductQuality { get; set; }
    public CustomerInputAverageDto? HygieneCleanliness { get; set; }
    public List<TemperatureReadingDto> TemperatureReadings { get; set; } = [];
}

public class VendorRatingService(BisyncDbContext db)
{
    public async Task<List<VendorRatingSummaryDto>> GetSummariesAsync(CancellationToken ct = default)
    {
        var vendors = await db.Vendors.AsNoTracking()
            .Select(v => new { v.ExternalId, v.Name, v.Type })
            .ToListAsync(ct);

        var metricsByName = await BuildVendorMetricsAsync(vendors.Select(v => v.Name).ToList(), ct);
        var offlineRows = await db.VendorRatings.AsNoTracking().ToListAsync(ct);
        var offlineByVendor = offlineRows
            .GroupBy(r => r.VendorExternalId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAt).First(), StringComparer.OrdinalIgnoreCase);

        var result = new List<VendorRatingSummaryDto>();
        foreach (var v in vendors)
        {
            var online = VendorRatingRules.IsOnlineVendor(v.Type);
            metricsByName.TryGetValue(NormalizeName(v.Name), out var metrics);
            metrics ??= VendorMetrics.Empty;

            decimal? overall;
            if (online)
            {
                overall = metrics.OverallPercent;
            }
            else
            {
                var scores = new List<decimal>();
                if (offlineByVendor.TryGetValue(v.ExternalId, out var row))
                {
                    var d = VendorRatingRules.CustomerLevelScore(row.Delivery);
                    if (d.HasValue) scores.Add(d.Value);
                }
                if (metrics.ProductQuality.AveragePercent is decimal q) scores.Add(q);
                if (metrics.Hygiene.AveragePercent is decimal h) scores.Add(h);
                if (metrics.ProductAccuracy.AveragePercent is decimal a) scores.Add(a);
                overall = VendorRatingRules.AverageScores(scores);
            }

            result.Add(new VendorRatingSummaryDto
            {
                VendorExternalId = v.ExternalId,
                VendorType = (v.Type ?? "offline").Trim().ToLowerInvariant(),
                VendorKind = online ? "online" : "offline",
                OverallRating = overall,
                HasRating = overall.HasValue,
                Control = online ? "vendor" : "operator",
                OverallMood = VendorRatingRules.MoodFromAverage(overall),
            });
        }

        return result;
    }

    public async Task<VendorRatingDetailDto?> GetDetailAsync(string vendorExternalId, CancellationToken ct = default)
    {
        var vendor = await db.Vendors.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ExternalId == vendorExternalId, ct);
        if (vendor is null) return null;

        var metricsByName = await BuildVendorMetricsAsync([vendor.Name], ct);
        metricsByName.TryGetValue(NormalizeName(vendor.Name), out var metrics);
        metrics ??= VendorMetrics.Empty;

        var online = VendorRatingRules.IsOnlineVendor(vendor.Type);
        if (online)
        {
            return new VendorRatingDetailDto
            {
                VendorExternalId = vendor.ExternalId,
                VendorName = vendor.Name,
                VendorType = "online",
                VendorKindLabel = "Online Vendor",
                Control = "vendor",
                ControlNote = "Online (cloud) vendor — order/PO/product accuracy are system-tracked. Product quality, hygiene, and temperature are captured on receive / consolidate.",
                OverallRating = metrics.OverallPercent,
                OverallMood = VendorRatingRules.MoodFromAverage(metrics.OverallPercent),
                HasRating = metrics.OverallPercent.HasValue,
                OrderAcceptance = metrics.OrderAcceptance,
                PoAcceptance = metrics.PoAcceptance,
                ProductAccuracy = metrics.ProductAccuracy,
                ProductQuality = metrics.ProductQuality,
                HygieneCleanliness = metrics.Hygiene,
                TemperatureReadings = metrics.Temperatures,
            };
        }

        var row = await db.VendorRatings.AsNoTracking()
            .Where(r => r.VendorExternalId == vendor.ExternalId)
            .OrderByDescending(r => r.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        var scores = new List<decimal>();
        var deliveryScore = VendorRatingRules.CustomerLevelScore(row?.Delivery);
        if (deliveryScore.HasValue) scores.Add(deliveryScore.Value);
        if (metrics.ProductQuality.AveragePercent is decimal q) scores.Add(q);
        if (metrics.Hygiene.AveragePercent is decimal h) scores.Add(h);
        if (metrics.ProductAccuracy.AveragePercent is decimal a) scores.Add(a);
        var overall = VendorRatingRules.AverageScores(scores);

        return new VendorRatingDetailDto
        {
            VendorExternalId = vendor.ExternalId,
            VendorName = vendor.Name,
            VendorType = "offline",
            VendorKindLabel = "Offline Vendor",
            Control = "operator",
            ControlNote = "Offline (virtual) vendor — delivery can be set manually; quality, hygiene, and temperature come from receive / consolidate.",
            OverallRating = overall,
            OverallMood = VendorRatingRules.MoodFromAverage(overall),
            HasRating = overall.HasValue,
            UpdatedAt = row?.UpdatedAt,
            UpdatedBy = row?.UpdatedBy ?? string.Empty,
            Delivery = string.IsNullOrWhiteSpace(row?.Delivery) ? null : row!.Delivery,
            Notes = row?.Notes ?? string.Empty,
            ProductAccuracy = metrics.ProductAccuracy,
            ProductQuality = metrics.ProductQuality,
            HygieneCleanliness = metrics.Hygiene,
            TemperatureReadings = metrics.Temperatures,
        };
    }

    public async Task<VendorRatingDetailDto?> UpsertOfflineAsync(
        string vendorExternalId,
        string? delivery,
        string? productAccuracy,
        string? productQuality,
        string? hygieneCleanliness,
        string? notes,
        string updatedBy,
        int? companyId,
        CancellationToken ct = default)
    {
        var vendor = await db.Vendors.FirstOrDefaultAsync(v => v.ExternalId == vendorExternalId, ct);
        if (vendor is null) return null;
        if (VendorRatingRules.IsOnlineVendor(vendor.Type))
            throw new InvalidOperationException("Online (cloud) vendor ratings are system-tracked and cannot be edited here.");

        var d = VendorRatingRules.NormalizeCustomerLevel(delivery)
            ?? throw new ArgumentException("Delivery must be satisfied, acceptable, or poor.");

        // Quality/hygiene are captured on receive; keep optional legacy fields if still posted.
        var row = await db.VendorRatings
            .Where(r => r.VendorExternalId == vendorExternalId)
            .OrderByDescending(r => r.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            row = new VendorRating
            {
                VendorExternalId = vendorExternalId,
                CompanyId = companyId ?? vendor.CompanyId,
            };
            db.VendorRatings.Add(row);
        }

        row.Delivery = d;
        var pq = VendorRatingRules.NormalizeCustomerLevel(productQuality);
        var hy = VendorRatingRules.NormalizeCustomerLevel(hygieneCleanliness);
        var pa = VendorRatingRules.NormalizeCustomerLevel(productAccuracy);
        if (pq is not null) row.ProductQuality = pq;
        if (hy is not null) row.HygieneCleanliness = hy;
        if (pa is not null) row.ProductAccuracy = pa;
        row.Notes = (notes ?? string.Empty).Trim();
        row.UpdatedBy = (updatedBy ?? string.Empty).Trim();
        row.UpdatedAt = DateTime.UtcNow;
        if (companyId is > 0) row.CompanyId = companyId;

        await db.SaveChangesAsync(ct);
        return await GetDetailAsync(vendorExternalId, ct);
    }

    sealed class VendorMetrics
    {
        public static VendorMetrics Empty { get; } = new();
        public OnlineOrderAcceptanceDto OrderAcceptance { get; set; } = new();
        public OnlinePoAcceptanceDto PoAcceptance { get; set; } = new();
        public OnlineProductAccuracyDto ProductAccuracy { get; set; } = new();
        public CustomerInputAverageDto ProductQuality { get; set; } = new();
        public CustomerInputAverageDto Hygiene { get; set; } = new();
        public List<TemperatureReadingDto> Temperatures { get; set; } = [];
        public decimal? OverallPercent { get; set; }
    }

    static string NormalizeName(string name) => name.Trim().ToLowerInvariant();

    async Task<Dictionary<string, VendorMetrics>> BuildVendorMetricsAsync(List<string> vendorNames, CancellationToken ct)
    {
        var result = new Dictionary<string, VendorMetrics>(StringComparer.OrdinalIgnoreCase);
        if (vendorNames.Count == 0) return result;

        var nameSet = vendorNames.Select(NormalizeName).Where(n => n.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var orders = await db.PurchaseOrders.AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.DocumentType == "PO")
            .ToListAsync(ct);

        foreach (var order in orders)
        {
            var key = NormalizeName(order.VendorName);
            if (!nameSet.Contains(key)) continue;
            if (!result.TryGetValue(key, out var metrics))
            {
                metrics = new VendorMetrics();
                result[key] = metrics;
            }

            AccumulateOrderAcceptance(metrics.OrderAcceptance, order);
            AccumulatePoAndAccuracy(metrics, order);
            AccumulateCustomerInput(metrics, order);
            AccumulateTemperatures(metrics, order);
        }

        foreach (var metrics in result.Values)
        {
            FinalizeOrderAcceptance(metrics.OrderAcceptance);
            FinalizePoAcceptance(metrics.PoAcceptance);
            FinalizeProductAccuracy(metrics.ProductAccuracy);
            FinalizeCustomerInput(metrics.ProductQuality);
            FinalizeCustomerInput(metrics.Hygiene);

            var scores = new List<decimal>();
            if (metrics.OrderAcceptance.AveragePercent is decimal oa) scores.Add(oa);
            if (metrics.PoAcceptance.AveragePercent is decimal pa) scores.Add(pa);
            if (metrics.ProductAccuracy.AveragePercent is decimal acc) scores.Add(acc);
            if (metrics.ProductQuality.AveragePercent is decimal q) scores.Add(q);
            if (metrics.Hygiene.AveragePercent is decimal h) scores.Add(h);
            metrics.OverallPercent = VendorRatingRules.AverageScores(scores);
            metrics.Temperatures = metrics.Temperatures
                .OrderByDescending(t => t.RecordedAt)
                .Take(40)
                .ToList();
        }

        return result;
    }

    static void AccumulateOrderAcceptance(OnlineOrderAcceptanceDto dto, PurchaseOrder order)
    {
        if (order.VendorAcceptedAt is null) return;
        dto.OrderCount++;
        var start = order.ApprovedAt ?? order.VendorAcceptedAt.Value.AddHours(-1);
        var hours = (order.VendorAcceptedAt.Value - start).TotalHours;
        if (hours <= 4) dto.Within4Hours.Count++;
        else if (hours <= 8) dto.Within8Hours.Count++;
        else dto.Beyond9Hours.Count++;
    }

    static void FinalizeOrderAcceptance(OnlineOrderAcceptanceDto dto)
    {
        dto.Within4Hours.ScorePercent = VendorRatingRules.ScoreFull;
        dto.Within4Hours.Weight = dto.Within4Hours.Count;
        dto.Within8Hours.ScorePercent = VendorRatingRules.ScoreGood;
        dto.Within8Hours.Weight = dto.Within8Hours.Count;
        dto.Beyond9Hours.ScorePercent = VendorRatingRules.ScoreLow;
        dto.Beyond9Hours.Weight = dto.Beyond9Hours.Count;

        var scores = new List<decimal>();
        for (var i = 0; i < dto.Within4Hours.Count; i++) scores.Add(VendorRatingRules.ScoreFull);
        for (var i = 0; i < dto.Within8Hours.Count; i++) scores.Add(VendorRatingRules.ScoreGood);
        for (var i = 0; i < dto.Beyond9Hours.Count; i++) scores.Add(VendorRatingRules.ScoreLow);
        dto.AveragePercent = VendorRatingRules.AverageScores(scores);
        dto.Mood = VendorRatingRules.MoodFromAverage(dto.AveragePercent);
    }

    static void AccumulatePoAndAccuracy(VendorMetrics metrics, PurchaseOrder order)
    {
        if (order.ReceivedAt is null && order.ReconciledAt is null) return;
        var items = order.Items?.ToList() ?? [];
        if (items.Count == 0) return;

        metrics.PoAcceptance.OrderCount++;
        metrics.ProductAccuracy.OrderCount++;

        var anyZeroQty = false;
        var anyQtyOrPriceChange = false;
        var changedLines = 0;

        foreach (var item in items)
        {
            var receivedQty = item.ReconciledQuantity ?? item.ReceivedQuantity ?? item.Quantity;
            var receivedPrice = item.ReconciledUnitPrice ?? item.ReceivedUnitPrice ?? item.UnitPrice;
            var qtyChanged = Math.Abs(receivedQty - item.Quantity) > 0.0001m;
            var priceChanged = Math.Abs(receivedPrice - item.UnitPrice) > 0.0001m;

            if (receivedQty == 0) anyZeroQty = true;
            if (qtyChanged || priceChanged)
            {
                anyQtyOrPriceChange = true;
                changedLines++;
            }
        }

        if (anyZeroQty)
            metrics.PoAcceptance.QuantityZeroOutOfStock.Count++;
        else if (anyQtyOrPriceChange)
            metrics.PoAcceptance.WithQuantityOrPriceChange.Count++;
        else
            metrics.PoAcceptance.WithoutChanges.Count++;

        var accuracyScore = VendorRatingRules.ProductAccuracyScore(items.Count, changedLines);
        if (accuracyScore == VendorRatingRules.ScoreFull)
            metrics.ProductAccuracy.WithoutChanges.Count++;
        else if (accuracyScore == VendorRatingRules.ScoreGood)
            metrics.ProductAccuracy.ChangedLinesUnder30Pct.Count++;
        else
            metrics.ProductAccuracy.ChangedLinesOver30Pct.Count++;
    }

    static void FinalizePoAcceptance(OnlinePoAcceptanceDto dto)
    {
        dto.WithoutChanges.ScorePercent = VendorRatingRules.ScoreFull;
        dto.WithQuantityOrPriceChange.ScorePercent = VendorRatingRules.ScoreGood;
        dto.QuantityZeroOutOfStock.ScorePercent = VendorRatingRules.ScoreLow;

        var scores = new List<decimal>();
        for (var i = 0; i < dto.WithoutChanges.Count; i++) scores.Add(VendorRatingRules.ScoreFull);
        for (var i = 0; i < dto.WithQuantityOrPriceChange.Count; i++) scores.Add(VendorRatingRules.ScoreGood);
        for (var i = 0; i < dto.QuantityZeroOutOfStock.Count; i++) scores.Add(VendorRatingRules.ScoreLow);
        dto.AveragePercent = VendorRatingRules.AverageScores(scores);
    }

    static void FinalizeProductAccuracy(OnlineProductAccuracyDto dto)
    {
        dto.WithoutChanges.ScorePercent = VendorRatingRules.ScoreFull;
        dto.ChangedLinesUnder30Pct.ScorePercent = VendorRatingRules.ScoreGood;
        dto.ChangedLinesOver30Pct.ScorePercent = VendorRatingRules.ScoreLow;

        var scores = new List<decimal>();
        for (var i = 0; i < dto.WithoutChanges.Count; i++) scores.Add(VendorRatingRules.ScoreFull);
        for (var i = 0; i < dto.ChangedLinesUnder30Pct.Count; i++) scores.Add(VendorRatingRules.ScoreGood);
        for (var i = 0; i < dto.ChangedLinesOver30Pct.Count; i++) scores.Add(VendorRatingRules.ScoreLow);
        dto.AveragePercent = VendorRatingRules.AverageScores(scores);
    }

    static void AccumulateCustomerInput(VendorMetrics metrics, PurchaseOrder order)
    {
        if (order.ReceivedAt is null && order.ReconciledAt is null) return;

        var quality = VendorRatingRules.NormalizeCustomerLevel(order.ProductQualityRating);
        if (quality is not null)
        {
            metrics.ProductQuality.ResponseCount++;
            if (quality == VendorRatingRules.LevelSatisfied) metrics.ProductQuality.Satisfied++;
            else if (quality == VendorRatingRules.LevelAcceptable) metrics.ProductQuality.Acceptable++;
            else metrics.ProductQuality.Poor++;
        }

        var hygiene = VendorRatingRules.NormalizeCustomerLevel(order.HygieneRating);
        if (hygiene is not null)
        {
            metrics.Hygiene.ResponseCount++;
            if (hygiene == VendorRatingRules.LevelSatisfied) metrics.Hygiene.Satisfied++;
            else if (hygiene == VendorRatingRules.LevelAcceptable) metrics.Hygiene.Acceptable++;
            else metrics.Hygiene.Poor++;
        }
    }

    static void FinalizeCustomerInput(CustomerInputAverageDto dto)
    {
        var scores = new List<decimal>();
        for (var i = 0; i < dto.Satisfied; i++) scores.Add(VendorRatingRules.ScoreFull);
        for (var i = 0; i < dto.Acceptable; i++) scores.Add(VendorRatingRules.ScoreGood);
        for (var i = 0; i < dto.Poor; i++) scores.Add(VendorRatingRules.ScoreLow);
        dto.AveragePercent = VendorRatingRules.AverageScores(scores);
    }

    static void AccumulateTemperatures(VendorMetrics metrics, PurchaseOrder order)
    {
        if (order.Items is null) return;
        foreach (var item in order.Items)
        {
            if (item.ReceivedTemperature is null) continue;
            metrics.Temperatures.Add(new TemperatureReadingDto
            {
                PoNumber = order.PoNumber,
                ProductName = string.IsNullOrWhiteSpace(item.Name) ? item.ComponentName : item.Name,
                VendorProductId = item.VendorProductId,
                Temperature = item.ReceivedTemperature.Value,
                RecordedAt = order.ReconciledAt ?? order.ReceivedAt,
            });
        }
    }
}
