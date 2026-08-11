using System.Text.Json;
using System.Text.Json.Nodes;
using Bisync.Api.Controllers;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Remounts RMS Category / Group renames onto Ingredients, Products, and POS configs
/// so POS register / modifiers / device / tax rules stay aligned with RMS labels.
/// </summary>
public static class CategoryGroupRenameService
{
    public sealed record RemapCounts(
        int Ingredients,
        int Products,
        int ModifierAttachments,
        int DeviceSetupRules,
        int Promotions,
        int TaxServiceConfigs,
        int HierarchyConfigs,
        int CatalogConfigs,
        int SampleRequests)
    {
        public int Total =>
            Ingredients
            + Products
            + ModifierAttachments
            + DeviceSetupRules
            + Promotions
            + TaxServiceConfigs
            + HierarchyConfigs
            + CatalogConfigs
            + SampleRequests;
    }

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Known POS synonym families that should collapse to the RMS canonical label.</summary>
    public static readonly IReadOnlyDictionary<string, string[]> GroupSynonymFamilies =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["Draught Beer"] = ["Beer Draft", "Draft Beer", "BEER DRAFT", "Draught Beer"],
            ["Bottled Beer"] = ["Bottle Beer", "Beer Bottle", "Bottled Beer"],
        };

    public static async Task<RemapCounts> RemapAsync(
        BisyncDbContext db,
        int companyId,
        string kind,
        string from,
        string to,
        CancellationToken cancellationToken = default)
    {
        var labelKind = (kind ?? string.Empty).Trim().ToLowerInvariant();
        if (labelKind is not ("category" or "group"))
            throw new ArgumentException("Kind must be category or group.");

        var fromName = (from ?? string.Empty).Trim();
        var toName = (to ?? string.Empty).Trim();
        if (fromName.Length == 0 || toName.Length == 0)
            throw new ArgumentException("Both from and to names are required.");
        if (string.Equals(fromName, toName, StringComparison.Ordinal))
            throw new ArgumentException("New name must differ from the current name.");

        var ingredients = 0;
        var products = 0;
        var attachments = 0;
        var deviceRules = 0;
        var promotions = 0;
        var taxConfigs = 0;
        var hierarchies = 0;
        var catalogs = 0;
        var samples = 0;

        if (labelKind == "category")
        {
            ingredients = await RemountIngredientCategoryAsync(db, companyId, fromName, toName, cancellationToken);
            products = await RemountProductCategoryAsync(db, companyId, fromName, toName, cancellationToken);
            attachments = await RemountModifierAttachmentCategoryAsync(db, companyId, fromName, toName, cancellationToken);
            deviceRules = await RemountDeviceRuleCategoryAsync(db, companyId, fromName, toName, cancellationToken);
            promotions = await RemountPromotionCategoryAsync(db, companyId, fromName, toName, cancellationToken);
            samples = await RemountSampleCategoryAsync(db, companyId, fromName, toName, cancellationToken);
            hierarchies = await RemountHierarchyLabelAsync(db, companyId, "category", fromName, toName, cancellationToken);
        }
        else
        {
            ingredients = await RemountIngredientGroupAsync(db, companyId, fromName, toName, cancellationToken);
            products = await RemountProductGroupAsync(db, companyId, fromName, toName, cancellationToken);
            attachments = await RemountModifierAttachmentGroupAsync(db, companyId, fromName, toName, cancellationToken);
            deviceRules = await RemountDeviceRuleGroupAsync(db, companyId, fromName, toName, cancellationToken);
            promotions = await RemountPromotionGroupAsync(db, companyId, fromName, toName, cancellationToken);
            taxConfigs = await RemountTaxServiceGroupsAsync(db, companyId, fromName, toName, cancellationToken);
            samples = await RemountSampleGroupAsync(db, companyId, fromName, toName, cancellationToken);
            hierarchies = await RemountHierarchyLabelAsync(db, companyId, "group", fromName, toName, cancellationToken);
            catalogs = await RemountCatalogExtraGroupsAsync(db, companyId, fromName, toName, cancellationToken);
        }

        if (ingredients + products + attachments + deviceRules + promotions + taxConfigs + hierarchies + catalogs + samples > 0)
            await db.SaveChangesAsync(cancellationToken);

        return new RemapCounts(
            ingredients,
            products,
            attachments,
            deviceRules,
            promotions,
            taxConfigs,
            hierarchies,
            catalogs,
            samples);
    }

    /// <summary>
    /// One-time / startup: remount synonym spellings (Beer Draft → Draught Beer) company-wide.
    /// </summary>
    public static async Task RemountPosGroupSynonymsAsync(
        BisyncDbContext db,
        CancellationToken cancellationToken = default)
    {
        var companyIds = await db.Companies.AsNoTracking().Select(c => c.Id).ToListAsync(cancellationToken);
        if (companyIds.Count == 0) companyIds.Add(1);

        var dirty = false;
        foreach (var companyId in companyIds)
        {
            foreach (var (canonical, aliases) in GroupSynonymFamilies)
            {
                foreach (var alias in aliases)
                {
                    if (string.Equals(alias, canonical, StringComparison.Ordinal)) continue;
                    try
                    {
                        var counts = await RemapAsync(db, companyId, "group", alias, canonical, cancellationToken);
                        if (counts.Total > 0) dirty = true;
                    }
                    catch (ArgumentException)
                    {
                        // Skip no-op / invalid synonym pairs.
                    }
                }
            }
        }

        // RemapAsync already SaveChanges when dirty; keep signature consistent.
        _ = dirty;
    }

    static bool NameEquals(string? left, string right) =>
        string.Equals((left ?? string.Empty).Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

    static async Task<int> RemountIngredientCategoryAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.Ingredients.Where(i => i.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.Category, from)) continue;
            row.Category = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountIngredientGroupAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.Ingredients.Where(i => i.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.Group, from)) continue;
            row.Group = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountProductCategoryAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.Products.Where(p => p.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.Category, from)) continue;
            row.Category = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountProductGroupAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.Products.Where(p => p.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.Group, from)) continue;
            row.Group = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountModifierAttachmentCategoryAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var groupIds = await db.PosModifierGroups.AsNoTracking()
            .Where(g => g.CompanyId == companyId)
            .Select(g => g.Id)
            .ToListAsync(ct);
        if (groupIds.Count == 0) return 0;

        var rows = await db.PosModifierAttachments
            .Where(a => groupIds.Contains(a.PosModifierGroupId))
            .ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.TargetProductCategory, from)) continue;
            row.TargetProductCategory = to;
            n++;
        }
        return n;
    }

    static async Task<int> RemountModifierAttachmentGroupAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var groupIds = await db.PosModifierGroups.AsNoTracking()
            .Where(g => g.CompanyId == companyId)
            .Select(g => g.Id)
            .ToListAsync(ct);
        if (groupIds.Count == 0) return 0;

        var rows = await db.PosModifierAttachments
            .Where(a => groupIds.Contains(a.PosModifierGroupId))
            .ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.TargetProductGroup, from)) continue;
            row.TargetProductGroup = to;
            n++;
        }
        return n;
    }

    static async Task<int> RemountDeviceRuleCategoryAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.PosDeviceSetupRules.Where(r => r.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.ProductCategory, from)) continue;
            row.ProductCategory = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountDeviceRuleGroupAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.PosDeviceSetupRules.Where(r => r.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.ProductGroup, from)) continue;
            row.ProductGroup = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountPromotionCategoryAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.PosPromotions.Where(p => p.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.FilterCategory, from)) continue;
            row.FilterCategory = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountPromotionGroupAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.PosPromotions.Where(p => p.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.FilterGroup, from)) continue;
            row.FilterGroup = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountSampleCategoryAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.SampleRequests.Where(r => r.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.ProductCategory, from)) continue;
            row.ProductCategory = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountSampleGroupAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.SampleRequests.Where(r => r.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (!NameEquals(row.ProductGroup, from)) continue;
            row.ProductGroup = to;
            row.UpdatedAt = DateTime.UtcNow;
            n++;
        }
        return n;
    }

    static async Task<int> RemountTaxServiceGroupsAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var rows = await db.PosTaxServiceConfigs.Where(c => c.CompanyId == companyId).ToListAsync(ct);
        var n = 0;
        foreach (var row in rows)
        {
            if (string.IsNullOrWhiteSpace(row.ConfigJson)) continue;
            try
            {
                var root = JsonNode.Parse(row.ConfigJson) as JsonObject;
                if (root is null) continue;
                var changed = false;
                if (root["salesTypes"] is JsonArray salesTypes)
                {
                    foreach (var st in salesTypes.OfType<JsonObject>())
                    {
                        if (st["productGroups"] is not JsonArray groups) continue;
                        for (var i = 0; i < groups.Count; i++)
                        {
                            var value = groups[i]?.GetValue<string>() ?? string.Empty;
                            if (!NameEquals(value, from)) continue;
                            groups[i] = to;
                            changed = true;
                        }
                    }
                }
                if (!changed) continue;
                row.ConfigJson = root.ToJsonString(JsonOptions);
                row.UpdatedAt = DateTime.UtcNow;
                n++;
            }
            catch (JsonException)
            {
                // Ignore malformed tax config JSON.
            }
        }
        return n;
    }

    static async Task<int> RemountHierarchyLabelAsync(
        BisyncDbContext db, int companyId, string kind, string from, string to, CancellationToken ct)
    {
        var row = await db.RevMgmtCompanyConfigs
            .FirstOrDefaultAsync(
                c => c.CompanyId == companyId && c.ConfigKey == RevMgmtConfigController.ComponentHierarchyKey,
                ct);
        if (row is null || string.IsNullOrWhiteSpace(row.StateJson)) return 0;

        try
        {
            var root = JsonNode.Parse(row.StateJson) as JsonObject;
            if (root is null) return 0;
            var changed = false;
            var key = kind == "category" ? "categories" : "groups";
            if (root[key] is JsonArray items)
            {
                foreach (var item in items.OfType<JsonObject>())
                {
                    var name = item["name"]?.GetValue<string>() ?? string.Empty;
                    if (!NameEquals(name, from)) continue;
                    item["name"] = to;
                    changed = true;
                }
            }
            // Sub-groups also carry a display name when kind=group is not applicable;
            // category renames do not touch subgroup names.
            if (kind == "group" && root["subGroups"] is JsonArray subs)
            {
                // Sub-group names are independent labels — leave them unless they exactly match.
                foreach (var item in subs.OfType<JsonObject>())
                {
                    var name = item["name"]?.GetValue<string>() ?? string.Empty;
                    if (!NameEquals(name, from)) continue;
                    item["name"] = to;
                    changed = true;
                }
            }
            if (!changed) return 0;
            // Collapse duplicate names created by remount (e.g. Draft Beer + Draught Beer).
            DedupeNamedArray(root, "categories");
            DedupeNamedArray(root, "groups", keepCategoryId: true);
            DedupeNamedArray(root, "subGroups", keepGroupId: true);
            row.StateJson = root.ToJsonString(JsonOptions);
            row.UpdatedAt = DateTime.UtcNow;
            return 1;
        }
        catch (JsonException)
        {
            return 0;
        }
    }

    static void DedupeNamedArray(JsonObject root, string key, bool keepCategoryId = false, bool keepGroupId = false)
    {
        if (root[key] is not JsonArray items) return;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var next = new JsonArray();
        foreach (var item in items.OfType<JsonObject>())
        {
            var name = item["name"]?.GetValue<string>() ?? string.Empty;
            var scope = keepCategoryId
                ? $"{item["categoryId"]?.GetValue<int>() ?? 0}::{name}"
                : keepGroupId
                    ? $"{item["groupId"]?.GetValue<int>() ?? 0}::{name}"
                    : name;
            if (string.IsNullOrWhiteSpace(name) || !seen.Add(scope)) continue;
            next.Add(item.DeepClone());
        }
        root[key] = next;
    }

    static async Task<int> RemountCatalogExtraGroupsAsync(
        BisyncDbContext db, int companyId, string from, string to, CancellationToken ct)
    {
        var row = await db.RevMgmtCompanyConfigs
            .FirstOrDefaultAsync(
                c => c.CompanyId == companyId && c.ConfigKey == RevMgmtConfigController.ComponentCatalogKey,
                ct);
        if (row is null || string.IsNullOrWhiteSpace(row.StateJson)) return 0;

        try
        {
            var root = JsonNode.Parse(row.StateJson) as JsonObject;
            if (root is null) return 0;
            if (root["extraGroups"] is not JsonArray groups) return 0;
            var changed = false;
            for (var i = 0; i < groups.Count; i++)
            {
                var value = groups[i]?.GetValue<string>() ?? string.Empty;
                if (!NameEquals(value, from)) continue;
                groups[i] = to;
                changed = true;
            }
            if (!changed) return 0;
            // Deduplicate after rename.
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var deduped = new JsonArray();
            foreach (var node in groups)
            {
                var value = node?.GetValue<string>() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(value) || !seen.Add(value)) continue;
                deduped.Add(value);
            }
            root["extraGroups"] = deduped;
            row.StateJson = root.ToJsonString(JsonOptions);
            row.UpdatedAt = DateTime.UtcNow;
            return 1;
        }
        catch (JsonException)
        {
            return 0;
        }
    }
}
