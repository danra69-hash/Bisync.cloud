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
        var delivery = config.Principal?.Delivery;
        if (delivery is null) return string.IsNullOrWhiteSpace(fallback) ? "pcs" : fallback.Trim();

        var parts = new[] { delivery.UnitUnit, delivery.PackUnit, delivery.OrderUnit }
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Select(part => part!.Trim())
            .ToList();
        if (parts.Count == 0) return string.IsNullOrWhiteSpace(fallback) ? "pcs" : fallback.Trim();
        return parts[0];
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
        public string? PackUnit { get; set; }
        public string? UnitUnit { get; set; }
    }
}
