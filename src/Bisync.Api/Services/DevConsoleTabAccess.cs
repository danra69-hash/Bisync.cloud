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
        "audit-trail",
        "ghost-support",
        "ref-library",
    ];

    /// <summary>Legacy top-level tab folded into Automated QA.</summary>
    private const string LegacyQaHistoryTab = "qa-history";

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

    /// <summary>
    /// Maps a raw tab id (including legacy <c>qa-history</c>) onto a current AllTabs entry.
    /// </summary>
    public static string? NormalizeTabId(string? tab)
    {
        var trimmed = tab?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return null;

        if (string.Equals(trimmed, LegacyQaHistoryTab, StringComparison.OrdinalIgnoreCase))
            return "automated-qa";

        return AllTabs.FirstOrDefault(t => string.Equals(t, trimmed, StringComparison.OrdinalIgnoreCase));
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
                var normalized = NormalizeTabId(item.GetString());
                if (normalized is not null)
                    allowed.Add(normalized);
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
                var match = NormalizeTabId(tab);
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
