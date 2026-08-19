using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Bisync.Api.Data;
using Bisync.Api.Models;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace Bisync.Api.Services;

public sealed class PosSalesImportService(BisyncDbContext db)
{
    public static readonly IReadOnlyList<PosSalesSystemField> SystemFields =
    [
        new("saleDate", "Sale date", true, "Business / sale date of the line"),
        new("checkNumber", "Check / ticket #", false, "POS check or ticket number"),
        new("productCode", "Product code / PLU", false, "SKU, PLU, or POS product number"),
        new("productName", "Product name", true, "Sold item name"),
        new("quantity", "Quantity", true, "Units sold"),
        new("unitPrice", "Unit price", false, "Price per unit"),
        new("lineTotal", "Line total / gross", false, "Extended amount for the line"),
        new("discount", "Discount", false, "Line or check discount amount"),
        new("tax", "Tax", false, "Tax amount"),
        new("covers", "Covers / pax", false, "Guest count"),
        new("paymentMethod", "Payment method", false, "Cash, card, QR, etc."),
        new("tableLabel", "Table", false, "Table or station label"),
    ];

    static readonly Dictionary<string, string[]> HeaderAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["saleDate"] = ["sale date", "sales date", "business date", "date", "txn date", "transaction date", "order date", "paid at", "paid date"],
        ["checkNumber"] = ["check", "check #", "check no", "check number", "ticket", "ticket #", "bill", "bill #", "order #", "order no", "receipt", "receipt #"],
        ["productCode"] = ["product code", "item code", "sku", "plu", "plu number", "pos code", "product id", "item id", "article"],
        ["productName"] = ["product", "product name", "item", "item name", "description", "menu item", "dish"],
        ["quantity"] = ["qty", "quantity", "qty sold", "units", "count", "sold qty"],
        ["unitPrice"] = ["unit price", "price", "rrp", "sell price", "unit amt", "rate"],
        ["lineTotal"] = ["line total", "total", "gross", "amount", "net amount", "sales amount", "extended", "line amount", "value"],
        ["discount"] = ["discount", "disc", "discount amt", "promo discount"],
        ["tax"] = ["tax", "gst", "vat", "sst", "tax amount"],
        ["covers"] = ["covers", "pax", "guests", "guest count", "cover"],
        ["paymentMethod"] = ["payment", "payment method", "tender", "pay type", "method"],
        ["tableLabel"] = ["table", "table #", "table no", "table label", "station"],
    };

    public async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
        await SchemaPatcher.EnsurePosSalesImportTablesAsync(db);
        ct.ThrowIfCancellationRequested();
    }

    public async Task<PosSalesHeaderMapDto?> GetHeaderMapAsync(int companyId, string? fingerprint, CancellationToken ct)
    {
        await EnsureSchemaAsync(ct);
        IQueryable<PosSalesHeaderMap> q = db.PosSalesHeaderMaps.AsNoTracking()
            .Where(m => m.CompanyId == companyId);
        if (!string.IsNullOrWhiteSpace(fingerprint))
            q = q.Where(m => m.HeaderFingerprint == fingerprint);
        var row = await q.OrderByDescending(m => m.UpdatedAt).FirstOrDefaultAsync(ct);
        return row is null ? null : ToDto(row);
    }

    public async Task<PosSalesHeaderMapDto> SaveHeaderMapAsync(
        int companyId,
        string fingerprint,
        IReadOnlyDictionary<string, string> mapping,
        string updatedBy,
        CancellationToken ct)
    {
        await EnsureSchemaAsync(ct);
        ValidateMapping(mapping);

        var existing = await db.PosSalesHeaderMaps
            .FirstOrDefaultAsync(m => m.CompanyId == companyId && m.HeaderFingerprint == fingerprint, ct);
        var json = JsonSerializer.Serialize(mapping);
        if (existing is null)
        {
            existing = new PosSalesHeaderMap
            {
                CompanyId = companyId,
                HeaderFingerprint = fingerprint,
                MappingJson = json,
                UpdatedAt = DateTime.UtcNow,
                UpdatedBy = updatedBy ?? string.Empty,
            };
            db.PosSalesHeaderMaps.Add(existing);
        }
        else
        {
            existing.MappingJson = json;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.UpdatedBy = updatedBy ?? string.Empty;
        }

        await db.SaveChangesAsync(ct);
        return ToDto(existing);
    }

    public async Task<PosSalesPreviewResult> PreviewAsync(
        Stream stream,
        string fileName,
        int companyId,
        CancellationToken ct)
    {
        await EnsureSchemaAsync(ct);
        var table = ParseFile(stream, fileName);
        if (table.Headers.Count == 0)
            throw new InvalidOperationException("No header row found. Upload a detailed sales CSV, Excel, or PDF with a header row.");

        var fingerprint = Fingerprint(table.Headers);
        var saved = await GetHeaderMapAsync(companyId, fingerprint, ct);
        var suggested = SuggestMapping(table.Headers);
        var mapping = saved?.Mapping ?? suggested;
        var requiresMapping = saved is null || !IsMappingComplete(mapping);

        return new PosSalesPreviewResult(
            FileName: fileName,
            FileKind: DetectKind(fileName),
            HeaderFingerprint: fingerprint,
            Headers: table.Headers,
            SampleRows: table.Rows.Take(8).ToList(),
            TotalDataRows: table.Rows.Count,
            SuggestedMapping: suggested,
            SavedMapping: saved?.Mapping,
            EffectiveMapping: mapping,
            RequiresMapping: requiresMapping,
            SystemFields: SystemFields.ToList());
    }

    public async Task<PosSalesImportResult> ImportAsync(
        Stream stream,
        string fileName,
        int companyId,
        string locationExternalId,
        DateOnly? businessDateOverride,
        IReadOnlyDictionary<string, string>? mappingOverride,
        string createdBy,
        CancellationToken ct)
    {
        await EnsureSchemaAsync(ct);
        if (companyId <= 0) throw new InvalidOperationException("companyId is required.");
        if (string.IsNullOrWhiteSpace(locationExternalId))
            throw new InvalidOperationException("locationExternalId is required.");

        var table = ParseFile(stream, fileName);
        if (table.Headers.Count == 0)
            throw new InvalidOperationException("No header row found in the upload.");

        var fingerprint = Fingerprint(table.Headers);
        Dictionary<string, string> mapping;
        if (mappingOverride is { Count: > 0 })
        {
            mapping = new Dictionary<string, string>(mappingOverride, StringComparer.OrdinalIgnoreCase);
            await SaveHeaderMapAsync(companyId, fingerprint, mapping, createdBy, ct);
        }
        else
        {
            var saved = await GetHeaderMapAsync(companyId, fingerprint, ct);
            mapping = saved?.Mapping
                ?? SuggestMapping(table.Headers);
            if (!IsMappingComplete(mapping))
                throw new InvalidOperationException(
                    "Map the file headers to POS fields before importing. This is required the first time a new header layout is uploaded.");
            if (saved is null)
                await SaveHeaderMapAsync(companyId, fingerprint, mapping, createdBy, ct);
        }

        ValidateMapping(mapping);

        var fieldToHeader = InvertMapping(mapping);
        var products = await db.Products.AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.Active)
            .Select(p => new { p.Id, p.ProductId, p.Name })
            .ToListAsync(ct);
        var pluMaps = await db.PosProductMappings.AsNoTracking()
            .Where(m => m.CompanyId == companyId && m.Active)
            .Select(m => new { m.PluNumber, m.ProductId, m.ProductCode, m.ProductName })
            .ToListAsync(ct);

        var productByCode = products
            .Where(p => !string.IsNullOrWhiteSpace(p.ProductId))
            .GroupBy(p => p.ProductId.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var productByName = products
            .Where(p => !string.IsNullOrWhiteSpace(p.Name))
            .GroupBy(p => NormalizeName(p.Name), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var pluByNumber = pluMaps
            .Where(m => !string.IsNullOrWhiteSpace(m.PluNumber))
            .GroupBy(m => m.PluNumber.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var defaultDate = businessDateOverride ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        var lines = new List<PosSalesImportLine>();
        var skipped = 0;
        var rowNum = 1;
        foreach (var row in table.Rows)
        {
            rowNum++;
            var cells = RowToDict(table.Headers, row);
            string Cell(string field) =>
                fieldToHeader.TryGetValue(field, out var header) && cells.TryGetValue(header, out var v)
                    ? v.Trim()
                    : string.Empty;

            var productName = Cell("productName");
            var productCode = Cell("productCode");
            var qty = ParseDecimal(Cell("quantity"));
            var unitPrice = ParseDecimal(Cell("unitPrice"));
            var lineTotal = ParseDecimal(Cell("lineTotal"));
            var discount = ParseDecimal(Cell("discount"));
            var tax = ParseDecimal(Cell("tax"));
            var covers = (int)Math.Round(ParseDecimal(Cell("covers")));
            var checkNumber = Cell("checkNumber");
            var paymentMethod = Cell("paymentMethod");
            var tableLabel = Cell("tableLabel");
            var saleDateRaw = Cell("saleDate");
            var saleAt = ParseDateTime(saleDateRaw);
            var businessDate = businessDateOverride
                ?? (saleAt is { } dt ? DateOnly.FromDateTime(dt) : defaultDate);

            if (string.IsNullOrWhiteSpace(productName)
                && string.IsNullOrWhiteSpace(productCode)
                && qty == 0
                && lineTotal == 0)
            {
                skipped++;
                continue;
            }

            if (string.IsNullOrWhiteSpace(productName) && string.IsNullOrWhiteSpace(productCode))
            {
                skipped++;
                continue;
            }

            if (lineTotal == 0 && qty != 0 && unitPrice != 0)
                lineTotal = Math.Round(qty * unitPrice, 4);
            if (unitPrice == 0 && qty != 0 && lineTotal != 0)
                unitPrice = Math.Round(lineTotal / qty, 4);
            if (qty == 0 && lineTotal != 0)
                qty = 1;

            int? resolvedProductId = null;
            if (!string.IsNullOrWhiteSpace(productCode)
                && pluByNumber.TryGetValue(productCode.Trim(), out var plu))
            {
                resolvedProductId = plu.ProductId;
                if (string.IsNullOrWhiteSpace(productName)) productName = plu.ProductName;
                if (string.IsNullOrWhiteSpace(productCode)) productCode = plu.ProductCode;
            }
            else if (!string.IsNullOrWhiteSpace(productCode)
                     && productByCode.TryGetValue(productCode.Trim(), out var byCode))
            {
                resolvedProductId = byCode.Id;
                if (string.IsNullOrWhiteSpace(productName)) productName = byCode.Name;
            }
            else if (!string.IsNullOrWhiteSpace(productName)
                     && productByName.TryGetValue(NormalizeName(productName), out var byName))
            {
                resolvedProductId = byName.Id;
                if (string.IsNullOrWhiteSpace(productCode)) productCode = byName.ProductId;
            }

            lines.Add(new PosSalesImportLine
            {
                CompanyId = companyId,
                LocationExternalId = locationExternalId.Trim(),
                BusinessDate = businessDate,
                SaleAt = saleAt,
                CheckNumber = checkNumber,
                ProductCode = productCode,
                ProductName = string.IsNullOrWhiteSpace(productName) ? productCode : productName,
                ResolvedProductId = resolvedProductId,
                Quantity = qty,
                UnitPrice = unitPrice,
                LineTotal = lineTotal,
                Discount = discount,
                Tax = tax,
                Covers = covers,
                PaymentMethod = paymentMethod,
                TableLabel = tableLabel,
                SourceRowNumber = rowNum,
                CreatedAt = DateTime.UtcNow,
            });
        }

        var batch = new PosSalesImportBatch
        {
            CompanyId = companyId,
            LocationExternalId = locationExternalId.Trim(),
            FileName = fileName,
            FileKind = DetectKind(fileName),
            BusinessDate = businessDateOverride
                ?? (lines.Count > 0
                    ? lines.GroupBy(l => l.BusinessDate).OrderByDescending(g => g.Count()).First().Key
                    : defaultDate),
            HeaderFingerprint = fingerprint,
            RowCount = table.Rows.Count,
            ImportedCount = lines.Count,
            SkippedCount = skipped,
            TotalQuantity = lines.Sum(l => l.Quantity),
            TotalGross = lines.Sum(l => l.LineTotal),
            Status = "imported",
            Message = lines.Count == 0
                ? "No usable sales lines after mapping."
                : $"Imported {lines.Count} line(s); skipped {skipped}.",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy ?? string.Empty,
        };
        db.PosSalesImportBatches.Add(batch);
        await db.SaveChangesAsync(ct);

        foreach (var line in lines)
            line.BatchId = batch.Id;
        if (lines.Count > 0)
            db.PosSalesImportLines.AddRange(lines);

        // Mirror into POS operational tables so Home / EOD / reports see the numbers.
        await MirrorToPosDbAsync(companyId, locationExternalId.Trim(), lines, batch.Id, ct);
        await db.SaveChangesAsync(ct);

        return new PosSalesImportResult(
            BatchId: batch.Id,
            BusinessDate: batch.BusinessDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ImportedCount: batch.ImportedCount,
            SkippedCount: batch.SkippedCount,
            TotalQuantity: batch.TotalQuantity,
            TotalGross: batch.TotalGross,
            Message: batch.Message,
            RequiresMapping: false);
    }

    public async Task<PosSalesListResult> ListAsync(
        int companyId,
        IReadOnlyList<string> locationIds,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct)
    {
        await EnsureSchemaAsync(ct);
        if (companyId <= 0 || locationIds.Count == 0)
            return new PosSalesListResult([], [], new PosSalesListSummary(0, 0, 0, 0));

        var locSet = locationIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var lineQ = db.PosSalesImportLines.AsNoTracking()
            .Where(l => l.CompanyId == companyId && locSet.Contains(l.LocationExternalId));
        if (from is { } f) lineQ = lineQ.Where(l => l.BusinessDate >= f);
        if (to is { } t) lineQ = lineQ.Where(l => l.BusinessDate <= t);

        var lines = await lineQ
            .OrderByDescending(l => l.BusinessDate)
            .ThenBy(l => l.CheckNumber)
            .ThenBy(l => l.Id)
            .Take(5000)
            .ToListAsync(ct);

        var batchIds = lines.Select(l => l.BatchId).Distinct().ToList();
        var batches = await db.PosSalesImportBatches.AsNoTracking()
            .Where(b => b.CompanyId == companyId && batchIds.Contains(b.Id))
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

        var summary = new PosSalesListSummary(
            LineCount: lines.Count,
            BatchCount: batches.Count,
            TotalQuantity: lines.Sum(l => l.Quantity),
            TotalGross: lines.Sum(l => l.LineTotal));

        return new PosSalesListResult(
            Batches: batches.Select(b => new PosSalesBatchDto(
                b.Id, b.FileName, b.FileKind,
                b.BusinessDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                b.LocationExternalId, b.ImportedCount, b.SkippedCount,
                b.TotalQuantity, b.TotalGross, b.Status, b.Message,
                b.CreatedAt.ToString("o"), b.CreatedBy)).ToList(),
            Lines: lines.Select(l => new PosSalesLineDto(
                l.Id, l.BatchId,
                l.BusinessDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                l.SaleAt?.ToString("o"),
                l.CheckNumber, l.ProductCode, l.ProductName, l.ResolvedProductId,
                l.Quantity, l.UnitPrice, l.LineTotal, l.Discount, l.Tax,
                l.Covers, l.PaymentMethod, l.TableLabel,
                l.LocationExternalId)).ToList(),
            Summary: summary);
    }

    async Task MirrorToPosDbAsync(
        int companyId,
        string locationExternalId,
        List<PosSalesImportLine> lines,
        int batchId,
        CancellationToken ct)
    {
        if (lines.Count == 0) return;

        foreach (var byCheck in lines.GroupBy(l =>
                     string.IsNullOrWhiteSpace(l.CheckNumber)
                         ? $"row-{l.SourceRowNumber}"
                         : l.CheckNumber.Trim(),
                     StringComparer.OrdinalIgnoreCase))
        {
            var checkKey = byCheck.Key;
            var externalId = $"pos-sales-import-{batchId}-{SanitizeId(checkKey)}";
            var existing = await db.PosClosedChecks
                .FirstOrDefaultAsync(c => c.ExternalId == externalId, ct);
            var grossCents = (long)Math.Round(byCheck.Sum(l => l.LineTotal) * 100m, 0, MidpointRounding.AwayFromZero);
            var discountCents = (long)Math.Round(byCheck.Sum(l => l.Discount) * 100m, 0, MidpointRounding.AwayFromZero);
            var taxCents = (long)Math.Round(byCheck.Sum(l => l.Tax) * 100m, 0, MidpointRounding.AwayFromZero);
            var covers = byCheck.Max(l => l.Covers);
            var paidAt = byCheck.Select(l => l.SaleAt).Where(d => d.HasValue).Select(d => d!.Value)
                .DefaultIfEmpty(byCheck.First().BusinessDate.ToDateTime(TimeOnly.Parse("12:00"), DateTimeKind.Utc))
                .Max();
            if (paidAt.Kind == DateTimeKind.Unspecified)
                paidAt = DateTime.SpecifyKind(paidAt, DateTimeKind.Utc);

            int.TryParse(Regex.Replace(checkKey, @"\D", ""), out var checkNumber);

            if (existing is null)
            {
                db.PosClosedChecks.Add(new PosClosedCheck
                {
                    CompanyId = companyId,
                    LocationExternalId = locationExternalId,
                    ExternalId = externalId,
                    CheckNumber = checkNumber,
                    CheckLabel = checkKey.Length > 32 ? checkKey[..32] : checkKey,
                    Covers = covers,
                    DiscountCents = discountCents,
                    TaxCents = taxCents,
                    VoidCents = 0,
                    GrossCents = grossCents,
                    PaidAt = new DateTimeOffset(paidAt),
                });
            }
            else
            {
                existing.GrossCents = grossCents;
                existing.DiscountCents = discountCents;
                existing.TaxCents = taxCents;
                existing.Covers = covers;
                existing.PaidAt = new DateTimeOffset(paidAt);
            }
        }

        foreach (var line in lines.Where(l => l.ResolvedProductId is > 0 || !string.IsNullOrWhiteSpace(l.ProductName)))
        {
            db.PosSaleDetails.Add(new PosSaleDetail
            {
                ProductId = line.ResolvedProductId ?? 0,
                ProductCode = line.ProductCode,
                ProductName = line.ProductName,
                CompanyId = companyId,
                LocationExternalId = locationExternalId,
                SalesChannel = "pos",
                VariableMode = string.Empty,
                QuantitySold = line.Quantity,
                SelectionsJson = "[]",
                ComponentUsagesJson = "[]",
                CreatedAt = line.SaleAt ?? line.BusinessDate.ToDateTime(TimeOnly.Parse("12:00"), DateTimeKind.Utc),
            });
        }
    }

    static void ValidateMapping(IReadOnlyDictionary<string, string> mapping)
    {
        var targets = mapping.Values
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v.Trim())
            .ToList();
        var known = SystemFields.Select(f => f.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var t in targets)
        {
            if (!known.Contains(t))
                throw new InvalidOperationException($"Unknown POS field '{t}' in header mapping.");
        }

        if (!IsMappingComplete(mapping))
            throw new InvalidOperationException(
                "Mapping must include saleDate (or rely on the upload business date), productName or productCode, and quantity or lineTotal.");
    }

    static bool IsMappingComplete(IReadOnlyDictionary<string, string> mapping)
    {
        var targets = mapping.Values
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => v.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hasProduct = targets.Contains("productName") || targets.Contains("productCode");
        var hasAmount = targets.Contains("quantity") || targets.Contains("lineTotal");
        // saleDate can be supplied via the business-date picker on import.
        return hasProduct && hasAmount;
    }

    static Dictionary<string, string> InvertMapping(IReadOnlyDictionary<string, string> mapping)
    {
        var inv = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (header, field) in mapping)
        {
            if (string.IsNullOrWhiteSpace(field)) continue;
            inv[field.Trim()] = header;
        }
        return inv;
    }

    public static Dictionary<string, string> SuggestMapping(IReadOnlyList<string> headers)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var usedFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var header in headers)
        {
            var normalized = NormalizeHeaderLabel(header);
            string? matched = null;
            foreach (var (field, aliases) in HeaderAliases)
            {
                if (usedFields.Contains(field)) continue;
                if (aliases.Any(a => normalized == NormalizeHeaderLabel(a) || normalized.Contains(NormalizeHeaderLabel(a))))
                {
                    matched = field;
                    break;
                }
            }
            if (matched is not null)
            {
                result[header] = matched;
                usedFields.Add(matched);
            }
            else
            {
                result[header] = string.Empty;
            }
        }
        return result;
    }

    public static string Fingerprint(IEnumerable<string> headers)
    {
        var joined = string.Join('\n', headers.Select(h => h.Trim().ToLowerInvariant()).OrderBy(h => h, StringComparer.Ordinal));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(joined));
        return Convert.ToHexString(hash)[..24].ToLowerInvariant();
    }

    static ParsedTable ParseFile(Stream stream, string fileName)
    {
        var kind = DetectKind(fileName);
        return kind switch
        {
            "xlsx" => ParseExcel(stream),
            "csv" => ParseCsv(stream),
            "pdf" => ParsePdf(stream),
            _ => throw new InvalidOperationException(
                "Unsupported file type. Upload CSV, Excel (.xlsx), or PDF detailed sales."),
        };
    }

    static string DetectKind(string fileName)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        return ext switch
        {
            ".xlsx" or ".xlsm" => "xlsx",
            ".xls" => throw new InvalidOperationException("Legacy .xls is not supported. Save as .xlsx or CSV."),
            ".csv" or ".txt" => "csv",
            ".pdf" => "pdf",
            _ => ext.TrimStart('.'),
        };
    }

    static ParsedTable ParseExcel(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        ms.Position = 0;
        using var wb = new XLWorkbook(ms);
        var ws = wb.Worksheets.First();
        var used = ws.RangeUsed();
        if (used is null) return new ParsedTable([], []);

        var headers = new List<string>();
        for (var c = 1; c <= used.ColumnCount(); c++)
        {
            var h = ws.Cell(1, c).GetFormattedString().Trim();
            if (string.IsNullOrWhiteSpace(h)) h = $"Column{c}";
            headers.Add(h);
        }

        var rows = new List<IReadOnlyList<string>>();
        for (var r = 2; r <= used.RowCount(); r++)
        {
            var cells = new string[headers.Count];
            var any = false;
            for (var c = 1; c <= headers.Count; c++)
            {
                var text = ws.Cell(r, c).GetFormattedString().Trim();
                cells[c - 1] = text;
                if (!string.IsNullOrWhiteSpace(text)) any = true;
            }
            if (any) rows.Add(cells);
        }
        return new ParsedTable(headers, rows);
    }

    static ParsedTable ParseCsv(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var text = reader.ReadToEnd();
        var lines = SplitCsvLines(text);
        if (lines.Count == 0) return new ParsedTable([], []);
        var headers = SplitCsvRow(lines[0]);
        if (headers.Count == 0) return new ParsedTable([], []);
        var rows = new List<IReadOnlyList<string>>();
        for (var i = 1; i < lines.Count; i++)
        {
            var cells = SplitCsvRow(lines[i]);
            if (cells.All(string.IsNullOrWhiteSpace)) continue;
            while (cells.Count < headers.Count) cells.Add(string.Empty);
            if (cells.Count > headers.Count) cells = cells.Take(headers.Count).ToList();
            rows.Add(cells);
        }
        return new ParsedTable(headers, rows);
    }

    static ParsedTable ParsePdf(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        ms.Position = 0;
        using var doc = PdfDocument.Open(ms);
        var lines = new List<string>();
        foreach (var page in doc.GetPages())
        {
            var pageText = page.Text ?? string.Empty;
            foreach (var line in pageText.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!string.IsNullOrWhiteSpace(line))
                    lines.Add(line);
            }
        }

        if (lines.Count == 0)
            throw new InvalidOperationException("Could not extract text from the PDF. Export the POS report as CSV or Excel instead.");

        // Prefer a delimiter-looking header line.
        var headerIdx = lines.FindIndex(l =>
            (l.Contains(',') || l.Contains('\t') || Regex.IsMatch(l, @"\s{2,}"))
            && Regex.IsMatch(l, @"date|product|item|qty|quantity|total|amount|plu|check", RegexOptions.IgnoreCase));
        if (headerIdx < 0) headerIdx = 0;

        string[] SplitPdf(string line)
        {
            if (line.Contains('\t')) return line.Split('\t', StringSplitOptions.None).Select(s => s.Trim()).ToArray();
            if (line.Contains(',')) return SplitCsvRow(line).ToArray();
            return Regex.Split(line.Trim(), @"\s{2,}").Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();
        }

        var headers = SplitPdf(lines[headerIdx]).ToList();
        if (headers.Count < 2)
            throw new InvalidOperationException(
                "PDF columns could not be detected. Export the detailed sales report as CSV or Excel for a reliable import.");

        var rows = new List<IReadOnlyList<string>>();
        for (var i = headerIdx + 1; i < lines.Count; i++)
        {
            var cells = SplitPdf(lines[i]).ToList();
            if (cells.Count == 0 || cells.All(string.IsNullOrWhiteSpace)) continue;
            while (cells.Count < headers.Count) cells.Add(string.Empty);
            if (cells.Count > headers.Count) cells = cells.Take(headers.Count).ToList();
            rows.Add(cells);
        }
        return new ParsedTable(headers, rows);
    }

    static List<string> SplitCsvLines(string text)
    {
        var result = new List<string>();
        using var sr = new StringReader(text);
        string? line;
        var sb = new StringBuilder();
        while ((line = sr.ReadLine()) is not null)
        {
            if (sb.Length > 0) sb.Append('\n');
            sb.Append(line);
            if (CountQuotes(sb.ToString()) % 2 == 0)
            {
                result.Add(sb.ToString());
                sb.Clear();
            }
        }
        if (sb.Length > 0) result.Add(sb.ToString());
        return result.Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
    }

    static int CountQuotes(string s)
    {
        var n = 0;
        foreach (var ch in s) if (ch == '"') n++;
        return n;
    }

    static List<string> SplitCsvRow(string line)
    {
        var cells = new List<string>();
        var sb = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        sb.Append('"');
                        i++;
                    }
                    else inQuotes = false;
                }
                else sb.Append(ch);
            }
            else
            {
                if (ch == '"') inQuotes = true;
                else if (ch == ',')
                {
                    cells.Add(sb.ToString());
                    sb.Clear();
                }
                else sb.Append(ch);
            }
        }
        cells.Add(sb.ToString());
        return cells;
    }

    static Dictionary<string, string> RowToDict(IReadOnlyList<string> headers, IReadOnlyList<string> row)
    {
        var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Count; i++)
            d[headers[i]] = i < row.Count ? row[i] ?? string.Empty : string.Empty;
        return d;
    }

    static decimal ParseDecimal(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0;
        var cleaned = raw.Trim().Replace(",", "").Replace(" ", "");
        if (cleaned.StartsWith('(') && cleaned.EndsWith(')'))
            cleaned = "-" + cleaned.Trim('(', ')');
        return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var v)
            || decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.CurrentCulture, out v)
            ? v
            : 0;
    }

    static DateTime? ParseDateTime(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt)
            || DateTime.TryParse(raw, CultureInfo.CurrentCulture, DateTimeStyles.AssumeLocal, out dt))
        {
            if (dt.Kind == DateTimeKind.Unspecified)
                dt = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
            return dt.ToUniversalTime();
        }
        if (DateOnly.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            || DateOnly.TryParse(raw, CultureInfo.CurrentCulture, DateTimeStyles.None, out d))
            return d.ToDateTime(TimeOnly.Parse("12:00"), DateTimeKind.Utc);
        return null;
    }

    static string NormalizeHeaderLabel(string value) =>
        Regex.Replace((value ?? string.Empty).Trim().ToLowerInvariant(), @"[^a-z0-9]+", " ").Trim();

    static string NormalizeName(string value) =>
        Regex.Replace((value ?? string.Empty).Trim().ToLowerInvariant(), @"\s+", " ");

    static string SanitizeId(string value)
    {
        var s = Regex.Replace(value ?? string.Empty, @"[^a-zA-Z0-9_-]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(s) ? "x" : (s.Length > 48 ? s[..48] : s);
    }

    static PosSalesHeaderMapDto ToDto(PosSalesHeaderMap row)
    {
        Dictionary<string, string> mapping;
        try
        {
            mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(row.MappingJson)
                      ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            mapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
        return new PosSalesHeaderMapDto(
            row.CompanyId,
            row.HeaderFingerprint,
            mapping,
            row.UpdatedAt.ToString("o"),
            row.UpdatedBy);
    }

    sealed record ParsedTable(IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows);
}

public sealed record PosSalesSystemField(string Key, string Label, bool RequiredHint, string Description);

public sealed record PosSalesHeaderMapDto(
    int CompanyId,
    string HeaderFingerprint,
    Dictionary<string, string> Mapping,
    string UpdatedAt,
    string UpdatedBy);

public sealed record PosSalesPreviewResult(
    string FileName,
    string FileKind,
    string HeaderFingerprint,
    IReadOnlyList<string> Headers,
    IReadOnlyList<IReadOnlyList<string>> SampleRows,
    int TotalDataRows,
    Dictionary<string, string> SuggestedMapping,
    Dictionary<string, string>? SavedMapping,
    Dictionary<string, string> EffectiveMapping,
    bool RequiresMapping,
    IReadOnlyList<PosSalesSystemField> SystemFields);

public sealed record PosSalesImportResult(
    int BatchId,
    string BusinessDate,
    int ImportedCount,
    int SkippedCount,
    decimal TotalQuantity,
    decimal TotalGross,
    string Message,
    bool RequiresMapping);

public sealed record PosSalesBatchDto(
    int Id, string FileName, string FileKind, string BusinessDate, string LocationExternalId,
    int ImportedCount, int SkippedCount, decimal TotalQuantity, decimal TotalGross,
    string Status, string Message, string CreatedAt, string CreatedBy);

public sealed record PosSalesLineDto(
    int Id, int BatchId, string BusinessDate, string? SaleAt, string CheckNumber,
    string ProductCode, string ProductName, int? ResolvedProductId,
    decimal Quantity, decimal UnitPrice, decimal LineTotal, decimal Discount, decimal Tax,
    int Covers, string PaymentMethod, string TableLabel, string LocationExternalId);

public sealed record PosSalesListSummary(int LineCount, int BatchCount, decimal TotalQuantity, decimal TotalGross);

public sealed record PosSalesListResult(
    IReadOnlyList<PosSalesBatchDto> Batches,
    IReadOnlyList<PosSalesLineDto> Lines,
    PosSalesListSummary Summary);
