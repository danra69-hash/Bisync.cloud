using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

public sealed class PlatformLaunchStatusDto
{
    public bool DemoMode { get; set; }
    public bool GoLive { get; set; }
    public bool RegistrationRestricted { get; set; }
    public IReadOnlyList<string> AllowedEmailDomains { get; set; } = [];
    public Dictionary<string, bool> ModulesGoLive { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public DateTime? UpdatedAt { get; set; }
    public string UpdatedByEmail { get; set; } = string.Empty;
}

public static class PlatformModuleGoLiveKeys
{
    public const string Rms = "RMS";
    public const string Pos = "POS";
    public const string Hrm = "HRM";
    public const string Accounting = "Accounting";
    public const string SystemConfig = "SystemConfig";

    public static readonly string[] All =
    [
        Rms,
        Pos,
        Hrm,
        Accounting,
        SystemConfig,
    ];
}

public class PlatformLaunchService(
    BisyncDbContext db,
    IOptions<DevConsoleAuthOptions> authOptions)
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public IReadOnlyList<string> DemoAllowedDomains =>
        authOptions.Value.AllowedEmailDomains
            .Select(d => d.Trim().TrimStart('@').ToLowerInvariant())
            .Where(d => d.Length > 0)
            .Distinct()
            .ToList();

    public async Task EnsureTableAsync(CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "PlatformLaunchSettings" (
                "Id" integer NOT NULL CONSTRAINT "PK_PlatformLaunchSettings" PRIMARY KEY,
                "DemoMode" boolean NOT NULL DEFAULT TRUE,
                "GoLive" boolean NOT NULL DEFAULT FALSE,
                "ModulesGoLiveJson" TEXT NOT NULL DEFAULT '{}',
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedByEmail" TEXT NOT NULL DEFAULT ''
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "PlatformLaunchSettings"
            ADD COLUMN IF NOT EXISTS "ModulesGoLiveJson" TEXT NOT NULL DEFAULT '{}';
            """, ct);

        var exists = await db.PlatformLaunchSettings.AsNoTracking().AnyAsync(s => s.Id == 1, ct);
        if (!exists)
        {
            db.PlatformLaunchSettings.Add(new PlatformLaunchSettings
            {
                Id = 1,
                DemoMode = true,
                GoLive = false,
                // Modules stay available by default; Demo mode only gates registration domains.
                ModulesGoLiveJson = SerializeModules(DefaultModules(goLive: true)),
                UpdatedAt = DateTime.UtcNow,
                UpdatedByEmail = "system",
            });
            await db.SaveChangesAsync(ct);
            return;
        }

        // Backfill empty module flags as all live (legacy sites already exposed modules).
        var row = await db.PlatformLaunchSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (row is null) return;
        if (string.IsNullOrWhiteSpace(row.ModulesGoLiveJson) || row.ModulesGoLiveJson.Trim() == "{}")
        {
            row.ModulesGoLiveJson = SerializeModules(DefaultModules(goLive: true));
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<PlatformLaunchSettings> GetOrCreateAsync(CancellationToken ct = default)
    {
        await EnsureTableAsync(ct);
        var row = await db.PlatformLaunchSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (row is not null) return row;

        row = new PlatformLaunchSettings
        {
            Id = 1,
            DemoMode = true,
            GoLive = false,
            ModulesGoLiveJson = SerializeModules(DefaultModules(goLive: true)),
            UpdatedAt = DateTime.UtcNow,
            UpdatedByEmail = "system",
        };
        db.PlatformLaunchSettings.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<PlatformLaunchStatusDto> GetStatusAsync(CancellationToken ct = default)
    {
        var row = await GetOrCreateAsync(ct);
        return ToDto(row);
    }

    public async Task<PlatformLaunchStatusDto> UpdateAsync(
        bool demoMode,
        IReadOnlyDictionary<string, bool>? modulesGoLive,
        string updatedByEmail,
        CancellationToken ct = default)
    {
        // Demo mode locks registration; turning Demo off opens signup (legacy GoLive flag).
        var goLive = !demoMode;

        var row = await GetOrCreateAsync(ct);
        row.DemoMode = demoMode;
        row.GoLive = goLive;
        if (modulesGoLive is not null)
            row.ModulesGoLiveJson = SerializeModules(NormalizeModules(modulesGoLive, fallbackGoLive: goLive));
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedByEmail = (updatedByEmail ?? string.Empty).Trim().ToLowerInvariant();
        await db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    /// <summary>
    /// Returns null when the email is allowed; otherwise an error message for the client.
    /// </summary>
    public async Task<string?> ValidateRegistrationEmailAsync(string email, CancellationToken ct = default)
    {
        var status = await GetStatusAsync(ct);
        if (!status.RegistrationRestricted) return null;

        if (IsAllowedDemoEmail(email)) return null;

        var domains = string.Join(", ", status.AllowedEmailDomains.Select(d => $"@{d}"));
        return $"This is a demo site. Registration is limited to {domains} until Go live.";
    }

    public bool IsAllowedDemoEmail(string email)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        var at = normalized.LastIndexOf('@');
        if (at < 0 || at == normalized.Length - 1) return false;
        var domain = normalized[(at + 1)..];
        return DemoAllowedDomains.Contains(domain);
    }

    PlatformLaunchStatusDto ToDto(PlatformLaunchSettings row) => new()
    {
        DemoMode = row.DemoMode,
        GoLive = row.GoLive,
        RegistrationRestricted = !row.GoLive,
        AllowedEmailDomains = DemoAllowedDomains,
        ModulesGoLive = ParseModules(row.ModulesGoLiveJson, fallbackGoLive: row.GoLive),
        UpdatedAt = row.UpdatedAt,
        UpdatedByEmail = row.UpdatedByEmail,
    };

    static Dictionary<string, bool> DefaultModules(bool goLive) =>
        PlatformModuleGoLiveKeys.All.ToDictionary(k => k, _ => goLive, StringComparer.OrdinalIgnoreCase);

    static Dictionary<string, bool> NormalizeModules(
        IReadOnlyDictionary<string, bool>? incoming,
        bool fallbackGoLive)
    {
        var result = DefaultModules(fallbackGoLive);
        if (incoming is null) return result;
        foreach (var key in PlatformModuleGoLiveKeys.All)
        {
            if (incoming.TryGetValue(key, out var value))
                result[key] = value;
            else
            {
                // Accept case-insensitive keys from clients.
                var match = incoming.FirstOrDefault(kv =>
                    string.Equals(kv.Key, key, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrEmpty(match.Key))
                    result[key] = match.Value;
            }
        }
        return result;
    }

    static Dictionary<string, bool> ParseModules(string? json, bool fallbackGoLive)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Trim() == "{}")
            return DefaultModules(fallbackGoLive);

        try
        {
            var parsed = JsonSerializer.Deserialize<Dictionary<string, bool>>(json, JsonOptions);
            return NormalizeModules(parsed, fallbackGoLive);
        }
        catch
        {
            return DefaultModules(fallbackGoLive);
        }
    }

    static string SerializeModules(Dictionary<string, bool> modules) =>
        JsonSerializer.Serialize(
            PlatformModuleGoLiveKeys.All.ToDictionary(k => k, k => modules.GetValueOrDefault(k)),
            JsonOptions);
}
