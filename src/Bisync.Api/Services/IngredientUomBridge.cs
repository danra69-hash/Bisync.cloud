using System.Globalization;
using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Converts quantities between an ingredient's recipe (Principal Component Unit) and inventory UOMs
/// using DetailConfigJson. Stock cards base on Principal Component Unit (recipe) and match
/// movements by UOM (with inventory↔recipe conversion), so inbound writes prefer PCU.
/// </summary>
public static class IngredientUomBridge
{
    public static (decimal Quantity, string Uom) ToInventoryPreferred(
        Ingredient ingredient,
        decimal quantity,
        string uom)
    {
        if (quantity <= 0 || ingredient is null)
            return (quantity, (uom ?? string.Empty).Trim());

        var selected = UomCanonical.Normalize(uom);
        var inventory = UomCanonical.Normalize(ingredient.InventoryUom);
        var recipe = UomCanonical.Normalize(ingredient.RecipeUom);

        if (string.IsNullOrEmpty(selected))
            return (quantity, ingredient.InventoryUom?.Trim() ?? uom);

        if (!string.IsNullOrEmpty(inventory) && selected == inventory)
            return (quantity, ingredient.InventoryUom.Trim());

        if (!string.IsNullOrEmpty(recipe)
            && selected == recipe
            && !string.IsNullOrEmpty(inventory)
            && recipe != inventory
            && TryGetRatio(ingredient.DetailConfigJson, out var inventoryPer, out var recipePer)
            && recipePer > 0)
        {
            // inventoryPer inventoryUom = recipePer recipeUom
            var inventoryQty = quantity * (inventoryPer / recipePer);
            return (inventoryQty, ingredient.InventoryUom.Trim());
        }

        return (quantity, uom.Trim());
    }

    /// <summary>
    /// Prefer Principal Component Unit (RecipeUom) for stock card / on-hand writes.
    /// </summary>
    public static (decimal Quantity, string Uom) ToRecipePreferred(
        Ingredient ingredient,
        decimal quantity,
        string uom)
    {
        if (quantity <= 0 || ingredient is null)
            return (quantity, (uom ?? string.Empty).Trim());

        var selected = UomCanonical.Normalize(uom);
        var inventory = UomCanonical.Normalize(ingredient.InventoryUom);
        var recipe = UomCanonical.Normalize(ingredient.RecipeUom);
        var recipeLabel = string.IsNullOrWhiteSpace(ingredient.RecipeUom)
            ? (uom ?? string.Empty).Trim()
            : ingredient.RecipeUom.Trim();

        if (string.IsNullOrEmpty(selected))
            return (quantity, recipeLabel);

        if (!string.IsNullOrEmpty(recipe) && selected == recipe)
            return (quantity, recipeLabel);

        if (!string.IsNullOrEmpty(inventory)
            && selected == inventory
            && !string.IsNullOrEmpty(recipe)
            && recipe != inventory
            && TryGetRatio(ingredient.DetailConfigJson, out var inventoryPer, out var recipePer)
            && inventoryPer > 0)
        {
            // inventoryPer inventoryUom = recipePer recipeUom
            var recipeQty = quantity * (recipePer / inventoryPer);
            return (recipeQty, recipeLabel);
        }

        return (quantity, (uom ?? string.Empty).Trim());
    }

    /// <summary>
    /// Delivery→PCU inbound conversion result. Document amount (PO/cash line) is financial
    /// authority; unit price is 4dp working rate; residual = extended@4dp − document.
    /// </summary>
    public readonly record struct InboundPrincipalConversion(
        decimal Quantity,
        string Uom,
        decimal UnitPrice,
        decimal DocumentAmount,
        decimal ExtendedAtUnitPrice,
        decimal RoundingResidual)
    {
        public void Deconstruct(out decimal quantity, out string uom, out decimal unitPrice)
        {
            quantity = Quantity;
            uom = Uom;
            unitPrice = UnitPrice;
        }

        public static InboundPrincipalConversion FromStock(
            decimal quantity,
            string uom,
            decimal unitPrice,
            decimal documentAmount)
        {
            var price = DecimalRounding.ToDb(unitPrice);
            var qty = quantity;
            var doc = DecimalRounding.ToDb(documentAmount);
            var extended = qty > 0 && price > 0
                ? DecimalRounding.ToDb(qty * price)
                : doc;
            var residual = DecimalRounding.ToDb(extended - doc);
            return new InboundPrincipalConversion(qty, (uom ?? string.Empty).Trim(), price, doc, extended, residual);
        }

        public static InboundPrincipalConversion Passthrough(decimal quantity, string uom, decimal unitPrice)
        {
            var price = DecimalRounding.ToDb(unitPrice);
            var doc = DecimalRounding.ToDb(quantity * price);
            return new InboundPrincipalConversion(
                quantity,
                (uom ?? string.Empty).Trim(),
                price,
                doc,
                doc,
                0m);
        }
    }

    /// <summary>
    /// Converts a received delivery-package quantity into Principal Component Unit for stock posting.
    /// <para>
    /// Step 1 (component detail tag): <c>stockQty = deliveryPackages × principalPerPackage</c>
    /// (e.g. 6 tub × 3790 Gr = 22,740 Gr).
    /// </para>
    /// <para>
    /// Step 2: <c>stockUnitPrice = (deliveryPackages × PO delivery unit price) ÷ stockQty</c>
    /// i.e. Vendor Product PO line amount ÷ total Principal Component qty
    /// (e.g. RM 750 ÷ 22,740 = 0.03298153… → 0.0330 at 4dp).
    /// </para>
    /// <para>
    /// Step 3: unit price is persisted at 4 decimal places (5th digit AwayFromZero).
    /// <c>RoundingResidual = ExtendedAtUnitPrice − DocumentAmount</c> (e.g. 125.07 − 125.00 = +0.07).
    /// Document amount stays AP/PO authority; residual is stored and shown on Stock Card inbound.
    /// </para>
    /// Falls back to vendor-product delivery path, then inventory↔recipe conversion.
    /// PO lines often label <paramref name="uom"/> as RecipeUom while <paramref name="quantity"/>
    /// is still delivery packages — conversion always runs when a principal factor is known.
    /// </summary>
    public static InboundPrincipalConversion ToInboundPrincipal(
        Ingredient ingredient,
        decimal quantity,
        string uom,
        decimal unitPrice,
        string? vendorProductId = null,
        string? deliveryUom = null,
        decimal? fallbackPrincipalPerPackage = null,
        string? fallbackPrincipalUom = null)
    {
        var sourceUom = (uom ?? string.Empty).Trim();
        if (quantity <= 0 || ingredient is null)
            return InboundPrincipalConversion.Passthrough(quantity, sourceUom, unitPrice);

        var recipeLabel = string.IsNullOrWhiteSpace(ingredient.RecipeUom)
            ? sourceUom
            : ingredient.RecipeUom.Trim();
        var recipe = UomCanonical.Normalize(ingredient.RecipeUom);
        var inventory = UomCanonical.Normalize(ingredient.InventoryUom);
        var selected = UomCanonical.Normalize(sourceUom);
        var delivery = UomCanonical.Normalize(deliveryUom);
        var documentAmount = DecimalRounding.ToDb(quantity * unitPrice);

        // Prefer tagged principal (with VP-id fallbacks), then delivery-path principal.
        // PO create often sets ComponentUom = RecipeUom while quantity is still packages —
        // when principal > 1 we always convert unless qty already looks like packages×principal.
        if (TryResolvePrincipalPerPackage(
                ingredient,
                vendorProductId,
                fallbackPrincipalPerPackage,
                fallbackPrincipalUom,
                out var principalPerPackage,
                out var taggedComponentUom)
            && principalPerPackage > 0)
        {
            var principalInRecipe = ResolvePrincipalInRecipeUom(
                ingredient,
                principalPerPackage,
                taggedComponentUom,
                recipeLabel,
                recipe,
                inventory);

            if (principalInRecipe > 1.0000001m)
            {
                if (LooksAlreadyConvertedToPrincipal(quantity, unitPrice, principalInRecipe))
                    return InboundPrincipalConversion.FromStock(quantity, recipeLabel, unitPrice, documentAmount);

                return ConvertDeliveryPackagesToPrincipal(
                    deliveryPackages: quantity,
                    deliveryUnitPrice: unitPrice,
                    principalPerPackage: principalInRecipe,
                    recipeUomLabel: recipeLabel);
            }

            // principal == 1 (1:1 package↔PCU): only rewrite UOM label when source is delivery.
            if (principalInRecipe > 0
                && !string.IsNullOrEmpty(delivery)
                && delivery != recipe
                && selected == delivery)
            {
                return ConvertDeliveryPackagesToPrincipal(
                    deliveryPackages: quantity,
                    deliveryUnitPrice: unitPrice,
                    principalPerPackage: principalInRecipe,
                    recipeUomLabel: recipeLabel);
            }
        }

        // Already PCU — only when no convertible delivery principal was available.
        if (!string.IsNullOrEmpty(recipe) && selected == recipe)
            return InboundPrincipalConversion.FromStock(quantity, recipeLabel, unitPrice, documentAmount);

        if (!string.IsNullOrEmpty(inventory) && selected == inventory
            && !string.IsNullOrEmpty(recipe) && recipe != inventory)
        {
            var (convertedQty, convertedUom) = ToRecipePreferred(ingredient, quantity, sourceUom);
            if (convertedQty > 0 && quantity > 0 && ConvertedAwayFromSource(quantity, convertedQty, selected, UomCanonical.Normalize(convertedUom)))
            {
                // Preserve PO line amount: (packages × packagePrice) / principalQty.
                var stockPrice = DecimalRounding.ToDb(documentAmount / convertedQty);
                return InboundPrincipalConversion.FromStock(convertedQty, convertedUom, stockPrice, documentAmount);
            }
            return InboundPrincipalConversion.FromStock(convertedQty, convertedUom, unitPrice, documentAmount);
        }

        // Qty may still be labeled with delivery UOM while ComponentUom was empty.
        if (!string.IsNullOrEmpty(delivery)
            && delivery != recipe
            && delivery != inventory
            && selected == delivery)
        {
            // No principal factor — keep as-is but label PCU when recipe exists so stock card can show it.
            if (!string.IsNullOrEmpty(recipeLabel))
                return InboundPrincipalConversion.FromStock(quantity, recipeLabel, unitPrice, documentAmount);
        }

        var (fallbackQty, fallbackUom) = ToRecipePreferred(ingredient, quantity, sourceUom);
        return InboundPrincipalConversion.FromStock(fallbackQty, fallbackUom, unitPrice, documentAmount);
    }

    /// <summary>
    /// Core Step 1 conversion used by receive / heal / stock card inbound.
    /// <c>stockQty = packages × principal</c>;
    /// <c>stockUnitPrice = round4(PO line amount ÷ stockQty)</c>.
    /// </summary>
    public static InboundPrincipalConversion ConvertDeliveryPackagesToPrincipal(
        decimal deliveryPackages,
        decimal deliveryUnitPrice,
        decimal principalPerPackage,
        string recipeUomLabel)
    {
        if (deliveryPackages <= 0 || principalPerPackage <= 0)
            return InboundPrincipalConversion.Passthrough(deliveryPackages, recipeUomLabel, deliveryUnitPrice);

        // Keep full precision on qty; round only the derived unit price (4dp).
        var stockQty = deliveryPackages * principalPerPackage;
        var poLineAmount = deliveryPackages * deliveryUnitPrice;
        var stockUnitPrice = DecimalRounding.ToDb(poLineAmount / stockQty);
        return InboundPrincipalConversion.FromStock(stockQty, recipeUomLabel, stockUnitPrice, poLineAmount);
    }

    /// <summary>UI / ledger label for a non-zero UOM rounding residual.</summary>
    public static string FormatRoundingResidualNote(
        decimal roundingResidual,
        decimal documentAmount,
        decimal extendedAtUnitPrice,
        decimal unitPrice)
    {
        if (Math.Abs(roundingResidual) <= 0.00005m)
            return string.Empty;
        var sign = roundingResidual > 0 ? "+" : "";
        return $"UOM rounding residual {sign}{roundingResidual:0.####} "
            + $"(PCU {extendedAtUnitPrice:0.####} @ {unitPrice:0.####}; document {documentAmount:0.####})";
    }

    /// <summary>
    /// True when a posted stock row still looks like delivery-package qty @ delivery-package price
    /// (needs packages × principal conversion).
    /// <paramref name="deliveryPackageQty"/> must be the PO shipment/order package count, not the posted PCU qty.
    /// </summary>
    public static bool NeedsDeliveryToPrincipalConversion(
        Ingredient ingredient,
        decimal postedQty,
        decimal postedUnitPrice,
        decimal deliveryPackageQty,
        decimal deliveryUnitPrice,
        string? vendorProductId,
        decimal? fallbackPrincipalPerPackage = null,
        string? fallbackPrincipalUom = null)
    {
        if (ingredient is null || postedQty <= 0 || deliveryPackageQty <= 0)
            return false;
        if (!TryResolvePrincipalPerPackage(
                ingredient,
                vendorProductId,
                fallbackPrincipalPerPackage,
                fallbackPrincipalUom,
                out var principal,
                out var taggedUom)
            || principal <= 0)
            return false;

        var recipeLabel = string.IsNullOrWhiteSpace(ingredient.RecipeUom)
            ? taggedUom
            : ingredient.RecipeUom.Trim();
        var principalInRecipe = ResolvePrincipalInRecipeUom(
            ingredient,
            principal,
            string.IsNullOrWhiteSpace(taggedUom) ? (fallbackPrincipalUom ?? string.Empty) : taggedUom,
            recipeLabel,
            UomCanonical.Normalize(ingredient.RecipeUom),
            UomCanonical.Normalize(ingredient.InventoryUom));

        if (principalInRecipe <= 1.0000001m)
            return false;

        var expectedQty = deliveryPackageQty * principalInRecipe;
        var poLineAmount = deliveryPackageQty * deliveryUnitPrice;
        var expectedPrice = expectedQty > 0
            ? DecimalRounding.ToDb(poLineAmount / expectedQty)
            : 0m;

        // Already correct (qty + rounded principal unit price).
        if (NearlyEqual(postedQty, expectedQty)
            && (expectedPrice <= 0 || NearlyEqual(postedUnitPrice, expectedPrice)))
            return false;

        // Posted qty still matches package count (never multiplied by principal).
        if (NearlyEqual(postedQty, deliveryPackageQty))
            return true;

        // Posted price still matches delivery package price (never divided by principal).
        if (deliveryUnitPrice > 0 && NearlyEqual(postedUnitPrice, deliveryUnitPrice))
            return true;

        // Posted qty is far below expected PCU (under-converted) while value ≈ package line.
        if (postedQty + 0.0001m < expectedQty
            && deliveryUnitPrice > 0
            && NearlyEqual(postedQty * postedUnitPrice, poLineAmount))
            return true;

        return false;
    }

    /// <summary>
    /// Resolves principal-per-package from component tags (exact VP, primary VP, single tagged
    /// principal &gt; 1), then optional delivery-path fallback from the vendor product catalog.
    /// </summary>
    public static bool TryResolvePrincipalPerPackage(
        Ingredient ingredient,
        string? vendorProductId,
        decimal? fallbackPrincipalPerPackage,
        string? fallbackPrincipalUom,
        out decimal principalPerPackage,
        out string componentUom)
    {
        principalPerPackage = 0m;
        componentUom = string.Empty;
        if (ingredient is null)
            return false;

        if (TryGetVendorPrincipalPerPackage(
                ingredient.DetailConfigJson,
                vendorProductId,
                out principalPerPackage,
                out componentUom)
            && principalPerPackage > 1.0000001m)
            return true;

        // Placeholder / missing tag for this VP — try primary or sole tagged principal > 1.
        if (TryGetBestTaggedPrincipal(
                ingredient.DetailConfigJson,
                out var taggedPrincipal,
                out var taggedUom)
            && taggedPrincipal > 1.0000001m)
        {
            principalPerPackage = taggedPrincipal;
            componentUom = taggedUom;
            return true;
        }

        if (fallbackPrincipalPerPackage is decimal fb && fb > 1.0000001m)
        {
            principalPerPackage = fb;
            componentUom = (fallbackPrincipalUom ?? string.Empty).Trim();
            return true;
        }

        // Keep exact tag of 1 when that is the only signal (1:1 package↔PCU).
        if (principalPerPackage > 0)
            return true;

        return TryGetVendorPrincipalPerPackage(
            ingredient.DetailConfigJson,
            vendorProductId,
            out principalPerPackage,
            out componentUom);
    }

    public static bool TryGetVendorPrincipalPerPackage(
        string? detailConfigJson,
        string? vendorProductId,
        out decimal principalPerPackage,
        out string componentUom)
    {
        principalPerPackage = 0m;
        componentUom = string.Empty;
        var vpId = (vendorProductId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(detailConfigJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            var root = doc.RootElement;

            if (string.IsNullOrEmpty(vpId))
            {
                // Fall back to primary vendorProductId on the component detail.
                vpId = root.TryGetProperty("vendorProductId", out var primaryEl)
                    && primaryEl.ValueKind == JsonValueKind.String
                        ? primaryEl.GetString()?.Trim() ?? string.Empty
                        : string.Empty;
            }

            if (string.IsNullOrEmpty(vpId))
                return false;

            if (root.TryGetProperty("vendorProductPrincipalQty", out var qtyMap)
                && qtyMap.ValueKind == JsonValueKind.Object)
            {
                if (TryGetMapDecimal(qtyMap, vpId, out var qty) && qty > 0)
                    principalPerPackage = qty;
            }

            if (root.TryGetProperty("vendorProductComponentUom", out var uomMap)
                && uomMap.ValueKind == JsonValueKind.Object)
            {
                componentUom = TryGetMapString(uomMap, vpId);
            }

            return principalPerPackage > 0;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// When the PO line VP id is missing/mismatched, use the sole tagged principal &gt; 1
    /// (or the largest if multiple — still better than posting raw packages).
    /// </summary>
    public static bool TryGetBestTaggedPrincipal(
        string? detailConfigJson,
        out decimal principalPerPackage,
        out string componentUom)
    {
        principalPerPackage = 0m;
        componentUom = string.Empty;
        if (string.IsNullOrWhiteSpace(detailConfigJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            var root = doc.RootElement;
            if (!root.TryGetProperty("vendorProductPrincipalQty", out var qtyMap)
                || qtyMap.ValueKind != JsonValueKind.Object)
                return false;

            string? bestId = null;
            decimal bestQty = 0m;
            foreach (var prop in qtyMap.EnumerateObject())
            {
                var qty = ParseDecimal(prop.Value);
                if (qty <= 1.0000001m) continue;
                if (qty > bestQty)
                {
                    bestQty = qty;
                    bestId = prop.Name;
                }
            }

            if (bestId is null || bestQty <= 0)
                return false;

            // Prefer a unique tagged principal; if several exist, still use the largest
            // so under-converted stock (5 pkg @ package price) can be healed.
            principalPerPackage = bestQty;
            if (root.TryGetProperty("vendorProductComponentUom", out var uomMap)
                && uomMap.ValueKind == JsonValueKind.Object)
            {
                componentUom = TryGetMapString(uomMap, bestId);
            }

            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Converts quantity (and unit price) from <paramref name="fromUom"/> into <paramref name="toUom"/>
    /// when both are the ingredient's recipe/inventory principals (or identical).
    /// </summary>
    public static bool TryConvertToUom(
        Ingredient ingredient,
        decimal quantity,
        decimal unitPrice,
        string fromUom,
        string toUom,
        out decimal convertedQty,
        out decimal convertedPrice)
    {
        convertedQty = quantity;
        convertedPrice = unitPrice;
        if (ingredient is null) return false;

        var from = UomCanonical.Normalize(fromUom);
        var to = UomCanonical.Normalize(toUom);
        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to))
            return false;
        if (from == to)
            return true;

        if (!TryConvertQuantity(ingredient, quantity, fromUom, toUom, out convertedQty))
            return false;

        if (quantity > 0 && convertedQty > 0)
            convertedPrice = DecimalRounding.ToDb(unitPrice * (quantity / convertedQty));
        return true;
    }

    public static bool TryConvertQuantity(
        Ingredient ingredient,
        decimal quantity,
        string fromUom,
        string toUom,
        out decimal convertedQty)
    {
        convertedQty = quantity;
        if (ingredient is null) return false;

        var from = UomCanonical.Normalize(fromUom);
        var to = UomCanonical.Normalize(toUom);
        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to))
            return false;
        if (from == to)
            return true;

        // SI family conversion (mass/volume) before ingredient-specific inventory↔recipe ratio.
        if (DeliveryPrincipalResolver.TryConvertMeasure(quantity, fromUom, toUom, out convertedQty))
            return true;

        var inventory = UomCanonical.Normalize(ingredient.InventoryUom);
        var recipe = UomCanonical.Normalize(ingredient.RecipeUom);

        if (string.IsNullOrEmpty(inventory) || string.IsNullOrEmpty(recipe) || inventory == recipe)
            return false;

        if (!TryGetRatio(ingredient.DetailConfigJson, out var inventoryPer, out var recipePer)
            || inventoryPer <= 0
            || recipePer <= 0)
            return false;

        if (from == inventory && to == recipe)
        {
            convertedQty = quantity * (recipePer / inventoryPer);
            return true;
        }

        if (from == recipe && to == inventory)
        {
            convertedQty = quantity * (inventoryPer / recipePer);
            return true;
        }

        return false;
    }

    static decimal ResolvePrincipalInRecipeUom(
        Ingredient ingredient,
        decimal principalPerPackage,
        string taggedComponentUom,
        string recipeLabel,
        string recipe,
        string inventory)
    {
        var principalInRecipe = principalPerPackage;
        var tagged = UomCanonical.Normalize(taggedComponentUom);
        if (string.IsNullOrEmpty(tagged) || string.IsNullOrEmpty(recipe) || tagged == recipe)
            return principalInRecipe;

        // SI mass/volume first (g↔kg, ml↔Ltr) — does not require DetailConfigJson ratio.
        if (DeliveryPrincipalResolver.TryConvertMeasure(
                principalPerPackage,
                taggedComponentUom,
                recipeLabel,
                out var siConverted)
            && siConverted > 0)
            return siConverted;

        if (TryConvertQuantity(ingredient, principalPerPackage, taggedComponentUom, recipeLabel, out var convertedPrincipal))
            return convertedPrincipal;

        if (!string.IsNullOrEmpty(inventory)
            && tagged == inventory
            && tagged != recipe)
        {
            var (converted, _) = ToRecipePreferred(ingredient, principalPerPackage, taggedComponentUom);
            return converted;
        }

        return principalInRecipe;
    }

    /// <summary>
    /// Heuristic: qty already looks like packages×principal (>> 1 package) and unit price
    /// looks like deliveryPrice/principal (much smaller than a typical package price).
    /// </summary>
    static bool LooksAlreadyConvertedToPrincipal(
        decimal quantity,
        decimal unitPrice,
        decimal principalPerPackage)
    {
        if (principalPerPackage <= 1.0000001m) return false;
        // Converted qty is at least ~one full package worth of PCU.
        if (quantity + 0.0001m < principalPerPackage) return false;
        // Unit price should be a small fraction of package price after ÷ principal.
        var packagesApprox = quantity / principalPerPackage;
        if (packagesApprox < 0.5m) return false;
        // If price × principal ≈ a plausible delivery price (> unitPrice itself), treat as converted.
        var impliedDelivery = unitPrice * principalPerPackage;
        return impliedDelivery > unitPrice * 1.5m;
    }

    static bool NearlyEqual(decimal a, decimal b, decimal tolerance = 0.00015m)
        => Math.Abs(a - b) <= Math.Max(tolerance, Math.Abs(a) * 0.0001m);

    static bool TryGetMapDecimal(JsonElement map, string key, out decimal value)
    {
        value = 0m;
        if (map.TryGetProperty(key, out var el))
        {
            value = ParseDecimal(el);
            return value > 0;
        }

        foreach (var prop in map.EnumerateObject())
        {
            if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                continue;
            value = ParseDecimal(prop.Value);
            return value > 0;
        }

        return false;
    }

    static string TryGetMapString(JsonElement map, string key)
    {
        if (map.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.String)
            return el.GetString()?.Trim() ?? string.Empty;

        foreach (var prop in map.EnumerateObject())
        {
            if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                continue;
            return prop.Value.ValueKind == JsonValueKind.String
                ? prop.Value.GetString()?.Trim() ?? string.Empty
                : string.Empty;
        }

        return string.Empty;
    }

    static bool TryGetRatio(string? detailConfigJson, out decimal inventoryPer, out decimal recipePer)
    {
        inventoryPer = 1m;
        recipePer = 1m;
        if (string.IsNullOrWhiteSpace(detailConfigJson))
            return false;

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("convertFromInventoryQty", out var fromEl))
                inventoryPer = ParseDecimal(fromEl);
            if (root.TryGetProperty("convertToRecipeQty", out var toEl))
                recipePer = ParseDecimal(toEl);
            return inventoryPer > 0 && recipePer > 0;
        }
        catch
        {
            return false;
        }
    }

    static decimal ParseDecimal(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Number && el.TryGetDecimal(out var n))
            return n;
        if (el.ValueKind == JsonValueKind.String
            && decimal.TryParse(el.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var s))
            return s;
        return 0m;
    }

    static bool ConvertedAwayFromSource(
        decimal sourceQty,
        decimal convertedQty,
        string sourceUom,
        string convertedUom)
        => sourceUom != convertedUom || Math.Abs(sourceQty - convertedQty) > 0.0000001m;
}
