using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class PurchaseOrderNumberService
{
    static readonly HashSet<string> CompanySkipWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "sdn", "bhd", "sdn.", "bhd.", "co", "ltd", "inc", "the", "and", "of",
    };

    public static string AbbreviateCompanyName(string name)
    {
        var words = name
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(w => w.Trim('.', ','))
            .Where(w => !CompanySkipWords.Contains(w))
            .ToList();

        if (words.Count == 0) return "CO";
        if (words.Count == 1) return words[0][..Math.Min(4, words[0].Length)].ToUpperInvariant();
        return string.Concat(words.Take(4).Select(w => char.ToUpperInvariant(w[0])));
    }

    public static string AbbreviateLocationName(string name, string externalId)
    {
        var id = externalId.Trim();
        if (!string.IsNullOrEmpty(id) && id.Length <= 4) return id.ToUpperInvariant();

        var words = name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (words.Length >= 2)
            return string.Concat(words.Take(3).Select(w => char.ToUpperInvariant(w[0])));

        var source = string.IsNullOrWhiteSpace(name) ? id : name;
        return source[..Math.Min(4, source.Length)].ToUpperInvariant();
    }

    public static string ResolveLocationAbbreviation(IReadOnlyList<string> locationExternalIds, IReadOnlyList<Location> locations)
    {
        if (locationExternalIds.Count == 0) return "GEN";
        if (locationExternalIds.Count > 1) return "MLT";

        var externalId = locationExternalIds[0];
        var location = locations.FirstOrDefault(l =>
            string.Equals(l.ExternalId, externalId, StringComparison.OrdinalIgnoreCase));

        return location is null
            ? AbbreviateLocationName(string.Empty, externalId)
            : AbbreviateLocationName(location.Name, location.ExternalId);
    }

    public static string ReserveNextPoNumber(
        HashSet<string> reservedPoNumbers,
        string companyAbbr,
        string locationAbbr,
        DateOnly orderDate)
    {
        var datePart = orderDate.ToString("yyyyMMdd");
        var prefix = $"{companyAbbr}-{locationAbbr}-";
        var suffix = $"-{datePart}";

        var maxSeq = reservedPoNumbers
            .Where(number =>
                number.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                && number.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
                && number.Length > prefix.Length + suffix.Length)
            .Select(number =>
            {
                var middle = number[prefix.Length..^suffix.Length];
                return int.TryParse(middle, out var seq) ? seq : 0;
            })
            .DefaultIfEmpty(0)
            .Max();

        var nextSeq = maxSeq + 1;
        var candidate = $"{prefix}{nextSeq:D3}{suffix}";
        while (reservedPoNumbers.Contains(candidate))
        {
            nextSeq++;
            candidate = $"{prefix}{nextSeq:D3}{suffix}";
        }

        return candidate;
    }
}
