using System.Globalization;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public sealed class ReportsService(
    BisyncDbContext db,
    SalesDataService salesData,
    StockCardService stockCards)
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<ReportPayload> ItemizedSalesSummaryAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string month,
        CancellationToken ct = default)
    {
        var sales = await salesData.GetAsync(companyId, locationIds, month, "product", ct);
        var groups = sales.Rows
            .GroupBy(r => new
            {
                ProductName = (r.ProductName ?? string.Empty).Trim(),
                Category = (r.Category ?? string.Empty).Trim(),
                Group = (r.Group ?? string.Empty).Trim(),
                Uom = (r.Uom ?? string.Empty).Trim(),
                ProductType = (r.ProductType ?? string.Empty).Trim(),
            })
            .Select(g => new Dictionary<string, object?>
            {
                ["productName"] = g.Key.ProductName,
                ["category"] = g.Key.Category,
                ["group"] = g.Key.Group,
                ["productType"] = g.Key.ProductType,
                ["uom"] = g.Key.Uom,
                ["qtySold"] = g.Sum(x => x.QtySold),
                ["totalValue"] = g.Sum(x => x.TotalValue),
                ["avgUnitPrice"] = g.Sum(x => x.QtySold) > 0
                    ? g.Sum(x => x.TotalValue) / g.Sum(x => x.QtySold)
                    : 0m,
                ["lineCount"] = g.Count(),
                ["channels"] = string.Join(", ", g.Select(x => x.SalesChannel).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(s => s)),
            })
            .OrderByDescending(r => Convert.ToDecimal(r["totalValue"], CultureInfo.InvariantCulture))
            .ThenBy(r => (string?)r["productName"], StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ReportPayload(
            "Itemized Sales Summary",
            month,
            new Dictionary<string, object?>
            {
                ["totalQuantity"] = sales.Summary.TotalQuantity,
                ["totalValue"] = sales.Summary.TotalValue,
                ["productCount"] = groups.Count,
                ["lineCount"] = sales.Summary.LineCount,
            },
            groups);
    }

    public async Task<ReportPayload> InventorySummaryAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string period,
        string itemType = "component",
        CancellationToken ct = default)
    {
        var rows = await stockCards.ListAsync(companyId, locationIds, itemType, "inventory", period, ct);
        var mapped = rows
            .Select(r => new Dictionary<string, object?>
            {
                ["itemType"] = r.ItemType,
                ["itemKey"] = r.ItemKey,
                ["group"] = r.Group,
                ["name"] = r.Name,
                ["uom"] = r.Uom,
                ["inboundQty"] = r.InboundQty,
                ["outboundQty"] = r.OutboundQty,
                ["adjustmentQty"] = r.AdjustmentQty,
                ["onHandQty"] = r.OnHandQty,
                ["averageCogs"] = r.AverageCogs,
                ["onHandValue"] = r.OnHandQty * r.OnHandAverageCogs,
            })
            .OrderBy(r => (string?)r["group"], StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => (string?)r["name"], StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ReportPayload(
            "Inventory Summary",
            period,
            new Dictionary<string, object?>
            {
                ["itemCount"] = mapped.Count,
                ["onHandQty"] = mapped.Sum(r => Convert.ToDecimal(r["onHandQty"], CultureInfo.InvariantCulture)),
                ["onHandValue"] = mapped.Sum(r => Convert.ToDecimal(r["onHandValue"], CultureInfo.InvariantCulture)),
                ["inboundQty"] = mapped.Sum(r => Convert.ToDecimal(r["inboundQty"], CultureInfo.InvariantCulture)),
                ["outboundQty"] = mapped.Sum(r => Convert.ToDecimal(r["outboundQty"], CultureInfo.InvariantCulture)),
            },
            mapped);
    }

    public async Task<ReportPayload> DetailedPurchaseSummaryAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string month,
        CancellationToken ct = default)
    {
        if (!TryParseMonth(month, out var monthStart, out var monthEnd))
            return Empty("Detailed Purchase Summary", month);

        var locSet = locationIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        IQueryable<PurchaseOrder> q = db.PurchaseOrders.AsNoTracking()
            .Include(p => p.Items)
            .Where(p => p.OrderDate >= monthStart && p.OrderDate < monthEnd);

        if (companyId is int cid)
            q = q.Where(p => p.CompanyId == null || p.CompanyId == cid);

        var orders = await q.OrderByDescending(p => p.OrderDate).ThenBy(p => p.PoNumber).ToListAsync(ct);
        if (locSet.Count > 0)
        {
            orders = orders.Where(p =>
            {
                var locs = ParseJsonStringArray(p.LocationIdsJson);
                return locs.Count == 0 || locs.Any(locSet.Contains);
            }).ToList();
        }

        var rows = new List<Dictionary<string, object?>>();
        foreach (var po in orders)
        {
            var locs = string.Join(", ", ParseJsonStringArray(po.LocationIdsJson));
            foreach (var item in po.Items.OrderBy(i => i.Name))
            {
                var qty = item.ReconciledQuantity ?? item.ReceivedQuantity ?? item.Quantity;
                var price = item.ReconciledUnitPrice ?? item.ReceivedUnitPrice ?? item.UnitPrice;
                rows.Add(new Dictionary<string, object?>
                {
                    ["poNumber"] = po.PoNumber,
                    ["orderDate"] = po.OrderDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    ["vendorName"] = po.VendorName,
                    ["status"] = po.Status,
                    ["documentType"] = po.DocumentType,
                    ["locations"] = locs,
                    ["itemName"] = string.IsNullOrWhiteSpace(item.Name) ? item.ComponentName : item.Name,
                    ["componentId"] = item.ComponentId,
                    ["uom"] = string.IsNullOrWhiteSpace(item.Unit) ? item.ComponentUom : item.Unit,
                    ["orderedQty"] = item.Quantity,
                    ["receivedQty"] = item.ReceivedQuantity ?? 0m,
                    ["deliveredQty"] = item.DeliveredQuantity,
                    ["unitPrice"] = price,
                    ["lineTotal"] = qty * price + item.TaxAmount,
                    ["taxAmount"] = item.TaxAmount,
                    ["isPreCommitted"] = po.IsPreCommitted,
                });
            }
        }

        return new ReportPayload(
            "Detailed Purchase Summary",
            month,
            new Dictionary<string, object?>
            {
                ["poCount"] = orders.Count,
                ["lineCount"] = rows.Count,
                ["orderedValue"] = rows.Sum(r => Convert.ToDecimal(r["lineTotal"], CultureInfo.InvariantCulture)),
                ["vendorCount"] = orders.Select(o => o.VendorName).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
            },
            rows);
    }

    public async Task<ReportPayload> ProductionReportAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string month,
        CancellationToken ct = default)
    {
        if (!TryParseMonth(month, out var monthStart, out var monthEnd))
            return Empty("Production Report", month);

        var locSet = locationIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var startText = monthStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var endText = monthEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        IQueryable<ProductProductionLog> q = db.ProductProductionLogs.AsNoTracking()
            .Include(l => l.Product)
            .Where(l => l.ProductionDate.CompareTo(startText) >= 0 && l.ProductionDate.CompareTo(endText) < 0);

        if (companyId is int cid)
            q = q.Where(l => l.CompanyId == null || l.CompanyId == cid);

        var logs = await q.OrderByDescending(l => l.ProductionDate).ThenByDescending(l => l.Id).ToListAsync(ct);
        if (locSet.Count > 0)
        {
            logs = logs.Where(l =>
            {
                var locs = ParseJsonStringArray(l.LocationIdsJson);
                return locs.Count == 0 || locs.Any(locSet.Contains);
            }).ToList();
        }

        var rows = logs.Select(l => new Dictionary<string, object?>
        {
            ["productionDate"] = l.ProductionDate,
            ["expiryDate"] = l.ExpiryDate,
            ["batchNumber"] = l.BatchNumber,
            ["entryType"] = l.EntryType,
            ["productId"] = l.ProductId,
            ["productName"] = l.Product?.Name ?? $"Product #{l.ProductId}",
            ["productCode"] = l.Product?.ProductId ?? l.ProductId.ToString(CultureInfo.InvariantCulture),
            ["quantity"] = l.Quantity,
            ["unitPrice"] = l.UnitPrice,
            ["totalValue"] = l.Quantity * l.UnitPrice,
            ["locations"] = string.Join(", ", ParseJsonStringArray(l.LocationIdsJson)),
        }).ToList();

        return new ReportPayload(
            "Production Report",
            month,
            new Dictionary<string, object?>
            {
                ["batchCount"] = rows.Count,
                ["totalQuantity"] = rows.Sum(r => Convert.ToDecimal(r["quantity"], CultureInfo.InvariantCulture)),
                ["totalValue"] = rows.Sum(r => Convert.ToDecimal(r["totalValue"], CultureInfo.InvariantCulture)),
                ["productCount"] = logs.Select(l => l.ProductId).Distinct().Count(),
            },
            rows);
    }

    public async Task<ReportPayload> BcgMatrixAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string month,
        CancellationToken ct = default)
    {
        if (!TryParseMonth(month, out var monthStart, out _))
            return Empty("BCG Matrix", month);

        var previousMonth = monthStart.AddMonths(-1).ToString("yyyy-MM", CultureInfo.InvariantCulture);
        const decimal shareThreshold = 0.5m;
        const decimal growthThreshold = 0.10m;

        var currentSales = await salesData.GetAsync(companyId, locationIds, month, "product", ct);
        var previousSales = await salesData.GetAsync(companyId, locationIds, previousMonth, "product", ct);

        static Dictionary<string, (decimal Value, decimal Qty, string Category, string Group, string ProductType)> Aggregate(
            IEnumerable<SalesDataRow> rows)
        {
            var map = new Dictionary<string, (decimal Value, decimal Qty, string Category, string Group, string ProductType)>(
                StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                var name = (row.ProductName ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(name)) continue;
                if (!map.TryGetValue(name, out var existing))
                {
                    map[name] = (
                        row.TotalValue,
                        row.QtySold,
                        (row.Category ?? string.Empty).Trim(),
                        (row.Group ?? string.Empty).Trim(),
                        (row.ProductType ?? string.Empty).Trim());
                    continue;
                }

                map[name] = (
                    existing.Value + row.TotalValue,
                    existing.Qty + row.QtySold,
                    string.IsNullOrWhiteSpace(existing.Category) ? (row.Category ?? string.Empty).Trim() : existing.Category,
                    string.IsNullOrWhiteSpace(existing.Group) ? (row.Group ?? string.Empty).Trim() : existing.Group,
                    string.IsNullOrWhiteSpace(existing.ProductType) ? (row.ProductType ?? string.Empty).Trim() : existing.ProductType);
            }

            return map;
        }

        var current = Aggregate(currentSales.Rows);
        var previous = Aggregate(previousSales.Rows);
        var names = current.Keys.Union(previous.Keys, StringComparer.OrdinalIgnoreCase).ToList();
        var maxValue = current.Values.Select(v => v.Value).DefaultIfEmpty(0m).Max();
        if (maxValue <= 0m)
            maxValue = previous.Values.Select(v => v.Value).DefaultIfEmpty(0m).Max();

        var totalCurrent = current.Values.Sum(v => v.Value);
        var rows = new List<Dictionary<string, object?>>();

        foreach (var name in names)
        {
            current.TryGetValue(name, out var cur);
            previous.TryGetValue(name, out var prev);
            var currentValue = cur.Value;
            var previousValue = prev.Value;
            var qtySold = cur.Qty;
            var category = !string.IsNullOrWhiteSpace(cur.Category) ? cur.Category : prev.Category;
            var group = !string.IsNullOrWhiteSpace(cur.Group) ? cur.Group : prev.Group;
            var productType = !string.IsNullOrWhiteSpace(cur.ProductType) ? cur.ProductType : prev.ProductType;

            var relativeShare = maxValue > 0m ? currentValue / maxValue : 0m;
            decimal growthRate;
            string growthLabel;
            if (previousValue > 0m)
            {
                growthRate = (currentValue - previousValue) / previousValue;
                growthLabel = $"{growthRate * 100m:0.#}%";
            }
            else if (currentValue > 0m)
            {
                growthRate = 1m;
                growthLabel = "New";
            }
            else
            {
                growthRate = 0m;
                growthLabel = "0%";
            }

            var highShare = relativeShare >= shareThreshold;
            var highGrowth = growthRate >= growthThreshold;
            var quadrant = (highGrowth, highShare) switch
            {
                (true, true) => "Star",
                (false, true) => "Cash Cow",
                (true, false) => "Question Mark",
                _ => "Dog",
            };

            rows.Add(new Dictionary<string, object?>
            {
                ["productName"] = name,
                ["category"] = category,
                ["group"] = group,
                ["productType"] = productType,
                ["qtySold"] = qtySold,
                ["currentValue"] = currentValue,
                ["previousValue"] = previousValue,
                ["valueDelta"] = currentValue - previousValue,
                ["relativeShare"] = Math.Round(relativeShare, 4),
                ["portfolioShare"] = totalCurrent > 0m ? Math.Round(currentValue / totalCurrent, 4) : 0m,
                ["growthRate"] = Math.Round(growthRate, 4),
                ["growthLabel"] = growthLabel,
                ["quadrant"] = quadrant,
                ["x"] = Math.Round(relativeShare, 4),
                ["y"] = Math.Round(growthRate, 4),
            });
        }

        rows = rows
            .OrderByDescending(r => Convert.ToDecimal(r["currentValue"], CultureInfo.InvariantCulture))
            .ThenBy(r => (string?)r["productName"], StringComparer.OrdinalIgnoreCase)
            .ToList();

        var quadrantCounts = rows
            .GroupBy(r => (string)r["quadrant"]!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => (object?)g.Count(), StringComparer.OrdinalIgnoreCase);

        return new ReportPayload(
            "BCG Matrix",
            month,
            new Dictionary<string, object?>
            {
                ["productCount"] = rows.Count,
                ["totalValue"] = totalCurrent,
                ["previousTotalValue"] = previous.Values.Sum(v => v.Value),
                ["previousMonth"] = previousMonth,
                ["shareThreshold"] = shareThreshold,
                ["growthThreshold"] = growthThreshold,
                ["stars"] = quadrantCounts.GetValueOrDefault("Star", 0),
                ["cashCows"] = quadrantCounts.GetValueOrDefault("Cash Cow", 0),
                ["questionMarks"] = quadrantCounts.GetValueOrDefault("Question Mark", 0),
                ["dogs"] = quadrantCounts.GetValueOrDefault("Dog", 0),
            },
            rows);
    }

    public async Task<ReportPayload> WastageReportAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string month,
        CancellationToken ct = default)
    {
        if (!TryParseMonth(month, out var monthStart, out var monthEnd))
            return Empty("Wastage Report", month);

        var locSet = locationIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        IQueryable<WastageEntry> q = db.WastageEntries.AsNoTracking()
            .Where(w => w.WastedDate >= monthStart && w.WastedDate < monthEnd);

        if (companyId is int cid)
            q = q.Where(w => w.CompanyId == null || w.CompanyId == cid);
        if (locSet.Count > 0)
            q = q.Where(w => locSet.Contains(w.LocationExternalId));

        var entries = await q.OrderByDescending(w => w.WastedDate).ThenByDescending(w => w.Id).ToListAsync(ct);

        var detail = entries.Select(w => new Dictionary<string, object?>
        {
            ["wastedDate"] = w.WastedDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["locationExternalId"] = w.LocationExternalId,
            ["source"] = w.Source,
            ["itemType"] = w.ItemType,
            ["itemKey"] = w.ItemKey,
            ["itemName"] = w.ItemName,
            ["quantity"] = w.Quantity,
            ["uom"] = w.Uom,
            ["reason"] = w.Reason,
            ["unitPrice"] = w.UnitPrice,
            ["totalValue"] = w.TotalValue,
            ["posCheckNo"] = w.PosCheckNo ?? "",
            ["isSplitUse"] = !string.IsNullOrWhiteSpace(w.SplitUseLineKey)
                || string.Equals(w.SourceReferenceType, "split_use", StringComparison.OrdinalIgnoreCase),
        }).ToList();

        var byReason = entries
            .GroupBy(w => string.IsNullOrWhiteSpace(w.Reason) ? "(none)" : w.Reason.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => new Dictionary<string, object?>
            {
                ["reason"] = g.Key,
                ["lineCount"] = g.Count(),
                ["quantity"] = g.Sum(x => x.Quantity),
                ["totalValue"] = g.Sum(x => x.TotalValue),
            })
            .OrderByDescending(r => Convert.ToDecimal(r["totalValue"], CultureInfo.InvariantCulture))
            .ToList();

        return new ReportPayload(
            "Wastage Report",
            month,
            new Dictionary<string, object?>
            {
                ["lineCount"] = detail.Count,
                ["totalQuantity"] = detail.Sum(r => Convert.ToDecimal(r["quantity"], CultureInfo.InvariantCulture)),
                ["totalValue"] = detail.Sum(r => Convert.ToDecimal(r["totalValue"], CultureInfo.InvariantCulture)),
                ["reasonCount"] = byReason.Count,
            },
            detail,
            new Dictionary<string, IReadOnlyList<Dictionary<string, object?>>>
            {
                ["byReason"] = byReason,
            });
    }

    static ReportPayload Empty(string title, string period) =>
        new(title, period, new Dictionary<string, object?>(), []);

    static bool TryParseMonth(string month, out DateOnly start, out DateOnly end)
    {
        start = default;
        end = default;
        if (string.IsNullOrWhiteSpace(month)) return false;
        if (!DateOnly.TryParseExact(month.Trim() + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out start)
            && !DateOnly.TryParse($"{month.Trim()}-01", out start))
            return false;
        end = start.AddMonths(1);
        return true;
    }

    static List<string> ParseJsonStringArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }
}

public sealed record ReportPayload(
    string Title,
    string Period,
    Dictionary<string, object?> Summary,
    IReadOnlyList<Dictionary<string, object?>> Rows,
    Dictionary<string, IReadOnlyList<Dictionary<string, object?>>>? Extra = null);
