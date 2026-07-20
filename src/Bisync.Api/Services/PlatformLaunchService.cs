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
    public DateTime? UpdatedAt { get; set; }
    public string UpdatedByEmail { get; set; } = string.Empty;
}

public class PlatformLaunchService(
    BisyncDbContext db,
    IOptions<DevConsoleAuthOptions> authOptions)
{
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
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedByEmail" TEXT NOT NULL DEFAULT ''
            );
            """, ct);

        var exists = await db.PlatformLaunchSettings.AsNoTracking().AnyAsync(s => s.Id == 1, ct);
        if (!exists)
        {
            db.PlatformLaunchSettings.Add(new PlatformLaunchSettings
            {
                Id = 1,
                DemoMode = true,
                GoLive = false,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByEmail = "system",
            });
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
        bool goLive,
        string updatedByEmail,
        CancellationToken ct = default)
    {
        // Mutual modes: Go live unlocks registration; Demo keeps the site locked.
        if (goLive)
        {
            demoMode = false;
            goLive = true;
        }
        else
        {
            demoMode = true;
            goLive = false;
        }

        var row = await GetOrCreateAsync(ct);
        row.DemoMode = demoMode;
        row.GoLive = goLive;
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
        UpdatedAt = row.UpdatedAt,
        UpdatedByEmail = row.UpdatedByEmail,
    };
}
