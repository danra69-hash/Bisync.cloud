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
        int? explicitAliasId = null)
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

        if (alias is not null)
        {
            var config = ParseConfig(alias.B2bSalesConfigJson);
            var rrp = ResolvePrincipalRrp(config, alias.Rrp > 0 ? alias.Rrp : product.Rrp);
            var uom = ResolvePrincipalUom(config, product.B2bPackageUnit);
            return new ResolvedB2bPricing(rrp, uom, alias.Id, alias.Name);
        }

        var principalConfig = ParseConfig(product.B2bSalesConfigJson);
        return new ResolvedB2bPricing(
            ResolvePrincipalRrp(principalConfig, product.Rrp),
            ResolvePrincipalUom(principalConfig, product.B2bPackageUnit),
            null,
            null);
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
