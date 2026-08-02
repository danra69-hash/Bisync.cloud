using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-modifier-groups")]
public class PosModifierGroupsController(BisyncDbContext db) : ControllerBase
{
    public static readonly string[] ValidKinds = ["compulsory", "food", "beverage", "component-swap"];

    public const string FoodModifierProductGroup = "Food Modifier";
    public const string BeverageModifierProductGroup = "Beverage Modifier";
    public const string ComponentSwapProductGroup = "Component SWAP";

    public record OptionInput(
        string Label,
        int Sequence = 0,
        long ExtraChargeCents = 0,
        int? LinkedProductId = null,
        string? LinkedProductName = null,
        string? LinkedComponentId = null,
        string? LinkedComponentName = null,
        string? BaseComponentId = null,
        string? BaseComponentName = null,
        bool Active = true);

    public record AttachmentInput(
        string TargetType,
        string? TargetProductGroup = null,
        int? TargetProductId = null,
        string? TargetProductName = null);

    public record UpsertRequest(
        int CompanyId,
        string Kind,
        string Name,
        int Sequence = 0,
        bool Required = false,
        int MinSelect = 1,
        int MaxSelect = 1,
        bool AffectsStock = false,
        bool Active = true,
        List<OptionInput>? Options = null,
        List<AttachmentInput>? Attachments = null);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? kind,
        [FromQuery] bool includeInactive = false,
        CancellationToken cancellationToken = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var q = db.PosModifierGroups.AsNoTracking()
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .Where(g => g.CompanyId == companyId);

        if (!includeInactive)
            q = q.Where(g => g.Active);

        if (!string.IsNullOrWhiteSpace(kind))
        {
            var k = kind.Trim().ToLowerInvariant();
            q = q.Where(g => g.Kind == k);
        }

        var rows = await q
            .OrderBy(g => g.Kind)
            .ThenBy(g => g.Sequence)
            .ThenBy(g => g.Name)
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(MapGroup));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken cancellationToken)
    {
        var row = await db.PosModifierGroups.AsNoTracking()
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "Modifier group not found." });
        return Ok(MapGroup(row));
    }

    /// <summary>
    /// Products available as stock-linked options for Food/Beverage modifiers,
    /// or inheritance sources for Component SWAP.
    /// </summary>
    [HttpGet("stock-catalog")]
    public async Task<ActionResult<object>> StockCatalog(
        [FromQuery] int companyId,
        [FromQuery] string kind,
        CancellationToken cancellationToken = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });
        var k = (kind ?? string.Empty).Trim().ToLowerInvariant();
        if (k is not ("food" or "beverage" or "component-swap"))
            return BadRequest(new { message = "kind must be food, beverage, or component-swap." });

        var groupName = k switch
        {
            "food" => FoodModifierProductGroup,
            "beverage" => BeverageModifierProductGroup,
            _ => ComponentSwapProductGroup,
        };

        var products = await db.Products.AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.Active)
            .ToListAsync(cancellationToken);

        IEnumerable<Product> filtered = k == "component-swap"
            ? products.Where(p =>
                string.Equals(p.Group?.Trim(), ComponentSwapProductGroup, StringComparison.OrdinalIgnoreCase)
                || p.IsVariableComponent)
            : products.Where(p =>
                string.Equals(p.Group?.Trim(), groupName, StringComparison.OrdinalIgnoreCase));

        var productList = filtered.OrderBy(p => p.Name).ToList();
        var rows = productList
            .Select(p => new
            {
                id = p.Id,
                productId = p.ProductId,
                name = p.Name,
                group = p.Group,
                rrp = p.Rrp,
                isVariableComponent = p.IsVariableComponent,
                variableComponentOptionsJson = p.VariableComponentOptionsJson,
            })
            .ToList();

        var swapPairs = k == "component-swap"
            ? productList
                .SelectMany(p => EnumerateSwapPairs(p))
                .OrderBy(s => s.ProductName)
                .ThenBy(s => s.Label)
                .Select(s => new
                {
                    key = s.Key,
                    label = s.Label,
                    linkedProductId = s.ProductId,
                    linkedProductName = s.ProductName,
                    baseComponentId = s.BaseComponentId,
                    baseComponentName = s.BaseComponentName,
                    linkedComponentId = s.ChosenComponentId,
                    linkedComponentName = s.ChosenComponentName,
                    extraChargeCents = s.ExtraChargeCents,
                })
                .ToList<object>()
            : [];

        return Ok(new { productGroup = groupName, products = rows, swapPairs });
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var error = Validate(body);
        if (error is not null)
            return BadRequest(new { message = error });

        var now = DateTime.UtcNow;
        var kind = body.Kind.Trim().ToLowerInvariant();
        var row = new PosModifierGroup
        {
            CompanyId = body.CompanyId,
            Kind = kind,
            Name = body.Name.Trim(),
            Sequence = Math.Max(0, body.Sequence),
            Required = kind == "compulsory" || body.Required,
            MinSelect = Math.Max(0, body.MinSelect),
            MaxSelect = Math.Max(1, body.MaxSelect),
            AffectsStock = (kind is "food" or "beverage") && body.AffectsStock,
            Active = body.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };
        ApplyChildren(row, body);
        db.PosModifierGroups.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapGroup(row));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(
        int id,
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var error = Validate(body);
        if (error is not null)
            return BadRequest(new { message = error });

        var row = await db.PosModifierGroups
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "modifier group not found." });
        if (row.CompanyId != body.CompanyId)
            return BadRequest(new { message = "companyId mismatch." });

        var kind = body.Kind.Trim().ToLowerInvariant();
        row.Kind = kind;
        row.Name = body.Name.Trim();
        row.Sequence = Math.Max(0, body.Sequence);
        row.Required = kind == "compulsory" || body.Required;
        row.MinSelect = Math.Max(0, body.MinSelect);
        row.MaxSelect = Math.Max(1, body.MaxSelect);
        row.AffectsStock = (kind is "food" or "beverage") && body.AffectsStock;
        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;

        db.PosModifierOptions.RemoveRange(row.Options);
        db.PosModifierAttachments.RemoveRange(row.Attachments);
        row.Options.Clear();
        row.Attachments.Clear();
        ApplyChildren(row, body);

        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapGroup(row));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] ActiveBody body,
        CancellationToken cancellationToken = default)
    {
        var row = await db.PosModifierGroups
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "modifier group not found." });
        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapGroup(row));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, CancellationToken cancellationToken = default)
    {
        var row = await db.PosModifierGroups
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .FirstOrDefaultAsync(g => g.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "modifier group not found." });
        db.PosModifierGroups.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Create or refresh a Component SWAP modifier group from RMS products
    /// in the Component SWAP group / Variable Component products.
    /// </summary>
    [HttpPost("inherit-component-swap")]
    public async Task<ActionResult<object>> InheritComponentSwap(
        [FromBody] InheritBody body,
        CancellationToken cancellationToken = default)
    {
        if (body.CompanyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var products = await db.Products.AsNoTracking()
            .Where(p => p.CompanyId == body.CompanyId && p.Active)
            .ToListAsync(cancellationToken);

        var sources = products
            .Where(p =>
                string.Equals(p.Group?.Trim(), ComponentSwapProductGroup, StringComparison.OrdinalIgnoreCase)
                || p.IsVariableComponent)
            .OrderBy(p => p.Name)
            .ToList();

        if (sources.Count == 0)
            return BadRequest(new
            {
                message = $"No products found in product group '{ComponentSwapProductGroup}' or marked Variable Component.",
            });

        var existing = await db.PosModifierGroups
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .FirstOrDefaultAsync(
                g => g.CompanyId == body.CompanyId && g.Kind == "component-swap" && g.Name == ComponentSwapProductGroup,
                cancellationToken);

        var now = DateTime.UtcNow;
        if (existing is null)
        {
            existing = new PosModifierGroup
            {
                CompanyId = body.CompanyId,
                Kind = "component-swap",
                Name = ComponentSwapProductGroup,
                Sequence = 0,
                Required = false,
                MinSelect = 0,
                MaxSelect = 1,
                AffectsStock = true,
                Active = true,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.PosModifierGroups.Add(existing);
        }
        else
        {
            db.PosModifierOptions.RemoveRange(existing.Options);
            existing.Options.Clear();
            existing.UpdatedAt = now;
            existing.Active = true;
            existing.AffectsStock = true;
        }

        var seq = 0;
        var anySwap = false;
        foreach (var p in sources)
        {
            var pairs = EnumerateSwapPairs(p).ToList();
            if (pairs.Count == 0) continue;
            anySwap = true;
            foreach (var pair in pairs)
            {
                existing.Options.Add(new PosModifierOption
                {
                    Label = pair.Label,
                    Sequence = seq++,
                    ExtraChargeCents = pair.ExtraChargeCents,
                    LinkedProductId = pair.ProductId,
                    LinkedProductName = pair.ProductName,
                    BaseComponentId = pair.BaseComponentId,
                    BaseComponentName = pair.BaseComponentName,
                    LinkedComponentId = pair.ChosenComponentId,
                    LinkedComponentName = pair.ChosenComponentName,
                    Active = true,
                });
            }
        }

        if (!anySwap)
            return BadRequest(new
            {
                message = "No swappable component pairs found. Configure Variable Component (base → alternate) on RMS products first.",
            });

        await db.SaveChangesAsync(cancellationToken);

        var reloaded = await db.PosModifierGroups.AsNoTracking()
            .Include(g => g.Options)
            .Include(g => g.Attachments)
            .FirstAsync(g => g.Id == existing.Id, cancellationToken);

        return Ok(MapGroup(reloaded));
    }

    public record ActiveBody(bool Active);
    public record InheritBody(int CompanyId);

    static string? Validate(UpsertRequest body)
    {
        if (body.CompanyId <= 0)
            return "companyId is required.";
        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (!ValidKinds.Contains(kind))
            return "kind must be compulsory, food, beverage, or component-swap.";
        if (string.IsNullOrWhiteSpace(body.Name))
            return "name is required.";
        if (body.MaxSelect < 1)
            return "maxSelect must be at least 1.";
        if (body.MinSelect > body.MaxSelect)
            return "minSelect cannot exceed maxSelect.";
        if (body.AffectsStock && kind is "food" or "beverage")
        {
            foreach (var opt in body.Options ?? [])
            {
                if (opt.LinkedProductId is null or <= 0)
                    return $"Option '{opt.Label}' must link a product when Affects Stock is on (create it under the {kind} Modifier product group).";
            }
        }
        foreach (var att in body.Attachments ?? [])
        {
            var t = (att.TargetType ?? string.Empty).Trim().ToLowerInvariant();
            if (t is not ("product-group" or "product"))
                return "attachment targetType must be product-group or product.";
            if (t == "product-group" && string.IsNullOrWhiteSpace(att.TargetProductGroup))
                return "attachment product-group requires targetProductGroup.";
            if (t == "product" && (att.TargetProductId is null or <= 0))
                return "attachment product requires targetProductId.";
        }
        return null;
    }

    static void ApplyChildren(PosModifierGroup row, UpsertRequest body)
    {
        var opts = body.Options ?? [];
        for (var i = 0; i < opts.Count; i++)
        {
            var o = opts[i];
            if (string.IsNullOrWhiteSpace(o.Label)) continue;
            row.Options.Add(new PosModifierOption
            {
                Label = o.Label.Trim(),
                Sequence = o.Sequence != 0 ? o.Sequence : i,
                ExtraChargeCents = Math.Max(0, o.ExtraChargeCents),
                LinkedProductId = o.LinkedProductId is > 0 ? o.LinkedProductId : null,
                LinkedProductName = (o.LinkedProductName ?? string.Empty).Trim(),
                LinkedComponentId = (o.LinkedComponentId ?? string.Empty).Trim(),
                LinkedComponentName = (o.LinkedComponentName ?? string.Empty).Trim(),
                BaseComponentId = (o.BaseComponentId ?? string.Empty).Trim(),
                BaseComponentName = (o.BaseComponentName ?? string.Empty).Trim(),
                Active = o.Active,
            });
        }

        foreach (var a in body.Attachments ?? [])
        {
            var t = a.TargetType.Trim().ToLowerInvariant();
            row.Attachments.Add(new PosModifierAttachment
            {
                TargetType = t,
                TargetProductGroup = (a.TargetProductGroup ?? string.Empty).Trim(),
                TargetProductId = a.TargetProductId is > 0 ? a.TargetProductId : null,
                TargetProductName = (a.TargetProductName ?? string.Empty).Trim(),
            });
        }
    }

    sealed record SwapPair(
        string Key,
        string Label,
        int ProductId,
        string ProductName,
        string BaseComponentId,
        string BaseComponentName,
        string ChosenComponentId,
        string ChosenComponentName,
        long ExtraChargeCents);

    static IEnumerable<SwapPair> EnumerateSwapPairs(Product product)
    {
        foreach (var slot in ParseVariableComponentSlots(product.VariableComponentOptionsJson))
        {
            var baseId = slot.BaseComponentId;
            var baseName = string.IsNullOrWhiteSpace(slot.BaseComponentName) ? baseId : slot.BaseComponentName;
            foreach (var alt in slot.Alternatives)
            {
                var altId = alt.ComponentId;
                var altName = string.IsNullOrWhiteSpace(alt.ComponentName) ? altId : alt.ComponentName;
                if (string.IsNullOrWhiteSpace(baseId) || string.IsNullOrWhiteSpace(altId))
                    continue;
                if (string.Equals(baseId, altId, StringComparison.OrdinalIgnoreCase))
                    continue;
                var label = $"{baseName} → {altName}";
                var extraCents = alt.ExtraCharge > 0
                    ? (long)Math.Round(alt.ExtraCharge * 100m, MidpointRounding.AwayFromZero)
                    : 0L;
                yield return new SwapPair(
                    Key: $"{product.Id}:{baseId}:{altId}",
                    Label: label,
                    ProductId: product.Id,
                    ProductName: product.Name,
                    BaseComponentId: baseId,
                    BaseComponentName: baseName,
                    ChosenComponentId: altId,
                    ChosenComponentName: altName,
                    ExtraChargeCents: extraCents);
            }
        }
    }

    sealed record ParsedAlt(string ComponentId, string ComponentName, decimal ExtraCharge);
    sealed record ParsedSlot(string BaseComponentId, string BaseComponentName, List<ParsedAlt> Alternatives);

    static List<ParsedSlot> ParseVariableComponentSlots(string? json)
    {
        var result = new List<ParsedSlot>();
        if (string.IsNullOrWhiteSpace(json) || json.Trim() is "{}" or "[]")
            return result;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("slots", out var slots) || slots.ValueKind != JsonValueKind.Array)
                return result;
            foreach (var slot in slots.EnumerateArray())
            {
                var baseId = slot.TryGetProperty("baseComponentId", out var baseEl)
                    ? (baseEl.GetString() ?? string.Empty).Trim()
                    : string.Empty;
                var baseName = slot.TryGetProperty("baseComponentName", out var baseNameEl)
                    ? (baseNameEl.GetString() ?? string.Empty).Trim()
                    : string.Empty;
                if (string.IsNullOrWhiteSpace(baseId)) continue;
                var alts = new List<ParsedAlt>();
                if (slot.TryGetProperty("alternatives", out var altArr) && altArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var alt in altArr.EnumerateArray())
                    {
                        var altId = alt.TryGetProperty("componentId", out var altIdEl)
                            ? (altIdEl.GetString() ?? string.Empty).Trim()
                            : string.Empty;
                        if (string.IsNullOrWhiteSpace(altId)) continue;
                        var altName = alt.TryGetProperty("componentName", out var altNameEl)
                            ? (altNameEl.GetString() ?? string.Empty).Trim()
                            : string.Empty;
                        decimal extra = 0;
                        if (alt.TryGetProperty("addonRrp", out var addonEl) && addonEl.TryGetDecimal(out var addon))
                            extra = addon;
                        else if (alt.TryGetProperty("extraCharge", out var chargeEl) && chargeEl.TryGetDecimal(out var charge))
                            extra = charge;
                        alts.Add(new ParsedAlt(altId, altName, Math.Max(0, extra)));
                    }
                }
                if (alts.Count > 0)
                    result.Add(new ParsedSlot(baseId, baseName, alts));
            }
        }
        catch (JsonException)
        {
            /* ignore malformed VC JSON */
        }
        return result;
    }

    static object MapGroup(PosModifierGroup g) => new
    {
        id = g.Id,
        companyId = g.CompanyId,
        kind = g.Kind,
        name = g.Name,
        sequence = g.Sequence,
        required = g.Required,
        minSelect = g.MinSelect,
        maxSelect = g.MaxSelect,
        affectsStock = g.AffectsStock,
        active = g.Active,
        createdAt = g.CreatedAt,
        updatedAt = g.UpdatedAt,
        options = g.Options
            .OrderBy(o => o.Sequence)
            .ThenBy(o => o.Id)
            .Select(o => new
            {
                id = o.Id,
                label = o.Label,
                sequence = o.Sequence,
                extraChargeCents = o.ExtraChargeCents,
                linkedProductId = o.LinkedProductId,
                linkedProductName = o.LinkedProductName,
                linkedComponentId = o.LinkedComponentId,
                linkedComponentName = o.LinkedComponentName,
                baseComponentId = o.BaseComponentId,
                baseComponentName = o.BaseComponentName,
                active = o.Active,
            }),
        attachments = g.Attachments.Select(a => new
        {
            id = a.Id,
            targetType = a.TargetType,
            targetProductGroup = a.TargetProductGroup,
            targetProductId = a.TargetProductId,
            targetProductName = a.TargetProductName,
        }),
    };
}
