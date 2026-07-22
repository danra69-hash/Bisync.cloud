using System.Globalization;
using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Imports Sales Module pipeline rows from Excel/CSV.
/// Default filter: only rows whose first column (Date Created) is 1 January 2026.
/// </summary>
public class SalesModuleImportService(
    BisyncDbContext db,
    SalesModuleCalendarSyncService calendarSync,
    ILogger<SalesModuleImportService> logger)
{
    public static readonly DateOnly DefaultImportDate = new(2026, 1, 1);

    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public sealed record ImportRow(
        DateTime CreatedAt,
        string Company,
        string Brand,
        int LocationCount,
        DateTime? LastContact,
        string DiscussionDetail,
        string Status,
        DateTime? LastChangedAt,
        string Hunter,
        string Farmer);

    public sealed record ImportResult(
        int Imported,
        int Skipped,
        int CompaniesCreated,
        IReadOnlyList<string> Messages,
        IReadOnlyList<object> Customers);

    public async Task<ImportResult> ImportAsync(
        Stream fileStream,
        string fileName,
        int salesTeamMemberId,
        DateOnly? onlyDate,
        string? companyNameFilter,
        CancellationToken ct = default)
    {
        await calendarSync.EnsureTeamSchemaAsync(ct);
        await EnsureCustomerColumnsAsync(ct);

        var member = await db.SalesModuleTeamMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == salesTeamMemberId && m.Active, ct);
        if (member is null)
            throw new InvalidOperationException("Select an active Sales Team member before importing.");

        var filterDate = onlyDate ?? DefaultImportDate;
        var rows = ParseFile(fileStream, fileName);
        var matched = rows
            .Where(r => DateOnly.FromDateTime(r.CreatedAt) == filterDate)
            .Where(r => string.IsNullOrWhiteSpace(companyNameFilter)
                        || r.Company.Equals(companyNameFilter.Trim(), StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (matched.Count == 0)
        {
            return new ImportResult(
                0,
                rows.Count,
                0,
                [
                    $"No rows matched date filter {filterDate:d MMMM yyyy}" +
                    (string.IsNullOrWhiteSpace(companyNameFilter) ? "." : $" and company \"{companyNameFilter}\"."),
                    $"Parsed {rows.Count} data row(s) from file.",
                ],
                []);
        }

        var team = await calendarSync.ListTeamAsync(ct);
        var createdCompanies = 0;
        var imported = 0;
        var messages = new List<string>();
        var customers = new List<object>();

        foreach (var row in matched)
        {
            var company = await FindOrCreateCompanyAsync(row.Company, member.Id, ct);
            if (company.Created)
                createdCompanies++;

            var hunter = ResolveMember(team, row.Hunter);
            var farmer = ResolveMember(team, row.Farmer);

            var existing = await db.SalesModuleCustomers
                .FirstOrDefaultAsync(c =>
                    c.CompanyId == company.Id
                    && c.CompanyName.ToLower() == row.Company.Trim().ToLower()
                    && c.Active, ct);

            SalesModuleCustomer customer;
            if (existing is null)
            {
                customer = new SalesModuleCustomer
                {
                    CompanyId = company.Id,
                    ExternalId = await NextExternalIdAsync(company.Id, ct),
                    CompanyName = row.Company.Trim(),
                    BrandsJson = SerializeBrand(row.Brand, row.LocationCount),
                    ContactsJson = "[]",
                    Status = string.IsNullOrWhiteSpace(row.Status) ? "Prospect" : row.Status.Trim(),
                    CreatedAt = DateTime.SpecifyKind(row.CreatedAt, DateTimeKind.Utc),
                    LastContactDate = row.LastContact.HasValue
                        ? DateTime.SpecifyKind(row.LastContact.Value, DateTimeKind.Utc)
                        : null,
                    LastDiscussionBrief = (row.DiscussionDetail ?? string.Empty).Trim(),
                    LocationCount = Math.Max(0, row.LocationCount),
                    LastChangedAt = DateTime.SpecifyKind(row.LastChangedAt ?? row.CreatedAt, DateTimeKind.Utc),
                    HunterMemberId = hunter?.Id,
                    HunterName = hunter?.Name ?? row.Hunter.Trim(),
                    FarmerMemberId = farmer?.Id,
                    FarmerName = farmer?.Name ?? row.Farmer.Trim(),
                    EngagedUserId = 0,
                    EngagedUserEmail = member.Email,
                    EngagedUserName = member.Name,
                    Active = true,
                };
                db.SalesModuleCustomers.Add(customer);
            }
            else
            {
                customer = existing;
                customer.BrandsJson = SerializeBrand(row.Brand, row.LocationCount);
                customer.Status = string.IsNullOrWhiteSpace(row.Status) ? customer.Status : row.Status.Trim();
                customer.LastContactDate = row.LastContact.HasValue
                    ? DateTime.SpecifyKind(row.LastContact.Value, DateTimeKind.Utc)
                    : customer.LastContactDate;
                if (!string.IsNullOrWhiteSpace(row.DiscussionDetail))
                    customer.LastDiscussionBrief = row.DiscussionDetail.Trim();
                customer.LocationCount = Math.Max(0, row.LocationCount);
                customer.LastChangedAt = DateTime.SpecifyKind(row.LastChangedAt ?? DateTime.UtcNow, DateTimeKind.Utc);
                customer.HunterMemberId = hunter?.Id ?? customer.HunterMemberId;
                customer.HunterName = hunter?.Name ?? (string.IsNullOrWhiteSpace(row.Hunter) ? customer.HunterName : row.Hunter.Trim());
                customer.FarmerMemberId = farmer?.Id ?? customer.FarmerMemberId;
                customer.FarmerName = farmer?.Name ?? (string.IsNullOrWhiteSpace(row.Farmer) ? customer.FarmerName : row.Farmer.Trim());
            }

            await db.SaveChangesAsync(ct);
            imported++;
            customers.Add(MapCustomer(customer));
        }

        messages.Add($"Imported {imported} row(s) for {filterDate:d MMMM yyyy}" +
                     (string.IsNullOrWhiteSpace(companyNameFilter) ? "." : $" · company filter \"{companyNameFilter}\"."));
        if (createdCompanies > 0)
            messages.Add($"Created {createdCompanies} Sales Module company(ies) tagged to {member.Name}.");
        var skipped = rows.Count - matched.Count;
        if (skipped > 0)
            messages.Add($"Skipped {skipped} row(s) outside the date/company filter.");

        logger.LogInformation(
            "Sales Module import: {Imported} imported, {Skipped} skipped, member {MemberId}",
            imported, skipped, salesTeamMemberId);

        return new ImportResult(imported, skipped, createdCompanies, messages, customers);
    }

    /// <summary>Creates the Atta pipeline row dated 1 January 2026 for the selected sales person.</summary>
    public async Task<ImportResult> ImportAttaSeedAsync(int salesTeamMemberId, CancellationToken ct = default)
    {
        await using var ms = new MemoryStream();
        using (var wb = new XLWorkbook())
        {
            var ws = wb.AddWorksheet("Sales");
            ws.Cell(1, 1).Value = "Date Created";
            ws.Cell(1, 2).Value = "Company";
            ws.Cell(1, 3).Value = "Brand";
            ws.Cell(1, 4).Value = "No. of Location";
            ws.Cell(1, 5).Value = "Last Contact";
            ws.Cell(1, 6).Value = "Discussion Detail";
            ws.Cell(1, 7).Value = "Status";
            ws.Cell(1, 8).Value = "Last Changes Date";
            ws.Cell(1, 9).Value = "Hunter";
            ws.Cell(1, 10).Value = "Farmer";

            ws.Cell(2, 1).Value = new DateTime(2026, 1, 1);
            ws.Cell(2, 2).Value = "Atta";
            ws.Cell(2, 3).Value = "";
            ws.Cell(2, 4).Value = 0;
            ws.Cell(2, 5).Value = "";
            ws.Cell(2, 6).Value = "";
            ws.Cell(2, 7).Value = "Prospect";
            ws.Cell(2, 8).Value = new DateTime(2026, 1, 1);
            ws.Cell(2, 9).Value = "";
            ws.Cell(2, 10).Value = "";
            wb.SaveAs(ms);
        }

        ms.Position = 0;
        return await ImportAsync(ms, "atta-seed.xlsx", salesTeamMemberId, DefaultImportDate, "Atta", ct);
    }

    public static List<ImportRow> ParseFile(Stream stream, string fileName)
    {
        var ext = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        if (ext is ".csv" or ".txt")
            return ParseCsv(stream);
        return ParseExcel(stream);
    }

    static List<ImportRow> ParseExcel(Stream stream)
    {
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheets.First();
        var rows = new List<ImportRow>();
        var used = ws.RangeUsed();
        if (used is null) return rows;

        var firstDataRow = 1;
        var header = used.FirstRow();
        if (LooksLikeHeader(header.Cell(1).GetString()))
            firstDataRow = 2;

        for (var r = firstDataRow; r <= used.RowCount(); r++)
        {
            var row = ws.Row(r);
            if (row.IsEmpty()) continue;
            var created = ParseDateCell(row.Cell(1));
            if (created is null) continue;
            var company = row.Cell(2).GetString().Trim();
            if (string.IsNullOrWhiteSpace(company)) continue;

            rows.Add(new ImportRow(
                created.Value,
                company,
                row.Cell(3).GetString().Trim(),
                ParseIntCell(row.Cell(4)),
                ParseDateCell(row.Cell(5)),
                row.Cell(6).GetString().Trim(),
                row.Cell(7).GetString().Trim(),
                ParseDateCell(row.Cell(8)),
                row.Cell(9).GetString().Trim(),
                row.Cell(10).GetString().Trim()));
        }

        return rows;
    }

    static List<ImportRow> ParseCsv(Stream stream)
    {
        using var reader = new StreamReader(stream);
        var rows = new List<ImportRow>();
        string? line;
        var isFirst = true;
        while ((line = reader.ReadLine()) is not null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = SplitCsv(line);
            if (cols.Count == 0) continue;
            if (isFirst)
            {
                isFirst = false;
                if (LooksLikeHeader(cols[0])) continue;
            }

            var created = ParseDateString(cols.ElementAtOrDefault(0));
            if (created is null) continue;
            var company = (cols.ElementAtOrDefault(1) ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(company)) continue;

            rows.Add(new ImportRow(
                created.Value,
                company,
                (cols.ElementAtOrDefault(2) ?? string.Empty).Trim(),
                int.TryParse(cols.ElementAtOrDefault(3), out var loc) ? loc : 0,
                ParseDateString(cols.ElementAtOrDefault(4)),
                (cols.ElementAtOrDefault(5) ?? string.Empty).Trim(),
                (cols.ElementAtOrDefault(6) ?? string.Empty).Trim(),
                ParseDateString(cols.ElementAtOrDefault(7)),
                (cols.ElementAtOrDefault(8) ?? string.Empty).Trim(),
                (cols.ElementAtOrDefault(9) ?? string.Empty).Trim()));
        }

        return rows;
    }

    static bool LooksLikeHeader(string value) =>
        value.Contains("date", StringComparison.OrdinalIgnoreCase)
        || value.Contains("created", StringComparison.OrdinalIgnoreCase);

    static DateTime? ParseDateCell(IXLCell cell)
    {
        if (cell.TryGetValue(out DateTime dt)) return dt.Date;
        return ParseDateString(cell.GetString());
    }

    static int ParseIntCell(IXLCell cell)
    {
        if (cell.TryGetValue(out double d)) return (int)Math.Round(d);
        return int.TryParse(cell.GetString(), out var n) ? n : 0;
    }

    static DateTime? ParseDateString(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = raw.Trim();
        string[] formats =
        [
            "d MMMM yyyy", "dd MMMM yyyy", "d MMM yyyy", "dd MMM yyyy",
            "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy", "M/d/yyyy",
            "dd-MM-yyyy", "d-M-yyyy",
        ];
        if (DateTime.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var exact))
            return DateTime.SpecifyKind(exact.Date, DateTimeKind.Utc);
        if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("en-GB"), DateTimeStyles.AssumeUniversal, out var gb))
            return DateTime.SpecifyKind(gb.Date, DateTimeKind.Utc);
        if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var inv))
            return DateTime.SpecifyKind(inv.Date, DateTimeKind.Utc);
        return null;
    }

    static List<string> SplitCsv(string line)
    {
        var result = new List<string>();
        var cur = new System.Text.StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }
            if (ch == ',' && !inQuotes)
            {
                result.Add(cur.ToString());
                cur.Clear();
                continue;
            }
            cur.Append(ch);
        }
        result.Add(cur.ToString());
        return result;
    }

    static string SerializeBrand(string brand, int _locationCount)
    {
        var name = (brand ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name)) return "[]";
        return JsonSerializer.Serialize(new[] { new { name, count = 1 } }, JsonOpts);
    }

    static SalesModuleTeamMember? ResolveMember(List<SalesModuleTeamMember> team, string name)
    {
        var key = (name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(key)) return null;
        return team.FirstOrDefault(m =>
            m.Name.Equals(key, StringComparison.OrdinalIgnoreCase)
            || m.Email.Equals(key, StringComparison.OrdinalIgnoreCase)
            || m.Email.StartsWith(key + "@", StringComparison.OrdinalIgnoreCase));
    }

    async Task<(int Id, bool Created)> FindOrCreateCompanyAsync(string name, int memberId, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "SalesModuleCompanies" (
                "Id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL CONSTRAINT "PK_SalesModuleCompanies" PRIMARY KEY,
                "Name" TEXT NOT NULL DEFAULT '',
                "Active" boolean NOT NULL DEFAULT true,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "CreatedByEmail" TEXT NOT NULL DEFAULT ''
            );
            """, ct);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "SalesModuleCompanyMembers" (
                "Id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL CONSTRAINT "PK_SalesModuleCompanyMembers" PRIMARY KEY,
                "SalesModuleCompanyId" integer NOT NULL,
                "SalesTeamMemberId" integer NOT NULL
            );
            """, ct);

        var trimmed = name.Trim();
        var existing = await db.SalesModuleCompanies
            .FirstOrDefaultAsync(c => c.Name.ToLower() == trimmed.ToLower(), ct);
        if (existing is null)
        {
            existing = new SalesModuleCompany
            {
                Name = trimmed,
                Active = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            db.SalesModuleCompanies.Add(existing);
            await db.SaveChangesAsync(ct);
            db.SalesModuleCompanyMembers.Add(new SalesModuleCompanyMember
            {
                SalesModuleCompanyId = existing.Id,
                SalesTeamMemberId = memberId,
            });
            await db.SaveChangesAsync(ct);
            return (existing.Id, true);
        }

        var tagged = await db.SalesModuleCompanyMembers.AnyAsync(
            t => t.SalesModuleCompanyId == existing.Id && t.SalesTeamMemberId == memberId, ct);
        if (!tagged)
        {
            db.SalesModuleCompanyMembers.Add(new SalesModuleCompanyMember
            {
                SalesModuleCompanyId = existing.Id,
                SalesTeamMemberId = memberId,
            });
            await db.SaveChangesAsync(ct);
        }

        return (existing.Id, false);
    }

    async Task<string> NextExternalIdAsync(int companyId, CancellationToken ct)
    {
        var existing = await db.SalesModuleCustomers.AsNoTracking()
            .Where(c => c.CompanyId == companyId)
            .Select(c => c.ExternalId)
            .ToListAsync(ct);
        var max = 0;
        foreach (var id in existing)
        {
            var digits = new string(id.Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var n) && n > max) max = n;
        }
        return $"SMC-{max + 1:D4}";
    }

    async Task EnsureCustomerColumnsAsync(CancellationToken ct)
    {
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleCustomers", "LocationCount", "INTEGER NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleCustomers", "LastChangedAt", "timestamp with time zone NULL");
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleCustomers", "HunterMemberId", "INTEGER NULL");
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleCustomers", "HunterName", "TEXT NOT NULL DEFAULT ''");
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleCustomers", "FarmerMemberId", "INTEGER NULL");
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleCustomers", "FarmerName", "TEXT NOT NULL DEFAULT ''");
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE "SalesModuleCustomers"
            SET "LastChangedAt" = COALESCE("LastChangedAt", "CreatedAt", NOW())
            WHERE "LastChangedAt" IS NULL;
            """);
    }

    static object MapCustomer(SalesModuleCustomer c) => new
    {
        c.Id,
        c.CompanyId,
        c.ExternalId,
        c.CompanyName,
        brands = ParseJson(c.BrandsJson),
        contacts = ParseJson(c.ContactsJson),
        c.Status,
        createdAt = c.CreatedAt,
        lastContactDate = c.LastContactDate,
        c.LastDiscussionBrief,
        locationCount = c.LocationCount,
        lastChangedAt = c.LastChangedAt,
        hunterMemberId = c.HunterMemberId,
        hunterName = c.HunterName,
        farmerMemberId = c.FarmerMemberId,
        farmerName = c.FarmerName,
        c.EngagedUserId,
        c.EngagedUserEmail,
        c.EngagedUserName,
        c.Active,
    };

    static object ParseJson(string json)
    {
        try { return JsonSerializer.Deserialize<object>(json) ?? Array.Empty<object>(); }
        catch { return Array.Empty<object>(); }
    }
}
