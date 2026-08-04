using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Depletes stock when a parent product is sold (POS, online, offline).
/// Smart components: BOM qty × units sold (FIFO), inflated by Yield Loss % to gross stock.
/// Sub-products: deplete produced stock first; shortfall uses sub-product recipe components.
/// Variable products: persist quantified sale detail and deplete from combination picks,
/// replacement substitutions, or exact weight served.
/// </summary>
public class ProductSaleInventoryService(
    BisyncDbContext db,
    ComponentStockService componentStock)
{
    public static readonly IReadOnlySet<string> ValidChannels = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "pos", "online", "offline",
    };

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public Task RecordProductSaleAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal quantitySold,
        string salesChannel,
        CancellationToken cancellationToken = default) =>
        RecordProductSaleAsync(
            productId,
            locationExternalIds,
            quantitySold,
            salesChannel,
            variableDetail: null,
            reasonOverride: null,
            cancellationToken);

    public Task RecordProductSaleAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal quantitySold,
        string salesChannel,
        PosSaleVariableDetailRequest? variableDetail,
        CancellationToken cancellationToken = default) =>
        RecordProductSaleAsync(
            productId,
            locationExternalIds,
            quantitySold,
            salesChannel,
            variableDetail,
            reasonOverride: null,
            cancellationToken);

    public async Task RecordProductSaleAsync(
        int productId,
        IReadOnlyList<string> locationExternalIds,
        decimal quantitySold,
        string salesChannel,
        PosSaleVariableDetailRequest? variableDetail,
        string? reasonOverride,
        CancellationToken cancellationToken = default)
    {
        if (quantitySold <= 0)
            return;

        var channel = NormalizeChannel(salesChannel);
        var referenceType = ChannelToReferenceType(channel);
        var reasonLabel = string.IsNullOrWhiteSpace(reasonOverride)
            ? ChannelToReasonLabel(channel)
            : reasonOverride.Trim();
        var batchNote = string.IsNullOrWhiteSpace(reasonOverride)
            ? string.Empty
            : reasonOverride.Trim();

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);

        if (product is null || product.IsSubProduct || !product.Active)
            return;

        var mode = ResolveVariableMode(product, variableDetail);
        var comboSelections = NormalizeCombinationSelections(variableDetail);
        var replacementSelections = NormalizeReplacementSelections(variableDetail);
        var replacementByBase = replacementSelections
            .GroupBy(s => s.BaseComponentId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var enteredWeight = variableDetail?.EnteredWeight is > 0
            ? variableDetail.EnteredWeight.Value
            : mode == "weight" ? quantitySold : (decimal?)null;
        var referenceWeightQty = variableDetail?.ReferenceWeightQty is > 0
            ? variableDetail.ReferenceWeightQty.Value
            : product.VariableChoiceQty > 0 && mode == "weight"
                ? product.VariableChoiceQty
                : (decimal?)null;
        var weightUom = (variableDetail?.WeightUom ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(weightUom) && mode == "weight")
            weightUom = ParseWeightUomFromOptions(product.VariableOptionsJson);

        // Weight (and Variable Component + weight): scale BOM by exact weight / reference package weight.
        // Other modes: multiply by units sold.
        var scaleByWeight = enteredWeight is > 0
            && referenceWeightQty is > 0
            && (mode == "weight" || mode == "variablecomponent");
        var bomMultiplier = scaleByWeight
            ? enteredWeight!.Value / referenceWeightQty!.Value
            : quantitySold;

        var finishedQty = scaleByWeight ? bomMultiplier : quantitySold;

        var subProductsByCode = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Where(p => p.IsSubProduct && p.Active)
            .ToDictionaryAsync(p => p.ProductId, StringComparer.OrdinalIgnoreCase, cancellationToken);

        var ingredientsByCode = await LoadActiveIngredientsByCodeAsync(product.CompanyId, cancellationToken);

        foreach (var locationId in locationExternalIds)
        {
            var usageAudit = new List<object>();

            await DepleteFinishedProductStockAsync(
                product,
                locationId,
                finishedQty,
                referenceType,
                batchNote,
                cancellationToken);
            usageAudit.Add(new
            {
                kind = "product",
                productId = product.Id,
                productCode = product.ProductId,
                productName = product.Name,
                quantity = finishedQty,
                role = "finished",
            });

            async Task DepleteBomLineAsync(
                string componentId,
                string componentName,
                string componentUom,
                decimal lineQty)
            {
                if (string.IsNullOrWhiteSpace(componentId) || lineQty <= 0)
                    return;

                if (subProductsByCode.TryGetValue(componentId, out var subProduct))
                {
                    await DepleteSubProductLineAsync(
                        product,
                        subProduct,
                        new ProductComponentItem
                        {
                            ComponentId = componentId,
                            ComponentName = componentName,
                            ComponentUom = componentUom,
                            Quantity = lineQty,
                        },
                        locationId,
                        bomMultiplier,
                        referenceType,
                        reasonLabel,
                        ingredientsByCode,
                        cancellationToken);
                    usageAudit.Add(new
                    {
                        kind = "subProduct",
                        componentId,
                        componentName,
                        componentUom,
                        quantity = lineQty * bomMultiplier,
                    });
                    return;
                }

                if (!ingredientsByCode.TryGetValue(componentId, out var ingredient))
                    return;

                var nettQty = lineQty * bomMultiplier;
                if (nettQty <= 0)
                    return;

                var requiredQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, nettQty);

                await componentStock.RecordDeductionAsync(
                    componentId,
                    componentName,
                    locationId,
                    requiredQty,
                    componentUom,
                    reason: $"{reasonLabel} — {product.Name}",
                    referenceType: referenceType,
                    referenceId: product.Id,
                    companyId: product.CompanyId,
                    cancellationToken);

                usageAudit.Add(new
                {
                    kind = "component",
                    componentId,
                    componentName,
                    componentUom,
                    quantity = requiredQty,
                });
            }

            if (mode == "combination")
            {
                // Packaging on the combo shell; recipe stock comes from selected products.
                foreach (var line in product.PackagingItems)
                {
                    await DepleteBomLineAsync(
                        line.ComponentId,
                        line.ComponentName,
                        line.ComponentUom,
                        line.Quantity);
                }

                foreach (var sel in comboSelections)
                {
                    var childQty = sel.Quantity * quantitySold;
                    if (childQty <= 0 || sel.ProductId <= 0)
                        continue;

                    usageAudit.Add(new
                    {
                        kind = "product",
                        productId = sel.ProductId,
                        productCode = sel.ProductCode ?? string.Empty,
                        productName = sel.ProductName ?? string.Empty,
                        quantity = childQty,
                        role = "combinationSelection",
                    });

                    await RecordProductSaleAsync(
                        sel.ProductId,
                        new[] { locationId },
                        childQty,
                        channel,
                        variableDetail: null,
                        reasonOverride: batchNote,
                        cancellationToken);
                }
            }
            else if (mode == "replacement" || mode == "variablecomponent")
            {
                var replacedBases = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var line in product.Items)
                {
                    if (replacementByBase.TryGetValue(line.ComponentId, out var swap))
                    {
                        replacedBases.Add(line.ComponentId);
                        var chosenId = swap.ChosenComponentId;
                        var chosenName = string.IsNullOrWhiteSpace(swap.ChosenComponentName)
                            ? line.ComponentName
                            : swap.ChosenComponentName!;
                        var chosenUom = string.IsNullOrWhiteSpace(swap.ComponentUom)
                            ? line.ComponentUom
                            : swap.ComponentUom!;
                        var qty = swap.Quantity > 0 ? swap.Quantity : line.Quantity;
                        await DepleteBomLineAsync(chosenId, chosenName, chosenUom, qty);
                        continue;
                    }

                    await DepleteBomLineAsync(
                        line.ComponentId,
                        line.ComponentName,
                        line.ComponentUom,
                        line.Quantity);
                }

                // Slots whose base is not on the current BOM still deplete the chosen component.
                foreach (var swap in replacementSelections)
                {
                    if (replacedBases.Contains(swap.BaseComponentId))
                        continue;
                    if (swap.Quantity <= 0 || string.IsNullOrWhiteSpace(swap.ChosenComponentId))
                        continue;
                    await DepleteBomLineAsync(
                        swap.ChosenComponentId,
                        swap.ChosenComponentName ?? swap.ChosenComponentId,
                        swap.ComponentUom ?? string.Empty,
                        swap.Quantity);
                }

                foreach (var line in product.PackagingItems)
                {
                    await DepleteBomLineAsync(
                        line.ComponentId,
                        line.ComponentName,
                        line.ComponentUom,
                        line.Quantity);
                }
            }
            else
            {
                foreach (var line in product.Items)
                {
                    await DepleteBomLineAsync(
                        line.ComponentId,
                        line.ComponentName,
                        line.ComponentUom,
                        line.Quantity);
                }

                foreach (var line in product.PackagingItems)
                {
                    await DepleteBomLineAsync(
                        line.ComponentId,
                        line.ComponentName,
                        line.ComponentUom,
                        line.Quantity);
                }
            }

            if (ShouldPersistSaleDetail(product, mode, variableDetail, comboSelections, replacementSelections, enteredWeight))
            {
                db.PosSaleDetails.Add(new PosSaleDetail
                {
                    ProductId = product.Id,
                    ProductCode = product.ProductId,
                    ProductName = product.Name,
                    CompanyId = product.CompanyId,
                    LocationExternalId = locationId,
                    SalesChannel = channel,
                    VariableMode = mode,
                    QuantitySold = quantitySold,
                    EnteredWeight = enteredWeight,
                    WeightUom = weightUom,
                    ReferenceWeightQty = referenceWeightQty,
                    SelectionsJson = BuildSelectionsJson(
                        mode,
                        comboSelections,
                        replacementSelections,
                        enteredWeight,
                        weightUom,
                        referenceWeightQty),
                    ComponentUsagesJson = JsonSerializer.Serialize(usageAudit, JsonOpts),
                    CreatedAt = DateTime.UtcNow,
                });
            }
        }

        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }

    static bool ShouldPersistSaleDetail(
        Product product,
        string mode,
        PosSaleVariableDetailRequest? detail,
        IReadOnlyList<PosSaleCombinationSelectionRequest> combo,
        IReadOnlyList<PosSaleReplacementSelectionRequest> replacements,
        decimal? enteredWeight)
    {
        if (detail is not null)
            return true;
        if (!product.IsVariableProduct)
            return false;
        if (mode == "combination" && combo.Count > 0)
            return true;
        if (mode == "replacement" || mode == "variablecomponent")
            return true;
        if (mode == "weight" && enteredWeight is > 0)
            return true;
        return product.IsVariableProduct || product.IsVariableComponent;
    }

    static string ResolveVariableMode(Product product, PosSaleVariableDetailRequest? detail)
    {
        var fromDetail = (detail?.VariableMode ?? string.Empty).Trim().ToLowerInvariant();
        if (fromDetail is "combination" or "replacement" or "weight" or "variablecomponent")
            return fromDetail;

        if (product.IsVariableComponent
            && (detail?.ReplacementSelections?.Count ?? 0) > 0)
            return "variablecomponent";

        if (!product.IsVariableProduct)
            return product.IsVariableComponent ? "variablecomponent" : string.Empty;

        var fromProduct = (product.VariableMode ?? string.Empty).Trim().ToLowerInvariant();
        return fromProduct is "combination" or "weight"
            ? fromProduct
            : "combination";
    }

    static List<PosSaleCombinationSelectionRequest> NormalizeCombinationSelections(
        PosSaleVariableDetailRequest? detail)
    {
        if (detail?.CombinationSelections is null || detail.CombinationSelections.Count == 0)
            return [];

        return detail.CombinationSelections
            .Where(s => s.ProductId > 0 && s.Quantity > 0)
            .Select(s => new PosSaleCombinationSelectionRequest
            {
                ProductId = s.ProductId,
                ProductCode = (s.ProductCode ?? string.Empty).Trim(),
                ProductName = (s.ProductName ?? string.Empty).Trim(),
                Quantity = s.Quantity,
            })
            .ToList();
    }

    static List<PosSaleReplacementSelectionRequest> NormalizeReplacementSelections(
        PosSaleVariableDetailRequest? detail)
    {
        if (detail?.ReplacementSelections is null || detail.ReplacementSelections.Count == 0)
            return [];

        return detail.ReplacementSelections
            .Where(s =>
                !string.IsNullOrWhiteSpace(s.BaseComponentId)
                && !string.IsNullOrWhiteSpace(s.ChosenComponentId)
                && s.Quantity > 0)
            .Select(s => new PosSaleReplacementSelectionRequest
            {
                BaseComponentId = s.BaseComponentId.Trim(),
                BaseComponentName = (s.BaseComponentName ?? string.Empty).Trim(),
                ChosenComponentId = s.ChosenComponentId.Trim(),
                ChosenComponentName = (s.ChosenComponentName ?? string.Empty).Trim(),
                ComponentUom = (s.ComponentUom ?? string.Empty).Trim(),
                Quantity = s.Quantity,
                ExtraCharge = s.ExtraCharge is > 0 ? s.ExtraCharge.Value : 0m,
            })
            .ToList();
    }

    static string BuildSelectionsJson(
        string mode,
        IReadOnlyList<PosSaleCombinationSelectionRequest> combo,
        IReadOnlyList<PosSaleReplacementSelectionRequest> replacements,
        decimal? enteredWeight,
        string weightUom,
        decimal? referenceWeightQty)
    {
        if (mode == "combination")
        {
            return JsonSerializer.Serialize(combo.Select(s => new
            {
                kind = "product",
                productId = s.ProductId,
                productCode = s.ProductCode,
                productName = s.ProductName,
                quantity = s.Quantity,
            }), JsonOpts);
        }

        if (mode == "replacement" || mode == "variablecomponent")
        {
            return JsonSerializer.Serialize(replacements.Select(s => new
            {
                kind = "componentSubstitution",
                baseComponentId = s.BaseComponentId,
                baseComponentName = s.BaseComponentName,
                chosenComponentId = s.ChosenComponentId,
                chosenComponentName = s.ChosenComponentName,
                componentUom = s.ComponentUom,
                quantity = s.Quantity,
                extraCharge = s.ExtraCharge,
            }), JsonOpts);
        }

        if (mode == "weight")
        {
            return JsonSerializer.Serialize(new[]
            {
                new
                {
                    kind = "weight",
                    enteredWeight,
                    weightUom,
                    referenceWeightQty,
                },
            }, JsonOpts);
        }

        return "[]";
    }

    static string ParseWeightUomFromOptions(string? optionsJson)
    {
        if (string.IsNullOrWhiteSpace(optionsJson))
            return string.Empty;
        try
        {
            using var doc = JsonDocument.Parse(optionsJson);
            if (doc.RootElement.TryGetProperty("weightUom", out var uom))
                return uom.GetString()?.Trim() ?? string.Empty;
        }
        catch
        {
            // ignore malformed JSON
        }

        return string.Empty;
    }

    async Task DepleteFinishedProductStockAsync(
        Product product,
        string locationId,
        decimal quantitySold,
        string referenceType,
        string batchNote,
        CancellationToken cancellationToken)
    {
        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == product.Id && s.LocationExternalId == locationId,
                cancellationToken);

        // B2C / finished goods may go negative; later inbound production prices the shortage on the stock card.
        if (stockRow is null)
        {
            stockRow = new ProductB2bLocationStock
            {
                ProductId = product.Id,
                LocationExternalId = locationId,
                InStock = 0,
                UpdatedAt = DateTime.UtcNow,
            };
            db.ProductB2bLocationStocks.Add(stockRow);
        }

        stockRow.InStock -= quantitySold;
        stockRow.UpdatedAt = DateTime.UtcNow;

        db.ProductProductionLogs.Add(new ProductProductionLog
        {
            ProductId = product.Id,
            EntryType = referenceType,
            Quantity = quantitySold,
            ProductionDate = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
            LocationIdsJson = JsonSerializer.Serialize(new[] { locationId }),
            BatchNumber = batchNote ?? string.Empty,
            CompanyId = product.CompanyId,
            CreatedAt = DateTime.UtcNow,
        });
    }

    async Task DepleteSubProductLineAsync(
        Product parentProduct,
        Product subProduct,
        ProductComponentItem bomLine,
        string locationId,
        decimal quantitySold,
        string referenceType,
        string reasonLabel,
        IReadOnlyDictionary<string, Ingredient> ingredientsByCode,
        CancellationToken cancellationToken)
    {
        var piecesNeeded = bomLine.Quantity * quantitySold;
        if (piecesNeeded <= 0)
            return;

        var stockUnitsRequired = subProduct.YieldQuantity > 0
            ? piecesNeeded / subProduct.YieldQuantity
            : piecesNeeded;

        if (stockUnitsRequired <= 0)
            return;

        var stockRow = await db.ProductB2bLocationStocks
            .FirstOrDefaultAsync(
                s => s.ProductId == subProduct.Id && s.LocationExternalId == locationId,
                cancellationToken);

        var availableStock = stockRow?.InStock ?? 0m;
        var fromProducedStock = Math.Min(availableStock, stockUnitsRequired);
        var shortfall = stockUnitsRequired - fromProducedStock;

        if (fromProducedStock > 0 && stockRow is not null)
        {
            stockRow.InStock = Math.Max(0, stockRow.InStock - fromProducedStock);
            stockRow.UpdatedAt = DateTime.UtcNow;

            db.ProductProductionLogs.Add(new ProductProductionLog
            {
                ProductId = subProduct.Id,
                EntryType = referenceType,
                Quantity = fromProducedStock,
                ProductionDate = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd"),
                LocationIdsJson = JsonSerializer.Serialize(new[] { locationId }),
                BatchNumber = reasonLabel.Contains("prepaid", StringComparison.OrdinalIgnoreCase)
                    ? reasonLabel
                    : string.Empty,
                CompanyId = subProduct.CompanyId,
                CreatedAt = DateTime.UtcNow,
            });
        }

        if (shortfall <= 0)
            return;

        foreach (var recipeLine in subProduct.Items.Where(line => !string.IsNullOrWhiteSpace(line.ComponentId)))
        {
            if (!ingredientsByCode.TryGetValue(recipeLine.ComponentId, out var ingredient))
                continue;

            var nettQty = recipeLine.Quantity * shortfall;
            if (nettQty <= 0)
                continue;

            var componentQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, nettQty);

            await componentStock.RecordDeductionAsync(
                recipeLine.ComponentId,
                recipeLine.ComponentName,
                locationId,
                componentQty,
                recipeLine.ComponentUom,
                reason: $"{reasonLabel} — {parentProduct.Name} (sub-product recipe, no production stock)",
                referenceType: referenceType,
                referenceId: parentProduct.Id,
                companyId: parentProduct.CompanyId,
                cancellationToken);
        }

        foreach (var packagingLine in subProduct.PackagingItems.Where(line => !string.IsNullOrWhiteSpace(line.ComponentId)))
        {
            if (!ingredientsByCode.TryGetValue(packagingLine.ComponentId, out var ingredient))
                continue;

            var nettQty = packagingLine.Quantity * shortfall;
            if (nettQty <= 0)
                continue;

            var componentQty = ComponentYieldLossRules.ToGrossQuantity(ingredient, nettQty);

            await componentStock.RecordDeductionAsync(
                packagingLine.ComponentId,
                packagingLine.ComponentName,
                locationId,
                componentQty,
                packagingLine.ComponentUom,
                reason: $"{reasonLabel} — {parentProduct.Name} (sub-product recipe, no production stock)",
                referenceType: referenceType,
                referenceId: parentProduct.Id,
                companyId: parentProduct.CompanyId,
                cancellationToken);
        }
    }

    async Task<Dictionary<string, Ingredient>> LoadActiveIngredientsByCodeAsync(
        int? companyId,
        CancellationToken cancellationToken)
    {
        IQueryable<Ingredient> query = db.Ingredients.AsNoTracking().Where(i => i.Active);
        if (companyId is int cid)
            query = query.Where(i => i.CompanyId == null || i.CompanyId == cid);

        var rows = await query.ToListAsync(cancellationToken);
        return rows
            .GroupBy(i => i.ComponentId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
    }

    static string NormalizeChannel(string salesChannel)
    {
        var normalized = salesChannel.Trim().ToLowerInvariant();
        return ValidChannels.Contains(normalized) ? normalized : "pos";
    }

    public static string ChannelToReferenceType(string channel) =>
        channel switch
        {
            "online" => "online_order",
            "offline" => "offline_order",
            _ => "pos_sale",
        };

    static string ChannelToReasonLabel(string channel) =>
        channel switch
        {
            "online" => "Online order sales depletion",
            "offline" => "Offline order sales depletion",
            _ => "POS sales depletion",
        };
}
