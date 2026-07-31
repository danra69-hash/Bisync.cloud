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
        if (!TryParseMonth(month, out _, out _))
            return Empty("BCG Matrix", month);

        var sales = await salesData.GetAsync(companyId, locationIds, month, "product", ct);

        IQueryable<Product> productQuery = db.Products.AsNoTracking();
        if (companyId is int cid)
            productQuery = productQuery.Where(p => p.CompanyId == null || p.CompanyId == cid);
        var products = await productQuery.ToListAsync(ct);
        var productById = products.ToDictionary(p => p.Id);
        var productByName = products
            .GroupBy(p => p.Name.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.UpdatedAt).First(), StringComparer.OrdinalIgnoreCase);

        var aggregates = new Dictionary<string, BcgProductAgg>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in sales.Rows)
        {
            var name = (row.ProductName ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name)) continue;

            Product? product = null;
            if (row.ProductId is int pid)
                productById.TryGetValue(pid, out product);
            if (product is null)
                productByName.TryGetValue(name, out product);

            if (!aggregates.TryGetValue(name, out var agg))
            {
                agg = new BcgProductAgg
                {
                    ProductName = name,
                    Category = FirstNonEmpty(row.Category, product?.Category),
                    Group = FirstNonEmpty(row.Group, product?.Group),
                    ProductType = FirstNonEmpty(row.ProductType, product is null ? "" : ResolveProductType(product)),
                    ProductId = product?.Id,
                    UnitCost = product is null ? 0m : product.TotalCost + product.PackagingCost,
                };
                aggregates[name] = agg;
            }

            agg.Sales += row.TotalValue;
            agg.QtySold += row.QtySold;
            if (string.IsNullOrWhiteSpace(agg.Category))
                agg.Category = FirstNonEmpty(row.Category, product?.Category);
            if (string.IsNullOrWhiteSpace(agg.Group))
                agg.Group = FirstNonEmpty(row.Group, product?.Group);
            if (agg.ProductId is null && product is not null)
            {
                agg.ProductId = product.Id;
                agg.UnitCost = product.TotalCost + product.PackagingCost;
            }
        }

        var working = aggregates.Values
            .Where(a => a.Sales > 0m || a.QtySold > 0m)
            .Select(a =>
            {
                var cost = a.UnitCost * a.QtySold;
                var marginAmount = a.Sales - cost;
                var marginPercent = a.Sales > 0m ? marginAmount / a.Sales : 0m;
                return new
                {
                    a.ProductName,
                    a.Category,
                    a.Group,
                    a.ProductType,
                    a.ProductId,
                    a.QtySold,
                    a.Sales,
                    a.UnitCost,
                    Cost = cost,
                    MarginAmount = marginAmount,
                    MarginPercent = marginPercent,
                };
            })
            .ToList();

        var marginThreshold = Median(working.Select(x => x.MarginPercent).ToList());
        var salesThreshold = Median(working.Select(x => x.Sales).ToList());

        var rows = working
            .Select(item =>
            {
                var highMargin = item.MarginPercent >= marginThreshold;
                var highSales = item.Sales >= salesThreshold;
                var quadrant = (highSales, highMargin) switch
                {
                    (true, true) => "Star",
                    (true, false) => "Cash Cow",
                    (false, true) => "Question Mark",
                    _ => "Dog",
                };

                return new Dictionary<string, object?>
                {
                    ["productName"] = item.ProductName,
                    ["category"] = item.Category,
                    ["group"] = item.Group,
                    ["productType"] = item.ProductType,
                    ["productId"] = item.ProductId,
                    ["qtySold"] = item.QtySold,
                    ["sales"] = Math.Round(item.Sales, 4),
                    ["unitCost"] = Math.Round(item.UnitCost, 4),
                    ["cost"] = Math.Round(item.Cost, 4),
                    ["marginAmount"] = Math.Round(item.MarginAmount, 4),
                    ["marginPercent"] = Math.Round(item.MarginPercent, 4),
                    ["quadrant"] = quadrant,
                    ["x"] = Math.Round(item.MarginPercent, 4),
                    ["y"] = Math.Round(item.Sales, 4),
                };
            })
            .OrderByDescending(r => Convert.ToDecimal(r["sales"], CultureInfo.InvariantCulture))
            .ThenBy(r => (string?)r["productName"], StringComparer.OrdinalIgnoreCase)
            .ToList();

        var quadrantCounts = rows
            .GroupBy(r => (string)r["quadrant"]!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => (object?)g.Count(), StringComparer.OrdinalIgnoreCase);

        var categories = rows
            .Select(r => (string?)r["category"] ?? "")
            .Where(s => !string.IsNullOrWhiteSpace(s) && s != "—")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(s => s, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var groups = rows
            .Select(r => (string?)r["group"] ?? "")
            .Where(s => !string.IsNullOrWhiteSpace(s) && s != "—")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(s => s, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalSales = working.Sum(x => x.Sales);
        var totalMargin = working.Sum(x => x.MarginAmount);

        return new ReportPayload(
            "BCG Matrix",
            month,
            new Dictionary<string, object?>
            {
                ["productCount"] = rows.Count,
                ["totalSales"] = totalSales,
                ["totalMargin"] = totalMargin,
                ["marginThreshold"] = Math.Round(marginThreshold, 4),
                ["salesThreshold"] = Math.Round(salesThreshold, 4),
                ["stars"] = quadrantCounts.GetValueOrDefault("Star", 0),
                ["cashCows"] = quadrantCounts.GetValueOrDefault("Cash Cow", 0),
                ["questionMarks"] = quadrantCounts.GetValueOrDefault("Question Mark", 0),
                ["dogs"] = quadrantCounts.GetValueOrDefault("Dog", 0),
                ["categories"] = categories,
                ["groups"] = groups,
            },
            rows);
    }

    sealed class BcgProductAgg
    {
        public string ProductName { get; set; } = "";
        public string Category { get; set; } = "";
        public string Group { get; set; } = "";
        public string ProductType { get; set; } = "";
        public int? ProductId { get; set; }
        public decimal UnitCost { get; set; }
        public decimal Sales { get; set; }
        public decimal QtySold { get; set; }
    }

    static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            var trimmed = (value ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(trimmed) && trimmed != "—")
                return trimmed;
        }
        return "";
    }

    static string ResolveProductType(Product product)
    {
        if (product.IsSubProduct) return "Sub-product";
        if (product.B2bEnabled && !product.PosEnabled) return "B2B";
        if (product.PosEnabled) return "POS";
        return "Product";
    }

    static decimal Median(IReadOnlyList<decimal> values)
    {
        if (values.Count == 0) return 0m;
        var sorted = values.OrderBy(v => v).ToList();
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 0
            ? (sorted[mid - 1] + sorted[mid]) / 2m
            : sorted[mid];
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
