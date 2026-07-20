using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class VendorRatingRules
{
    public const string LevelSatisfied = "satisfied";
    public const string LevelAcceptable = "acceptable";
    public const string LevelUnsatisfied = "unsatisfied";

    public static readonly string[] Levels = [LevelSatisfied, LevelAcceptable, LevelUnsatisfied];

    public static bool IsOnlineVendor(string? type) =>
        string.Equals((type ?? "").Trim(), "online", StringComparison.OrdinalIgnoreCase);

    public static bool IsOfflineVendor(string? type) => !IsOnlineVendor(type);

    public static string? NormalizeLevel(string? raw)
    {
        var v = (raw ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(v)) return null;
        return Levels.Contains(v) ? v : null;
    }

    public static decimal? LevelScore(string? level) => NormalizeLevel(level) switch
    {
        LevelSatisfied => 5m,
        LevelAcceptable => 3m,
        LevelUnsatisfied => 1m,
        _ => null,
    };

    public static decimal? AverageOverall(params string?[] levels)
    {
        var scores = levels.Select(LevelScore).Where(s => s.HasValue).Select(s => s!.Value).ToList();
        if (scores.Count == 0) return null;
        return Math.Round(scores.Average(), 1, MidpointRounding.AwayFromZero);
    }

    public static decimal? OnlineOverallFromBuckets(
        int within4h, int within8h, int beyond9h,
        int acceptYes, int acceptNo, int qtyChange, int priceChange, int withoutChanges)
    {
        var speedScores = new List<decimal>();
        for (var i = 0; i < within4h; i++) speedScores.Add(5m);
        for (var i = 0; i < within8h; i++) speedScores.Add(3m);
        for (var i = 0; i < beyond9h; i++) speedScores.Add(1m);

        var acceptScores = new List<decimal>();
        for (var i = 0; i < withoutChanges; i++) acceptScores.Add(5m);
        for (var i = 0; i < acceptYes; i++) acceptScores.Add(5m);
        for (var i = 0; i < qtyChange; i++) acceptScores.Add(3m);
        for (var i = 0; i < priceChange; i++) acceptScores.Add(3m);
        for (var i = 0; i < acceptNo; i++) acceptScores.Add(1m);

        var all = speedScores.Concat(acceptScores).ToList();
        if (all.Count == 0) return null;
        return Math.Round(all.Average(), 1, MidpointRounding.AwayFromZero);
    }
}

public sealed class VendorRatingSummaryDto
{
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorType { get; set; } = "offline";
    public string VendorKind { get; set; } = "offline"; // online | offline (API alias)
    public decimal? OverallRating { get; set; }
    public bool HasRating { get; set; }
    public string Control { get; set; } = "operator"; // vendor | operator
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
    public bool HasRating { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = string.Empty;

    // Offline / Virtual — client input
    public string? Delivery { get; set; }
    public string? ProductAccuracy { get; set; }
    public string? ProductQuality { get; set; }
    public string? HygieneCleanliness { get; set; }
    public string Notes { get; set; } = string.Empty;

    // Online / Cloud — system generated
    public OnlineOrderAcceptedDto? OrderAccepted { get; set; }
    public OnlinePoAcceptanceDto? PoAcceptance { get; set; }
    public bool OnlineRelationshipPending { get; set; }
}

public sealed class OnlineOrderAcceptedDto
{
    public int Within4Hours { get; set; }
    public int Within8Hours { get; set; }
    public int Beyond9Hours { get; set; }
    public int Total { get; set; }
}

public sealed class OnlinePoAcceptanceDto
{
    public int Yes { get; set; }
    public int No { get; set; }
    public int AcceptWithQuantityChange { get; set; }
    public int AcceptWithPriceChange { get; set; }
    public int AcceptWithoutChanges { get; set; }
    public int Total { get; set; }
}

public class VendorRatingService(BisyncDbContext db)
{
    public async Task<List<VendorRatingSummaryDto>> GetSummariesAsync(CancellationToken ct = default)
    {
        var vendors = await db.Vendors.AsNoTracking()
            .Select(v => new { v.ExternalId, v.Name, v.Type })
            .ToListAsync(ct);
        var ratings = await db.VendorRatings.AsNoTracking().ToListAsync(ct);
        var ratingsByVendor = ratings
            .GroupBy(r => r.VendorExternalId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAt).First(), StringComparer.OrdinalIgnoreCase);

        var onlineBuckets = await BuildOnlineBucketsAsync(vendors.Select(v => v.Name).ToList(), ct);

        var result = new List<VendorRatingSummaryDto>();
        foreach (var v in vendors)
        {
            var online = VendorRatingRules.IsOnlineVendor(v.Type);
            decimal? overall = null;
            var has = false;

            if (online)
            {
                onlineBuckets.TryGetValue(NormalizeName(v.Name), out var bucket);
                bucket ??= OnlineBucket.Empty;
                overall = VendorRatingRules.OnlineOverallFromBuckets(
                    bucket.Within4h, bucket.Within8h, bucket.Beyond9h,
                    bucket.Yes, bucket.No, bucket.QtyChange, bucket.PriceChange, bucket.WithoutChanges);
                has = overall.HasValue;
            }
            else if (ratingsByVendor.TryGetValue(v.ExternalId, out var row))
            {
                overall = VendorRatingRules.AverageOverall(
                    row.Delivery, row.ProductAccuracy, row.ProductQuality, row.HygieneCleanliness);
                has = overall.HasValue;
            }

            result.Add(new VendorRatingSummaryDto
            {
                VendorExternalId = v.ExternalId,
                VendorType = (v.Type ?? "offline").Trim().ToLowerInvariant(),
                VendorKind = online ? "online" : "offline",
                OverallRating = overall,
                HasRating = has,
                Control = online ? "vendor" : "operator",
            });
        }

        return result;
    }

    public async Task<VendorRatingDetailDto?> GetDetailAsync(string vendorExternalId, CancellationToken ct = default)
    {
        var vendor = await db.Vendors.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ExternalId == vendorExternalId, ct);
        if (vendor is null) return null;

        var online = VendorRatingRules.IsOnlineVendor(vendor.Type);
        if (online)
        {
            var buckets = await BuildOnlineBucketsAsync([vendor.Name], ct);
            buckets.TryGetValue(NormalizeName(vendor.Name), out var bucket);
            bucket ??= OnlineBucket.Empty;
            var overall = VendorRatingRules.OnlineOverallFromBuckets(
                bucket.Within4h, bucket.Within8h, bucket.Beyond9h,
                bucket.Yes, bucket.No, bucket.QtyChange, bucket.PriceChange, bucket.WithoutChanges);

            return new VendorRatingDetailDto
            {
                VendorExternalId = vendor.ExternalId,
                VendorName = vendor.Name,
                VendorType = "online",
                VendorKindLabel = "Online Vendor",
                Control = "vendor",
                ControlNote = "Cloud vendor — control is in the vendor's hands. Order acceptance measures are system-generated. Full cloud-vendor relationship will be wired later.",
                OverallRating = overall,
                HasRating = overall.HasValue,
                OnlineRelationshipPending = true,
                OrderAccepted = new OnlineOrderAcceptedDto
                {
                    Within4Hours = bucket.Within4h,
                    Within8Hours = bucket.Within8h,
                    Beyond9Hours = bucket.Beyond9h,
                    Total = bucket.Within4h + bucket.Within8h + bucket.Beyond9h,
                },
                PoAcceptance = new OnlinePoAcceptanceDto
                {
                    Yes = bucket.Yes,
                    No = bucket.No,
                    AcceptWithQuantityChange = bucket.QtyChange,
                    AcceptWithPriceChange = bucket.PriceChange,
                    AcceptWithoutChanges = bucket.WithoutChanges,
                    Total = bucket.Yes + bucket.No + bucket.QtyChange + bucket.PriceChange + bucket.WithoutChanges,
                },
            };
        }

        var row = await db.VendorRatings.AsNoTracking()
            .Where(r => r.VendorExternalId == vendor.ExternalId)
            .OrderByDescending(r => r.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        var overallOffline = row is null
            ? null
            : VendorRatingRules.AverageOverall(row.Delivery, row.ProductAccuracy, row.ProductQuality, row.HygieneCleanliness);

        return new VendorRatingDetailDto
        {
            VendorExternalId = vendor.ExternalId,
            VendorName = vendor.Name,
            VendorType = "offline",
            VendorKindLabel = "Offline Vendor",
            Control = "operator",
            ControlNote = "Virtual vendor — not on Bisync Cloud. Control is in the operator's hands; enter client-input measures below.",
            OverallRating = overallOffline,
            HasRating = overallOffline.HasValue,
            UpdatedAt = row?.UpdatedAt,
            UpdatedBy = row?.UpdatedBy ?? string.Empty,
            Delivery = string.IsNullOrWhiteSpace(row?.Delivery) ? null : row!.Delivery,
            ProductAccuracy = string.IsNullOrWhiteSpace(row?.ProductAccuracy) ? null : row!.ProductAccuracy,
            ProductQuality = string.IsNullOrWhiteSpace(row?.ProductQuality) ? null : row!.ProductQuality,
            HygieneCleanliness = string.IsNullOrWhiteSpace(row?.HygieneCleanliness) ? null : row!.HygieneCleanliness,
            Notes = row?.Notes ?? string.Empty,
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
            throw new InvalidOperationException("Online (cloud) vendor ratings are system-generated and cannot be edited by operators.");

        string RequireLevel(string? raw, string field)
        {
            var n = VendorRatingRules.NormalizeLevel(raw);
            if (n is null)
                throw new ArgumentException($"{field} must be satisfied, acceptable, or unsatisfied.");
            return n;
        }

        var d = RequireLevel(delivery, "Delivery");
        var a = RequireLevel(productAccuracy, "Product accuracy");
        var q = RequireLevel(productQuality, "Product quality");
        var h = RequireLevel(hygieneCleanliness, "Hygiene & cleanliness");

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
        row.ProductAccuracy = a;
        row.ProductQuality = q;
        row.HygieneCleanliness = h;
        row.Notes = (notes ?? string.Empty).Trim();
        row.UpdatedBy = (updatedBy ?? string.Empty).Trim();
        row.UpdatedAt = DateTime.UtcNow;
        if (companyId is > 0) row.CompanyId = companyId;

        await db.SaveChangesAsync(ct);
        return await GetDetailAsync(vendorExternalId, ct);
    }

    sealed class OnlineBucket
    {
        public static OnlineBucket Empty { get; } = new();
        public int Within4h { get; set; }
        public int Within8h { get; set; }
        public int Beyond9h { get; set; }
        public int Yes { get; set; }
        public int No { get; set; }
        public int QtyChange { get; set; }
        public int PriceChange { get; set; }
        public int WithoutChanges { get; set; }
    }

    static string NormalizeName(string name) => name.Trim().ToLowerInvariant();

    async Task<Dictionary<string, OnlineBucket>> BuildOnlineBucketsAsync(List<string> vendorNames, CancellationToken ct)
    {
        var result = new Dictionary<string, OnlineBucket>(StringComparer.OrdinalIgnoreCase);
        if (vendorNames.Count == 0) return result;

        var nameSet = vendorNames.Select(NormalizeName).Where(n => n.Length > 0).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var orders = await db.PurchaseOrders.AsNoTracking()
            .Where(o => o.VendorAcceptedAt != null)
            .Select(o => new
            {
                o.VendorName,
                o.ApprovedAt,
                o.VendorAcceptedAt,
                o.ReceivedAt,
            })
            .ToListAsync(ct);

        foreach (var o in orders)
        {
            var key = NormalizeName(o.VendorName);
            if (!nameSet.Contains(key)) continue;
            if (!result.TryGetValue(key, out var bucket))
            {
                bucket = new OnlineBucket();
                result[key] = bucket;
            }

            // Order accepted timing from approval (or order fallback) to vendor accept.
            var start = o.ApprovedAt ?? o.VendorAcceptedAt!.Value.AddHours(-1);
            var hours = (o.VendorAcceptedAt!.Value - start).TotalHours;
            if (hours <= 4) bucket.Within4h++;
            else if (hours <= 8) bucket.Within8h++;
            else bucket.Beyond9h++;

            // Until cloud relationship supports qty/price change acceptances, treat plain accept as Yes.
            bucket.Yes++;
        }

        return result;
    }
}
