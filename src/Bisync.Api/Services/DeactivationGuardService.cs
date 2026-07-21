using System.Text.Json;
using System.Text.Json.Nodes;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public record TaggedComponentRef(
    int Id,
    string ComponentId,
    string Name,
    IReadOnlyList<string> TaggedVendorProductIds,
    IReadOnlyList<string> TaggedVendorProductNames);

public static class DeactivationGuardService
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// Pending PO = not yet received and not yet consolidated (reconciled).
    /// </summary>
    public static bool IsPendingPurchaseOrderStatus(string? status)
    {
        var normalized = status?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(normalized)) return true;
        if (string.Equals(normalized, PurchaseOrderWorkflow.StatusReceived, StringComparison.OrdinalIgnoreCase))
            return false;
        if (string.Equals(normalized, PurchaseOrderWorkflow.StatusReconciled, StringComparison.OrdinalIgnoreCase))
            return false;
        return true;
    }

    public static async Task<string?> ValidateComponentDeactivationAsync(
        BisyncDbContext db,
        Ingredient ingredient,
        CancellationToken cancellationToken = default)
    {
        var componentId = ingredient.ComponentId?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(componentId))
            return null;

        var recipeProductNames = await db.ProductComponentItems.AsNoTracking()
            .Where(i => i.ComponentId == componentId)
            .Join(db.Products.AsNoTracking(), i => i.ProductId, p => p.Id, (i, p) => p.Name)
            .Distinct()
            .Take(5)
            .ToListAsync(cancellationToken);

        var packagingProductNames = await db.ProductPackagingItems.AsNoTracking()
            .Where(i => i.ComponentId == componentId)
            .Join(db.Products.AsNoTracking(), i => i.ProductId, p => p.Id, (i, p) => p.Name)
            .Distinct()
            .Take(5)
            .ToListAsync(cancellationToken);

        var attachedNames = recipeProductNames
            .Concat(packagingProductNames)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToList();

        if (attachedNames.Count > 0)
        {
            var sample = string.Join(", ", attachedNames);
            return $"Cannot deactivate: component is attached to product(s) or sub-product(s) ({sample}). Remove it from recipes first.";
        }

        var pendingPoCount = await db.PurchaseOrderItems.AsNoTracking()
            .Where(i => i.ComponentId == componentId)
            .Join(
                db.PurchaseOrders.AsNoTracking(),
                i => i.PurchaseOrderId,
                o => o.Id,
                (i, o) => o.Status)
            .ToListAsync(cancellationToken);

        var pending = pendingPoCount.Count(IsPendingPurchaseOrderStatus);
        if (pending > 0)
        {
            return $"Cannot deactivate: component has {pending} pending purchase order line(s) that are not yet received or consolidated.";
        }

        return null;
    }

    public static async Task<string?> ValidateB2bProductDeactivationAsync(
        BisyncDbContext db,
        Product product,
        CancellationToken cancellationToken = default)
    {
        if (!product.B2bEnabled)
            return null;

        var inStock = await db.ProductB2bLocationStocks.AsNoTracking()
            .Where(s => s.ProductId == product.Id)
            .SumAsync(s => (decimal?)s.InStock, cancellationToken) ?? 0m;

        if (inStock > 0)
            return $"Cannot deactivate: B2B product still has {inStock:0.####} on hand. Clear stock first.";

        var pendingQty = await db.B2bSalesOrderLines.AsNoTracking()
            .Where(l => l.ProductId == product.Id
                && l.Status != "fulfilled"
                && l.Status != "released")
            .Join(
                db.B2bSalesOrders.AsNoTracking()
                    .Where(o => o.Status == "draft" || o.Status == "issued" || o.Status == "confirmed"),
                line => line.SalesOrderId,
                order => order.Id,
                (line, _) => line.QuantityOrdered)
            .SumAsync(cancellationToken);

        if (pendingQty > 0)
            return $"Cannot deactivate: B2B product has {pendingQty:0.####} on pending sales order(s). Fulfil or cancel them first.";

        return null;
    }

    public static async Task<IReadOnlyList<TaggedComponentRef>> FindComponentsTaggedToVendorAsync(
        BisyncDbContext db,
        string vendorExternalId,
        int? companyId = null,
        CancellationToken cancellationToken = default)
    {
        var vendorId = vendorExternalId.Trim();
        if (string.IsNullOrEmpty(vendorId))
            return [];

        var vendorProducts = await db.VendorProducts.AsNoTracking()
            .Where(p => p.VendorExternalId == vendorId)
            .Select(p => new { p.ExternalId, p.ProductName })
            .ToListAsync(cancellationToken);

        if (vendorProducts.Count == 0)
            return [];

        var productIds = vendorProducts
            .Select(p => p.ExternalId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var productNames = vendorProducts.ToDictionary(
            p => p.ExternalId,
            p => p.ProductName,
            StringComparer.OrdinalIgnoreCase);

        IQueryable<Ingredient> query = db.Ingredients.AsNoTracking();
        if (companyId is int cid)
            query = query.Where(i => i.CompanyId == cid);

        // Narrow to rows that mention any vendor product id in DetailConfigJson.
        var candidates = await query
            .Where(i => i.DetailConfigJson != null && i.DetailConfigJson != "" && i.DetailConfigJson != "{}")
            .Select(i => new { i.Id, i.ComponentId, i.Name, i.DetailConfigJson })
            .ToListAsync(cancellationToken);

        var results = new List<TaggedComponentRef>();
        foreach (var row in candidates)
        {
            var taggedIds = ExtractTaggedVendorProductIds(row.DetailConfigJson);
            var matched = taggedIds
                .Where(id => productIds.Contains(id))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (matched.Count == 0) continue;

            results.Add(new TaggedComponentRef(
                row.Id,
                row.ComponentId,
                row.Name,
                matched,
                matched.Select(id => productNames.GetValueOrDefault(id) ?? id).ToList()));
        }

        return results
            .OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static IReadOnlyList<string> ExtractTaggedVendorProductIds(string? detailConfigJson)
    {
        if (string.IsNullOrWhiteSpace(detailConfigJson))
            return [];

        try
        {
            using var doc = JsonDocument.Parse(detailConfigJson);
            if (!doc.RootElement.TryGetProperty("taggedVendorProductIds", out var arr)
                || arr.ValueKind != JsonValueKind.Array)
                return [];

            return arr.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.String)
                .Select(e => e.GetString()?.Trim() ?? string.Empty)
                .Where(id => id.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string UntagVendorProductsFromDetailConfig(
        string? detailConfigJson,
        IReadOnlyCollection<string> vendorProductIdsToRemove)
    {
        var remove = vendorProductIdsToRemove
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (remove.Count == 0)
            return string.IsNullOrWhiteSpace(detailConfigJson) ? "{}" : detailConfigJson!;

        JsonObject root;
        try
        {
            root = string.IsNullOrWhiteSpace(detailConfigJson)
                ? new JsonObject()
                : JsonNode.Parse(detailConfigJson) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            return detailConfigJson ?? "{}";
        }

        var tagged = ExtractTaggedVendorProductIds(detailConfigJson)
            .Where(id => !remove.Contains(id))
            .ToList();

        root["taggedVendorProductIds"] = new JsonArray(tagged.Select(id => JsonValue.Create(id)).ToArray());

        if (root["vendorProductLocations"] is JsonObject locs)
        {
            foreach (var key in locs.Select(p => p.Key).Where(remove.Contains).ToList())
                locs.Remove(key);
        }

        var primaryId = root["vendorProductId"]?.GetValue<string>()?.Trim() ?? string.Empty;
        if (remove.Contains(primaryId) || tagged.Count == 0)
            root["vendorProductId"] = tagged.FirstOrDefault() ?? string.Empty;

        return root.ToJsonString(JsonOptions);
    }
}
