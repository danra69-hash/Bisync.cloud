using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public sealed class ComponentVendorTagSuggestionService(
    TagSuggestionDbContext suggestionDb,
    ITenantConnectionResolver resolver,
    ILogger<ComponentVendorTagSuggestionService> logger)
{
    public const decimal MinProbability = TagSuggestionStartup.MinProbability;

    sealed record ProductAgg(string ProductName, string VendorName, int TagCount);

    sealed class NameBucket
    {
        public string DisplayName { get; set; } = string.Empty;
        public int ObservationCount { get; set; }
        public Dictionary<(string ProductKey, string VendorKey), ProductAgg> Products { get; } = new();
    }

    public async Task RebuildEmptyCountriesAsync(CancellationToken cancellationToken = default)
    {
        await using var control = CreateControlDb();
        var countries = await control.Companies.AsNoTracking()
            .Select(c => c.CountryCode)
            .Where(c => c != null && c != "")
            .Distinct()
            .ToListAsync(cancellationToken);

        if (countries.Count == 0)
            countries.Add("MY");

        foreach (var raw in countries)
        {
            var country = NormalizeCountry(raw);
            var hasRows = await suggestionDb.Components.AsNoTracking()
                .AnyAsync(c => c.CountryCode == country, cancellationToken);
            if (hasRows) continue;
            await RebuildCountryAsync(country, force: true, cancellationToken);
        }
    }

    /// <summary>
    /// Rebuild countries whose local clock is in the 03:00 hour and that have not
    /// already been rebuilt for today's local calendar date.
    /// </summary>
    public async Task RebuildDueCountriesAsync(CancellationToken cancellationToken = default)
    {
        await using var control = CreateControlDb();
        var countries = await control.Companies.AsNoTracking()
            .Select(c => c.CountryCode)
            .Where(c => c != null && c != "")
            .Distinct()
            .ToListAsync(cancellationToken);

        if (countries.Count == 0)
            countries.Add("MY");

        foreach (var raw in countries.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var country = NormalizeCountry(raw);
            var localNow = CountryTimeZones.NowLocal(country);
            if (localNow.Hour != TagSuggestionStartup.RebuildLocalHour)
                continue;

            var localDate = DateOnly.FromDateTime(localNow).ToString("yyyy-MM-dd");
            var already = await suggestionDb.RebuildLogs.AsNoTracking()
                .AnyAsync(l => l.CountryCode == country && l.LocalDate == localDate && l.Status == "ok",
                    cancellationToken);
            if (already) continue;

            await RebuildCountryAsync(country, force: true, cancellationToken);
        }
    }

    public async Task RebuildCountryAsync(
        string countryCode,
        bool force = false,
        CancellationToken cancellationToken = default)
    {
        var country = NormalizeCountry(countryCode);
        var localDate = CountryTimeZones.TodayLocal(country).ToString("yyyy-MM-dd");

        if (!force)
        {
            var already = await suggestionDb.RebuildLogs.AsNoTracking()
                .AnyAsync(l => l.CountryCode == country && l.LocalDate == localDate && l.Status == "ok",
                    cancellationToken);
            if (already) return;
        }

        logger.LogInformation("Rebuilding component tag suggestions for {Country} (local date {Date})", country, localDate);

        try
        {
            var buckets = await CollectCountryBucketsAsync(country, cancellationToken);
            var builtAt = DateTime.UtcNow;
            var components = new List<TagSuggestionComponent>();
            var productCount = 0;
            var observationTotal = 0;

            foreach (var (nameKey, bucket) in buckets.OrderBy(b => b.Key, StringComparer.Ordinal))
            {
                if (bucket.ObservationCount <= 0) continue;
                observationTotal += bucket.ObservationCount;

                var products = new List<TagSuggestionVendorProduct>();
                foreach (var ((productKey, vendorKey), agg) in bucket.Products)
                {
                    var probability = Math.Round(
                        100m * agg.TagCount / bucket.ObservationCount,
                        3,
                        MidpointRounding.AwayFromZero);
                    if (probability < MinProbability) continue;

                    products.Add(new TagSuggestionVendorProduct
                    {
                        VendorProductNameKey = productKey,
                        VendorProductName = agg.ProductName,
                        VendorNameKey = vendorKey,
                        VendorName = agg.VendorName,
                        TagCount = agg.TagCount,
                        Probability = probability,
                        BuiltAtUtc = builtAt,
                    });
                }

                if (products.Count == 0) continue;

                productCount += products.Count;
                components.Add(new TagSuggestionComponent
                {
                    CountryCode = country,
                    ComponentNameKey = nameKey,
                    ComponentName = string.IsNullOrWhiteSpace(bucket.DisplayName)
                        ? nameKey
                        : bucket.DisplayName,
                    ObservationCount = bucket.ObservationCount,
                    BuiltAtUtc = builtAt,
                    VendorProducts = products
                        .OrderByDescending(p => p.Probability)
                        .ThenBy(p => p.VendorProductName, StringComparer.OrdinalIgnoreCase)
                        .ToList(),
                });
            }

            await using var tx = await suggestionDb.Database.BeginTransactionAsync(cancellationToken);
            var old = await suggestionDb.Components
                .Where(c => c.CountryCode == country)
                .ToListAsync(cancellationToken);
            if (old.Count > 0)
                suggestionDb.Components.RemoveRange(old);

            if (components.Count > 0)
                suggestionDb.Components.AddRange(components);

            var log = await suggestionDb.RebuildLogs
                .FirstOrDefaultAsync(l => l.CountryCode == country && l.LocalDate == localDate, cancellationToken);
            if (log is null)
            {
                log = new TagSuggestionRebuildLog
                {
                    CountryCode = country,
                    LocalDate = localDate,
                };
                suggestionDb.RebuildLogs.Add(log);
            }

            log.BuiltAtUtc = builtAt;
            log.ComponentCount = components.Count;
            log.ProductCount = productCount;
            log.ObservationCount = observationTotal;
            log.Status = "ok";
            log.Message = $"Rebuilt {components.Count} component name(s), {productCount} product suggestion(s).";

            await suggestionDb.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            logger.LogInformation(
                "Tag suggestions rebuilt for {Country}: {Components} components, {Products} products, {Obs} observations",
                country, components.Count, productCount, observationTotal);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Tag suggestion rebuild failed for {Country}", country);
            try
            {
                var log = await suggestionDb.RebuildLogs
                    .FirstOrDefaultAsync(l => l.CountryCode == country && l.LocalDate == localDate, cancellationToken);
                if (log is null)
                {
                    log = new TagSuggestionRebuildLog { CountryCode = country, LocalDate = localDate };
                    suggestionDb.RebuildLogs.Add(log);
                }
                log.BuiltAtUtc = DateTime.UtcNow;
                log.Status = "error";
                log.Message = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                await suggestionDb.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                // ignore secondary failure
            }

            throw;
        }
    }

    public async Task<IReadOnlyList<object>> LookupForComponentAsync(
        int companyId,
        string componentName,
        IReadOnlyList<string> locationIds,
        BisyncDbContext tenantDb,
        CancellationToken cancellationToken = default)
    {
        var country = await ResolveCompanyCountryAsync(companyId, tenantDb, cancellationToken);
        var nameKey = ComponentIdentityRules.NormalizeNameKey(componentName);
        if (string.IsNullOrEmpty(nameKey))
            return [];

        var component = await suggestionDb.Components.AsNoTracking()
            .Include(c => c.VendorProducts)
            .FirstOrDefaultAsync(
                c => c.CountryCode == country && c.ComponentNameKey == nameKey,
                cancellationToken);

        if (component is null || component.VendorProducts.Count == 0)
            return [];

        var products = await tenantDb.VendorProducts.AsNoTracking()
            .Where(p => p.Active)
            .Select(p => new
            {
                p.ExternalId,
                p.ProductName,
                p.VendorExternalId,
                p.VendorName,
                p.DeliveryPrice,
                p.Group,
                p.Specification,
            })
            .ToListAsync(cancellationToken);

        var vendorIds = products.Select(p => p.VendorExternalId).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var vendors = await tenantDb.Vendors.AsNoTracking()
            .Where(v => vendorIds.Contains(v.ExternalId))
            .Select(v => new { v.ExternalId, v.Engaged, v.EngagedLocationIdsJson, v.Name })
            .ToListAsync(cancellationToken);
        var vendorById = vendors.ToDictionary(v => v.ExternalId, StringComparer.OrdinalIgnoreCase);

        var locSet = locationIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        bool IsEngaged(string vendorExternalId)
        {
            if (!vendorById.TryGetValue(vendorExternalId, out var v) || !v.Engaged)
                return false;
            if (locSet.Count == 0) return true;
            var engagedLocs = ParseStringArray(v.EngagedLocationIdsJson);
            if (engagedLocs.Count == 0) return true;
            return engagedLocs.Any(locSet.Contains);
        }

        var ingredientConfigs = await tenantDb.Ingredients.AsNoTracking()
            .Where(i => i.CompanyId == companyId)
            .Select(i => new { i.Name, i.DetailConfigJson })
            .ToListAsync(cancellationToken);
        var ingredient = ingredientConfigs.FirstOrDefault(i =>
            ComponentIdentityRules.NormalizeNameKey(i.Name) == nameKey);
        var alreadyTagged = DeactivationGuardService.ExtractTaggedVendorProductIds(ingredient?.DetailConfigJson)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var matched = new List<(bool Engaged, decimal Probability, object Row)>();
        var seenLocalIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var suggestion in component.VendorProducts
            .Where(p => p.Probability >= MinProbability)
            .OrderByDescending(p => p.Probability))
        {
            var candidates = products
                .Where(p => ComponentIdentityRules.NormalizeNameKey(p.ProductName) == suggestion.VendorProductNameKey)
                .ToList();
            if (candidates.Count == 0) continue;

            // Prefer same vendor name when multiple products share the product name.
            var preferred = candidates
                .OrderByDescending(p =>
                    ComponentIdentityRules.NormalizeNameKey(p.VendorName) == suggestion.VendorNameKey ? 1 : 0)
                .ThenBy(p => p.ProductName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var local in preferred)
            {
                if (!seenLocalIds.Add(local.ExternalId)) continue;

                var engaged = IsEngaged(local.VendorExternalId);
                matched.Add((engaged, suggestion.Probability, new
                {
                    vendorProductId = local.ExternalId,
                    productName = local.ProductName,
                    vendorExternalId = local.VendorExternalId,
                    vendorName = string.IsNullOrWhiteSpace(local.VendorName)
                        ? (vendorById.TryGetValue(local.VendorExternalId, out var vn) ? vn.Name : suggestion.VendorName)
                        : local.VendorName,
                    vendorEngaged = engaged,
                    probability = suggestion.Probability,
                    tagCount = suggestion.TagCount,
                    observationCount = component.ObservationCount,
                    suggestedVendorName = suggestion.VendorName,
                    deliveryPrice = local.DeliveryPrice,
                    group = local.Group,
                    specification = local.Specification,
                    alreadyTagged = alreadyTagged.Contains(local.ExternalId),
                }));
            }
        }

        // Engaged first, then untact (unengaged); within each group by probability.
        return matched
            .OrderByDescending(m => m.Engaged)
            .ThenByDescending(m => m.Probability)
            .Select(m => m.Row)
            .ToList();
    }

    public async Task<Dictionary<string, int>> CountSuggestionsAsync(
        int companyId,
        IReadOnlyList<string> componentNames,
        BisyncDbContext tenantDb,
        CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (componentNames.Count == 0) return result;

        var country = await ResolveCompanyCountryAsync(companyId, tenantDb, cancellationToken);
        var keys = componentNames
            .Select(ComponentIdentityRules.NormalizeNameKey)
            .Where(k => k.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (keys.Count == 0) return result;

        var rows = await suggestionDb.Components.AsNoTracking()
            .Where(c => c.CountryCode == country && keys.Contains(c.ComponentNameKey))
            .Select(c => new
            {
                c.ComponentNameKey,
                Count = c.VendorProducts.Count(p => p.Probability >= MinProbability),
            })
            .ToListAsync(cancellationToken);

        var byKey = rows.ToDictionary(r => r.ComponentNameKey, r => r.Count, StringComparer.Ordinal);

        // Map counts back to original names (and keys) so the client can look up either way.
        foreach (var name in componentNames)
        {
            var key = ComponentIdentityRules.NormalizeNameKey(name);
            if (key.Length == 0) continue;
            var count = byKey.GetValueOrDefault(key);
            if (count <= 0) continue;
            result[name] = count;
            result[key] = count;
        }

        return result;
    }

    async Task<Dictionary<string, NameBucket>> CollectCountryBucketsAsync(
        string country,
        CancellationToken cancellationToken)
    {
        var buckets = new Dictionary<string, NameBucket>(StringComparer.Ordinal);
        await using var control = CreateControlDb();

        var companyRows = await control.Companies.AsNoTracking()
            .Where(c => c.Active)
            .Select(c => new { c.Id, c.CountryCode })
            .ToListAsync(cancellationToken);
        var companies = companyRows
            .Where(c => NormalizeCountry(c.CountryCode) == country)
            .Select(c => new { c.Id })
            .ToList();

        var registry = await control.TenantConnections.AsNoTracking()
            .Where(t => t.IsActive)
            .ToListAsync(cancellationToken);
        var registryByCompany = registry.ToDictionary(t => t.CompanyId);

        foreach (var company in companies)
        {
            registryByCompany.TryGetValue(company.Id, out var conn);
            var provisioned = conn is not null && !string.IsNullOrWhiteSpace(conn.ConnectionString);

            try
            {
                if (provisioned)
                {
                    await using var ops = CreateDb(conn!.ConnectionString);
                    await CollectFromDbAsync(ops, company.Id, filterByCompany: false, buckets, cancellationToken);
                }
                else
                {
                    await using var shared = CreateDb(resolver.DefaultOperationalConnection);
                    await CollectFromDbAsync(shared, company.Id, filterByCompany: true, buckets, cancellationToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Tag suggestion collect failed for company {CompanyId}", company.Id);
            }
        }

        return buckets;
    }

    static async Task CollectFromDbAsync(
        BisyncDbContext db,
        int companyId,
        bool filterByCompany,
        Dictionary<string, NameBucket> buckets,
        CancellationToken cancellationToken)
    {
        var ingredientQuery = db.Ingredients.AsNoTracking().AsQueryable();
        if (filterByCompany)
            ingredientQuery = ingredientQuery.Where(i => i.CompanyId == companyId);

        var ingredients = await ingredientQuery
            .Select(i => new { i.Name, i.DetailConfigJson })
            .ToListAsync(cancellationToken);

        var productIds = ingredients
            .SelectMany(i => DeactivationGuardService.ExtractTaggedVendorProductIds(i.DetailConfigJson))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (productIds.Count == 0) return;

        var products = await db.VendorProducts.AsNoTracking()
            .Where(p => productIds.Contains(p.ExternalId))
            .Select(p => new { p.ExternalId, p.ProductName, p.VendorName })
            .ToListAsync(cancellationToken);
        var byId = products.ToDictionary(p => p.ExternalId, StringComparer.OrdinalIgnoreCase);

        foreach (var ingredient in ingredients)
        {
            var tagged = DeactivationGuardService.ExtractTaggedVendorProductIds(ingredient.DetailConfigJson);
            if (tagged.Count == 0) continue;

            var nameKey = ComponentIdentityRules.NormalizeNameKey(ingredient.Name);
            if (string.IsNullOrEmpty(nameKey)) continue;

            if (!buckets.TryGetValue(nameKey, out var bucket))
            {
                bucket = new NameBucket
                {
                    DisplayName = ComponentIdentityRules.NormalizeName(ingredient.Name),
                };
                buckets[nameKey] = bucket;
            }

            bucket.ObservationCount++;

            foreach (var id in tagged)
            {
                if (!byId.TryGetValue(id, out var vp)) continue;
                var productKey = ComponentIdentityRules.NormalizeNameKey(vp.ProductName);
                if (string.IsNullOrEmpty(productKey)) continue;
                var vendorKey = ComponentIdentityRules.NormalizeNameKey(vp.VendorName);
                var key = (productKey, vendorKey);
                if (bucket.Products.TryGetValue(key, out var existing))
                {
                    bucket.Products[key] = existing with { TagCount = existing.TagCount + 1 };
                }
                else
                {
                    bucket.Products[key] = new ProductAgg(
                        ComponentIdentityRules.NormalizeName(vp.ProductName),
                        ComponentIdentityRules.NormalizeName(vp.VendorName),
                        1);
                }
            }
        }
    }

    async Task<string> ResolveCompanyCountryAsync(
        int companyId,
        BisyncDbContext tenantDb,
        CancellationToken cancellationToken)
    {
        var fromTenant = await tenantDb.Companies.AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(fromTenant))
            return NormalizeCountry(fromTenant);

        await using var control = CreateControlDb();
        var fromControl = await control.Companies.AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.CountryCode)
            .FirstOrDefaultAsync(cancellationToken);
        return NormalizeCountry(fromControl);
    }

    BisyncDbContext CreateControlDb() => CreateDb(resolver.DefaultOperationalConnection);

    static BisyncDbContext CreateDb(string connectionString)
    {
        var options = new DbContextOptionsBuilder<BisyncDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new BisyncDbContext(options);
    }

    static string NormalizeCountry(string? countryCode)
    {
        var code = (countryCode ?? "MY").Trim().ToUpperInvariant();
        return code.Length == 0 ? "MY" : code;
    }

    static List<string> ParseStringArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];
            return doc.RootElement.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.String)
                .Select(e => e.GetString()?.Trim() ?? string.Empty)
                .Where(s => s.Length > 0)
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
