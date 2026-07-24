using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

public sealed class NutritionLibrarySyncService(
    BisyncDbContext db,
    IHttpClientFactory httpClientFactory,
    IOptions<NutritionLibraryOptions> options,
    ILogger<NutritionLibrarySyncService> logger)
{
    public const string SourceFoundation = "foundation";
    public const string SourceSrLegacy = "sr_legacy";

    static readonly HashSet<int> NutrientIds =
    [
        1008, // Energy kcal
        1003, // Protein
        1005, // Carbohydrate by difference
        2000, // Total Sugars
        1063, // Sugars, Total (alt)
        1079, // Fiber total dietary
        1004, // Total lipid (fat)
        1258, // Saturated fat
        1093, // Sodium
        1253, // Cholesterol
    ];

    public async Task<NutritionLibraryMeta> GetStatusAsync(CancellationToken ct = default)
    {
        var meta = await db.NutritionLibraryMeta.AsNoTracking().FirstOrDefaultAsync(ct);
        if (meta is not null) return meta;
        return new NutritionLibraryMeta
        {
            LastSyncStatus = "never",
            SourceLabel = "USDA FoodData Central (Foundation Foods + SR Legacy)",
            Citation = "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.",
        };
    }

    /// <summary>
    /// Downloads Foundation Foods + SR Legacy CSVs, rebuilds the library table,
    /// and marks product estimates stale when content changed.
    /// </summary>
    public async Task<NutritionLibraryMeta> SyncAsync(bool force = false, CancellationToken ct = default)
    {
        var opts = options.Value;
        var workDir = Path.Combine(Path.GetTempPath(), "bisync-nutrition-library");
        Directory.CreateDirectory(workDir);

        var meta = await db.NutritionLibraryMeta.FirstOrDefaultAsync(ct)
            ?? new NutritionLibraryMeta { Id = 1 };
        if (meta.Id == 0) meta.Id = 1;
        meta.LastCheckedAt = DateTime.UtcNow;
        meta.LastSyncStatus = "running";
        meta.LastSyncError = string.Empty;

        if (db.NutritionLibraryMeta.Local.All(m => m.Id != meta.Id)
            && !await db.NutritionLibraryMeta.AnyAsync(m => m.Id == meta.Id, ct))
            db.NutritionLibraryMeta.Add(meta);

        await db.SaveChangesAsync(ct);

        try
        {
            var client = httpClientFactory.CreateClient("nutrition-library");
            client.Timeout = TimeSpan.FromMinutes(10);

            var foundationZip = Path.Combine(workDir, "foundation.zip");
            var srZip = Path.Combine(workDir, "sr_legacy.zip");
            await DownloadAsync(client, opts.FoundationZipUrl, foundationZip, ct);
            await DownloadAsync(client, opts.SrLegacyZipUrl, srZip, ct);

            var foundationDir = Path.Combine(workDir, "foundation");
            var srDir = Path.Combine(workDir, "sr_legacy");
            ExtractZip(foundationZip, foundationDir);
            ExtractZip(srZip, srDir);

            var foundationFoodCsv = FindCsv(foundationDir, "food.csv");
            var foundationNutrientCsv = FindCsv(foundationDir, "food_nutrient.csv");
            var foundationOnlyCsv = FindCsv(foundationDir, "foundation_food.csv");
            var srFoodCsv = FindCsv(srDir, "food.csv");
            var srNutrientCsv = FindCsv(srDir, "food_nutrient.csv");

            var foods = new Dictionary<long, NutritionLibraryFood>();

            // Prefer Foundation Foods (lab-analyzed).
            var foundationIds = LoadFoundationIds(foundationOnlyCsv);
            await LoadFoodsAsync(
                foods,
                foundationFoodCsv,
                foundationNutrientCsv,
                SourceFoundation,
                allowedIds: foundationIds,
                preferOverwrite: true,
                ct);

            // Fill gaps from SR Legacy.
            await LoadFoodsAsync(
                foods,
                srFoodCsv,
                srNutrientCsv,
                SourceSrLegacy,
                allowedIds: null,
                preferOverwrite: false,
                ct);

            // Prefer foundation over SR when normalized names collide.
            var byName = new Dictionary<string, NutritionLibraryFood>(StringComparer.Ordinal);
            foreach (var food in foods.Values.OrderBy(f => f.Source == SourceFoundation ? 0 : 1))
            {
                if (string.IsNullOrWhiteSpace(food.NormalizedName)) continue;
                if (!byName.ContainsKey(food.NormalizedName))
                    byName[food.NormalizedName] = food;
            }
            foods = byName.Values.ToDictionary(f => f.FdcId);

            var version = BuildVersion(foundationZip, srZip, foods.Count);
            var changed = !string.Equals(meta.Version, version, StringComparison.Ordinal)
                || force
                || !await db.NutritionLibraryFoods.AnyAsync(ct);

            if (changed)
            {
                await using var tx = await db.Database.BeginTransactionAsync(ct);
                await db.NutritionLibraryFoods.ExecuteDeleteAsync(ct);
                await db.NutritionLibraryFoods.AddRangeAsync(foods.Values, ct);

                meta.Version = version;
                meta.EntryCount = foods.Count;
                meta.SourceLabel = "USDA FoodData Central (Foundation Foods + SR Legacy)";
                meta.Citation =
                    "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. Foundation Foods and SR Legacy.";
                meta.Basis = "per 100 g edible portion";
                meta.LastSyncedAt = DateTime.UtcNow;
                meta.LastSyncStatus = "ok";
                meta.ChangedOnLastSync = true;
                meta.LastSyncError = string.Empty;
                await db.SaveChangesAsync(ct);

                await db.ProductNutrientEstimates
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.IsStale, true), ct);

                await tx.CommitAsync(ct);
                logger.LogInformation(
                    "Nutrition library synced: {Count} foods, version {Version}",
                    foods.Count,
                    version);
            }
            else
            {
                meta.LastSyncedAt = DateTime.UtcNow;
                meta.LastSyncStatus = "ok";
                meta.ChangedOnLastSync = false;
                meta.LastSyncError = string.Empty;
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Nutrition library unchanged (version {Version}).", version);
            }

            return meta;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Nutrition library sync failed.");
            meta.LastSyncStatus = "error";
            meta.LastSyncError = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
            meta.ChangedOnLastSync = false;
            await db.SaveChangesAsync(ct);
            throw;
        }
    }

    static async Task DownloadAsync(HttpClient client, string url, string path, CancellationToken ct)
    {
        await using var remote = await client.GetStreamAsync(url, ct);
        await using var file = File.Create(path);
        await remote.CopyToAsync(file, ct);
    }

    static void ExtractZip(string zipPath, string destDir)
    {
        if (Directory.Exists(destDir))
            Directory.Delete(destDir, recursive: true);
        Directory.CreateDirectory(destDir);
        ZipFile.ExtractToDirectory(zipPath, destDir);
    }

    static string FindCsv(string root, string fileName)
    {
        var match = Directory.EnumerateFiles(root, fileName, SearchOption.AllDirectories).FirstOrDefault();
        if (match is null)
            throw new InvalidOperationException($"Could not find {fileName} under {root}.");
        return match;
    }

    static HashSet<long> LoadFoundationIds(string foundationFoodCsv)
    {
        var ids = new HashSet<long>();
        using var reader = new StreamReader(foundationFoodCsv);
        var header = reader.ReadLine();
        if (header is null) return ids;
        var cols = SplitCsv(header);
        var fdcIdx = IndexOf(cols, "fdc_id");
        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            var parts = SplitCsv(line);
            if (fdcIdx < parts.Count && long.TryParse(parts[fdcIdx], out var id))
                ids.Add(id);
        }
        return ids;
    }

    static async Task LoadFoodsAsync(
        Dictionary<long, NutritionLibraryFood> foods,
        string foodCsv,
        string nutrientCsv,
        string source,
        HashSet<long>? allowedIds,
        bool preferOverwrite,
        CancellationToken ct)
    {
        var descriptions = new Dictionary<long, (string Description, string? Ndb)>();
        using (var reader = new StreamReader(foodCsv))
        {
            var header = await reader.ReadLineAsync(ct) ?? throw new InvalidOperationException("Empty food.csv");
            var cols = SplitCsv(header);
            var fdcIdx = IndexOf(cols, "fdc_id");
            var descIdx = IndexOf(cols, "description");
            var typeIdx = IndexOf(cols, "data_type");
            string? line;
            while ((line = await reader.ReadLineAsync(ct)) is not null)
            {
                var parts = SplitCsv(line);
                if (fdcIdx >= parts.Count || descIdx >= parts.Count) continue;
                if (!long.TryParse(parts[fdcIdx], out var fdcId)) continue;
                if (allowedIds is not null && !allowedIds.Contains(fdcId)) continue;
                if (allowedIds is null && typeIdx >= 0 && typeIdx < parts.Count)
                {
                    var dataType = parts[typeIdx];
                    if (!string.Equals(dataType, "sr_legacy_food", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(dataType, "foundation_food", StringComparison.OrdinalIgnoreCase))
                        continue;
                }

                var description = parts[descIdx].Trim();
                if (string.IsNullOrWhiteSpace(description)) continue;
                descriptions[fdcId] = (description, null);
            }
        }

        var nutrients = new Dictionary<long, Dictionary<int, decimal>>();
        using (var reader = new StreamReader(nutrientCsv))
        {
            var header = await reader.ReadLineAsync(ct) ?? throw new InvalidOperationException("Empty food_nutrient.csv");
            var cols = SplitCsv(header);
            var fdcIdx = IndexOf(cols, "fdc_id");
            var nutrientIdx = IndexOf(cols, "nutrient_id");
            var amountIdx = IndexOf(cols, "amount");
            string? line;
            while ((line = await reader.ReadLineAsync(ct)) is not null)
            {
                var parts = SplitCsv(line);
                if (fdcIdx >= parts.Count || nutrientIdx >= parts.Count || amountIdx >= parts.Count) continue;
                if (!long.TryParse(parts[fdcIdx], out var fdcId)) continue;
                if (!descriptions.ContainsKey(fdcId)) continue;
                if (!int.TryParse(parts[nutrientIdx], out var nutrientId) || !NutrientIds.Contains(nutrientId))
                    continue;
                if (!decimal.TryParse(parts[amountIdx], NumberStyles.Float, CultureInfo.InvariantCulture, out var amount))
                    continue;

                if (!nutrients.TryGetValue(fdcId, out var map))
                {
                    map = new Dictionary<int, decimal>();
                    nutrients[fdcId] = map;
                }

                // Prefer first non-zero / keep existing unless missing.
                if (!map.ContainsKey(nutrientId))
                    map[nutrientId] = amount;
            }
        }

        var now = DateTime.UtcNow;
        foreach (var (fdcId, (description, ndb)) in descriptions)
        {
            if (!preferOverwrite && foods.ContainsKey(fdcId))
                continue;

            // Prefer foundation description over SR when names collide on normalized key later.
            nutrients.TryGetValue(fdcId, out var map);
            map ??= new Dictionary<int, decimal>();

            var food = new NutritionLibraryFood
            {
                FdcId = fdcId,
                Source = source,
                Description = Truncate(description, 400),
                NormalizedName = Truncate(NormalizeName(description), 400),
                NdbNumber = ndb,
                EnergyKcal = GetNutrient(map, 1008),
                ProteinG = GetNutrient(map, 1003),
                CarbG = GetNutrient(map, 1005),
                SugarsG = GetNutrient(map, 2000, 1063),
                FiberG = GetNutrient(map, 1079),
                FatG = GetNutrient(map, 1004),
                SatFatG = GetNutrient(map, 1258),
                SodiumMg = GetNutrient(map, 1093),
                CholesterolMg = GetNutrient(map, 1253),
                UpdatedAt = now,
            };

            if (preferOverwrite || !foods.ContainsKey(fdcId))
                foods[fdcId] = food;
        }
    }

    static decimal GetNutrient(Dictionary<int, decimal> map, params int[] ids)
    {
        foreach (var id in ids)
        {
            if (map.TryGetValue(id, out var value))
                return decimal.Round(value, 4);
        }
        return 0;
    }

    static string BuildVersion(string foundationZip, string srZip, int count)
    {
        using var sha = SHA256.Create();
        var payload = $"{Path.GetFileName(foundationZip)}|{new FileInfo(foundationZip).Length}|{Path.GetFileName(srZip)}|{new FileInfo(srZip).Length}|{count}";
        var hash = Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(payload)))[..16];
        return $"fdc-{count}-{hash.ToLowerInvariant()}";
    }

    public static string NormalizeName(string value)
    {
        var s = value.ToLowerInvariant();
        s = Regex.Replace(s, @"[^a-z0-9\s]", " ");
        s = Regex.Replace(s, @"\s+", " ").Trim();
        return s;
    }

    static string Truncate(string value, int maxLen) =>
        value.Length <= maxLen ? value : value[..maxLen];

    static int IndexOf(IReadOnlyList<string> cols, string name)
    {
        for (var i = 0; i < cols.Count; i++)
        {
            if (string.Equals(cols[i].Trim().Trim('"'), name, StringComparison.OrdinalIgnoreCase))
                return i;
        }
        throw new InvalidOperationException($"Column '{name}' not found.");
    }

    static List<string> SplitCsv(string line)
    {
        var result = new List<string>();
        var sb = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    sb.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch == ',' && !inQuotes)
            {
                result.Add(sb.ToString());
                sb.Clear();
                continue;
            }

            sb.Append(ch);
        }
        result.Add(sb.ToString());
        return result;
    }
}
