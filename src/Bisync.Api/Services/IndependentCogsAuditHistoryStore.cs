using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bisync.Api.Services;

/// <summary>
/// Persists completed Independent COGS audits under data-archives/cogs-audit-history.
/// </summary>
public class IndependentCogsAuditHistoryStore
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    readonly string _rootDir;
    readonly string _runsDir;
    readonly string _indexPath;
    readonly object _gate = new();

    public IndependentCogsAuditHistoryStore(IHostEnvironment environment, IConfiguration configuration)
    {
        _rootDir = ResolveHistoryDirectory(environment, configuration);
        _runsDir = Path.Combine(_rootDir, "runs");
        _indexPath = Path.Combine(_rootDir, "history-index.json");
        Directory.CreateDirectory(_runsDir);
    }

    public string HistoryDirectory => _rootDir;

    public IndependentAuditHistoryEntry Save(
        IndependentAuditUploadResult result,
        Dictionary<string, CogsAuditDetailResult> details,
        DateTime createdAtUtc)
    {
        var entry = new IndependentAuditHistoryEntry
        {
            SessionId = result.SessionId,
            FileName = result.FileName,
            PeriodMonth = result.PeriodMonth,
            CreatedAtUtc = createdAtUtc,
            IngredientCount = result.Summary.IngredientCount,
            OpeningValue = result.Summary.OpeningValue,
            ClosingValue = result.Summary.ClosingValue,
            ShortageQty = result.Summary.ShortageQty,
            ShortageValue = result.Summary.ShortageValue,
            DebitCreditMode = result.DebitCreditMode,
            DebitCreditConvention = result.DebitCreditConvention,
            DebitMeans = result.DebitMeans,
            CreditMeans = result.CreditMeans,
            ConventionSampleCount = result.ConventionSampleCount,
            ConventionMatchCount = result.ConventionMatchCount,
            ConventionConfidence = result.ConventionConfidence,
            ColumnsSwapped = result.ColumnsSwapped,
        };

        var payload = new IndependentAuditHistoryFile
        {
            Entry = entry,
            Summary = result.Summary,
            Details = details,
        };

        var runPath = RunPath(result.SessionId);
        var json = JsonSerializer.Serialize(payload, JsonOptions);

        lock (_gate)
        {
            File.WriteAllText(runPath, json);
            var index = ReadIndexUnlocked();
            index.RemoveAll(e => string.Equals(e.SessionId, entry.SessionId, StringComparison.OrdinalIgnoreCase));
            index.Insert(0, entry);
            // Keep newest 200 runs in the index
            if (index.Count > 200)
                index = index.Take(200).ToList();
            WriteIndexUnlocked(index);
        }

        return entry;
    }

    public IReadOnlyList<IndependentAuditHistoryEntry> List(int take = 50)
    {
        lock (_gate)
        {
            return ReadIndexUnlocked().Take(Math.Clamp(take, 1, 200)).ToList();
        }
    }

    public IndependentAuditHistoryFile? Load(string sessionId)
    {
        var path = RunPath(sessionId);
        if (!File.Exists(path))
            return null;

        try
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<IndependentAuditHistoryFile>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    public bool Delete(string sessionId)
    {
        lock (_gate)
        {
            var path = RunPath(sessionId);
            if (File.Exists(path))
                File.Delete(path);

            var index = ReadIndexUnlocked();
            var removed = index.RemoveAll(e => string.Equals(e.SessionId, sessionId, StringComparison.OrdinalIgnoreCase));
            if (removed > 0)
                WriteIndexUnlocked(index);
            return removed > 0 || !File.Exists(path);
        }
    }

    string RunPath(string sessionId)
    {
        var safe = string.Concat(sessionId.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_'));
        if (string.IsNullOrWhiteSpace(safe))
            throw new InvalidOperationException("Invalid session id.");
        return Path.Combine(_runsDir, $"{safe}.json");
    }

    List<IndependentAuditHistoryEntry> ReadIndexUnlocked()
    {
        if (!File.Exists(_indexPath))
            return [];
        try
        {
            var json = File.ReadAllText(_indexPath);
            return JsonSerializer.Deserialize<List<IndependentAuditHistoryEntry>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    void WriteIndexUnlocked(List<IndependentAuditHistoryEntry> index)
    {
        var json = JsonSerializer.Serialize(index, JsonOptions);
        File.WriteAllText(_indexPath, json);
    }

    static string ResolveHistoryDirectory(IHostEnvironment environment, IConfiguration configuration)
    {
        var configured = configuration["CogsAuditHistory:Directory"];
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(configured.Trim());

        var repoPath = Path.GetFullPath(Path.Combine(
            environment.ContentRootPath,
            "..",
            "..",
            "data-archives",
            "cogs-audit-history"));

        if (Directory.Exists(Path.GetDirectoryName(repoPath)!) || environment.IsDevelopment())
            return repoPath;

        return Path.Combine(environment.ContentRootPath, "data-archives", "cogs-audit-history");
    }
}

public sealed class IndependentAuditHistoryEntry
{
    public string SessionId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string PeriodMonth { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public int IngredientCount { get; set; }
    public decimal OpeningValue { get; set; }
    public decimal ClosingValue { get; set; }
    public decimal ShortageQty { get; set; }
    public decimal ShortageValue { get; set; }
    public string DebitCreditMode { get; set; } = string.Empty;
    public string DebitCreditConvention { get; set; } = string.Empty;
    public string DebitMeans { get; set; } = string.Empty;
    public string CreditMeans { get; set; } = string.Empty;
    public int ConventionSampleCount { get; set; }
    public int ConventionMatchCount { get; set; }
    public decimal ConventionConfidence { get; set; }
    public bool ColumnsSwapped { get; set; }
}

public sealed class IndependentAuditHistoryFile
{
    public IndependentAuditHistoryEntry Entry { get; set; } = new();
    public CogsAuditSummaryResult Summary { get; set; } = new();
    public Dictionary<string, CogsAuditDetailResult> Details { get; set; } = new(StringComparer.Ordinal);
}
