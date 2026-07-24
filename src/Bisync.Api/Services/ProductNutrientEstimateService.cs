using System.Globalization;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public sealed class ProductNutrientEstimateService(BisyncDbContext db)
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "and", "with", "from", "the", "for", "raw", "fresh", "cooked", "nfs", "ns",
        "prepared", "plain", "regular", "type", "commercial",
    };

    const int MinMatchScore = 48;

    public async Task<ProductNutrientEstimate?> GetOrCalculateAsync(
        int productId,
        bool force = false,
        CancellationToken ct = default)
    {
        var product = await db.Products
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product is null) return null;

        var existing = await db.ProductNutrientEstimates.FirstOrDefaultAsync(e => e.ProductId == productId, ct);
        var meta = await db.NutritionLibraryMeta.AsNoTracking().FirstOrDefaultAsync(ct);
        var libraryVersion = meta?.Version ?? string.Empty;

        if (!force
            && existing is not null
            && !existing.IsStale
            && string.Equals(existing.LibraryVersion, libraryVersion, StringComparison.Ordinal)
            && !string.IsNullOrWhiteSpace(libraryVersion))
        {
            return existing;
        }

        return await CalculateAndSaveAsync(product, existing, libraryVersion, ct);
    }

    public async Task<ProductNutrientEstimate?> RecalculateForProductAsync(
        int productId,
        CancellationToken ct = default)
    {
        return await GetOrCalculateAsync(productId, force: true, ct);
    }

    async Task<ProductNutrientEstimate> CalculateAndSaveAsync(
        Product product,
        ProductNutrientEstimate? existing,
        string libraryVersion,
        CancellationToken ct)
    {
        var foods = await db.NutritionLibraryFoods.AsNoTracking().ToListAsync(ct);
        var index = foods
            .Select(f => (Norm: f.NormalizedName, Food: f))
            .Where(x => !string.IsNullOrWhiteSpace(x.Norm))
            .ToList();

        var yieldDivisor = product.IsSubProduct && product.YieldQuantity > 0
            ? product.YieldQuantity
            : 1m;

        var totals = new Totals();
        var details = new List<object>();
        var matched = 0;
        var coverageGrams = 0m;
        var items = product.Items
            .Where(i => (!string.IsNullOrWhiteSpace(i.ComponentName) || !string.IsNullOrWhiteSpace(i.ComponentId))
                && i.Quantity > 0)
            .ToList();

        foreach (var item in items)
        {
            var name = string.IsNullOrWhiteSpace(item.ComponentName) ? item.ComponentId : item.ComponentName;
            var grams = QuantityToGrams(item.Quantity, item.ComponentUom);
            var match = FindBestMatch(name, index);

            if (match is { } hit && grams is > 0)
            {
                AddScaled(totals, hit.Food, grams.Value);
                matched++;
                coverageGrams += grams.Value;
                details.Add(new
                {
                    componentId = item.ComponentId,
                    componentName = name,
                    matchedName = hit.Food.Description,
                    fdcId = hit.Food.FdcId,
                    source = hit.Food.Source,
                    matchScore = hit.Score,
                    gramsUsed = decimal.Round(grams.Value, 3),
                });
            }
            else
            {
                details.Add(new
                {
                    componentId = item.ComponentId,
                    componentName = name,
                    matchedName = match?.Food.Description,
                    fdcId = match?.Food.FdcId,
                    source = (string?)null,
                    matchScore = match?.Score ?? 0,
                    gramsUsed = grams,
                    note = grams is null ? "Could not convert UOM to grams" : "No library match",
                });
            }
        }

        var estimate = existing ?? new ProductNutrientEstimate { ProductId = product.Id };
        estimate.EnergyKcal = Round(totals.EnergyKcal / yieldDivisor);
        estimate.ProteinG = Round(totals.ProteinG / yieldDivisor);
        estimate.CarbG = Round(totals.CarbG / yieldDivisor);
        estimate.SugarsG = Round(totals.SugarsG / yieldDivisor);
        estimate.FiberG = Round(totals.FiberG / yieldDivisor);
        estimate.FatG = Round(totals.FatG / yieldDivisor);
        estimate.SatFatG = Round(totals.SatFatG / yieldDivisor);
        estimate.SodiumMg = Round(totals.SodiumMg / yieldDivisor);
        estimate.CholesterolMg = Round(totals.CholesterolMg / yieldDivisor);
        estimate.MatchedCount = matched;
        estimate.TotalCount = items.Count;
        estimate.CoverageGrams = Round(coverageGrams);
        estimate.DetailsJson = JsonSerializer.Serialize(details, JsonOptions);
        estimate.LibraryVersion = libraryVersion;
        estimate.IsStale = false;
        estimate.CalculatedAt = DateTime.UtcNow;

        if (existing is null)
            db.ProductNutrientEstimates.Add(estimate);

        await db.SaveChangesAsync(ct);
        return estimate;
    }

    static (NutritionLibraryFood Food, int Score)? FindBestMatch(
        string componentName,
        List<(string Norm, NutritionLibraryFood Food)> index)
    {
        if (index.Count == 0) return null;
        var query = NutritionLibrarySyncService.NormalizeName(componentName);
        if (string.IsNullOrWhiteSpace(query)) return null;

        NutritionLibraryFood? bestFood = null;
        var bestScore = 0;
        foreach (var (norm, food) in index)
        {
            var score = ScoreMatch(query, norm);
            if (string.Equals(food.Source, NutritionLibrarySyncService.SourceFoundation, StringComparison.OrdinalIgnoreCase))
                score += 5;
            if (score > bestScore)
            {
                bestScore = score;
                bestFood = food;
            }
        }

        if (bestFood is null || bestScore < MinMatchScore) return null;
        return (bestFood, bestScore);
    }

    static int ScoreMatch(string query, string candidate)
    {
        if (query == candidate) return 100;
        if (candidate.StartsWith(query, StringComparison.Ordinal) || query.StartsWith(candidate, StringComparison.Ordinal))
            return 92;
        if (candidate.Contains(query, StringComparison.Ordinal) || query.Contains(candidate, StringComparison.Ordinal))
        {
            var ratio = (double)Math.Min(query.Length, candidate.Length) / Math.Max(query.Length, candidate.Length);
            return (int)(78 + ratio * 12);
        }

        var qt = TokenSet(query);
        var ct = TokenSet(candidate);
        if (qt.Count == 0) return 0;
        var hit = qt.Count(t => ct.Contains(t));
        return (int)((hit / (double)qt.Count) * 72);
    }

    static HashSet<string> TokenSet(string name) =>
        name.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length > 2 && !StopWords.Contains(t))
            .ToHashSet(StringComparer.Ordinal);

    public static decimal? QuantityToGrams(decimal quantity, string? uomRaw)
    {
        if (quantity <= 0) return null;
        var uom = (uomRaw ?? string.Empty).Trim().ToLowerInvariant();
        uom = uom switch
        {
            "gr" or "g" or "gram" or "grams" => "g",
            "kg" or "kgs" => "kg",
            "mg" => "mg",
            "ml" or "milliliter" or "millilitre" => "ml",
            "ltr" or "l" or "liter" or "litre" => "l",
            "oz" => "oz",
            "lb" or "lbs" => "lb",
            "cl" => "cl",
            "floz" or "fl oz" => "floz",
            "tsp" or "teaspoon" => "tsp",
            "tbsp" or "tablespoon" => "tbsp",
            "cup" => "cup",
            _ => uom,
        };

        return uom switch
        {
            "g" => quantity,
            "kg" => quantity * 1000m,
            "mg" => quantity * 0.001m,
            "ml" => quantity, // approx water density
            "cl" => quantity * 10m,
            "l" => quantity * 1000m,
            "oz" => quantity * 28.3495m,
            "lb" => quantity * 453.592m,
            "floz" => quantity * 29.5735m,
            "tsp" => quantity * 5m,
            "tbsp" => quantity * 15m,
            "cup" => quantity * 240m,
            _ => null,
        };
    }

    static void AddScaled(Totals totals, NutritionLibraryFood food, decimal grams)
    {
        var factor = grams / 100m;
        totals.EnergyKcal += food.EnergyKcal * factor;
        totals.ProteinG += food.ProteinG * factor;
        totals.CarbG += food.CarbG * factor;
        totals.SugarsG += food.SugarsG * factor;
        totals.FiberG += food.FiberG * factor;
        totals.FatG += food.FatG * factor;
        totals.SatFatG += food.SatFatG * factor;
        totals.SodiumMg += food.SodiumMg * factor;
        totals.CholesterolMg += food.CholesterolMg * factor;
    }

    static decimal Round(decimal value) =>
        decimal.Round(value, 4, MidpointRounding.AwayFromZero);

    sealed class Totals
    {
        public decimal EnergyKcal;
        public decimal ProteinG;
        public decimal CarbG;
        public decimal SugarsG;
        public decimal FiberG;
        public decimal FatG;
        public decimal SatFatG;
        public decimal SodiumMg;
        public decimal CholesterolMg;
    }

    public static object MapEstimate(ProductNutrientEstimate e, NutritionLibraryMeta? meta) => new
    {
        productId = e.ProductId,
        energyKcal = e.EnergyKcal,
        proteinG = e.ProteinG,
        carbG = e.CarbG,
        sugarsG = e.SugarsG,
        fiberG = e.FiberG,
        fatG = e.FatG,
        satFatG = e.SatFatG,
        sodiumMg = e.SodiumMg,
        cholesterolMg = e.CholesterolMg,
        matchedCount = e.MatchedCount,
        totalCount = e.TotalCount,
        coverageGrams = e.CoverageGrams,
        libraryVersion = e.LibraryVersion,
        isStale = e.IsStale,
        calculatedAt = e.CalculatedAt,
        sourceLabel = meta?.SourceLabel ?? "USDA FoodData Central",
        basisLabel = meta?.Basis ?? "per 100 g edible portion",
        rows = new[]
        {
            new { factor = "Energy", perRecipe = e.EnergyKcal, unit = "kcal" },
            new { factor = "Protein", perRecipe = e.ProteinG, unit = "g" },
            new { factor = "Carbohydrates", perRecipe = e.CarbG, unit = "g" },
            new { factor = "Total sugars", perRecipe = e.SugarsG, unit = "g" },
            new { factor = "Dietary fibre", perRecipe = e.FiberG, unit = "g" },
            new { factor = "Total fat", perRecipe = e.FatG, unit = "g" },
            new { factor = "Saturated fat", perRecipe = e.SatFatG, unit = "g" },
            new { factor = "Sodium", perRecipe = e.SodiumMg, unit = "mg" },
            new { factor = "Cholesterol", perRecipe = e.CholesterolMg, unit = "mg" },
        },
    };
}
