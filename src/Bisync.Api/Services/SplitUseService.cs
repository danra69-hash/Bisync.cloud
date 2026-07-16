using System.Text.Json;
using System.Text.Json.Nodes;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public sealed record SplitUseLineConfig(
    string Key,
    string Name,
    decimal Quantity,
    string Uom,
    decimal ValueAssignedPct,
    bool IsWaste,
    string ChildComponentId);

public sealed record SplitUseConfig(
    bool Enabled,
    decimal ComponentQuantity,
    string QuantityBasis,
    IReadOnlyList<SplitUseLineConfig> Lines);

public sealed record SplitUsePostingResult(
    InventoryPurchase ParentPurchase,
    IReadOnlyList<InventoryPurchase> ChildPurchases,
    IReadOnlyList<WastageEntry> WasteEntries);

public class SplitUseService(BisyncDbContext db)
{
    const decimal Tolerance = 0.000001m;

    public async Task<string> NormalizeIngredientConfigAsync(
        Ingredient parent,
        int companyId,
        string? detailConfigJson,
        CancellationToken cancellationToken = default)
    {
        var root = ParseRoot(detailConfigJson);
        var splitNode = root["splitUse"] as JsonObject;
        if (splitNode is null || !ReadBool(splitNode, "enabled", "Enabled"))
            return root.ToJsonString();

        var config = ParseAndValidate(splitNode, parent.InventoryUom, parent.RecipeUom);
        var companyCode = await CompanyCodeService.ResolveCodeAsync(db, companyId);
        var canonicalLines = new JsonArray();

        foreach (var line in config.Lines)
        {
            string childComponentId = string.Empty;
            if (!line.IsWaste)
            {
                var normalizedName = ComponentIdentityRules.NormalizeName(line.Name);
                if (string.Equals(normalizedName, parent.Name, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("A Split Use output cannot be the parent component.");

                var child = await db.Ingredients.FirstOrDefaultAsync(
                    ingredient => ingredient.CompanyId == companyId
                        && ingredient.Name.ToLower() == normalizedName.ToLower(),
                    cancellationToken);

                if (child is null)
                {
                    child = new Ingredient
                    {
                        CompanyId = companyId,
                        ComponentId = await ComponentIdGenerator.GenerateAsync(db, companyCode, companyId),
                        Name = normalizedName,
                        Category = parent.Category,
                        Group = parent.Group,
                        InventoryUom = line.Uom,
                        RecipeUom = line.Uom,
                        LastPriceInventory = 0,
                        LastPriceRecipe = 0,
                        DailyUsage = 0,
                        OrderFreqDays = parent.OrderFreqDays > 0 ? parent.OrderFreqDays : 7,
                        StorageJson = parent.StorageJson,
                        StorageNote = $"Split Use output from {parent.Name}",
                        DetailConfigJson = "{}",
                        AttachedProducts = 0,
                        AttachedVendors = 0,
                        Active = true,
                        LocationsJson = parent.LocationsJson,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    };
                    db.Ingredients.Add(child);
                    // Reserve the generated ID before generating another child ID.
                    await db.SaveChangesAsync(cancellationToken);
                }

                if (string.Equals(child.ComponentId, parent.ComponentId, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("A Split Use output cannot reference its parent component.");
                if (ConfigReferencesComponent(child.DetailConfigJson, parent.ComponentId))
                    throw new InvalidOperationException($"Split Use output '{child.Name}' would create a circular component link.");

                childComponentId = child.ComponentId;
            }

            canonicalLines.Add(new JsonObject
            {
                ["key"] = line.Key,
                ["name"] = ComponentIdentityRules.NormalizeName(line.Name),
                ["qty"] = line.Quantity.ToString("0.######"),
                ["inventoryUom"] = line.Uom,
                ["valueAssignedPct"] = line.ValueAssignedPct.ToString("0.######"),
                ["valueAssigned"] = line.ValueAssignedPct.ToString("0.######"),
                ["isWaste"] = line.IsWaste,
                ["childComponentId"] = childComponentId,
            });
        }

        root["splitUse"] = new JsonObject
        {
            ["enabled"] = true,
            ["componentQty"] = config.ComponentQuantity.ToString("0.######"),
            ["qtyBasis"] = config.QuantityBasis,
            ["lines"] = canonicalLines,
        };

        ClearYieldLoss(root);
        return root.ToJsonString();
    }

    public SplitUseConfig? ReadConfig(Ingredient ingredient)
    {
        var root = ParseRoot(ingredient.DetailConfigJson);
        var splitNode = root["splitUse"] as JsonObject;
        if (splitNode is null || !ReadBool(splitNode, "enabled", "Enabled"))
            return null;
        return ParseAndValidate(splitNode, ingredient.InventoryUom, ingredient.RecipeUom);
    }

    public async Task<SplitUsePostingResult> PostInboundAsync(
        Ingredient parent,
        decimal receiptQuantity,
        string receiptUom,
        decimal receiptUnitPrice,
        DateOnly dateOrdered,
        DateTime createdAt,
        int purchaseOrderId,
        int purchaseOrderItemId,
        int? companyId,
        string locationIdsJson,
        string locationExternalId,
        string sourceType,
        int sourceId,
        CancellationToken cancellationToken = default)
    {
        var config = ReadConfig(parent)
            ?? throw new InvalidOperationException("Split Use is not enabled for this component.");
        if (receiptQuantity <= 0)
            throw new InvalidOperationException("Receipt quantity must be greater than zero.");

        var basisUom = config.QuantityBasis == "recipe" ? parent.RecipeUom : parent.InventoryUom;
        var receiptBasisQty = ConvertQuantity(receiptQuantity, receiptUom, basisUom, parent);
        if (receiptBasisQty <= 0)
            throw new InvalidOperationException("Receipt UOM cannot be converted to the Split Use basis UOM.");

        var existing = await db.InventoryPurchases.AnyAsync(
            purchase => purchase.SplitSourceType == sourceType
                && purchase.SplitSourceId == sourceId
                && purchase.SplitLineKey == "__nett__",
            cancellationToken);
        if (existing)
            throw new InvalidOperationException("This receipt has already been split into inventory.");

        var scale = receiptBasisQty / config.ComponentQuantity;
        var totalReceiptValue = receiptQuantity * receiptUnitPrice;
        var parentBasisUnitCost = totalReceiptValue / receiptBasisQty;
        decimal outputBasisQty = 0;
        decimal allocatedValue = 0;
        var childPurchases = new List<InventoryPurchase>();
        var wasteEntries = new List<WastageEntry>();

        foreach (var line in config.Lines)
        {
            var configuredBasisQty = ConvertQuantity(line.Quantity, line.Uom, basisUom, parent);
            var lineBasisQty = configuredBasisQty * scale;
            var lineQty = line.Quantity * scale;
            var lineValue = lineBasisQty * parentBasisUnitCost * line.ValueAssignedPct / 100m;
            var lineUnitPrice = lineQty > 0 ? lineValue / lineQty : 0;
            outputBasisQty += lineBasisQty;
            allocatedValue += lineValue;

            if (line.IsWaste)
            {
                wasteEntries.Add(new WastageEntry
                {
                    CompanyId = companyId,
                    LocationExternalId = locationExternalId,
                    Source = WastageService.SourceSplitUse,
                    ItemType = "component",
                    ItemKey = parent.ComponentId,
                    ItemName = line.Name,
                    Quantity = lineQty,
                    Uom = line.Uom,
                    WastedDate = DateOnly.FromDateTime(createdAt),
                    Reason = $"Split Use from {parent.Name}",
                    UnitPrice = StockCardFifoEngine.RoundUnitPrice(lineUnitPrice),
                    TotalValue = Math.Round(lineValue, 2, MidpointRounding.AwayFromZero),
                    SourceReferenceType = sourceType,
                    SourceReferenceId = sourceId,
                    SplitUseLineKey = line.Key,
                    CreatedAt = createdAt,
                });
                continue;
            }

            var child = await db.Ingredients.FirstOrDefaultAsync(
                ingredient => ingredient.CompanyId == companyId
                    && ingredient.ComponentId == line.ChildComponentId,
                cancellationToken)
                ?? throw new InvalidOperationException($"Split Use component '{line.Name}' was not found.");

            child.LastPriceInventory = StockCardFifoEngine.RoundUnitPrice(lineUnitPrice);
            child.LastPriceRecipe = child.LastPriceInventory;
            child.UpdatedAt = DateTime.UtcNow;

            childPurchases.Add(CreatePurchase(
                child.ComponentId,
                child.Name,
                lineQty,
                line.Uom,
                lineUnitPrice,
                dateOrdered,
                createdAt,
                purchaseOrderId,
                purchaseOrderItemId,
                companyId,
                locationIdsJson,
                locationExternalId,
                sourceType,
                sourceId,
                line.Key,
                parent.ComponentId));
        }

        var nettQty = receiptBasisQty - outputBasisQty;
        var nettValue = totalReceiptValue - allocatedValue;
        if (nettQty <= Tolerance)
            throw new InvalidOperationException("Split Use must leave a positive nett parent quantity.");
        if (nettValue < -Tolerance)
            throw new InvalidOperationException("Split Use assigned value exceeds the receipt value.");

        var nettUnitPrice = nettValue / nettQty;
        parent.LastPriceInventory = StockCardFifoEngine.RoundUnitPrice(nettUnitPrice);
        if (string.Equals(parent.InventoryUom, basisUom, StringComparison.OrdinalIgnoreCase)
            && string.Equals(parent.RecipeUom, basisUom, StringComparison.OrdinalIgnoreCase))
            parent.LastPriceRecipe = parent.LastPriceInventory;
        parent.UpdatedAt = DateTime.UtcNow;

        var parentPurchase = CreatePurchase(
            parent.ComponentId,
            parent.Name,
            nettQty,
            basisUom,
            nettUnitPrice,
            dateOrdered,
            createdAt,
            purchaseOrderId,
            purchaseOrderItemId,
            companyId,
            locationIdsJson,
            locationExternalId,
            sourceType,
            sourceId,
            "__nett__",
            parent.ComponentId);

        db.InventoryPurchases.Add(parentPurchase);
        db.InventoryPurchases.AddRange(childPurchases);
        db.WastageEntries.AddRange(wasteEntries);

        return new SplitUsePostingResult(parentPurchase, childPurchases, wasteEntries);
    }

    static InventoryPurchase CreatePurchase(
        string componentId,
        string componentName,
        decimal quantity,
        string uom,
        decimal unitPrice,
        DateOnly dateOrdered,
        DateTime createdAt,
        int purchaseOrderId,
        int purchaseOrderItemId,
        int? companyId,
        string locationIdsJson,
        string locationExternalId,
        string sourceType,
        int sourceId,
        string lineKey,
        string parentComponentId) => new()
        {
            ComponentId = componentId,
            ComponentName = componentName,
            Quantity = quantity,
            Uom = uom,
            UnitPrice = StockCardFifoEngine.RoundUnitPrice(unitPrice),
            DateOrdered = dateOrdered,
            DateCreatedInStock = createdAt,
            PurchaseOrderId = purchaseOrderId,
            PurchaseOrderItemId = purchaseOrderItemId,
            CompanyId = companyId,
            LocationIdsJson = locationIdsJson,
            LocationExternalId = locationExternalId,
            SplitSourceType = sourceType,
            SplitSourceId = sourceId,
            SplitLineKey = lineKey,
            SplitParentComponentId = parentComponentId,
        };

    static SplitUseConfig ParseAndValidate(JsonObject node, string inventoryUom, string recipeUom)
    {
        var componentQty = ReadDecimal(node, "componentQty", "ComponentQty");
        if (componentQty <= 0)
            throw new InvalidOperationException("Enter a valid component quantity for Split Use.");
        var qtyBasis = ReadString(node, "qtyBasis", "QtyBasis").Equals("recipe", StringComparison.OrdinalIgnoreCase)
            ? "recipe"
            : "inventory";
        var basisUom = qtyBasis == "recipe" ? recipeUom : inventoryUom;
        var linesNode = node["lines"] as JsonArray ?? node["Lines"] as JsonArray;
        if (linesNode is null || linesNode.Count == 0)
            throw new InvalidOperationException("Add at least one Split Use output.");

        var lines = new List<SplitUseLineConfig>();
        decimal outputBasisQty = 0;
        decimal weightedAllocation = 0;
        foreach (var item in linesNode)
        {
            if (item is not JsonObject line) continue;
            var name = ComponentIdentityRules.NormalizeName(ReadString(line, "name", "Name"));
            var nameError = ComponentIdentityRules.ValidateName(name);
            if (nameError is not null)
                throw new InvalidOperationException(nameError);
            var qty = ReadDecimal(line, "qty", "Qty");
            if (qty <= 0)
                throw new InvalidOperationException($"Split Use output '{name}' needs a quantity greater than zero.");
            var uom = NormalizeUom(ReadString(line, "inventoryUom", "InventoryUom"));
            if (string.IsNullOrWhiteSpace(uom))
                throw new InvalidOperationException($"Split Use output '{name}' needs a UOM.");
            var pct = ReadDecimal(line, "valueAssignedPct", "ValueAssignedPct");
            if (pct == 0 && line["valueAssignedPct"] is null && line["ValueAssignedPct"] is null)
                pct = ReadDecimal(line, "valueAssigned", "ValueAssigned");
            if (pct < 0 || pct > 100)
                throw new InvalidOperationException($"Value Assigned for '{name}' must be between 0% and 100%.");
            var basisQty = ConvertSimple(qty, uom, basisUom)
                ?? throw new InvalidOperationException($"UOM '{uom}' cannot be converted to '{basisUom}'.");
            outputBasisQty += basisQty;
            weightedAllocation += basisQty * pct / 100m;
            lines.Add(new SplitUseLineConfig(
                ReadString(line, "key", "Key") is { Length: > 0 } key ? key : Guid.NewGuid().ToString("N"),
                name,
                qty,
                uom,
                pct,
                ReadBool(line, "isWaste", "IsWaste"),
                ReadString(line, "childComponentId", "ChildComponentId")));
        }

        if (lines.Count == 0)
            throw new InvalidOperationException("Add at least one Split Use output.");
        if (outputBasisQty >= componentQty - Tolerance)
            throw new InvalidOperationException("Split Use outputs must leave a positive Component Nett quantity.");
        if (weightedAllocation > componentQty + Tolerance)
            throw new InvalidOperationException("Split Use assigned value exceeds 100% of the component value.");

        return new SplitUseConfig(true, componentQty, qtyBasis, lines);
    }

    static decimal ConvertQuantity(decimal qty, string fromUom, string toUom, Ingredient ingredient)
    {
        var simple = ConvertSimple(qty, fromUom, toUom);
        if (simple is decimal converted) return converted;

        var inventory = NormalizeUom(ingredient.InventoryUom);
        var recipe = NormalizeUom(ingredient.RecipeUom);
        var from = NormalizeUom(fromUom);
        var to = NormalizeUom(toUom);
        if (!TryReadIngredientRatio(ingredient.DetailConfigJson, out var inventoryQty, out var recipeQty))
            throw new InvalidOperationException($"UOM '{fromUom}' cannot be converted to '{toUom}'.");
        if (from == recipe && to == inventory)
            return qty * inventoryQty / recipeQty;
        if (from == inventory && to == recipe)
            return qty * recipeQty / inventoryQty;
        throw new InvalidOperationException($"UOM '{fromUom}' cannot be converted to '{toUom}'.");
    }

    static decimal? ConvertSimple(decimal qty, string fromUom, string toUom)
    {
        var from = NormalizeUom(fromUom);
        var to = NormalizeUom(toUom);
        if (from == to) return qty;
        var factors = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["mg"] = 0.001m,
            ["g"] = 1m,
            ["kg"] = 1000m,
            ["t"] = 1_000_000m,
            ["ml"] = 1m,
            ["cl"] = 10m,
            ["l"] = 1000m,
            ["oz"] = 28.3495m,
            ["lb"] = 453.592m,
            ["fl oz"] = 29.5735m,
            ["gal"] = 3785.41m,
        };
        if (!factors.TryGetValue(from, out var fromFactor) || !factors.TryGetValue(to, out var toFactor))
            return null;
        var fromMass = from is "mg" or "g" or "kg" or "t" or "oz" or "lb";
        var toMass = to is "mg" or "g" or "kg" or "t" or "oz" or "lb";
        if (fromMass != toMass) return null;
        return qty * fromFactor / toFactor;
    }

    static string NormalizeUom(string? uom)
    {
        var raw = (uom ?? string.Empty).Trim().ToLowerInvariant();
        return raw switch
        {
            "mg" => "mg",
            "gr" or "gram" or "grams" => "g",
            "kg" => "kg",
            "tonne" => "t",
            "ml" => "ml",
            "cl" => "cl",
            "ltr" or "litre" or "liter" => "L",
            "floz" => "fl oz",
            "gal" => "gal",
            "each" => "pcs",
            "bottle" => "btl",
            "case" => "case",
            _ => raw,
        };
    }

    static bool TryReadIngredientRatio(string? json, out decimal inventoryQty, out decimal recipeQty)
    {
        inventoryQty = recipeQty = 0;
        var root = ParseRoot(json);
        inventoryQty = ReadDecimal(root, "convertFromInventoryQty", "ConvertFromInventoryQty");
        recipeQty = ReadDecimal(root, "convertToRecipeQty", "ConvertToRecipeQty");
        return inventoryQty > 0 && recipeQty > 0;
    }

    static bool ConfigReferencesComponent(string? json, string componentId)
    {
        if (string.IsNullOrWhiteSpace(componentId)) return false;
        var root = ParseRoot(json);
        var lines = (root["splitUse"] as JsonObject)?["lines"] as JsonArray;
        return lines?.OfType<JsonObject>().Any(line =>
            string.Equals(ReadString(line, "childComponentId", "ChildComponentId"), componentId, StringComparison.OrdinalIgnoreCase)) == true;
    }

    static void ClearYieldLoss(JsonObject root)
    {
        root["vendorProductLossYield"] = new JsonObject();
        root["lossYield"] = "0";
    }

    static JsonObject ParseRoot(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try
        {
            return JsonNode.Parse(json) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            return new JsonObject();
        }
    }

    static string ReadString(JsonObject node, string camel, string pascal)
        => node[camel]?.ToString() ?? node[pascal]?.ToString() ?? string.Empty;

    static decimal ReadDecimal(JsonObject node, string camel, string pascal)
        => decimal.TryParse(ReadString(node, camel, pascal), out var value) ? value : 0;

    static bool ReadBool(JsonObject node, string camel, string pascal)
        => bool.TryParse(ReadString(node, camel, pascal), out var value) && value;
}
