using System.Text.Json;
using System.Text.Json.Nodes;
using Bisync.Api.Controllers;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Services;

/// <summary>
/// System-wide catalog hygiene:
/// - Normalize Category/Group casing on ingredients and products
/// - Merge case-insensitive duplicate category/group labels within a company hierarchy
/// - Deactivate duplicate product names within the same company + category + group
/// </summary>
public static class CatalogLabelHealer
{
    public static async Task<int> ApplyAsync(
        BisyncDbContext db,
        ILogger? logger = null,
        CancellationToken ct = default)
    {
        var changed = 0;
        changed += await NormalizeIngredientLabelsAsync(db, ct);
        changed += await NormalizeProductLabelsAsync(db, ct);
        changed += await DeduplicateHierarchyConfigsAsync(db, logger, ct);
        changed += await DeactivateDuplicateProductNamesAsync(db, logger, ct);
        if (changed > 0)
            await db.SaveChangesAsync(ct);
        return changed;
    }

    static async Task<int> NormalizeIngredientLabelsAsync(BisyncDbContext db, CancellationToken ct)
    {
        var rows = await db.Ingredients.ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            var category = IngredientCatalogNormalizer.NormalizeCategory(row.Category);
            var group = IngredientCatalogNormalizer.NormalizeGroup(row.Group);
            if (string.Equals(category, row.Category, StringComparison.Ordinal)
                && string.Equals(group, row.Group, StringComparison.Ordinal))
            {
                continue;
            }
            row.Category = category;
            row.Group = group;
            row.UpdatedAt = DateTime.UtcNow;
            n += 1;
        }
        return n;
    }

    static async Task<int> NormalizeProductLabelsAsync(BisyncDbContext db, CancellationToken ct)
    {
        var rows = await db.Products.ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            var category = IngredientCatalogNormalizer.NormalizeCategory(row.Category);
            var group = IngredientCatalogNormalizer.NormalizeGroup(row.Group);
            if (string.Equals(category, row.Category, StringComparison.Ordinal)
                && string.Equals(group, row.Group, StringComparison.Ordinal))
            {
                continue;
            }
            row.Category = category;
            row.Group = group;
            row.UpdatedAt = DateTime.UtcNow;
            n += 1;
        }
        return n;
    }

    static async Task<int> DeduplicateHierarchyConfigsAsync(
        BisyncDbContext db,
        ILogger? logger,
        CancellationToken ct)
    {
        var configs = await db.RevMgmtCompanyConfigs
            .Where(c => c.ConfigKey == RevMgmtConfigController.ComponentHierarchyKey)
            .ToListAsync(ct);
        var n = 0;
        foreach (var config in configs)
        {
            if (string.IsNullOrWhiteSpace(config.StateJson)) continue;
            try
            {
                var root = JsonNode.Parse(config.StateJson) as JsonObject;
                if (root is null) continue;
                if (!TryMergeHierarchyJson(root, out var merged)) continue;
                config.StateJson = merged.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
                config.UpdatedAt = DateTime.UtcNow;
                n += 1;
                logger?.LogInformation(
                    "Merged duplicate category/group labels in componentHierarchy for company {CompanyId}",
                    config.CompanyId);
            }
            catch (Exception ex)
            {
                logger?.LogWarning(ex, "Failed hierarchy dedupe for company {CompanyId}", config.CompanyId);
            }
        }
        return n;
    }

    internal static bool TryMergeHierarchyJson(JsonObject root, out JsonObject merged)
    {
        merged = root;
        if (root["categories"] is not JsonArray categoriesArr
            || root["groups"] is not JsonArray groupsArr)
        {
            return false;
        }

        var categoryKeep = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
        var categoryIdRemap = new Dictionary<int, int>();
        var nextCategories = new JsonArray();
        foreach (var node in categoriesArr.OfType<JsonObject>().OrderBy(c => c["id"]?.GetValue<int>() ?? 0))
        {
            var id = node["id"]?.GetValue<int>() ?? 0;
            var name = (node["name"]?.GetValue<string>() ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name) || id <= 0) continue;
            if (!categoryKeep.TryGetValue(name, out var keep))
            {
                var copy = JsonNode.Parse(node.ToJsonString())!.AsObject();
                copy["name"] = name;
                categoryKeep[name] = copy;
                categoryIdRemap[id] = id;
                nextCategories.Add(copy);
                continue;
            }
            var keepId = keep["id"]!.GetValue<int>();
            categoryIdRemap[id] = keepId;
        }

        var groupKeep = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
        var groupIdRemap = new Dictionary<int, int>();
        var nextGroups = new JsonArray();
        foreach (var node in groupsArr.OfType<JsonObject>().OrderBy(g => g["id"]?.GetValue<int>() ?? 0))
        {
            var id = node["id"]?.GetValue<int>() ?? 0;
            var categoryId = node["categoryId"]?.GetValue<int>() ?? 0;
            var name = (node["name"]?.GetValue<string>() ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name) || id <= 0) continue;
            if (categoryIdRemap.TryGetValue(categoryId, out var remappedCategory))
                categoryId = remappedCategory;
            var key = $"{categoryId}::{name}";
            if (!groupKeep.TryGetValue(key, out var keep))
            {
                var copy = JsonNode.Parse(node.ToJsonString())!.AsObject();
                copy["name"] = name;
                copy["categoryId"] = categoryId;
                groupKeep[key] = copy;
                groupIdRemap[id] = id;
                nextGroups.Add(copy);
                continue;
            }
            var keepId = keep["id"]!.GetValue<int>();
            groupIdRemap[id] = keepId;
            var keepItems = keep["items"]?.GetValue<int>() ?? 0;
            var items = node["items"]?.GetValue<int>() ?? 0;
            if (items > keepItems) keep["items"] = items;
        }

        var nextSubs = new JsonArray();
        if (root["subGroups"] is JsonArray subsArr)
        {
            var subKeep = new Dictionary<string, JsonObject>(StringComparer.OrdinalIgnoreCase);
            foreach (var node in subsArr.OfType<JsonObject>().OrderBy(s => s["id"]?.GetValue<int>() ?? 0))
            {
                var id = node["id"]?.GetValue<int>() ?? 0;
                var groupId = node["groupId"]?.GetValue<int>() ?? 0;
                var name = (node["name"]?.GetValue<string>() ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(name) || id <= 0) continue;
                if (groupIdRemap.TryGetValue(groupId, out var remappedGroup))
                    groupId = remappedGroup;
                var key = $"{groupId}::{name}";
                if (!subKeep.TryGetValue(key, out var keep))
                {
                    var copy = JsonNode.Parse(node.ToJsonString())!.AsObject();
                    copy["name"] = name;
                    copy["groupId"] = groupId;
                    subKeep[key] = copy;
                    nextSubs.Add(copy);
                    continue;
                }
                var keepItems = keep["items"]?.GetValue<int>() ?? 0;
                var items = node["items"]?.GetValue<int>() ?? 0;
                if (items > keepItems) keep["items"] = items;
            }
        }

        var changed =
            nextCategories.Count != categoriesArr.Count
            || nextGroups.Count != groupsArr.Count
            || (root["subGroups"] is JsonArray oldSubs && nextSubs.Count != oldSubs.Count)
            || categoryIdRemap.Any(kv => kv.Key != kv.Value)
            || groupIdRemap.Any(kv => kv.Key != kv.Value);

        if (!changed) return false;

        merged = new JsonObject
        {
            ["categories"] = nextCategories,
            ["groups"] = nextGroups,
            ["subGroups"] = nextSubs,
            ["nextCategoryId"] = root["nextCategoryId"]?.DeepClone() ?? nextCategories.Count + 1,
            ["nextGroupId"] = root["nextGroupId"]?.DeepClone() ?? nextGroups.Count + 1,
            ["nextSubGroupId"] = root["nextSubGroupId"]?.DeepClone() ?? nextSubs.Count + 1,
        };
        return true;
    }

    static async Task<int> DeactivateDuplicateProductNamesAsync(
        BisyncDbContext db,
        ILogger? logger,
        CancellationToken ct)
    {
        var products = await db.Products
            .Where(p => p.Active)
            .OrderBy(p => p.Id)
            .ToListAsync(ct);

        var n = 0;
        foreach (var group in products.GroupBy(p => (
            CompanyId: p.CompanyId ?? 0,
            Category: (p.Category ?? string.Empty).Trim().ToLowerInvariant(),
            Group: (p.Group ?? string.Empty).Trim().ToLowerInvariant(),
            Name: (p.Name ?? string.Empty).Trim().ToLowerInvariant())))
        {
            if (string.IsNullOrWhiteSpace(group.Key.Name)) continue;
            var ordered = group.OrderBy(p => p.Id).ToList();
            if (ordered.Count < 2) continue;
            foreach (var dup in ordered.Skip(1))
            {
                dup.Active = false;
                dup.UpdatedAt = DateTime.UtcNow;
                n += 1;
                logger?.LogInformation(
                    "Deactivated duplicate product {ProductId} '{Name}' under {Category}/{Group} (kept id {KeeperId})",
                    dup.ProductId,
                    dup.Name,
                    dup.Category,
                    dup.Group,
                    ordered[0].Id);
            }
        }
        return n;
    }
}
