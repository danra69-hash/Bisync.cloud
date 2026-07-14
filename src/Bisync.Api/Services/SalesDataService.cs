using System.Globalization;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public sealed class SalesDataService(BisyncDbContext db)
{
    static readonly HashSet<string> ProductLogSaleEntryTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "pos_sale", "online_order", "offline_order",
    };

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<SalesDataResult> GetAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string month,
        string viewBy,
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return EmptyResult();

        if (!TryParseMonth(month, out var monthStart, out var monthEnd, out var earliestAllowed))
            return EmptyResult();

        if (monthStart < earliestAllowed)
            return EmptyResult();

        var locations = await db.Locations.AsNoTracking().ToListAsync(cancellationToken);
        var locationNameToExternalId = locations
            .GroupBy(l => NormalizeLocationKey(l.Name))
            .ToDictionary(g => g.Key, g => g.First().ExternalId, StringComparer.OrdinalIgnoreCase);

        IQueryable<Product> productQuery = db.Products.AsNoTracking().Where(p => p.Active);
        if (companyId is int id)
            productQuery = productQuery.Where(p => p.CompanyId == null || p.CompanyId == id);

        var products = await productQuery.ToListAsync(cancellationToken);
        var productByName = products
            .GroupBy(p => p.Name.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var rows = new List<SalesDataRow>();
        rows.AddRange(await CollectB2bRowsAsync(companyId, locationIds, monthStart, monthEnd, productByName, cancellationToken));
        rows.AddRange(await CollectPosRowsAsync(companyId, locationIds, monthStart, monthEnd, productByName, locationNameToExternalId, cancellationToken));
        rows.AddRange(await CollectFulfilledSalesOrderRowsAsync(
            companyId,
            locationIds,
            monthStart,
            monthEnd,
            products,
            cancellationToken));
        rows.AddRange(await CollectProductLogRowsAsync(
            products,
            locationIds,
            monthStart,
            monthEnd,
            productByName,
            cancellationToken));
        rows = DedupeSalesRows(rows);

        var normalizedView = string.Equals(viewBy, "customer", StringComparison.OrdinalIgnoreCase)
            ? "customer"
            : "product";

        rows = normalizedView == "customer"
            ? rows.OrderBy(r => r.CustomerName, StringComparer.OrdinalIgnoreCase)
                .ThenByDescending(r => r.Date)
                .ThenBy(r => r.ProductName, StringComparer.OrdinalIgnoreCase)
                .ToList()
            : rows.OrderBy(r => r.ProductName, StringComparer.OrdinalIgnoreCase)
                .ThenByDescending(r => r.Date)
                .ThenBy(r => r.CustomerName, StringComparer.OrdinalIgnoreCase)
                .ToList();

        return new SalesDataResult
        {
            Month = month,
            ViewBy = normalizedView,
            Summary = new SalesDataSummary
            {
                TotalQuantity = rows.Sum(r => r.QtySold),
                TotalValue = rows.Sum(r => r.TotalValue),
                LineCount = rows.Count,
                ProductCount = rows.Select(r => r.ProductName).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                CustomerCount = rows.Select(r => r.CustomerName).Distinct(StringComparer.OrdinalIgnoreCase).Count(),
            },
            Rows = rows,
        };
    }

    static SalesDataResult EmptyResult() => new()
    {
        Summary = new SalesDataSummary(),
        Rows = [],
    };

    async Task<IEnumerable<SalesDataRow>> CollectB2bRowsAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        DateOnly monthStart,
        DateOnly monthEnd,
        IReadOnlyDictionary<string, Product> productByName,
        CancellationToken cancellationToken)
    {
        IQueryable<B2bCustomer> query = db.B2bCustomers.AsNoTracking().Where(c => c.Active);
        if (companyId is int id)
            query = query.Where(c => c.CompanyId == id);

        var customers = await query.ToListAsync(cancellationToken);
        var rows = new List<SalesDataRow>();

        foreach (var customer in customers)
        {
            foreach (var line in ParseB2bHistory(customer.PurchaseHistoryJson))
            {
                var saleDate = ResolveSaleDate(line.DateDelivered, line.DateOrdered);
                if (saleDate is null || saleDate < monthStart || saleDate > monthEnd)
                    continue;

                productByName.TryGetValue(line.ProductName.Trim(), out var product);
                var qty = line.QtyOrdered > 0 ? line.QtyOrdered : 0;
                var rrp = line.ActualRrp > 0 ? line.ActualRrp : line.Rrp;
                var total = line.TotalRevenue > 0 ? line.TotalRevenue : qty * rrp;

                rows.Add(new SalesDataRow
                {
                    Date = saleDate.Value.ToString("yyyy-MM-dd"),
                    Category = product?.Category ?? "—",
                    Group = product?.Group ?? "—",
                    ProductName = line.ProductName,
                    Uom = !string.IsNullOrWhiteSpace(line.DeliveryUom)
                        ? line.DeliveryUom
                        : ResolveProductUom(product),
                    ProductType = product is null ? "B2B" : ResolveProductType(product),
                    SalesChannel = ResolveB2bSalesChannel(product, "sales_order"),
                    QtySold = qty,
                    Rrp = rrp,
                    TotalValue = total,
                    CustomerName = customer.CompanyName,
                    CustomerExternalId = customer.ExternalId,
                    ProductId = product?.Id,
                });
            }
        }

        return rows;
    }

    async Task<IEnumerable<SalesDataRow>> CollectPosRowsAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        DateOnly monthStart,
        DateOnly monthEnd,
        IReadOnlyDictionary<string, Product> productByName,
        IReadOnlyDictionary<string, string> locationNameToExternalId,
        CancellationToken cancellationToken)
    {
        var customers = await db.PosCustomers.AsNoTracking()
            .Where(c => c.Active && (companyId == null || c.CompanyId == companyId))
            .ToListAsync(cancellationToken);

        var rows = new List<SalesDataRow>();
        foreach (var customer in customers)
        {
            foreach (var activity in ParsePosActivities(customer.ActivityHistoryJson))
            {
                if (!TryParseDate(activity.ActivityDate, out var activityDate)
                    || activityDate < monthStart
                    || activityDate > monthEnd)
                {
                    continue;
                }

                if (!ActivityMatchesLocations(activity.ActivityLocation, locationIds, locationNameToExternalId))
                    continue;

                foreach (var receiptLine in activity.ReceiptLines)
                {
                    if (IsNonProductReceiptLine(receiptLine.ItemName))
                        continue;

                    productByName.TryGetValue(receiptLine.ItemName.Trim(), out var product);
                    var channel = ResolvePosSalesChannel(product, MapPosActivityChannel(activity.ActivityType));
                    var qty = receiptLine.Qty > 0 ? receiptLine.Qty : 0;
                    var rrp = receiptLine.UnitPrice > 0 ? receiptLine.UnitPrice : product?.Rrp ?? 0;
                    var total = receiptLine.LineTotal > 0 ? receiptLine.LineTotal : qty * rrp;

                    rows.Add(new SalesDataRow
                    {
                        Date = activityDate.ToString("yyyy-MM-dd"),
                        Category = product?.Category ?? "—",
                        Group = product?.Group ?? "—",
                        ProductName = receiptLine.ItemName,
                        Uom = ResolveProductUom(product),
                        ProductType = ResolveProductType(product),
                        SalesChannel = channel,
                        QtySold = qty,
                        Rrp = rrp,
                        TotalValue = total,
                        CustomerName = customer.Name,
                        CustomerExternalId = customer.ExternalId,
                        ProductId = product?.Id,
                    });
                }
            }
        }

        return rows;
    }

    async Task<IEnumerable<SalesDataRow>> CollectProductLogRowsAsync(
        IReadOnlyList<Product> products,
        IReadOnlyList<string> locationIds,
        DateOnly monthStart,
        DateOnly monthEnd,
        IReadOnlyDictionary<string, Product> productByName,
        CancellationToken cancellationToken)
    {
        var productIds = products.Select(p => p.Id).ToList();
        if (productIds.Count == 0)
            return [];

        var logs = await db.ProductProductionLogs.AsNoTracking()
            .Where(l => productIds.Contains(l.ProductId) && ProductLogSaleEntryTypes.Contains(l.EntryType))
            .ToListAsync(cancellationToken);

        var rows = new List<SalesDataRow>();
        foreach (var log in logs)
        {
            if (!LogMatchesLocations(log.LocationIdsJson, locationIds))
                continue;

            var occurredAt = ParseProductionDate(log.ProductionDate) ?? DateOnly.FromDateTime(log.CreatedAt);
            if (occurredAt < monthStart || occurredAt > monthEnd)
                continue;

            var product = products.FirstOrDefault(p => p.Id == log.ProductId);
            if (product is null)
                continue;

            var qty = log.Quantity > 0 ? log.Quantity : 0;
            var rrp = log.UnitPrice > 0 ? log.UnitPrice : product.Rrp;
            var total = qty * rrp;

            rows.Add(new SalesDataRow
            {
                Date = occurredAt.ToString("yyyy-MM-dd"),
                Category = product.Category ?? "—",
                Group = product.Group ?? "—",
                ProductName = product.Name,
                Uom = ResolveProductUom(product),
                ProductType = ResolveProductType(product),
                SalesChannel = ResolveLogSalesChannel(product, log.EntryType),
                QtySold = qty,
                Rrp = rrp,
                TotalValue = total,
                CustomerName = "Walk-in",
                CustomerExternalId = "",
                ProductId = product.Id,
            });
        }

        return rows;
    }

    async Task<IEnumerable<SalesDataRow>> CollectFulfilledSalesOrderRowsAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        DateOnly monthStart,
        DateOnly monthEnd,
        IReadOnlyList<Product> products,
        CancellationToken cancellationToken)
    {
        IQueryable<B2bSalesOrder> query = db.B2bSalesOrders.AsNoTracking()
            .Include(o => o.Lines)
            .Where(o => o.Status == "fulfilled");
        if (companyId is int id)
            query = query.Where(o => o.CompanyId == id);

        var orders = await query.ToListAsync(cancellationToken);
        var productById = products.ToDictionary(p => p.Id);
        var rows = new List<SalesDataRow>();

        foreach (var order in orders)
        {
            if (!TryParseDate(order.FulfilledDate, out var fulfilledDate)
                || fulfilledDate < monthStart
                || fulfilledDate > monthEnd)
            {
                continue;
            }

            var orderSource = string.Equals(order.Source, "online_order", StringComparison.OrdinalIgnoreCase)
                ? "online_order"
                : "sales_order";

            foreach (var line in order.Lines.Where(l => l.Status == "fulfilled" && l.QuantityLocked > 0))
            {
                if (!locationIds.Contains(line.LocationExternalId))
                    continue;

                if (!productById.TryGetValue(line.ProductId, out var product))
                {
                    product = await db.Products.AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == line.ProductId && p.Active, cancellationToken);
                    if (product is null)
                        continue;
                }

                var qty = line.QuantityLocked;
                var rrp = line.Rrp > 0 ? line.Rrp : product.Rrp;
                var uom = !string.IsNullOrWhiteSpace(line.Uom) ? line.Uom.Trim() : ResolveProductUom(product);

                rows.Add(new SalesDataRow
                {
                    Date = fulfilledDate.ToString("yyyy-MM-dd"),
                    Category = product.Category ?? "—",
                    Group = product.Group ?? "—",
                    ProductName = !string.IsNullOrWhiteSpace(line.ProductName) ? line.ProductName : product.Name,
                    Uom = uom,
                    ProductType = ResolveProductType(product),
                    SalesChannel = ResolveB2bSalesChannel(product, orderSource),
                    QtySold = qty,
                    Rrp = rrp,
                    TotalValue = qty * rrp,
                    CustomerName = order.CustomerName,
                    CustomerExternalId = order.CustomerExternalId,
                    ProductId = product.Id,
                });
            }
        }

        return rows;
    }

    static List<SalesDataRow> DedupeSalesRows(List<SalesDataRow> rows)
    {
        var orderBackedFingerprints = new HashSet<string>(
            rows
                .Where(r => !string.IsNullOrWhiteSpace(r.CustomerExternalId))
                .Select(OrderLineFingerprint),
            StringComparer.OrdinalIgnoreCase);

        return rows
            .Where(row =>
            {
                if (!string.IsNullOrWhiteSpace(row.CustomerExternalId))
                    return true;

                if (string.Equals(row.CustomerName, "Walk-in", StringComparison.OrdinalIgnoreCase)
                    && orderBackedFingerprints.Contains(OrderLineFingerprint(row)))
                {
                    return false;
                }

                return true;
            })
            .ToList();
    }

    static string OrderLineFingerprint(SalesDataRow row) =>
        $"{row.ProductId}|{row.Date}|{row.QtySold:0.####}";

    static bool TryParseMonth(string month, out DateOnly monthStart, out DateOnly monthEnd, out DateOnly earliestAllowed)
    {
        monthStart = default;
        monthEnd = default;
        earliestAllowed = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-2);

        if (string.IsNullOrWhiteSpace(month))
            return false;

        if (!DateTime.TryParseExact($"{month.Trim()}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            return false;

        monthStart = DateOnly.FromDateTime(parsed);
        monthEnd = monthStart.AddMonths(1).AddDays(-1);
        return true;
    }

    static DateOnly? ResolveSaleDate(string? primary, string? fallback)
    {
        if (TryParseDate(primary, out var primaryDate))
            return primaryDate;
        if (TryParseDate(fallback, out var fallbackDate))
            return fallbackDate;
        return null;
    }

    static bool TryParseDate(string? value, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;
        return DateOnly.TryParse(value.Trim(), out date);
    }

    static DateOnly? ParseProductionDate(string? value)
    {
        return TryParseDate(value, out var date) ? date : null;
    }

    static string ResolveProductUom(Product? product)
    {
        if (product is null)
            return "—";
        if (!string.IsNullOrWhiteSpace(product.B2bPackageUnit))
            return product.B2bPackageUnit.Trim();
        if (!string.IsNullOrWhiteSpace(product.ParStockUom))
            return product.ParStockUom.Trim();
        if (!string.IsNullOrWhiteSpace(product.YieldUom))
            return product.YieldUom.Trim();
        return "pcs";
    }

    static string ResolveProductType(Product? product)
    {
        if (product is null)
            return "—";
        if (product.IsSubProduct)
            return "Sub-product";
        if (product.B2bEnabled)
            return "B2B";
        if (product.B2cEnabled)
            return "B2C";
        return "—";
    }

    static string ResolveB2bSalesChannel(Product? product, string orderSource)
    {
        if (string.Equals(orderSource, "online_order", StringComparison.OrdinalIgnoreCase))
            return "Online";
        return "B2B";
    }

    static string ResolveLogSalesChannel(Product product, string entryType)
    {
        var normalized = entryType.Trim().ToLowerInvariant();
        if (product.IsSubProduct)
            return normalized == "online_order" ? "Online" : "B2B";

        if (product.B2bEnabled)
            return normalized == "online_order" ? "Online" : "B2B";

        if (product.B2cEnabled)
        {
            return normalized switch
            {
                "online_order" => "Online",
                "offline_order" => "B2C",
                _ => "POS",
            };
        }

        return MapLogChannel(entryType);
    }

    static string ResolvePosSalesChannel(Product? product, string activityChannel)
    {
        if (product?.IsSubProduct == true)
            return "B2B";

        if (product?.B2bEnabled == true)
            return activityChannel == "Online" ? "Online" : "B2B";

        if (product?.B2cEnabled == true)
            return activityChannel;

        return activityChannel;
    }

    static string MapLogChannel(string entryType) =>
        entryType.Trim().ToLowerInvariant() switch
        {
            "online_order" => "Online",
            "offline_order" => "Offline",
            _ => "POS",
        };

    static string MapPosActivityChannel(string activityType)
    {
        var normalized = activityType.Trim().ToLowerInvariant();
        if (normalized.Contains("online"))
            return "Online";
        if (normalized.Contains("take-out") || normalized.Contains("takeout"))
            return "B2C";
        return "POS";
    }

    static bool IsNonProductReceiptLine(string itemName)
    {
        var normalized = itemName.Trim().ToLowerInvariant();
        return normalized is "service charge" or "service" or "tax" or "tips" or "tip";
    }

    static bool ActivityMatchesLocations(
        string? activityLocation,
        IReadOnlyList<string> locationIds,
        IReadOnlyDictionary<string, string> locationNameToExternalId)
    {
        if (string.IsNullOrWhiteSpace(activityLocation))
            return true;

        var key = NormalizeLocationKey(activityLocation);
        if (locationIds.Contains(key, StringComparer.OrdinalIgnoreCase))
            return true;

        if (locationNameToExternalId.TryGetValue(key, out var externalId)
            && locationIds.Contains(externalId, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        return locationIds.Any(id =>
            key.Contains(NormalizeLocationKey(id), StringComparison.OrdinalIgnoreCase)
            || NormalizeLocationKey(id).Contains(key, StringComparison.OrdinalIgnoreCase));
    }

    static string NormalizeLocationKey(string value) =>
        value.Trim().ToLowerInvariant().Replace(" ", "").Replace("-", "");

    static bool LogMatchesLocations(string locationIdsJson, IReadOnlyList<string> locationIds)
    {
        if (string.IsNullOrWhiteSpace(locationIdsJson))
            return true;

        try
        {
            var parsed = JsonSerializer.Deserialize<string[]>(locationIdsJson, JsonOptions) ?? [];
            if (parsed.Length == 0)
                return true;
            return parsed.Any(locationIds.Contains);
        }
        catch
        {
            return true;
        }
    }

    static IEnumerable<B2bHistoryLine> ParseB2bHistory(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "[]")
            yield break;

        B2bHistoryLine[]? lines;
        try
        {
            lines = JsonSerializer.Deserialize<B2bHistoryLine[]>(json, JsonOptions);
        }
        catch
        {
            yield break;
        }

        if (lines is null)
            yield break;

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line.ProductName))
                continue;
            yield return line;
        }
    }

    static IEnumerable<PosActivityLine> ParsePosActivities(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "[]")
            yield break;

        PosActivityLine[]? lines;
        try
        {
            lines = JsonSerializer.Deserialize<PosActivityLine[]>(json, JsonOptions);
        }
        catch
        {
            yield break;
        }

        if (lines is null)
            yield break;

        foreach (var line in lines)
            yield return line;
    }

    sealed class B2bHistoryLine
    {
        public string DateOrdered { get; set; } = string.Empty;
        public string DateDelivered { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string DeliveryUom { get; set; } = string.Empty;
        public decimal Rrp { get; set; }
        public decimal QtyOrdered { get; set; }
        public decimal ActualRrp { get; set; }
        public decimal TotalRevenue { get; set; }
    }

    sealed class PosActivityLine
    {
        public string ActivityDate { get; set; } = string.Empty;
        public string ActivityLocation { get; set; } = string.Empty;
        public string ActivityType { get; set; } = string.Empty;
        public List<PosReceiptLineDto> ReceiptLines { get; set; } = [];
    }

    sealed class PosReceiptLineDto
    {
        public string ItemName { get; set; } = string.Empty;
        public decimal Qty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
    }
}

public sealed class SalesDataResult
{
    public string Month { get; set; } = string.Empty;
    public string ViewBy { get; set; } = "product";
    public SalesDataSummary Summary { get; set; } = new();
    public List<SalesDataRow> Rows { get; set; } = [];
}

public sealed class SalesDataSummary
{
    public decimal TotalQuantity { get; set; }
    public decimal TotalValue { get; set; }
    public int LineCount { get; set; }
    public int ProductCount { get; set; }
    public int CustomerCount { get; set; }
}

public sealed class SalesDataRow
{
    public string Date { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public string ProductType { get; set; } = string.Empty;
    public string SalesChannel { get; set; } = string.Empty;
    public decimal QtySold { get; set; }
    public decimal Rrp { get; set; }
    public decimal TotalValue { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerExternalId { get; set; } = string.Empty;
    public int? ProductId { get; set; }
}
