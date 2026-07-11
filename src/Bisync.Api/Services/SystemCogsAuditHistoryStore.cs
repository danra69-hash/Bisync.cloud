using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Persists live (DB) COGS audits under:
/// Company / Location / Month / Year [/ Revised yyyy-MM-dd_HHmmss]
/// </summary>
public class SystemCogsAuditHistoryStore
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    readonly string _rootDir;
    readonly string _indexPath;
    readonly object _gate = new();

    public SystemCogsAuditHistoryStore(IHostEnvironment environment, IConfiguration configuration)
    {
        _rootDir = ResolveRoot(environment, configuration);
        _indexPath = Path.Combine(_rootDir, "system-history-index.json");
        Directory.CreateDirectory(_rootDir);
    }

    public string HistoryDirectory => _rootDir;

    public SystemCogsAuditHistoryEntry Save(
        SystemCogsAuditHistoryEntry entry,
        CogsAuditSummaryResult summary,
        bool isRevised,
        DateTime? revisedAtUtc = null)
    {
        var companySeg = Sanitize(entry.CompanyName);
        var locationSeg = Sanitize(entry.LocationName);
        var monthSeg = entry.MonthName;
        var yearSeg = entry.Year.ToString(CultureInfo.InvariantCulture);

        var periodDir = Path.Combine(_rootDir, companySeg, locationSeg, monthSeg, yearSeg);
        Directory.CreateDirectory(periodDir);

        string runDir;
        if (isRevised)
        {
            var stamp = (revisedAtUtc ?? DateTime.UtcNow).ToString("yyyy-MM-dd_HHmmss", CultureInfo.InvariantCulture);
            runDir = Path.Combine(periodDir, $"Revised_{stamp}");
            Directory.CreateDirectory(runDir);
            entry.IsRevised = true;
            entry.RevisedAtUtc = revisedAtUtc ?? DateTime.UtcNow;
            entry.RelativePath = Path.Combine(companySeg, locationSeg, monthSeg, yearSeg, $"Revised_{stamp}");
        }
        else
        {
            runDir = periodDir;
            entry.IsRevised = false;
            entry.RevisedAtUtc = null;
            entry.RelativePath = Path.Combine(companySeg, locationSeg, monthSeg, yearSeg);
        }

        entry.RunId ??= Guid.NewGuid().ToString("N");
        var payload = new SystemCogsAuditHistoryFile
        {
            Entry = entry,
            Summary = summary,
        };

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        File.WriteAllText(Path.Combine(runDir, "cogs-audit.json"), json);

        // Marker for "initial audit exists" checks
        if (!isRevised)
            File.WriteAllText(Path.Combine(periodDir, "INITIAL.ok"), entry.RunId);

        lock (_gate)
        {
            var index = ReadIndexUnlocked();
            index.RemoveAll(e => string.Equals(e.RunId, entry.RunId, StringComparison.OrdinalIgnoreCase));
            index.Insert(0, entry);
            if (index.Count > 500)
                index = index.Take(500).ToList();
            WriteIndexUnlocked(index);
        }

        return entry;
    }

    public bool HasInitialAudit(string companyName, string locationName, string periodMonth)
    {
        if (!TrySplitPeriod(periodMonth, out var year, out var monthNum, out var monthName))
            return false;
        var path = Path.Combine(
            _rootDir,
            Sanitize(companyName),
            Sanitize(locationName),
            monthName,
            year.ToString(CultureInfo.InvariantCulture),
            "INITIAL.ok");
        return File.Exists(path);
    }

    public IReadOnlyList<SystemCogsAuditHistoryEntry> List(int take = 100)
    {
        lock (_gate)
            return ReadIndexUnlocked().Take(Math.Clamp(take, 1, 500)).ToList();
    }

    public SystemCogsAuditHistoryFile? Load(string runId)
    {
        SystemCogsAuditHistoryEntry? entry;
        lock (_gate)
            entry = ReadIndexUnlocked().FirstOrDefault(e =>
                string.Equals(e.RunId, runId, StringComparison.OrdinalIgnoreCase));

        if (entry is null || string.IsNullOrWhiteSpace(entry.RelativePath))
            return null;

        var path = Path.Combine(_rootDir, entry.RelativePath, "cogs-audit.json");
        if (!File.Exists(path))
            return null;

        try
        {
            return JsonSerializer.Deserialize<SystemCogsAuditHistoryFile>(File.ReadAllText(path), JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    public static bool TrySplitPeriod(string periodMonth, out int year, out int month, out string monthName)
    {
        year = 0;
        month = 0;
        monthName = "";
        if (!DateOnly.TryParse($"{periodMonth.Trim()}-01", out var d))
            return false;
        year = d.Year;
        month = d.Month;
        monthName = d.ToString("MMMM", CultureInfo.InvariantCulture);
        return true;
    }

    static string Sanitize(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "_";
        var cleaned = Regex.Replace(value.Trim(), @"[^\w\-. ]+", "_");
        cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? "_" : cleaned;
    }

    List<SystemCogsAuditHistoryEntry> ReadIndexUnlocked()
    {
        if (!File.Exists(_indexPath))
            return [];
        try
        {
            return JsonSerializer.Deserialize<List<SystemCogsAuditHistoryEntry>>(
                File.ReadAllText(_indexPath), JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    void WriteIndexUnlocked(List<SystemCogsAuditHistoryEntry> index) =>
        File.WriteAllText(_indexPath, JsonSerializer.Serialize(index, JsonOptions));

    static string ResolveRoot(IHostEnvironment environment, IConfiguration configuration)
    {
        var configured = configuration["CogsAuditHistory:SystemDirectory"];
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(configured.Trim());

        var repoPath = Path.GetFullPath(Path.Combine(
            environment.ContentRootPath, "..", "..", "data-archives", "cogs-audit-history", "system"));
        if (Directory.Exists(Path.GetDirectoryName(repoPath)!) || environment.IsDevelopment())
            return repoPath;

        return Path.Combine(environment.ContentRootPath, "data-archives", "cogs-audit-history", "system");
    }
}

public sealed class SystemCogsAuditHistoryEntry
{
    public string RunId { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string LocationExternalId { get; set; } = string.Empty;
    public string LocationName { get; set; } = string.Empty;
    public string PeriodMonth { get; set; } = string.Empty;
    public string MonthName { get; set; } = string.Empty;
    public int Year { get; set; }
    public string UomMode { get; set; } = "inventory";
    public bool IsRevised { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? RevisedAtUtc { get; set; }
    public string Trigger { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public int IngredientCount { get; set; }
    public decimal OpeningValue { get; set; }
    public decimal ClosingValue { get; set; }
    public decimal ShortageValue { get; set; }
}

public sealed class SystemCogsAuditHistoryFile
{
    public SystemCogsAuditHistoryEntry Entry { get; set; } = new();
    public CogsAuditSummaryResult Summary { get; set; } = new();
}

/// <summary>
/// Runs live COGS audit snapshots after month inventory reconcile, and revised snapshots after later adjustments.
/// </summary>
public class SystemCogsAuditSnapshotService(
    BisyncDbContext db,
    CogsAuditService cogsAudit,
    SystemCogsAuditHistoryStore historyStore,
    ILogger<SystemCogsAuditSnapshotService> logger)
{
    public async Task SnapshotAfterInventoryReconcileAsync(
        int? companyId,
        IReadOnlyList<string> locationExternalIds,
        string periodMonth,
        string uomMode,
        string trigger,
        CancellationToken cancellationToken = default)
    {
        if (locationExternalIds.Count == 0 || string.IsNullOrWhiteSpace(periodMonth))
            return;

        if (!SystemCogsAuditHistoryStore.TrySplitPeriod(periodMonth, out var year, out _, out var monthName))
        {
            logger.LogWarning("COGS audit snapshot skipped — invalid period {Period}", periodMonth);
            return;
        }

        var companyName = await ResolveCompanyNameAsync(companyId, cancellationToken);
        var locationNames = await ResolveLocationNamesAsync(locationExternalIds, cancellationToken);

        foreach (var locationId in locationExternalIds.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                var locationName = locationNames.GetValueOrDefault(locationId) ?? locationId;
                var summary = await cogsAudit.GetSummaryAsync(
                    companyId,
                    [locationId],
                    periodMonth,
                    string.IsNullOrWhiteSpace(uomMode) ? "inventory" : uomMode,
                    "component",
                    cancellationToken);

                var entry = new SystemCogsAuditHistoryEntry
                {
                    RunId = Guid.NewGuid().ToString("N"),
                    CompanyId = companyId,
                    CompanyName = companyName,
                    LocationExternalId = locationId,
                    LocationName = locationName,
                    PeriodMonth = periodMonth.Trim(),
                    MonthName = monthName,
                    Year = year,
                    UomMode = string.IsNullOrWhiteSpace(uomMode) ? "inventory" : uomMode,
                    CreatedAtUtc = DateTime.UtcNow,
                    Trigger = trigger,
                    IngredientCount = summary.IngredientCount,
                    OpeningValue = summary.OpeningValue,
                    ClosingValue = summary.ClosingValue,
                    ShortageValue = summary.ShortageValue,
                };

                historyStore.Save(entry, summary, isRevised: false);
                logger.LogInformation(
                    "COGS audit saved {Path} ({Ingredients} ingredients)",
                    entry.RelativePath,
                    entry.IngredientCount);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "Failed COGS audit snapshot for company {CompanyId} location {Location} period {Period}",
                    companyId, locationId, periodMonth);
            }
        }
    }

    public async Task SnapshotRevisedAfterAdjustmentAsync(
        int? companyId,
        string locationExternalId,
        DateOnly adjustmentDate,
        string uomMode,
        string reason,
        CancellationToken cancellationToken = default)
    {
        // Inventory-confirm adjustments are handled by the reconcile snapshot (Initial).
        if (reason.Contains("Full inventory count #", StringComparison.OrdinalIgnoreCase))
            return;

        if (string.IsNullOrWhiteSpace(locationExternalId))
            return;

        var periodMonth = $"{adjustmentDate.Year:D4}-{adjustmentDate.Month:D2}";
        if (!SystemCogsAuditHistoryStore.TrySplitPeriod(periodMonth, out var year, out _, out var monthName))
            return;

        var companyName = await ResolveCompanyNameAsync(companyId, cancellationToken);
        var locationNames = await ResolveLocationNamesAsync([locationExternalId], cancellationToken);
        var locationName = locationNames.GetValueOrDefault(locationExternalId) ?? locationExternalId;

        if (!historyStore.HasInitialAudit(companyName, locationName, periodMonth))
        {
            // No prior monthly audit — nothing to revise yet.
            return;
        }

        try
        {
            var summary = await cogsAudit.GetSummaryAsync(
                companyId,
                [locationExternalId],
                periodMonth,
                string.IsNullOrWhiteSpace(uomMode) ? "inventory" : uomMode,
                "component",
                cancellationToken);

            var now = DateTime.UtcNow;
            var entry = new SystemCogsAuditHistoryEntry
            {
                RunId = Guid.NewGuid().ToString("N"),
                CompanyId = companyId,
                CompanyName = companyName,
                LocationExternalId = locationExternalId,
                LocationName = locationName,
                PeriodMonth = periodMonth,
                MonthName = monthName,
                Year = year,
                UomMode = string.IsNullOrWhiteSpace(uomMode) ? "inventory" : uomMode,
                CreatedAtUtc = now,
                Trigger = $"Adjustment revised: {Truncate(reason, 120)}",
                IngredientCount = summary.IngredientCount,
                OpeningValue = summary.OpeningValue,
                ClosingValue = summary.ClosingValue,
                ShortageValue = summary.ShortageValue,
            };

            historyStore.Save(entry, summary, isRevised: true, revisedAtUtc: now);
            logger.LogInformation(
                "COGS audit REVISED saved {Path} after adjustment on {Date}",
                entry.RelativePath,
                adjustmentDate);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed revised COGS audit for company {CompanyId} location {Location} period {Period}",
                companyId, locationExternalId, periodMonth);
        }
    }

    async Task<string> ResolveCompanyNameAsync(int? companyId, CancellationToken cancellationToken)
    {
        if (companyId is not int cid)
            return "UnknownCompany";
        var name = await db.Companies.AsNoTracking()
            .Where(c => c.Id == cid)
            .Select(c => c.Name)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(name) ? $"Company_{cid}" : name;
    }

    async Task<Dictionary<string, string>> ResolveLocationNamesAsync(
        IReadOnlyList<string> locationExternalIds,
        CancellationToken cancellationToken)
    {
        var rows = await db.Locations.AsNoTracking()
            .Where(l => locationExternalIds.Contains(l.ExternalId))
            .Select(l => new { l.ExternalId, l.Name })
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(r => r.ExternalId, r => r.Name, StringComparer.OrdinalIgnoreCase);
    }

    static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) ? "" : (s.Length <= max ? s : s[..max]);
}
