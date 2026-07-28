using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bisync.Api.Services;

/// <summary>Years-of-service leave band: fromYears ≤ YOS &lt; toYears (toYears null = and above).</summary>
public sealed class LeaveTenureRule
{
    [JsonPropertyName("fromYears")]
    public decimal FromYears { get; set; }

    /// <summary>Exclusive upper bound; null means open-ended ("and above").</summary>
    [JsonPropertyName("toYears")]
    public decimal? ToYears { get; set; }

    [JsonPropertyName("days")]
    public int Days { get; set; }
}

public static class LeaveTenureRules
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static readonly IReadOnlyList<LeaveTenureRule> DefaultBands =
    [
        new LeaveTenureRule { FromYears = 1, ToYears = 3, Days = 10 },
        new LeaveTenureRule { FromYears = 3, ToYears = 5, Days = 12 },
        new LeaveTenureRule { FromYears = 5, ToYears = null, Days = 14 },
    ];

    public static string DefaultJson => Serialize(DefaultBands);

    public static string Serialize(IEnumerable<LeaveTenureRule> rules)
        => JsonSerializer.Serialize(Normalize(rules), JsonOptions);

    public static List<LeaveTenureRule> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return DefaultBands.Select(Clone).ToList();
        try
        {
            var parsed = JsonSerializer.Deserialize<List<LeaveTenureRule>>(json, JsonOptions);
            if (parsed is null || parsed.Count == 0)
                return DefaultBands.Select(Clone).ToList();
            return Normalize(parsed);
        }
        catch
        {
            return DefaultBands.Select(Clone).ToList();
        }
    }

    public static List<LeaveTenureRule> Normalize(IEnumerable<LeaveTenureRule>? rules)
    {
        var list = (rules ?? [])
            .Select(r => new LeaveTenureRule
            {
                FromYears = Math.Max(0, r.FromYears),
                ToYears = r.ToYears is null ? null : Math.Max(0, r.ToYears.Value),
                Days = Math.Max(0, r.Days),
            })
            .Where(r => r.ToYears is null || r.ToYears > r.FromYears)
            .OrderBy(r => r.FromYears)
            .ThenBy(r => r.ToYears ?? decimal.MaxValue)
            .ToList();
        return list.Count > 0 ? list : DefaultBands.Select(Clone).ToList();
    }

    public static int ResolveDays(string? rulesJson, decimal yearsOfService, int fallback)
    {
        var rules = Parse(rulesJson);
        if (rules.Count == 0) return Math.Max(0, fallback);

        LeaveTenureRule? match = null;
        foreach (var rule in rules)
        {
            if (yearsOfService >= rule.FromYears
                && (rule.ToYears is null || yearsOfService < rule.ToYears.Value))
                match = rule;
        }

        if (match is not null) return match.Days;
        if (yearsOfService < rules[0].FromYears) return rules[0].Days;
        return rules[^1].Days;
    }

    public static int SummaryDays(string? rulesJson, int fallback)
    {
        var rules = Parse(rulesJson);
        return rules.Count > 0 ? rules[0].Days : Math.Max(0, fallback);
    }

    static LeaveTenureRule Clone(LeaveTenureRule r) => new()
    {
        FromYears = r.FromYears,
        ToYears = r.ToYears,
        Days = r.Days,
    };
}
