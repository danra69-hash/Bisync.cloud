using System.Text.Json;
using System.Text.Json.Nodes;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public record LocationCatalogInheritanceRequest(
    int SourceCompanyId,
    string SourceLocationExternalId,
    bool CopyComponents,
    bool CopyVendorsAndVendorProducts,
    bool CopyProducts);

public record LocationCatalogInheritanceResult(
    int ComponentsCopied,
    int VendorsCopied,
    int VendorProductsCopied,
    int ProductsCopied,
    string Mode);

/// <summary>
/// Copies catalog membership (same company) or clean clones (cross company)
/// from a source location into a newly created location bucket.
/// </summary>
public class LocationCatalogInheritanceService(BisyncDbContext db, ILogger<LocationCatalogInheritanceService> logger)
{
    static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public async Task<LocationCatalogInheritanceResult> ApplyAsync(
        Location targetLocation,
        LocationCatalogInheritanceRequest request,
        CancellationToken ct = default)
    {
        if (targetLocation.CompanyId is not int targetCompanyId || targetCompanyId <= 0)
            throw new InvalidOperationException("Target location must belong to a company.");

        var sourceLoc = (request.SourceLocationExternalId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(sourceLoc))
            throw new InvalidOperationException("Source location is required for inheritance.");

        var sourceExists = await db.Locations.AsNoTracking()
            .AnyAsync(l => l.CompanyId == request.SourceCompanyId
                && l.ExternalId.ToLower() == sourceLoc.ToLower(), ct);
        if (!sourceExists)
            throw new InvalidOperationException("Source location was not found for the selected company.");

        var targetLoc = targetLocation.ExternalId.Trim();
        if (string.Equals(sourceLoc, targetLoc, StringComparison.OrdinalIgnoreCase)
            && request.SourceCompanyId == targetCompanyId)
        {
            return new LocationCatalogInheritanceResult(0, 0, 0, 0, "noop");
        }

        var copyComponents = request.CopyComponents;
        var copyVendors = request.CopyVendorsAndVendorProducts;
        var copyProducts = request.CopyProducts;

        if (!copyComponents && !copyVendors && !copyProducts)
            return new LocationCatalogInheritanceResult(0, 0, 0, 0, "noop");

        if (request.SourceCompanyId == targetCompanyId)
        {
            return await MountSameCompanyAsync(
                targetCompanyId,
                sourceLoc,
                targetLoc,
                copyComponents,
                copyVendors,
                copyProducts,
                ct);
        }

        // Cross-company product clones need the recipe/packaging components remapped.
        return await CloneCrossCompanyAsync(
            request.SourceCompanyId,
            targetCompanyId,
            sourceLoc,
            targetLoc,
            copyComponents,
            copyVendors,
            copyProducts,
            ct);
    }

    async Task<LocationCatalogInheritanceResult> MountSameCompanyAsync(
        int companyId,
        string sourceLoc,
        string targetLoc,
        bool copyComponents,
        bool copyVendors,
        bool copyProducts,
        CancellationToken ct)
    {
        var componentsCopied = 0;
        var vendorsCopied = 0;
        var vendorProductsCopied = 0;
        var productsCopied = 0;

        if (copyComponents)
        {
            var ingredients = await db.Ingredients
                .Where(i => i.CompanyId == companyId && i.Active)
                .ToListAsync(ct);

            foreach (var ingredient in ingredients)
            {
                if (!LocationListMatches(ingredient.LocationsJson, sourceLoc))
                    continue;

                var nextLocations = EnsureLocationMembership(ingredient.LocationsJson, targetLoc);
                var nextDetail = CopyVendorProductLocationTags(ingredient.DetailConfigJson, sourceLoc, targetLoc);
                var changed = !string.Equals(nextLocations, ingredient.LocationsJson, StringComparison.Ordinal)
                    || !string.Equals(nextDetail, ingredient.DetailConfigJson, StringComparison.Ordinal);
                if (!changed) continue;

                ingredient.LocationsJson = nextLocations;
                ingredient.DetailConfigJson = nextDetail;
                ingredient.UpdatedAt = DateTime.UtcNow;
                componentsCopied++;
            }
        }

        if (copyVendors)
        {
            var vendors = await db.Vendors
                .Where(v => v.CompanyId == companyId && v.Active)
                .ToListAsync(ct);

            var vendorExternalIds = new List<string>();
            foreach (var vendor in vendors)
            {
                if (!LocationListMatches(vendor.EngagedLocationIdsJson, sourceLoc, emptyMeansNone: true))
                    continue;

                var next = EnsureLocationMembership(vendor.EngagedLocationIdsJson, targetLoc, treatAllAsAll: false);
                if (string.Equals(next, vendor.EngagedLocationIdsJson, StringComparison.Ordinal))
                    continue;

                vendor.EngagedLocationIdsJson = next;
                if (!vendor.Engaged) vendor.Engaged = true;
                vendorsCopied++;
                vendorExternalIds.Add(vendor.ExternalId);
            }

            if (vendorExternalIds.Count > 0)
            {
                var products = await db.VendorProducts
                    .Where(p => vendorExternalIds.Contains(p.VendorExternalId) && p.Active)
                    .ToListAsync(ct);

                foreach (var product in products)
                {
                    if (!product.IsPrivate) continue;
                    if (!LocationListMatches(product.PrivateLocationIdsJson, sourceLoc, emptyMeansNone: true))
                        continue;

                    var next = EnsureLocationMembership(product.PrivateLocationIdsJson, targetLoc, treatAllAsAll: false);
                    if (string.Equals(next, product.PrivateLocationIdsJson, StringComparison.Ordinal))
                        continue;

                    product.PrivateLocationIdsJson = next;
                    product.UpdatedAt = DateTime.UtcNow;
                    vendorProductsCopied++;
                }
            }
        }

        if (copyProducts)
        {
            var products = await db.Products
                .Where(p => p.CompanyId == companyId && p.Active)
                .ToListAsync(ct);

            foreach (var product in products)
            {
                if (!LocationListMatches(product.LocationIdsJson, sourceLoc))
                    continue;

                var next = EnsureLocationMembership(product.LocationIdsJson, targetLoc);
                if (string.Equals(next, product.LocationIdsJson, StringComparison.Ordinal))
                    continue;

                product.LocationIdsJson = next;
                product.UpdatedAt = DateTime.UtcNow;
                productsCopied++;
            }
        }

        if (componentsCopied + vendorsCopied + vendorProductsCopied + productsCopied > 0)
            await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Location catalog inheritance (mount) → {Target}: components={C}, vendors={V}, vendorProducts={VP}, products={P}",
            targetLoc, componentsCopied, vendorsCopied, vendorProductsCopied, productsCopied);

        return new LocationCatalogInheritanceResult(
            componentsCopied, vendorsCopied, vendorProductsCopied, productsCopied, "mount");
    }

    async Task<LocationCatalogInheritanceResult> CloneCrossCompanyAsync(
        int sourceCompanyId,
        int targetCompanyId,
        string sourceLoc,
        string targetLoc,
        bool copyComponents,
        bool copyVendors,
        bool copyProducts,
        CancellationToken ct)
    {
        var componentIdMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var vendorIdMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var vendorProductIdMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var componentsCopied = 0;
        var vendorsCopied = 0;
        var vendorProductsCopied = 0;
        var productsCopied = 0;

        // Vendors first so component DetailConfig can remap tagged vendor product IDs.
        if (copyVendors)
        {
            var sourceVendors = await db.Vendors.AsNoTracking()
                .Where(v => v.CompanyId == sourceCompanyId && v.Active)
                .ToListAsync(ct);

            foreach (var source in sourceVendors)
            {
                if (!LocationListMatches(source.EngagedLocationIdsJson, sourceLoc, emptyMeansNone: true))
                    continue;

                var newExternalId = await AllocateUniqueVendorExternalIdAsync(source.ExternalId, ct);
                var newName = await AllocateUniqueVendorNameAsync(source.Name, ct);
                var clone = new Vendor
                {
                    CompanyId = targetCompanyId,
                    ExternalId = newExternalId,
                    Name = newName,
                    Type = source.Type,
                    Brn = source.Brn,
                    Products = source.Products,
                    City = source.City,
                    State = source.State,
                    Postcode = source.Postcode,
                    ContactPerson = source.ContactPerson,
                    ContactPosition = source.ContactPosition,
                    Mobile = source.Mobile,
                    Email = source.Email,
                    Address = source.Address,
                    ContactsJson = source.ContactsJson,
                    Engaged = true,
                    EngagementStatus = "none",
                    LinkedCompanyId = null,
                    MinOrderAmount = source.MinOrderAmount,
                    DeliveryChargeBelowMin = source.DeliveryChargeBelowMin,
                    PaymentTerms = source.PaymentTerms,
                    ProductPolicyTag = source.ProductPolicyTag,
                    AllowPartialDelivery = source.AllowPartialDelivery,
                    EngagedLocationIdsJson = JsonSerializer.Serialize(new[] { targetLoc }),
                    DeliveryDaysJson = source.DeliveryDaysJson,
                    Active = true,
                };
                db.Vendors.Add(clone);
                vendorIdMap[source.ExternalId] = newExternalId;
                vendorsCopied++;
            }

            if (vendorIdMap.Count > 0)
            {
                var sourceVendorIds = vendorIdMap.Keys.ToList();
                var sourceProducts = await db.VendorProducts.AsNoTracking()
                    .Where(p => sourceVendorIds.Contains(p.VendorExternalId) && p.Active)
                    .ToListAsync(ct);
                var priceMap = await db.VendorProductPrices.AsNoTracking()
                    .Where(p => sourceProducts.Select(x => x.ExternalId).Contains(p.ExternalId))
                    .ToDictionaryAsync(p => p.ExternalId, p => p, StringComparer.OrdinalIgnoreCase, ct);

                foreach (var source in sourceProducts)
                {
                    if (source.IsPrivate
                        && !LocationListMatches(source.PrivateLocationIdsJson, sourceLoc, emptyMeansNone: true))
                    {
                        continue;
                    }

                    if (!vendorIdMap.TryGetValue(source.VendorExternalId, out var newVendorId))
                        continue;

                    var newProductId = await AllocateUniqueVendorProductIdAsync(source.ExternalId, ct);
                    var privateLocs = source.IsPrivate
                        ? JsonSerializer.Serialize(new[] { targetLoc })
                        : "[]";

                    db.VendorProducts.Add(new VendorProduct
                    {
                        ExternalId = newProductId,
                        VendorExternalId = newVendorId,
                        VendorName = source.VendorName,
                        ProductName = source.ProductName,
                        Group = source.Group,
                        Specification = source.Specification,
                        ImageUrl = source.ImageUrl,
                        DeliveryPrice = source.DeliveryPrice,
                        DeliveryJson = source.DeliveryJson,
                        ProductPolicyTag = source.ProductPolicyTag,
                        IsPrivate = source.IsPrivate,
                        PrivateLocationIdsJson = privateLocs,
                        ReturnableDeposit = source.ReturnableDeposit,
                        ReturnableItemName = source.ReturnableItemName,
                        ReturnableUom = source.ReturnableUom,
                        ReturnableDepositAmount = source.ReturnableDepositAmount,
                        Active = true,
                        UpdatedAt = DateTime.UtcNow,
                    });

                    if (priceMap.TryGetValue(source.ExternalId, out var price))
                    {
                        db.VendorProductPrices.Add(new VendorProductPrice
                        {
                            ExternalId = newProductId,
                            DeliveryPrice = price.DeliveryPrice,
                            UpdatedAt = DateTime.UtcNow,
                        });
                    }

                    vendorProductIdMap[source.ExternalId] = newProductId;
                    vendorProductsCopied++;
                }
            }

            await db.SaveChangesAsync(ct);
        }

        if (copyComponents || copyProducts)
        {
            var companyCode = await CompanyCodeService.ResolveCodeAsync(db, targetCompanyId);
            var sourceIngredients = await db.Ingredients.AsNoTracking()
                .Where(i => i.CompanyId == sourceCompanyId && i.Active)
                .ToListAsync(ct);

            // When only products are requested, clone just the components referenced by those products.
            HashSet<string>? neededComponentIds = null;
            if (copyProducts && !copyComponents)
                neededComponentIds = await CollectReferencedComponentIdsAsync(sourceCompanyId, sourceLoc, ct);

            var existingNames = await db.Ingredients.AsNoTracking()
                .Where(i => i.CompanyId == targetCompanyId)
                .Select(i => i.Name)
                .ToListAsync(ct);
            var usedNames = new HashSet<string>(existingNames, StringComparer.OrdinalIgnoreCase);

            foreach (var source in sourceIngredients)
            {
                if (!LocationListMatches(source.LocationsJson, sourceLoc))
                    continue;
                if (neededComponentIds is not null
                    && !neededComponentIds.Contains(source.ComponentId))
                {
                    continue;
                }

                var name = source.Name.Trim();
                if (usedNames.Contains(name))
                {
                    logger.LogWarning(
                        "Skip component clone '{Name}' — name already exists in target company {CompanyId}",
                        name, targetCompanyId);
                    continue;
                }

                var newComponentId = await ComponentIdGenerator.GenerateAsync(db, companyCode, targetCompanyId);
                var detail = RemapDetailConfigForClone(
                    source.DetailConfigJson,
                    sourceLoc,
                    targetLoc,
                    vendorProductIdMap);

                var clone = new Ingredient
                {
                    CompanyId = targetCompanyId,
                    ComponentId = newComponentId,
                    Name = name,
                    Category = source.Category,
                    Group = source.Group,
                    RecipeUom = source.RecipeUom,
                    InventoryUom = source.InventoryUom,
                    LastPriceRecipe = source.LastPriceRecipe,
                    LastPriceInventory = source.LastPriceInventory,
                    DailyUsage = 0,
                    OrderFreqDays = source.OrderFreqDays,
                    ParStock = source.ParStock,
                    ParStockUom = source.ParStockUom,
                    StorageJson = source.StorageJson,
                    StorageNote = source.StorageNote,
                    DetailConfigJson = detail,
                    AttachedProducts = 0,
                    AttachedVendors = 0,
                    Active = true,
                    LocationsJson = JsonSerializer.Serialize(new[] { targetLoc }),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                };
                db.Ingredients.Add(clone);
                usedNames.Add(name);
                componentIdMap[source.ComponentId] = newComponentId;
                componentsCopied++;
            }

            await db.SaveChangesAsync(ct);
        }

        if (copyProducts)
        {
            var sourceProducts = await db.Products.AsNoTracking()
                .Include(p => p.Items)
                .Include(p => p.PackagingItems)
                .Include(p => p.Aliases)
                .Where(p => p.CompanyId == sourceCompanyId && p.Active)
                .ToListAsync(ct);

            foreach (var source in sourceProducts)
            {
                if (!LocationListMatches(source.LocationIdsJson, sourceLoc))
                    continue;

                // Skip bi-products that point at a parent we are not cloning in this pass.
                if (source.BiOfProductId is int)
                    continue;

                var newProductId = await ProductIdGenerator.GenerateAsync(db, source.Name, source.IsSubProduct);
                var clone = CloneProductShell(source, targetCompanyId, targetLoc, newProductId);
                clone.Items = source.Items
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new ProductComponentItem
                    {
                        ComponentId = RemapComponentId(i.ComponentId, componentIdMap),
                        ComponentName = i.ComponentName,
                        ComponentUom = i.ComponentUom,
                        ComponentUomPrice = i.ComponentUomPrice,
                        Quantity = i.Quantity,
                        Subtotal = i.Subtotal,
                        SortOrder = i.SortOrder,
                    })
                    .ToList();
                clone.PackagingItems = source.PackagingItems
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new ProductPackagingItem
                    {
                        ComponentId = RemapComponentId(i.ComponentId, componentIdMap),
                        ComponentName = i.ComponentName,
                        ComponentUom = i.ComponentUom,
                        ComponentUomPrice = i.ComponentUomPrice,
                        Quantity = i.Quantity,
                        Subtotal = i.Subtotal,
                        SortOrder = i.SortOrder,
                    })
                    .ToList();
                clone.Aliases = source.Aliases
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new ProductAlias
                    {
                        Name = a.Name,
                        Rrp = a.Rrp,
                        B2bSalesConfigJson = a.B2bSalesConfigJson,
                        SortOrder = a.SortOrder,
                    })
                    .ToList();

                db.Products.Add(clone);
                productsCopied++;
            }

            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation(
            "Location catalog inheritance (clone) → {Target}: components={C}, vendors={V}, vendorProducts={VP}, products={P}",
            targetLoc, componentsCopied, vendorsCopied, vendorProductsCopied, productsCopied);

        return new LocationCatalogInheritanceResult(
            componentsCopied, vendorsCopied, vendorProductsCopied, productsCopied, "clone");
    }

    async Task<HashSet<string>> CollectReferencedComponentIdsAsync(
        int sourceCompanyId,
        string sourceLoc,
        CancellationToken ct)
    {
        var products = await db.Products.AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => p.CompanyId == sourceCompanyId && p.Active)
            .ToListAsync(ct);

        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var product in products)
        {
            if (!LocationListMatches(product.LocationIdsJson, sourceLoc))
                continue;
            foreach (var item in product.Items)
            {
                if (!string.IsNullOrWhiteSpace(item.ComponentId))
                    ids.Add(item.ComponentId.Trim());
            }
            foreach (var item in product.PackagingItems)
            {
                if (!string.IsNullOrWhiteSpace(item.ComponentId))
                    ids.Add(item.ComponentId.Trim());
            }
        }
        return ids;
    }

    static Product CloneProductShell(Product source, int targetCompanyId, string targetLoc, string newProductId) =>
        new()
        {
            ProductId = newProductId,
            Name = source.Name,
            Category = source.Category,
            Group = source.Group,
            IsSubProduct = source.IsSubProduct,
            IsBiProduct = false,
            BiOfProductId = null,
            BiSellable = source.BiSellable,
            IsVariableProduct = source.IsVariableProduct,
            VariableMode = source.VariableMode,
            VariableChoiceQty = source.VariableChoiceQty,
            VariableOptionsJson = source.VariableOptionsJson,
            VariableMinCost = source.VariableMinCost,
            VariableMaxCost = source.VariableMaxCost,
            IsVariableComponent = source.IsVariableComponent,
            VariableComponentOptionsJson = source.VariableComponentOptionsJson,
            B2cEnabled = source.B2cEnabled,
            B2bEnabled = source.B2bEnabled,
            B2bPackageUnit = source.B2bPackageUnit,
            B2bSalesConfigJson = source.B2bSalesConfigJson,
            TotalCost = source.TotalCost,
            PackagingCost = source.PackagingCost,
            Rrp = source.Rrp,
            YieldQuantity = source.YieldQuantity,
            YieldUom = source.YieldUom,
            YieldAltUnitsJson = source.YieldAltUnitsJson,
            ExpiryPeriodDays = source.ExpiryPeriodDays,
            ActivationPeriodHours = source.ActivationPeriodHours,
            OrderLockPeriodDays = source.OrderLockPeriodDays,
            ParStock = source.ParStock,
            ParStockUom = source.ParStockUom,
            PosEnabled = source.PosEnabled,
            PosDeliveryUnitsJson = source.PosDeliveryUnitsJson,
            PosSalesUom = source.PosSalesUom,
            Active = true,
            CompanyId = targetCompanyId,
            LocationIdsJson = JsonSerializer.Serialize(new[] { targetLoc }),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    static string RemapComponentId(string componentId, IReadOnlyDictionary<string, string> map)
    {
        var key = (componentId ?? string.Empty).Trim();
        if (key.Length == 0) return key;
        return map.TryGetValue(key, out var mapped) ? mapped : key;
    }

    async Task<string> AllocateUniqueVendorExternalIdAsync(string sourceExternalId, CancellationToken ct)
    {
        var baseId = new string((sourceExternalId ?? "VND").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (baseId.Length == 0) baseId = "VND";
        if (baseId.Length > 12) baseId = baseId[..12];

        for (var i = 0; i < 50; i++)
        {
            var candidate = i == 0 ? $"{baseId}X" : $"{baseId}{i:X}";
            var taken = await db.Vendors.AnyAsync(v => v.ExternalId.ToLower() == candidate.ToLower(), ct)
                || db.ChangeTracker.Entries<Vendor>()
                    .Any(e => string.Equals(e.Entity.ExternalId, candidate, StringComparison.OrdinalIgnoreCase));
            if (!taken) return candidate;
        }

        return $"{baseId}{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
    }

    async Task<string> AllocateUniqueVendorNameAsync(string sourceName, CancellationToken ct)
    {
        var baseName = (sourceName ?? "Vendor").Trim();
        if (baseName.Length == 0) baseName = "Vendor";

        for (var i = 0; i < 50; i++)
        {
            var candidate = i == 0 ? $"{baseName} (copy)" : $"{baseName} (copy {i + 1})";
            var taken = await db.Vendors.AnyAsync(v => v.Name.ToLower() == candidate.ToLower(), ct)
                || db.ChangeTracker.Entries<Vendor>()
                    .Any(e => string.Equals(e.Entity.Name, candidate, StringComparison.OrdinalIgnoreCase));
            if (!taken) return candidate;
        }

        return $"{baseName} ({Guid.NewGuid().ToString("N")[..6]})";
    }

    async Task<string> AllocateUniqueVendorProductIdAsync(string sourceExternalId, CancellationToken ct)
    {
        var baseId = new string((sourceExternalId ?? "VP").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (baseId.Length == 0) baseId = "VP";
        if (baseId.Length > 20) baseId = baseId[..20];

        for (var i = 0; i < 50; i++)
        {
            var candidate = i == 0 ? $"{baseId}-C" : $"{baseId}-C{i}";
            var taken = await db.VendorProducts.AnyAsync(p => p.ExternalId.ToLower() == candidate.ToLower(), ct)
                || db.ChangeTracker.Entries<VendorProduct>()
                    .Any(e => string.Equals(e.Entity.ExternalId, candidate, StringComparison.OrdinalIgnoreCase));
            if (!taken) return candidate;
        }

        return $"{baseId}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
    }

    static bool LocationListMatches(string? json, string locationExternalId, bool emptyMeansNone = false)
    {
        var ids = DeserializeLocationIds(json);
        if (ids.Count == 0)
            return !emptyMeansNone;
        if (ids.Any(id => string.Equals(id, "all", StringComparison.OrdinalIgnoreCase)))
            return true;
        return ids.Any(id => string.Equals(id, locationExternalId, StringComparison.OrdinalIgnoreCase));
    }

    static string EnsureLocationMembership(string? json, string locationExternalId, bool treatAllAsAll = true)
    {
        var ids = DeserializeLocationIds(json);
        if (treatAllAsAll)
        {
            if (ids.Count == 0
                || ids.Any(id => string.Equals(id, "all", StringComparison.OrdinalIgnoreCase)))
            {
                return string.IsNullOrWhiteSpace(json) ? "[]" : json!.Trim();
            }
        }

        if (ids.Any(id => string.Equals(id, locationExternalId, StringComparison.OrdinalIgnoreCase)))
            return JsonSerializer.Serialize(ids);

        ids.Add(locationExternalId);
        return JsonSerializer.Serialize(ids);
    }

    static List<string> DeserializeLocationIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions)?
                .Select(id => (id ?? string.Empty).Trim())
                .Where(id => id.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
                ?? [];
        }
        catch
        {
            return [];
        }
    }

    static string CopyVendorProductLocationTags(string? detailConfigJson, string sourceLoc, string targetLoc)
    {
        if (string.IsNullOrWhiteSpace(detailConfigJson) || detailConfigJson.Trim() == "{}")
            return detailConfigJson ?? "{}";

        try
        {
            var root = JsonNode.Parse(detailConfigJson) as JsonObject;
            if (root is null) return detailConfigJson;

            if (root["vendorProductLocations"] is not JsonObject locationsObj)
                return detailConfigJson;

            var changed = false;
            foreach (var prop in locationsObj.ToList())
            {
                if (prop.Value is not JsonArray arr) continue;
                var locs = arr
                    .Select(n => n?.GetValue<string>()?.Trim() ?? string.Empty)
                    .Where(s => s.Length > 0)
                    .ToList();
                var hasSource = locs.Any(l => string.Equals(l, sourceLoc, StringComparison.OrdinalIgnoreCase));
                var hasTarget = locs.Any(l => string.Equals(l, targetLoc, StringComparison.OrdinalIgnoreCase));
                if (!hasSource || hasTarget) continue;

                arr.Add(targetLoc);
                changed = true;
            }

            return changed ? root.ToJsonString() : detailConfigJson;
        }
        catch
        {
            return detailConfigJson ?? "{}";
        }
    }

    static string RemapDetailConfigForClone(
        string? detailConfigJson,
        string sourceLoc,
        string targetLoc,
        IReadOnlyDictionary<string, string> vendorProductIdMap)
    {
        if (string.IsNullOrWhiteSpace(detailConfigJson) || detailConfigJson.Trim() == "{}")
            return "{}";

        try
        {
            var root = JsonNode.Parse(detailConfigJson) as JsonObject;
            if (root is null) return "{}";

            RemapStringArrayKeys(root, "taggedVendorProductIds", vendorProductIdMap);
            RemapObjectKeys(root, "vendorProductPrincipalQty", vendorProductIdMap);
            RemapObjectKeys(root, "vendorProductLossYield", vendorProductIdMap);
            RemapObjectKeys(root, "vendorProductComponentUom", vendorProductIdMap);
            RemapVendorProductLocations(root, sourceLoc, targetLoc, vendorProductIdMap);

            if (root["vendorProduct"] is JsonValue vpVal
                && vpVal.TryGetValue<string>(out var vpId)
                && vendorProductIdMap.TryGetValue(vpId, out var mappedVp))
            {
                root["vendorProduct"] = mappedVp;
            }

            return root.ToJsonString();
        }
        catch
        {
            return "{}";
        }
    }

    static void RemapStringArrayKeys(
        JsonObject root,
        string propertyName,
        IReadOnlyDictionary<string, string> map)
    {
        if (root[propertyName] is not JsonArray arr || map.Count == 0) return;
        var next = new JsonArray();
        foreach (var node in arr)
        {
            var key = node?.GetValue<string>()?.Trim() ?? string.Empty;
            if (key.Length == 0) continue;
            next.Add(map.TryGetValue(key, out var mapped) ? mapped : key);
        }
        root[propertyName] = next;
    }

    static void RemapObjectKeys(
        JsonObject root,
        string propertyName,
        IReadOnlyDictionary<string, string> map)
    {
        if (root[propertyName] is not JsonObject obj || map.Count == 0) return;
        var next = new JsonObject();
        foreach (var prop in obj)
        {
            var key = prop.Key?.Trim() ?? string.Empty;
            if (key.Length == 0) continue;
            var mappedKey = map.TryGetValue(key, out var mapped) ? mapped : key;
            next[mappedKey] = prop.Value?.DeepClone();
        }
        root[propertyName] = next;
    }

    static void RemapVendorProductLocations(
        JsonObject root,
        string sourceLoc,
        string targetLoc,
        IReadOnlyDictionary<string, string> vendorProductIdMap)
    {
        if (root["vendorProductLocations"] is not JsonObject locationsObj) return;
        var next = new JsonObject();
        foreach (var prop in locationsObj)
        {
            var key = prop.Key?.Trim() ?? string.Empty;
            if (key.Length == 0) continue;
            var mappedKey = vendorProductIdMap.TryGetValue(key, out var mapped) ? mapped : key;
            if (prop.Value is not JsonArray arr)
            {
                next[mappedKey] = prop.Value?.DeepClone();
                continue;
            }

            var locs = arr
                .Select(n => n?.GetValue<string>()?.Trim() ?? string.Empty)
                .Where(s => s.Length > 0)
                .Select(l => string.Equals(l, sourceLoc, StringComparison.OrdinalIgnoreCase) ? targetLoc : l)
                .Where(l => string.Equals(l, targetLoc, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (locs.Count == 0) locs.Add(targetLoc);
            var nextArr = new JsonArray();
            foreach (var loc in locs) nextArr.Add(loc);
            next[mappedKey] = nextArr;
        }
        root["vendorProductLocations"] = next;
    }
}
