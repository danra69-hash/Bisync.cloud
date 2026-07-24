using System;
using System.Collections.Generic;

namespace Bisync.Api.Services;

/// <summary>Maps company setup CountryCode → ISO 4217 currency (display/billing helpers).</summary>
public static class CountryCurrencies
{
    static readonly Dictionary<string, string> CodeByCountry = new(StringComparer.OrdinalIgnoreCase)
    {
        ["MY"] = "MYR",
        ["SG"] = "SGD",
        ["AU"] = "AUD",
        ["GB"] = "GBP",
        ["UK"] = "GBP",
        ["US"] = "USD",
        ["ID"] = "IDR",
        ["TH"] = "THB",
        ["VN"] = "VND",
        ["PH"] = "PHP",
        ["JP"] = "JPY",
        ["KR"] = "KRW",
        ["CN"] = "CNY",
        ["HK"] = "HKD",
        ["TW"] = "TWD",
        ["NZ"] = "NZD",
        ["FR"] = "EUR",
        ["DE"] = "EUR",
        ["IT"] = "EUR",
        ["ES"] = "EUR",
        ["CA"] = "CAD",
        ["AE"] = "AED",
        ["IN"] = "INR",
    };

    static readonly Dictionary<string, string> SymbolByCountry = new(StringComparer.OrdinalIgnoreCase)
    {
        ["MY"] = "RM",
        ["SG"] = "S$",
        ["AU"] = "A$",
        ["GB"] = "£",
        ["UK"] = "£",
        ["US"] = "$",
        ["ID"] = "Rp",
        ["TH"] = "฿",
        ["VN"] = "₫",
        ["PH"] = "₱",
        ["JP"] = "¥",
        ["KR"] = "₩",
        ["CN"] = "¥",
        ["HK"] = "HK$",
        ["TW"] = "NT$",
        ["NZ"] = "NZ$",
        ["FR"] = "€",
        ["DE"] = "€",
        ["IT"] = "€",
        ["ES"] = "€",
        ["CA"] = "C$",
        ["AE"] = "AED",
        ["IN"] = "₹",
    };

    public static string NormalizeCountry(string? countryCode)
    {
        var code = (countryCode ?? "MY").Trim().ToUpperInvariant();
        return string.IsNullOrEmpty(code) ? "MY" : code;
    }

    public static string ResolveCode(string? countryCode)
    {
        var country = NormalizeCountry(countryCode);
        return CodeByCountry.TryGetValue(country, out var currency) ? currency : "MYR";
    }

    public static string ResolveSymbol(string? countryCode)
    {
        var country = NormalizeCountry(countryCode);
        return SymbolByCountry.TryGetValue(country, out var symbol) ? symbol : "RM";
    }
}
