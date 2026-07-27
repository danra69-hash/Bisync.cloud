using System.Text.Json;

namespace Bisync.Api.Services;

/// <summary>
/// Dev Console tab allowlist stored on <c>DevTeamUser.AccessJson</c>.
/// Separate from customer AppUser Access Control.
/// </summary>
public static class DevConsoleTabAccess
{
    public static readonly string[] AllTabs =
    [
        "overview",
        "tenant-rollups",
        "sales-module",
        "automated-qa",
        "qa-history",
        "audit-trail",
        "ghost-support",
        "ref-library",
    ];

    public static readonly string[] TeamTypes =
    [
        "Management",
        "Hunter",
        "Farmer",
        "Accounts",
    ];

    public static string AllTabsJson() =>
        JsonSerializer.Serialize(new { tabs = AllTabs });

    public static string NormalizeTeamType(string? value)
    {
        var trimmed = (value ?? "").Trim();
        foreach (var t in TeamTypes)
        {
            if (string.Equals(t, trimmed, StringComparison.OrdinalIgnoreCase))
                return t;
        }
        return "Management";
    }

    public static List<string> ParseTabs(string? accessJson)
    {
        if (string.IsNullOrWhiteSpace(accessJson))
            return AllTabs.ToList();

        try
        {
            using var doc = JsonDocument.Parse(accessJson);
            if (!doc.RootElement.TryGetProperty("tabs", out var tabsEl) || tabsEl.ValueKind != JsonValueKind.Array)
                return AllTabs.ToList();

            var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in tabsEl.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String) continue;
                var tab = item.GetString()?.Trim();
                if (string.IsNullOrWhiteSpace(tab)) continue;
                if (AllTabs.Any(t => string.Equals(t, tab, StringComparison.OrdinalIgnoreCase)))
                    allowed.Add(AllTabs.First(t => string.Equals(t, tab, StringComparison.OrdinalIgnoreCase)));
            }

            return allowed.Count > 0 ? AllTabs.Where(allowed.Contains).ToList() : [];
        }
        catch
        {
            return AllTabs.ToList();
        }
    }

    public static string BuildAccessJson(IEnumerable<string>? tabs)
    {
        var selected = new List<string>();
        if (tabs is not null)
        {
            foreach (var tab in tabs)
            {
                var match = AllTabs.FirstOrDefault(t => string.Equals(t, tab?.Trim(), StringComparison.OrdinalIgnoreCase));
                if (match is not null && !selected.Contains(match))
                    selected.Add(match);
            }
        }

        if (selected.Count == 0)
            selected.Add("overview");

        return JsonSerializer.Serialize(new { tabs = selected });
    }

    public static bool HasTab(string? accessJson, string tab, bool isRoot) =>
        isRoot || ParseTabs(accessJson).Contains(tab, StringComparer.OrdinalIgnoreCase);
}
