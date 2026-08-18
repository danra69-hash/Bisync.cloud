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
    static readonly string[] ChargeTypes = ["tax-regular", "tax-alcohol", "service"];

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false,
    };

    public record ChargeLineDto(string Id, string Name, decimal Percent, string Type);

    public record SalesTypeRuleDto(
        string SalesType,
        string[] TaxIds,
        string[] ServiceIds,
        bool ApplyToAllProducts,
        string[] ProductGroups);

    public record ChannelFlagsDto(bool TaxRegular, bool TaxAlcohol, bool Service);

    public record ProductRuleDto(
        int ProductId,
        ChannelFlagsDto DineIn,
        ChannelFlagsDto Takeaway,
        ChannelFlagsDto Delivery);

    public record ConfigDto(
        int CompanyId,
        ChargeLineDto[] Charges,
        ProductRuleDto[] ProductRules,
        ChargeLineDto[] Taxes,
        ChargeLineDto[] Services,
        SalesTypeRuleDto[] SalesTypes,
        DateTime? UpdatedAt);

    public record UpsertBody(
        int CompanyId,
        ChargeLineDto[]? Charges,
        ProductRuleDto[]? ProductRules,
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

        await SchemaPatcher.EnsurePosTaxServiceConfigsTableAsync(db);

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

        await SchemaPatcher.EnsurePosTaxServiceConfigsTableAsync(db);

        var charges = NormalizeCharges(body);
        if (charges.error is not null)
            return BadRequest(new { message = charges.error });

        var productRules = NormalizeProductRules(body.ProductRules);
        if (productRules.error is not null)
            return BadRequest(new { message = productRules.error });

        var taxIds = charges.lines
            .Where(c => c.Type is "tax-regular" or "tax-alcohol")
            .Select(c => c.Id)
            .ToHashSet(StringComparer.Ordinal);
        var serviceIds = charges.lines
            .Where(c => c.Type == "service")
            .Select(c => c.Id)
            .ToHashSet(StringComparer.Ordinal);

        var sales = NormalizeSalesTypes(body.SalesTypes, taxIds, serviceIds, productRules.rules, charges.lines);
        if (sales.error is not null)
            return BadRequest(new { message = sales.error });

        var taxes = charges.lines.Where(c => c.Type is "tax-regular" or "tax-alcohol").ToArray();
        var services = charges.lines.Where(c => c.Type == "service").ToArray();

        var payload = new
        {
            charges = charges.lines,
            productRules = productRules.rules,
            taxes,
            services,
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
            var charges = ReadCharges(root);
            var productRules = ReadProductRules(root);
            var taxes = charges.Where(c => c.Type is "tax-regular" or "tax-alcohol").ToArray();
            var services = charges.Where(c => c.Type == "service").ToArray();
            var sales = ReadSalesTypes(
                root,
                taxes.Select(t => t.Id).ToHashSet(StringComparer.Ordinal),
                services.Select(s => s.Id).ToHashSet(StringComparer.Ordinal));
            return new ConfigDto(row.CompanyId, charges, productRules, taxes, services, sales, row.UpdatedAt);
        }
        catch
        {
            return EmptyConfig(row.CompanyId) with { UpdatedAt = row.UpdatedAt };
        }
    }

    static ChargeLineDto[] ReadCharges(JsonElement root)
    {
        if (root.TryGetProperty("charges", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            var list = new List<ChargeLineDto>();
            var i = 0;
            foreach (var el in arr.EnumerateArray())
            {
                i++;
                var parsed = ReadChargeElement(el, i, null);
                if (parsed is not null)
                    list.Add(parsed);
            }
            if (list.Count > 0)
                return list.ToArray();
        }

        // Legacy: taxes[] + services[] without type.
        var legacy = new List<ChargeLineDto>();
        var ti = 0;
        if (root.TryGetProperty("taxes", out var taxArr) && taxArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in taxArr.EnumerateArray())
            {
                ti++;
                var name = el.TryGetProperty("name", out var nameEl) ? nameEl.GetString()?.Trim() ?? "" : "";
                var type = IsAlcoholTaxName(name) ? "tax-alcohol" : "tax-regular";
                var parsed = ReadChargeElement(el, ti, type);
                if (parsed is not null)
                    legacy.Add(parsed);
            }
        }
        var si = 0;
        if (root.TryGetProperty("services", out var svcArr) && svcArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in svcArr.EnumerateArray())
            {
                si++;
                var parsed = ReadChargeElement(el, si, "service");
                if (parsed is not null)
                    legacy.Add(parsed);
            }
        }
        return legacy.ToArray();
    }

    static ChargeLineDto? ReadChargeElement(JsonElement el, int index, string? forcedType)
    {
        var id = el.TryGetProperty("id", out var idEl) ? idEl.GetString()?.Trim() : null;
        if (string.IsNullOrWhiteSpace(id))
            id = $"charge-{index}";
        var name = el.TryGetProperty("name", out var nameEl) ? nameEl.GetString()?.Trim() ?? "" : "";
        decimal percent = 0;
        if (el.TryGetProperty("percent", out var pctEl))
        {
            if (pctEl.ValueKind == JsonValueKind.Number && pctEl.TryGetDecimal(out var d))
                percent = d;
            else if (pctEl.ValueKind == JsonValueKind.String && decimal.TryParse(pctEl.GetString(), out var parsed))
                percent = parsed;
        }
        var type = forcedType;
        if (string.IsNullOrWhiteSpace(type) && el.TryGetProperty("type", out var typeEl))
            type = NormalizeChargeType(typeEl.GetString());
        if (string.IsNullOrWhiteSpace(type))
            type = IsAlcoholTaxName(name) ? "tax-alcohol" : "tax-regular";
        return new ChargeLineDto(id, name, Math.Clamp(percent, 0, 100), type!);
    }

    static ProductRuleDto[] ReadProductRules(JsonElement root)
    {
        if (!root.TryGetProperty("productRules", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return [];

        var list = new List<ProductRuleDto>();
        var seen = new HashSet<int>();
        foreach (var el in arr.EnumerateArray())
        {
            if (!el.TryGetProperty("productId", out var idEl))
                continue;
            int productId;
            if (idEl.ValueKind == JsonValueKind.Number && idEl.TryGetInt32(out var n))
                productId = n;
            else if (idEl.ValueKind == JsonValueKind.String && int.TryParse(idEl.GetString(), out var p))
                productId = p;
            else
                continue;
            if (productId <= 0 || !seen.Add(productId))
                continue;

            var dineIn = ReadChannelFlags(el, "dineIn");
            var takeaway = ReadChannelFlags(el, "takeaway", "takeout");
            var delivery = ReadChannelFlags(el, "delivery");
            list.Add(new ProductRuleDto(productId, dineIn, takeaway, delivery));
        }
        return list.ToArray();
    }

    static ChannelFlagsDto ReadChannelFlags(JsonElement parent, string prop, string? altProp = null)
    {
        JsonElement el = default;
        var found = parent.TryGetProperty(prop, out el);
        if (!found && altProp is not null)
            found = parent.TryGetProperty(altProp, out el);
        if (!found || el.ValueKind != JsonValueKind.Object)
            return new ChannelFlagsDto(false, false, false);

        var taxRegular = ReadBool(el, "taxRegular");
        var taxAlcohol = ReadBool(el, "taxAlcohol");
        var service = ReadBool(el, "service");
        // Mutual exclusion: prefer alcohol when both were somehow stored.
        if (taxRegular && taxAlcohol)
            taxRegular = false;
        return new ChannelFlagsDto(taxRegular, taxAlcohol, service);
    }

    static bool ReadBool(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var v))
            return false;
        return v.ValueKind == JsonValueKind.True;
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

    static (ChargeLineDto[] lines, string? error) NormalizeCharges(UpsertBody body)
    {
        if (body.Charges is { Length: > 0 })
        {
            var list = new List<ChargeLineDto>();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < body.Charges.Length; i++)
            {
                var item = body.Charges[i];
                var name = (item.Name ?? "").Trim();
                if (string.IsNullOrWhiteSpace(name))
                    return ([], $"Charge line {i + 1}: name is required.");
                if (item.Percent < 0 || item.Percent > 100)
                    return ([], $"Charge line {i + 1}: percent must be between 0 and 100.");
                var type = NormalizeChargeType(item.Type);
                if (type is null)
                    return ([], $"Charge line {i + 1}: type must be tax-regular, tax-alcohol, or service.");
                var id = string.IsNullOrWhiteSpace(item.Id)
                    ? $"{type}-{Guid.NewGuid():N}"[..18]
                    : item.Id.Trim();
                if (!seen.Add(id))
                    id = $"{id}-{i + 1}";
                list.Add(new ChargeLineDto(id, name, Math.Round(item.Percent, 4), type));
            }
            return (list.ToArray(), null);
        }

        // Legacy upsert: taxes + services.
        var merged = new List<ChargeLineDto>();
        var legacyTaxes = body.Taxes ?? [];
        for (var i = 0; i < legacyTaxes.Length; i++)
        {
            var item = legacyTaxes[i];
            var name = (item.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
                return ([], $"Tax line {i + 1}: name is required.");
            if (item.Percent < 0 || item.Percent > 100)
                return ([], $"Tax line {i + 1}: percent must be between 0 and 100.");
            var type = NormalizeChargeType(item.Type)
                ?? (IsAlcoholTaxName(name) ? "tax-alcohol" : "tax-regular");
            var id = string.IsNullOrWhiteSpace(item.Id)
                ? $"tax-{Guid.NewGuid():N}"[..16]
                : item.Id.Trim();
            merged.Add(new ChargeLineDto(id, name, Math.Round(item.Percent, 4), type));
        }
        var legacyServices = body.Services ?? [];
        for (var i = 0; i < legacyServices.Length; i++)
        {
            var item = legacyServices[i];
            var name = (item.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name))
                return ([], $"Service line {i + 1}: name is required.");
            if (item.Percent < 0 || item.Percent > 100)
                return ([], $"Service line {i + 1}: percent must be between 0 and 100.");
            var id = string.IsNullOrWhiteSpace(item.Id)
                ? $"svc-{Guid.NewGuid():N}"[..16]
                : item.Id.Trim();
            merged.Add(new ChargeLineDto(id, name, Math.Round(item.Percent, 4), "service"));
        }
        return (merged.ToArray(), null);
    }

    static (ProductRuleDto[] rules, string? error) NormalizeProductRules(ProductRuleDto[]? input)
    {
        var list = new List<ProductRuleDto>();
        var seen = new HashSet<int>();
        foreach (var item in input ?? [])
        {
            if (item.ProductId <= 0)
                return ([], "productRules: productId must be a positive integer.");
            if (!seen.Add(item.ProductId))
                continue;
            list.Add(new ProductRuleDto(
                item.ProductId,
                NormalizeChannel(item.DineIn),
                NormalizeChannel(item.Takeaway),
                NormalizeChannel(item.Delivery)));
        }
        return (list.ToArray(), null);
    }

    static ChannelFlagsDto NormalizeChannel(ChannelFlagsDto? flags)
    {
        var taxRegular = flags?.TaxRegular == true;
        var taxAlcohol = flags?.TaxAlcohol == true;
        var service = flags?.Service == true;
        if (taxRegular && taxAlcohol)
            taxRegular = false;
        return new ChannelFlagsDto(taxRegular, taxAlcohol, service);
    }

    static (SalesTypeRuleDto[] rules, string? error) NormalizeSalesTypes(
        SalesTypeRuleDto[]? input,
        HashSet<string> taxIds,
        HashSet<string> serviceIds,
        ProductRuleDto[] productRules,
        ChargeLineDto[] charges)
    {
        if (productRules.Length > 0)
        {
            // Derive legacy sales-type attachments from product matrix so older clients keep working.
            var regularIds = charges.Where(c => c.Type == "tax-regular").Select(c => c.Id).ToArray();
            var alcoholIds = charges.Where(c => c.Type == "tax-alcohol").Select(c => c.Id).ToArray();
            var svcIds = charges.Where(c => c.Type == "service").Select(c => c.Id).ToArray();

            SalesTypeRuleDto Derive(string salesType, Func<ProductRuleDto, ChannelFlagsDto> pick)
            {
                var anyRegular = productRules.Any(r => pick(r).TaxRegular);
                var anyAlcohol = productRules.Any(r => pick(r).TaxAlcohol);
                var anyService = productRules.Any(r => pick(r).Service);
                var tids = new List<string>();
                if (anyRegular) tids.AddRange(regularIds);
                if (anyAlcohol) tids.AddRange(alcoholIds);
                return new SalesTypeRuleDto(
                    salesType,
                    tids.Where(taxIds.Contains).Distinct(StringComparer.Ordinal).ToArray(),
                    anyService ? svcIds.Where(serviceIds.Contains).ToArray() : [],
                    false,
                    []);
            }

            return ([
                Derive("dine-in", r => r.DineIn),
                Derive("takeaway", r => r.Takeaway),
                Derive("delivery", r => r.Delivery),
            ], null);
        }

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

    static string? NormalizeChargeType(string? raw)
    {
        var key = (raw ?? "").Trim().ToLowerInvariant().Replace('_', '-');
        return key switch
        {
            "tax-regular" or "taxregular" or "regular" or "tax" => "tax-regular",
            "tax-alcohol" or "taxalcohol" or "alcohol" => "tax-alcohol",
            "service" or "service-charge" or "svc" => "service",
            _ => ChargeTypes.Contains(key) ? key : null,
        };
    }

    static bool IsAlcoholTaxName(string? name) =>
        System.Text.RegularExpressions.Regex.IsMatch(name ?? "", "alcohol|liquor|spirit|abev|excise",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
}
