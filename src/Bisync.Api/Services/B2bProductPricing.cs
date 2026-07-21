using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class B2bProductPricing
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public sealed record ResolvedB2bPricing(
        decimal Rrp,
        string Uom,
        int? ProductAliasId,
        string? ProductAliasName);

    sealed record TaggedUnitDto(
        int ProductId,
        int? AliasId,
        string UnitKey,
        decimal? AppliedRrp,
        decimal? DiscountPercent);

    public static List<int> ParseIdList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "[]") return [];
        try
        {
            var parsed = JsonSerializer.Deserialize<List<int>>(json, JsonOptions);
            return parsed?.Where(id => id > 0).Distinct().ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static ResolvedB2bPricing ResolveForCustomerProduct(
        Product product,
        B2bCustomer? customer,
        int? explicitAliasId = null,
        string? unitKey = null)
    {
        var aliasIds = customer is null ? [] : ParseIdList(customer.TaggedProductAliasIdsJson);
        ProductAlias? alias = null;

        if (explicitAliasId is int aliasId && aliasId > 0)
        {
            alias = product.Aliases.FirstOrDefault(a => a.Id == aliasId);
        }
        else if (aliasIds.Count > 0)
        {
            alias = product.Aliases.FirstOrDefault(a => aliasIds.Contains(a.Id));
        }

        decimal publishedRrp;
        string uom;
        int? resolvedAliasId;
        string? resolvedAliasName;

        if (alias is not null)
        {
            var config = ParseConfig(alias.B2bSalesConfigJson);
            publishedRrp = ResolvePrincipalRrp(config, alias.Rrp > 0 ? alias.Rrp : product.Rrp);
            uom = ResolvePrincipalUom(config, product.B2bPackageUnit);
            resolvedAliasId = alias.Id;
            resolvedAliasName = alias.Name;
        }
        else
        {
            var principalConfig = ParseConfig(product.B2bSalesConfigJson);
            publishedRrp = ResolvePrincipalRrp(principalConfig, product.Rrp);
            uom = ResolvePrincipalUom(principalConfig, product.B2bPackageUnit);
            resolvedAliasId = null;
            resolvedAliasName = null;
        }

        var applied = ResolveCustomerAppliedRrp(customer, product.Id, resolvedAliasId, unitKey);
        return new ResolvedB2bPricing(
            applied is > 0 ? applied.Value : publishedRrp,
            uom,
            resolvedAliasId,
            resolvedAliasName);
    }

    static decimal? ResolveCustomerAppliedRrp(
        B2bCustomer? customer,
        int productId,
        int? aliasId,
        string? unitKey)
    {
        if (customer is null) return null;
        var units = ParseTaggedUnits(customer.TaggedB2bProductUnitsJson);
        if (units.Count == 0) return null;

        TaggedUnitDto? match = null;
        if (!string.IsNullOrWhiteSpace(unitKey))
        {
            match = units.FirstOrDefault(u =>
                u.ProductId == productId
                && u.AliasId == aliasId
                && string.Equals(u.UnitKey, unitKey.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        match ??= units.FirstOrDefault(u =>
            u.ProductId == productId
            && u.AliasId == aliasId
            && u.AppliedRrp is > 0);

        match ??= units.FirstOrDefault(u =>
            u.ProductId == productId
            && (aliasId is null || u.AliasId == aliasId)
            && u.AppliedRrp is > 0);

        return match?.AppliedRrp is > 0 ? match.AppliedRrp : null;
    }

    static List<TaggedUnitDto> ParseTaggedUnits(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "[]") return [];
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return [];

            var rows = new List<TaggedUnitDto>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (el.ValueKind != JsonValueKind.Object) continue;
                var productId = ReadInt(el, "productId", "ProductId");
                if (productId <= 0) continue;
                var unitKey = ReadString(el, "unitKey", "UnitKey");
                if (string.IsNullOrWhiteSpace(unitKey)) continue;
                int? aliasId = null;
                if (el.TryGetProperty("aliasId", out var aliasEl) || el.TryGetProperty("AliasId", out aliasEl))
                {
                    if (aliasEl.ValueKind == JsonValueKind.Number && aliasEl.TryGetInt32(out var aid) && aid > 0)
                        aliasId = aid;
                    else if (aliasEl.ValueKind != JsonValueKind.Null && aliasEl.ValueKind != JsonValueKind.Undefined
                             && int.TryParse(aliasEl.ToString(), out var aid2) && aid2 > 0)
                        aliasId = aid2;
                }

                decimal? applied = null;
                if (el.TryGetProperty("appliedRrp", out var appliedEl) || el.TryGetProperty("AppliedRrp", out appliedEl))
                {
                    if (appliedEl.ValueKind == JsonValueKind.Number && appliedEl.TryGetDecimal(out var a) && a > 0)
                        applied = a;
                }

                decimal? discount = null;
                if (el.TryGetProperty("discountPercent", out var discountEl)
                    || el.TryGetProperty("DiscountPercent", out discountEl))
                {
                    if (discountEl.ValueKind == JsonValueKind.Number && discountEl.TryGetDecimal(out var d) && d >= 0)
                        discount = d;
                }

                rows.Add(new TaggedUnitDto(productId, aliasId, unitKey.Trim(), applied, discount));
            }

            return rows;
        }
        catch
        {
            return [];
        }
    }

    static int ReadInt(JsonElement el, string camel, string pascal)
    {
        if (el.TryGetProperty(camel, out var v) || el.TryGetProperty(pascal, out v))
        {
            if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n)) return n;
            if (int.TryParse(v.ToString(), out var n2)) return n2;
        }
        return 0;
    }

    static string ReadString(JsonElement el, string camel, string pascal)
    {
        if (el.TryGetProperty(camel, out var v) || el.TryGetProperty(pascal, out v))
            return v.GetString()?.Trim() ?? string.Empty;
        return string.Empty;
    }

    static B2bSalesConfigDto ParseConfig(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new B2bSalesConfigDto();
        try
        {
            return JsonSerializer.Deserialize<B2bSalesConfigDto>(json, JsonOptions) ?? new B2bSalesConfigDto();
        }
        catch
        {
            return new B2bSalesConfigDto();
        }
    }

    static decimal ResolvePrincipalRrp(B2bSalesConfigDto config, decimal fallback)
    {
        if (decimal.TryParse(config.Principal?.Rrp, out var parsed) && parsed > 0)
            return parsed;
        return fallback;
    }

    static string ResolvePrincipalUom(B2bSalesConfigDto config, string fallback)
    {
        // B2bPackageUnit is already the formatted delivery path (e.g. "1 Box/12 Bottle").
        if (!string.IsNullOrWhiteSpace(fallback))
            return fallback.Trim();

        var delivery = config.Principal?.Delivery;
        if (delivery is null) return "pcs";

        var path = FormatDeliveryUnitPath(delivery);
        return string.IsNullOrWhiteSpace(path) ? "pcs" : path;
    }

    static string FormatDeliveryUnitPath(DeliveryUnitDto delivery)
    {
        var orderUnit = delivery.OrderUnit?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(orderUnit)) return string.Empty;

        static string Segment(decimal? qty, string unit)
        {
            var q = qty is null or <= 0 ? 1m : qty.Value;
            return q == 1m ? unit : $"{q:0.##} {unit}";
        }

        var packUnit = delivery.PackUnit?.Trim() ?? string.Empty;
        var unitUnit = delivery.UnitUnit?.Trim() ?? string.Empty;
        var packQty = delivery.PackQty is null or <= 0 ? 1m : delivery.PackQty.Value;
        var unitQty = delivery.UnitQty is null or <= 0 ? 1m : delivery.UnitQty.Value;
        var hasPack = !string.IsNullOrWhiteSpace(packUnit)
            && (!string.Equals(packUnit, orderUnit, StringComparison.OrdinalIgnoreCase) || packQty != 1m);
        var hasUnit = !string.IsNullOrWhiteSpace(unitUnit)
            && (!string.Equals(unitUnit, hasPack ? packUnit : orderUnit, StringComparison.OrdinalIgnoreCase) || unitQty != 1m);

        var parts = new List<string> { Segment(delivery.OrderQty, orderUnit) };
        if (hasPack) parts.Add(Segment(delivery.PackQty, packUnit));
        if (hasUnit) parts.Add(Segment(delivery.UnitQty, unitUnit));
        return string.Join("/", parts);
    }

    sealed class B2bSalesConfigDto
    {
        public B2bSalesUnitDto? Principal { get; set; }
    }

    sealed class B2bSalesUnitDto
    {
        public string? Rrp { get; set; }
        public DeliveryUnitDto? Delivery { get; set; }
    }

    sealed class DeliveryUnitDto
    {
        public string? OrderUnit { get; set; }
        public decimal? OrderQty { get; set; }
        public string? PackUnit { get; set; }
        public decimal? PackQty { get; set; }
        public string? UnitUnit { get; set; }
        public decimal? UnitQty { get; set; }
    }
}
