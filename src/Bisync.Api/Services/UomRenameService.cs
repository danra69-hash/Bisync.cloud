using System.Text.Json;
using System.Text.Json.Nodes;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Remaps a renamed UOM string across company-scoped masters and operational rows
/// so catalog edits stay effective in components, products, vendor products, stock, etc.
/// </summary>
public static class UomRenameService
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>Display ↔ API forms used by the client (componentForm toApiUom/fromApiUom).</summary>
    static readonly Dictionary<string, string> DisplayToApi = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Mg"] = "mg", ["Gr"] = "g", ["Kg"] = "kg", ["Tonne"] = "t",
        ["Ml"] = "ml", ["Cl"] = "cl", ["Ltr"] = "L",
        ["Each"] = "pcs", ["Pack"] = "pack", ["Punnet"] = "punnet", ["Bunch"] = "bunch",
        ["Tray"] = "tray", ["Case"] = "case", ["Bottle"] = "btl", ["Can"] = "can",
        ["Tin"] = "tin", ["Slice"] = "slice",
        ["Oz"] = "oz", ["Lb"] = "lb", ["FlOz"] = "fl oz", ["Gal"] = "gal",
    };

    public sealed record RemapCounts(
        int Ingredients,
        int Products,
        int ProductBomLines,
        int ProductPackagingLines,
        int VendorProducts,
        int OrderTemplateItems,
        int PurchaseOrderItems,
        int InventoryPurchases,
        int InventoryMovements,
        int CashPurchases,
        int WastageEntries,
        int TransferEntries,
        int InventoryCountLines,
        int QuoteRequestLines,
        int SampleRequests,
        int PromotionProducts,
        int ReturnableGoodsReturns,
        int B2bSalesOrderLines)
    {
        public int Total =>
            Ingredients + Products + ProductBomLines + ProductPackagingLines + VendorProducts
            + OrderTemplateItems + PurchaseOrderItems + InventoryPurchases + InventoryMovements
            + CashPurchases + WastageEntries + TransferEntries + InventoryCountLines
            + QuoteRequestLines + SampleRequests + PromotionProducts + ReturnableGoodsReturns
            + B2bSalesOrderLines;
    }

    public static async Task<RemapCounts> RemapAsync(
        BisyncDbContext db,
        int companyId,
        string fromRaw,
        string toRaw,
        CancellationToken cancellationToken = default)
    {
        var from = (fromRaw ?? string.Empty).Trim();
        var to = (toRaw ?? string.Empty).Trim();
        if (companyId <= 0 || from.Length == 0 || to.Length == 0)
            throw new ArgumentException("Company, from, and to are required.");
        if (string.Equals(from, to, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("New UOM name must differ from the current name.");

        var fromKeys = BuildMatchKeys(from);

        var ingredients = 0;
        var products = 0;
        var bom = 0;
        var packaging = 0;
        var vendorProducts = 0;
        var templates = 0;
        var poItems = 0;
        var purchases = 0;
        var movements = 0;
        var cash = 0;
        var wastage = 0;
        var transfers = 0;
        var countLines = 0;
        var quotes = 0;
        var samples = 0;
        var promos = 0;
        var returnables = 0;
        var b2bLines = 0;

        // --- Ingredients (components) ---
        var ingredientRows = await db.Ingredients
            .Where(i => i.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in ingredientRows)
        {
            var dirty = false;
            if (TryReplace(row.RecipeUom, fromKeys, to, out var recipe))
            {
                row.RecipeUom = recipe;
                dirty = true;
            }
            if (TryReplace(row.InventoryUom, fromKeys, to, out var inventory))
            {
                row.InventoryUom = inventory;
                dirty = true;
            }
            if (TryReplace(row.ParStockUom, fromKeys, to, out var par))
            {
                row.ParStockUom = par;
                dirty = true;
            }
            var nextDetail = RemapJsonStrings(row.DetailConfigJson, fromKeys, to);
            if (!string.Equals(nextDetail, row.DetailConfigJson, StringComparison.Ordinal))
            {
                row.DetailConfigJson = nextDetail;
                dirty = true;
            }
            if (dirty)
            {
                row.UpdatedAt = DateTime.UtcNow;
                ingredients++;
            }
        }

        // --- Products + BOM / packaging / aliases ---
        var productRows = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .Where(p => p.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var product in productRows)
        {
            var dirty = false;
            if (TryReplace(product.YieldUom, fromKeys, to, out var yieldUom))
            {
                product.YieldUom = yieldUom;
                dirty = true;
            }
            if (TryReplace(product.ParStockUom, fromKeys, to, out var productPar))
            {
                product.ParStockUom = productPar;
                dirty = true;
            }
            if (TryReplace(product.B2bPackageUnit, fromKeys, to, out var packageUnit))
            {
                product.B2bPackageUnit = packageUnit;
                dirty = true;
            }

            var nextYieldAlt = RemapJsonStrings(product.YieldAltUnitsJson, fromKeys, to);
            if (!string.Equals(nextYieldAlt, product.YieldAltUnitsJson, StringComparison.Ordinal))
            {
                product.YieldAltUnitsJson = nextYieldAlt;
                dirty = true;
            }
            var nextB2b = RemapJsonStrings(product.B2bSalesConfigJson, fromKeys, to);
            if (!string.Equals(nextB2b, product.B2bSalesConfigJson, StringComparison.Ordinal))
            {
                product.B2bSalesConfigJson = nextB2b;
                dirty = true;
            }
            var nextVariable = RemapJsonStrings(product.VariableOptionsJson, fromKeys, to);
            if (!string.Equals(nextVariable, product.VariableOptionsJson, StringComparison.Ordinal))
            {
                product.VariableOptionsJson = nextVariable;
                dirty = true;
            }

            foreach (var item in product.Items)
            {
                if (TryReplace(item.ComponentUom, fromKeys, to, out var componentUom))
                {
                    item.ComponentUom = componentUom;
                    bom++;
                    dirty = true;
                }
            }
            foreach (var item in product.PackagingItems)
            {
                if (TryReplace(item.ComponentUom, fromKeys, to, out var packUom))
                {
                    item.ComponentUom = packUom;
                    packaging++;
                    dirty = true;
                }
            }
            foreach (var alias in product.Aliases)
            {
                var nextAlias = RemapJsonStrings(alias.B2bSalesConfigJson, fromKeys, to);
                if (!string.Equals(nextAlias, alias.B2bSalesConfigJson, StringComparison.Ordinal))
                {
                    alias.B2bSalesConfigJson = nextAlias;
                    dirty = true;
                }
            }

            if (dirty)
            {
                product.UpdatedAt = DateTime.UtcNow;
                products++;
            }
        }

        // --- Vendor products for this company's vendors ---
        var vendorExternalIds = await db.Vendors.AsNoTracking()
            .Where(v => v.CompanyId == companyId && v.ExternalId != "")
            .Select(v => v.ExternalId)
            .ToListAsync(cancellationToken);
        if (vendorExternalIds.Count > 0)
        {
            var vendorIdSet = vendorExternalIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var vendorProductRows = await db.VendorProducts
                .Where(p => vendorIdSet.Contains(p.VendorExternalId))
                .ToListAsync(cancellationToken);
            foreach (var row in vendorProductRows)
            {
                var dirty = false;
                if (TryReplace(row.ReturnableUom, fromKeys, to, out var returnableUom))
                {
                    row.ReturnableUom = returnableUom;
                    dirty = true;
                }
                var nextDelivery = RemapJsonStrings(row.DeliveryJson, fromKeys, to);
                if (!string.Equals(nextDelivery, row.DeliveryJson, StringComparison.Ordinal))
                {
                    row.DeliveryJson = nextDelivery;
                    dirty = true;
                }
                if (dirty)
                {
                    row.UpdatedAt = DateTime.UtcNow;
                    vendorProducts++;
                }
            }
        }

        // --- Order templates ---
        var templateIds = await db.OrderTemplates.AsNoTracking()
            .Where(t => t.CompanyId == companyId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);
        if (templateIds.Count > 0)
        {
            var templateItems = await db.OrderTemplateItems
                .Where(i => templateIds.Contains(i.OrderTemplateId))
                .ToListAsync(cancellationToken);
            foreach (var item in templateItems)
            {
                var dirty = false;
                if (TryReplace(item.ComponentUom, fromKeys, to, out var cu))
                {
                    item.ComponentUom = cu;
                    dirty = true;
                }
                if (TryReplace(item.DeliveryUnit, fromKeys, to, out var du))
                {
                    item.DeliveryUnit = du;
                    dirty = true;
                }
                if (dirty) templates++;
            }
        }

        // --- Purchase order items ---
        var poIds = await db.PurchaseOrders.AsNoTracking()
            .Where(p => p.CompanyId == companyId)
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);
        if (poIds.Count > 0)
        {
            var items = await db.PurchaseOrderItems
                .Where(i => poIds.Contains(i.PurchaseOrderId))
                .ToListAsync(cancellationToken);
            foreach (var item in items)
            {
                var dirty = false;
                if (TryReplace(item.Unit, fromKeys, to, out var unit))
                {
                    item.Unit = unit;
                    dirty = true;
                }
                if (TryReplace(item.ComponentUom, fromKeys, to, out var cu))
                {
                    item.ComponentUom = cu;
                    dirty = true;
                }
                if (dirty) poItems++;
            }
        }

        // --- Inventory purchases / movements ---
        var purchaseRows = await db.InventoryPurchases
            .Where(p => p.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in purchaseRows)
        {
            if (TryReplace(row.Uom, fromKeys, to, out var uom))
            {
                row.Uom = uom;
                purchases++;
            }
        }

        var movementRows = await db.InventoryMovements
            .Where(m => m.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in movementRows)
        {
            if (TryReplace(row.Uom, fromKeys, to, out var uom))
            {
                row.Uom = uom;
                movements++;
            }
        }

        // --- Cash purchases ---
        var cashRows = await db.CashPurchases
            .Where(c => c.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in cashRows)
        {
            var dirty = false;
            if (TryReplace(row.DeliveryUnit, fromKeys, to, out var deliveryUnit))
            {
                row.DeliveryUnit = deliveryUnit;
                dirty = true;
            }
            if (TryReplace(row.ComponentUom, fromKeys, to, out var cu))
            {
                row.ComponentUom = cu;
                dirty = true;
            }
            if (dirty) cash++;
        }

        // --- Wastage / transfers ---
        var wastageRows = await db.WastageEntries
            .Where(w => w.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in wastageRows)
        {
            if (TryReplace(row.Uom, fromKeys, to, out var uom))
            {
                row.Uom = uom;
                wastage++;
            }
        }

        var transferRows = await db.TransferEntries
            .Where(t => t.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in transferRows)
        {
            if (TryReplace(row.Uom, fromKeys, to, out var uom))
            {
                row.Uom = uom;
                transfers++;
            }
        }

        // --- Inventory count lines ---
        var sessionIds = await db.InventoryCountSessions.AsNoTracking()
            .Where(s => s.CompanyId == companyId)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);
        if (sessionIds.Count > 0)
        {
            var lines = await db.InventoryCountSessionLines
                .Where(l => sessionIds.Contains(l.SessionId))
                .ToListAsync(cancellationToken);
            foreach (var line in lines)
            {
                if (TryReplace(line.Uom, fromKeys, to, out var uom))
                {
                    line.Uom = uom;
                    countLines++;
                }
            }
        }

        // --- Quote request lines ---
        var quoteIds = await db.QuoteRequests.AsNoTracking()
            .Where(q => q.CompanyId == companyId)
            .Select(q => q.Id)
            .ToListAsync(cancellationToken);
        if (quoteIds.Count > 0)
        {
            var lines = await db.QuoteRequestLines
                .Where(l => quoteIds.Contains(l.QuoteRequestId))
                .ToListAsync(cancellationToken);
            foreach (var line in lines)
            {
                var dirty = false;
                if (TryReplace(line.PrincipalUom, fromKeys, to, out var principal))
                {
                    line.PrincipalUom = principal;
                    dirty = true;
                }
                var nextResponses = RemapJsonStrings(line.VendorResponsesJson, fromKeys, to);
                if (!string.Equals(nextResponses, line.VendorResponsesJson, StringComparison.Ordinal))
                {
                    line.VendorResponsesJson = nextResponses;
                    dirty = true;
                }
                if (dirty) quotes++;
            }
        }

        // --- Sample requests ---
        var sampleRows = await db.SampleRequests
            .Where(s => s.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in sampleRows)
        {
            var dirty = false;
            if (TryReplace(row.QuantityUom, fromKeys, to, out var qtyUom))
            {
                row.QuantityUom = qtyUom;
                dirty = true;
            }
            if (TryReplace(row.DeliveryUnit, fromKeys, to, out var deliveryUnit))
            {
                row.DeliveryUnit = deliveryUnit;
                dirty = true;
            }
            if (dirty) samples++;
        }

        // --- Promotions ---
        var promoIds = await db.Promotions.AsNoTracking()
            .Where(p => p.CompanyId == companyId)
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);
        if (promoIds.Count > 0)
        {
            var promoProducts = await db.PromotionProducts
                .Where(p => promoIds.Contains(p.PromotionId))
                .ToListAsync(cancellationToken);
            foreach (var row in promoProducts)
            {
                if (TryReplace(row.DeliveryUnit, fromKeys, to, out var deliveryUnit))
                {
                    row.DeliveryUnit = deliveryUnit;
                    promos++;
                }
            }
        }

        // --- Returnable goods returns ---
        var returnRows = await db.ReturnableGoodsReturns
            .Where(r => r.CompanyId == companyId)
            .ToListAsync(cancellationToken);
        foreach (var row in returnRows)
        {
            if (TryReplace(row.Uom, fromKeys, to, out var uom))
            {
                row.Uom = uom;
                returnables++;
            }
        }

        // --- B2B sales order lines ---
        var b2bOrderIds = await db.B2bSalesOrders.AsNoTracking()
            .Where(o => o.CompanyId == companyId)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);
        if (b2bOrderIds.Count > 0)
        {
            var lines = await db.B2bSalesOrderLines
                .Where(l => b2bOrderIds.Contains(l.SalesOrderId))
                .ToListAsync(cancellationToken);
            foreach (var line in lines)
            {
                if (TryReplace(line.Uom, fromKeys, to, out var uom))
                {
                    line.Uom = uom;
                    b2bLines++;
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);

        return new RemapCounts(
            ingredients,
            products,
            bom,
            packaging,
            vendorProducts,
            templates,
            poItems,
            purchases,
            movements,
            cash,
            wastage,
            transfers,
            countLines,
            quotes,
            samples,
            promos,
            returnables,
            b2bLines);
    }

    internal static HashSet<string> BuildMatchKeys(string from)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        void Add(string? value)
        {
            var trimmed = (value ?? string.Empty).Trim();
            if (trimmed.Length > 0) keys.Add(trimmed);
        }

        Add(from);

        // Expand display↔API only for canonical built-ins (e.g. Gr↔g, Ltr↔L).
        // Custom spellings like "Gram" must stay exact-match so they do not pull in "Gr".
        string? familyDisplay = null;
        if (DisplayToApi.ContainsKey(from))
        {
            familyDisplay = DisplayToApi.Keys.First(k => string.Equals(k, from, StringComparison.OrdinalIgnoreCase));
        }
        else if (DisplayToApi.Values.Any(v => string.Equals(v, from, StringComparison.OrdinalIgnoreCase)))
        {
            familyDisplay = DisplayToApi
                .First(kv => string.Equals(kv.Value, from, StringComparison.OrdinalIgnoreCase))
                .Key;
        }

        if (familyDisplay is not null)
        {
            Add(familyDisplay);
            if (DisplayToApi.TryGetValue(familyDisplay, out var api))
                Add(api);
        }

        return keys;
    }

    static bool TryReplace(string? current, HashSet<string> fromKeys, string to, out string replaced)
    {
        var trimmed = (current ?? string.Empty).Trim();
        if (trimmed.Length > 0 && fromKeys.Contains(trimmed))
        {
            replaced = to;
            return !string.Equals(trimmed, to, StringComparison.Ordinal);
        }
        replaced = current ?? string.Empty;
        return false;
    }

    static string RemapJsonStrings(string? json, HashSet<string> fromKeys, string to)
    {
        if (string.IsNullOrWhiteSpace(json)) return json ?? string.Empty;
        try
        {
            var node = JsonNode.Parse(json);
            if (node is null) return json;
            if (!RemapNode(node, fromKeys, to)) return json;
            return node.ToJsonString(JsonOptions);
        }
        catch
        {
            return json;
        }
    }

    static bool RemapNode(JsonNode node, HashSet<string> fromKeys, string to)
    {
        switch (node)
        {
            case JsonValue value when value.TryGetValue<string>(out var text):
            {
                if (TryReplace(text, fromKeys, to, out var replaced) && !string.Equals(text, replaced, StringComparison.Ordinal))
                {
                    // JsonValue is immutable via parent assignment — handled by object/array parents.
                    return true;
                }
                return false;
            }
            case JsonObject obj:
            {
                var dirty = false;
                foreach (var property in obj.ToList())
                {
                    if (property.Value is null) continue;
                    if (property.Value is JsonValue value && value.TryGetValue<string>(out var text))
                    {
                        if (TryReplace(text, fromKeys, to, out var replaced)
                            && !string.Equals(text, replaced, StringComparison.Ordinal))
                        {
                            obj[property.Key] = replaced;
                            dirty = true;
                        }
                    }
                    else if (RemapNode(property.Value, fromKeys, to))
                    {
                        dirty = true;
                    }
                }
                return dirty;
            }
            case JsonArray array:
            {
                var dirty = false;
                for (var i = 0; i < array.Count; i++)
                {
                    var child = array[i];
                    if (child is null) continue;
                    if (child is JsonValue value && value.TryGetValue<string>(out var text))
                    {
                        if (TryReplace(text, fromKeys, to, out var replaced)
                            && !string.Equals(text, replaced, StringComparison.Ordinal))
                        {
                            array[i] = replaced;
                            dirty = true;
                        }
                    }
                    else if (RemapNode(child, fromKeys, to))
                    {
                        dirty = true;
                    }
                }
                return dirty;
            }
            default:
                return false;
        }
    }
}
