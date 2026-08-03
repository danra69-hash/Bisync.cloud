using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-tax-service-config")]
public class PosTaxServiceConfigController(BisyncDbContext db) : ControllerBase
{
    static readonly string[] DefaultSalesTypes = ["dine-in", "takeaway", "delivery"];

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false,
    };

    public record ChargeLineDto(string Id, string Name, decimal Percent);

    public record SalesTypeRuleDto(
        string SalesType,
        string[] TaxIds,
        string[] ServiceIds,
        bool ApplyToAllProducts,
        string[] ProductGroups);

    public record ConfigDto(
        int CompanyId,
        ChargeLineDto[] Taxes,
        ChargeLineDto[] Services,
        SalesTypeRuleDto[] SalesTypes,
        DateTime? UpdatedAt);

    public record UpsertBody(
        int CompanyId,
        ChargeLineDto[]? Taxes,
        ChargeLineDto[]? Services,
        SalesTypeRuleDto[]? SalesTypes);

    [HttpGet]
    public async Task<ActionResult<ConfigDto>> Get(
        [FromQuery] int companyId,
        CancellationToken cancellationToken = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var row = await db.PosTaxServiceConfigs.AsNoTracking()
            .FirstOrDefaultAsync(r => r.CompanyId == companyId, cancellationToken);

        if (row is null)
            return Ok(EmptyConfig(companyId));

        return Ok(ParseRow(row));
    }

    [HttpPut]
    public async Task<ActionResult<ConfigDto>> Put(
        [FromBody] UpsertBody body,
        CancellationToken cancellationToken = default)
    {
        if (body.CompanyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var taxes = NormalizeLines(body.Taxes, "Tax");
        var services = NormalizeLines(body.Services, "Service");
        if (taxes.error is not null)
            return BadRequest(new { message = taxes.error });
        if (services.error is not null)
            return BadRequest(new { message = services.error });

        var taxIds = taxes.lines.Select(t => t.Id).ToHashSet(StringComparer.Ordinal);
        var serviceIds = services.lines.Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
        var sales = NormalizeSalesTypes(body.SalesTypes, taxIds, serviceIds);
        if (sales.error is not null)
            return BadRequest(new { message = sales.error });

        var payload = new
        {
            taxes = taxes.lines,
            services = services.lines,
            salesTypes = sales.rules,
        };
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var now = DateTime.UtcNow;

        var row = await db.PosTaxServiceConfigs
            .FirstOrDefaultAsync(r => r.CompanyId == body.CompanyId, cancellationToken);
        if (row is null)
        {
            row = new PosTaxServiceConfig
            {
                CompanyId = body.CompanyId,
                ConfigJson = json,
                UpdatedAt = now,
            };
            db.PosTaxServiceConfigs.Add(row);
        }
        else
        {
            row.ConfigJson = json;
            row.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(ParseRow(row));
    }

    static ConfigDto EmptyConfig(int companyId) => new(
        companyId,
        [],
        [],
        DefaultSalesTypes.Select(st => new SalesTypeRuleDto(st, [], [], true, [])).ToArray(),
        null);

    static ConfigDto ParseRow(PosTaxServiceConfig row)
    {
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(row.ConfigJson) ? "{}" : row.ConfigJson);
            var root = doc.RootElement;
            var taxes = ReadLines(root, "taxes");
            var services = ReadLines(root, "services");
            var sales = ReadSalesTypes(root, taxes.Select(t => t.Id).ToHashSet(StringComparer.Ordinal),
                services.Select(s => s.Id).ToHashSet(StringComparer.Ordinal));
            return new ConfigDto(row.CompanyId, taxes, services, sales, row.UpdatedAt);
        }
        catch
        {
            return EmptyConfig(row.CompanyId) with { UpdatedAt = row.UpdatedAt };
        }
    }

    static ChargeLineDto[] ReadLines(JsonElement root, string prop)
    {
        if (!root.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];

        var list = new List<ChargeLineDto>();
        var i = 0;
        foreach (var el in arr.EnumerateArray())
        {
            i++;
            var id = el.TryGetProperty("id", out var idEl) ? idEl.GetString()?.Trim() : null;
            if (string.IsNullOrWhiteSpace(id))
                id = $"{prop}-{i}";
            var name = el.TryGetProperty("name", out var nameEl) ? nameEl.GetString()?.Trim() ?? "" : "";
            decimal percent = 0;
            if (el.TryGetProperty("percent", out var pctEl))
            {
                if (pctEl.ValueKind == JsonValueKind.Number && pctEl.TryGetDecimal(out var d))
                    percent = d;
                else if (pctEl.ValueKind == JsonValueKind.String && decimal.TryParse(pctEl.GetString(), out var parsed))
                    percent = parsed;
            }
            list.Add(new ChargeLineDto(id, name, Math.Clamp(percent, 0, 100)));
        }
        return list.ToArray();
    }

    static SalesTypeRuleDto[] ReadSalesTypes(JsonElement root, HashSet<string> taxIds, HashSet<string> serviceIds)
    {
        var byType = new Dictionary<string, SalesTypeRuleDto>(StringComparer.OrdinalIgnoreCase);
        if (root.TryGetProperty("salesTypes", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in arr.EnumerateArray())
            {
                var st = el.TryGetProperty("salesType", out var stEl) ? stEl.GetString()?.Trim().ToLowerInvariant() : null;
                if (string.IsNullOrWhiteSpace(st)) continue;
                var tids = ReadStringArray(el, "taxIds").Where(taxIds.Contains).ToArray();
                var sids = ReadStringArray(el, "serviceIds").Where(serviceIds.Contains).ToArray();
                var all = true;
                if (el.TryGetProperty("applyToAllProducts", out var allEl))
                {
                    if (allEl.ValueKind is JsonValueKind.True or JsonValueKind.False)
                        all = allEl.GetBoolean();
                }
                var groups = all ? [] : ReadStringArray(el, "productGroups");
                byType[st] = new SalesTypeRuleDto(st, tids, sids, all, groups);
            }
        }

        return DefaultSalesTypes
            .Select(st => byType.TryGetValue(st, out var rule)
                ? rule
                : new SalesTypeRuleDto(st, [], [], true, []))
            .Concat(byType.Values.Where(r => !DefaultSalesTypes.Contains(r.SalesType, StringComparer.OrdinalIgnoreCase)))
            .ToArray();
    }

    static string[] ReadStringArray(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];
        return arr.EnumerateArray()
            .Select(x => x.GetString()?.Trim() ?? "")
            .Where(s => s.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    static (ChargeLineDto[] lines, string? error) NormalizeLines(ChargeLineDto[]? input, string label)
    {
        var raw = input ?? [];
        var list = new List<ChargeLineDto>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < raw.Length; i++)
        {
            var item = raw[i];
            var name = (item.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
                return ([], $"{label} line {i + 1}: name is required.");
            if (item.Percent < 0 || item.Percent > 100)
                return ([], $"{label} line {i + 1}: percent must be between 0 and 100.");
            var id = string.IsNullOrWhiteSpace(item.Id)
                ? $"{label.ToLowerInvariant()}-{Guid.NewGuid():N}"[..16]
                : item.Id.Trim();
            if (!seen.Add(id))
                id = $"{id}-{i + 1}";
            list.Add(new ChargeLineDto(id, name, Math.Round(item.Percent, 4)));
        }
        return (list.ToArray(), null);
    }

    static (SalesTypeRuleDto[] rules, string? error) NormalizeSalesTypes(
        SalesTypeRuleDto[]? input,
        HashSet<string> taxIds,
        HashSet<string> serviceIds)
    {
        var byType = new Dictionary<string, SalesTypeRuleDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in input ?? [])
        {
            var st = (item.SalesType ?? "").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(st))
                return ([], "salesType is required.");
            var tids = (item.TaxIds ?? []).Where(id => taxIds.Contains(id)).Distinct(StringComparer.Ordinal).ToArray();
            var sids = (item.ServiceIds ?? []).Where(id => serviceIds.Contains(id)).Distinct(StringComparer.Ordinal).ToArray();
            var all = item.ApplyToAllProducts;
            var groups = all
                ? Array.Empty<string>()
                : (item.ProductGroups ?? [])
                    .Select(g => g.Trim())
                    .Where(g => g.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            byType[st] = new SalesTypeRuleDto(st, tids, sids, all, groups);
        }

        var rules = DefaultSalesTypes
            .Select(st => byType.TryGetValue(st, out var rule)
                ? rule
                : new SalesTypeRuleDto(st, [], [], true, []))
            .Concat(byType.Values.Where(r => !DefaultSalesTypes.Contains(r.SalesType, StringComparer.OrdinalIgnoreCase)))
            .ToArray();
        return (rules, null);
    }
}
