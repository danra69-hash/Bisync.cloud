using System.Text.Json;

namespace Bisync.Api.Services;

/// <summary>Detects the stock demo floor plan so it cannot clobber a custom save.</summary>
public static class PosFloorPlanGuard
{
    static readonly (string Id, string Label, int Seats, string Section, string Shape, double X, double Y, double W, double H)[] StockTables =
    [
        ("t1", "T1", 2, "Patio", "round", 8, 20, 14, 14),
        ("t2", "T2", 4, "Main", "square", 28, 10, 14, 20),
        ("t3", "T3", 4, "Main", "square", 48, 10, 14, 20),
        ("t4", "T4", 6, "Main", "rect", 68, 8, 18, 24),
        ("t5", "T5", 2, "Bar", "oval", 10, 45, 12, 18),
        ("t6", "T6", 8, "Private", "rect", 35, 42, 22, 28),
        ("t7", "T7", 4, "Patio", "square", 65, 48, 14, 20),
        ("t8", "T8", 2, "Bar", "round", 10, 72, 12, 12),
    ];

    public static bool IsEmptyLayout(string? layoutJson)
    {
        if (string.IsNullOrWhiteSpace(layoutJson)) return true;
        try
        {
            using var doc = JsonDocument.Parse(layoutJson);
            if (!doc.RootElement.TryGetProperty("tables", out var tables)
                || tables.ValueKind != JsonValueKind.Array)
            {
                return true;
            }
            return tables.GetArrayLength() == 0;
        }
        catch
        {
            return true;
        }
    }

    public static bool IsStockDefaultLayout(string? layoutJson)
    {
        if (string.IsNullOrWhiteSpace(layoutJson)) return false;
        try
        {
            using var doc = JsonDocument.Parse(layoutJson);
            if (!doc.RootElement.TryGetProperty("tables", out var tables)
                || tables.ValueKind != JsonValueKind.Array)
            {
                return false;
            }

            if (tables.GetArrayLength() != StockTables.Length) return false;

            var byId = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            foreach (var el in tables.EnumerateArray())
            {
                if (!el.TryGetProperty("id", out var idEl)) return false;
                var id = idEl.GetString() ?? string.Empty;
                if (string.IsNullOrEmpty(id)) return false;
                byId[id] = el;
            }

            foreach (var stock in StockTables)
            {
                if (!byId.TryGetValue(stock.Id, out var el)) return false;
                if (!Matches(el, "label", stock.Label)) return false;
                if (!MatchesInt(el, "seats", stock.Seats)) return false;
                if (!Matches(el, "section", stock.Section)) return false;
                if (!Matches(el, "shape", stock.Shape)) return false;
                if (!MatchesNum(el, "x", stock.X)) return false;
                if (!MatchesNum(el, "y", stock.Y)) return false;
                if (!MatchesNum(el, "w", stock.W)) return false;
                if (!MatchesNum(el, "h", stock.H)) return false;
            }

            return true;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsCustomLayout(string? layoutJson)
        => !IsEmptyLayout(layoutJson) && !IsStockDefaultLayout(layoutJson);

    static bool Matches(JsonElement el, string prop, string expected)
        => el.TryGetProperty(prop, out var v)
           && string.Equals(v.GetString() ?? string.Empty, expected, StringComparison.Ordinal);

    static bool MatchesInt(JsonElement el, string prop, int expected)
        => el.TryGetProperty(prop, out var v)
           && v.TryGetInt32(out var n)
           && n == expected;

    static bool MatchesNum(JsonElement el, string prop, double expected)
    {
        if (!el.TryGetProperty(prop, out var v)) return false;
        double n = v.ValueKind switch
        {
            JsonValueKind.Number => v.GetDouble(),
            JsonValueKind.String when double.TryParse(v.GetString(), out var parsed) => parsed,
            _ => double.NaN,
        };
        return !double.IsNaN(n) && Math.Abs(n - expected) < 0.01;
    }
}
