using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Syncs Sales Module appointments to the Cubevalue Office 365 calendar via Microsoft Graph.
/// </summary>
public class SalesModuleCalendarSyncService(
    BisyncDbContext db,
    ILogger<SalesModuleCalendarSyncService> logger)
{
    public async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "SalesModuleCalendarSettings" (
                "Id" integer NOT NULL CONSTRAINT "PK_SalesModuleCalendarSettings" PRIMARY KEY,
                "Enabled" boolean NOT NULL DEFAULT false,
                "GraphTenantId" TEXT NOT NULL DEFAULT '',
                "GraphClientId" TEXT NOT NULL DEFAULT '',
                "GraphClientSecret" TEXT NOT NULL DEFAULT '',
                "CalendarMailbox" TEXT NOT NULL DEFAULT '',
                "CalendarDisplayName" TEXT NOT NULL DEFAULT 'Cubevalue',
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedByEmail" TEXT NOT NULL DEFAULT '',
                "LastTestAt" TEXT NOT NULL DEFAULT '',
                "LastTestResult" TEXT NOT NULL DEFAULT ''
            );
            """, ct);

        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "SalesModuleCalendarSettings" (
                "Id", "Enabled", "GraphTenantId", "GraphClientId", "GraphClientSecret",
                "CalendarMailbox", "CalendarDisplayName", "UpdatedAt", "UpdatedByEmail", "LastTestAt", "LastTestResult"
            )
            SELECT 1, false, '', '', '', '', 'Cubevalue', NOW(), '', '', ''
            WHERE NOT EXISTS (SELECT 1 FROM "SalesModuleCalendarSettings" WHERE "Id" = 1);
            """, ct);
    }

    public async Task<SalesModuleCalendarSettings> GetOrCreateAsync(CancellationToken ct = default)
    {
        await EnsureSchemaAsync(ct);
        var row = await db.SalesModuleCalendarSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (row is not null) return row;

        row = new SalesModuleCalendarSettings
        {
            Id = 1,
            Enabled = false,
            CalendarDisplayName = "Cubevalue",
            UpdatedAt = DateTime.UtcNow,
        };
        db.SalesModuleCalendarSettings.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    public object ToPublicDto(SalesModuleCalendarSettings row) => new
    {
        enabled = row.Enabled,
        graphTenantId = row.GraphTenantId,
        graphClientId = row.GraphClientId,
        graphClientSecretSet = !string.IsNullOrWhiteSpace(row.GraphClientSecret),
        calendarMailbox = row.CalendarMailbox,
        calendarDisplayName = string.IsNullOrWhiteSpace(row.CalendarDisplayName) ? "Cubevalue" : row.CalendarDisplayName,
        configured = IsReady(row),
        updatedAt = row.UpdatedAt,
        updatedByEmail = row.UpdatedByEmail,
        lastTestAt = string.IsNullOrWhiteSpace(row.LastTestAt) ? null : row.LastTestAt,
        lastTestResult = string.IsNullOrWhiteSpace(row.LastTestResult) ? null : row.LastTestResult,
        permissionHint = "Azure app needs Application permission Calendars.ReadWrite with admin consent.",
    };

    public static bool IsReady(SalesModuleCalendarSettings row) =>
        row.Enabled
        && MicrosoftGraphAuth.LooksConfigured(row.GraphTenantId, row.GraphClientId, row.GraphClientSecret)
        && !string.IsNullOrWhiteSpace(row.CalendarMailbox);

    public async Task<SalesModuleCalendarSettings> UpdateAsync(
        bool enabled,
        string? graphTenantId,
        string? graphClientId,
        string? graphClientSecret,
        string? calendarMailbox,
        string? calendarDisplayName,
        string updatedByEmail,
        CancellationToken ct = default)
    {
        var row = await GetOrCreateAsync(ct);
        row.Enabled = enabled;
        if (graphTenantId is not null) row.GraphTenantId = graphTenantId.Trim();
        if (graphClientId is not null) row.GraphClientId = graphClientId.Trim();
        if (!string.IsNullOrWhiteSpace(graphClientSecret))
            row.GraphClientSecret = graphClientSecret.Trim();
        if (calendarMailbox is not null) row.CalendarMailbox = calendarMailbox.Trim().ToLowerInvariant();
        if (calendarDisplayName is not null)
            row.CalendarDisplayName = string.IsNullOrWhiteSpace(calendarDisplayName)
                ? "Cubevalue"
                : calendarDisplayName.Trim();
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedByEmail = (updatedByEmail ?? string.Empty).Trim().ToLowerInvariant();
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<(bool Ok, string Message)> TestAsync(CancellationToken ct = default)
    {
        var row = await GetOrCreateAsync(ct);
        if (!MicrosoftGraphAuth.LooksConfigured(row.GraphTenantId, row.GraphClientId, row.GraphClientSecret))
            return (false, "Save Directory (tenant) ID, Application (client) ID, and Client secret first.");
        if (string.IsNullOrWhiteSpace(row.CalendarMailbox))
            return (false, "Calendar mailbox (Cubevalue Microsoft 365 email) is required.");

        var (ok, message) = await MicrosoftGraphCalendarService.TestAccessAsync(
            row.GraphTenantId,
            row.GraphClientId,
            row.GraphClientSecret,
            row.CalendarMailbox,
            ct);

        row.LastTestAt = DateTime.UtcNow.ToString("u");
        row.LastTestResult = ok ? $"OK: {message}" : $"Failed: {message}";
        await db.SaveChangesAsync(ct);
        return (ok, message);
    }

    public async Task PushCreateAsync(
        SalesModuleAppointment appointment,
        SalesModuleCustomer? customer,
        CancellationToken ct = default)
    {
        var settings = await GetOrCreateAsync(ct);
        if (!MicrosoftGraphAuth.LooksConfigured(settings.GraphTenantId, settings.GraphClientId, settings.GraphClientSecret))
            return;

        var teamMember = await ResolveTeamMailboxAsync(appointment.EngagedUserEmail, ct);
        var targets = new List<(string Mailbox, string Label)>();
        if (teamMember is not null)
            targets.Add((teamMember.Email, teamMember.Name));
        if (IsReady(settings)
            && !targets.Any(t => string.Equals(t.Mailbox, settings.CalendarMailbox, StringComparison.OrdinalIgnoreCase)))
            targets.Add((settings.CalendarMailbox, settings.CalendarDisplayName));

        if (targets.Count == 0) return;

        string? primaryEventId = null;
        string? primaryWebLink = null;
        string? lastError = null;

        foreach (var (mailbox, label) in targets)
        {
            try
            {
                var input = BuildEventInput(appointment, customer, label);
                var result = await MicrosoftGraphCalendarService.CreateEventAsync(
                    settings.GraphTenantId,
                    settings.GraphClientId,
                    settings.GraphClientSecret,
                    mailbox,
                    input,
                    ct);
                primaryEventId ??= result.EventId;
                primaryWebLink ??= result.WebLink;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Sales Module O365 create failed for appointment {Id} → {Mailbox}", appointment.Id, mailbox);
                lastError = MicrosoftGraphAuth.Trim(ex.Message, 400);
            }
        }

        if (!string.IsNullOrWhiteSpace(primaryEventId))
        {
            appointment.OutlookEventId = primaryEventId;
            appointment.OutlookWebLink = primaryWebLink ?? string.Empty;
            appointment.OutlookSyncError = string.Empty;
            appointment.OutlookSyncedAt = DateTime.UtcNow;
        }
        else if (!string.IsNullOrWhiteSpace(lastError))
        {
            appointment.OutlookSyncError = lastError;
            appointment.OutlookSyncedAt = null;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task PushDeleteAsync(SalesModuleAppointment appointment, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(appointment.OutlookEventId)) return;

        var settings = await GetOrCreateAsync(ct);
        if (!MicrosoftGraphAuth.LooksConfigured(settings.GraphTenantId, settings.GraphClientId, settings.GraphClientSecret))
            return;

        var mailboxes = new List<string>();
        var teamMember = await ResolveTeamMailboxAsync(appointment.EngagedUserEmail, ct);
        if (teamMember is not null) mailboxes.Add(teamMember.Email);
        if (!string.IsNullOrWhiteSpace(settings.CalendarMailbox)
            && !mailboxes.Any(m => string.Equals(m, settings.CalendarMailbox, StringComparison.OrdinalIgnoreCase)))
            mailboxes.Add(settings.CalendarMailbox);

        foreach (var mailbox in mailboxes)
        {
            try
            {
                await MicrosoftGraphCalendarService.DeleteEventAsync(
                    settings.GraphTenantId,
                    settings.GraphClientId,
                    settings.GraphClientSecret,
                    mailbox,
                    appointment.OutlookEventId,
                    ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Sales Module O365 delete failed for appointment {Id} → {Mailbox}", appointment.Id, mailbox);
            }
        }
    }

    public async Task EnsureTeamSchemaAsync(CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "SalesModuleTeamMembers" (
                "Id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL CONSTRAINT "PK_SalesModuleTeamMembers" PRIMARY KEY,
                "Name" TEXT NOT NULL DEFAULT '',
                "Email" TEXT NOT NULL DEFAULT '',
                "Active" boolean NOT NULL DEFAULT true,
                "IsHunter" boolean NOT NULL DEFAULT true,
                "IsFarmer" boolean NOT NULL DEFAULT false,
                "CalendarSyncEnabled" boolean NOT NULL DEFAULT true,
                "LastSyncError" TEXT NOT NULL DEFAULT '',
                "LastSyncedAt" timestamp with time zone NULL,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW()
            );
            """, ct);
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleTeamMembers", "IsHunter", "boolean NOT NULL DEFAULT true");
        await DatabaseSchemaHelper.TryAddColumnAsync(db, "SalesModuleTeamMembers", "IsFarmer", "boolean NOT NULL DEFAULT false");
        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_SalesModuleTeamMembers_Email"
            ON "SalesModuleTeamMembers" ("Email");
            """, ct);
    }

    public async Task<List<SalesModuleTeamMember>> ListTeamAsync(CancellationToken ct = default)
    {
        await EnsureTeamSchemaAsync(ct);
        return await db.SalesModuleTeamMembers.AsNoTracking()
            .OrderBy(m => m.Name)
            .ThenBy(m => m.Email)
            .ToListAsync(ct);
    }

    public async Task<SalesModuleTeamMember> CreateTeamMemberAsync(
        string name,
        string email,
        bool calendarSyncEnabled = true,
        bool isHunter = true,
        bool isFarmer = false,
        string? graphTenantId = null,
        string? graphClientId = null,
        string? graphClientSecret = null,
        CancellationToken ct = default)
    {
        await EnsureTeamSchemaAsync(ct);
        var trimmedName = (name ?? string.Empty).Trim();
        var trimmedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(trimmedName))
            throw new InvalidOperationException("Name is required.");
        if (string.IsNullOrWhiteSpace(trimmedEmail) || !trimmedEmail.Contains('@'))
            throw new InvalidOperationException("A valid email (Office 365 UPN) is required.");

        if (await db.SalesModuleTeamMembers.AnyAsync(m => m.Email == trimmedEmail, ct))
            throw new InvalidOperationException($"Sales team member {trimmedEmail} already exists.");

        await ApplyGraphCredentialsFromTeamMemberAsync(
            trimmedEmail,
            calendarSyncEnabled,
            graphTenantId,
            graphClientId,
            graphClientSecret,
            ct);

        var row = new SalesModuleTeamMember
        {
            Name = trimmedName,
            Email = trimmedEmail,
            Active = true,
            IsHunter = isHunter,
            IsFarmer = isFarmer,
            CalendarSyncEnabled = calendarSyncEnabled,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.SalesModuleTeamMembers.Add(row);
        await db.SaveChangesAsync(ct);

        // Probe mailbox when Graph credentials exist so the member is immediately wired for sync.
        await ProbeTeamMemberAsync(row, ct);
        return row;
    }

    public async Task<SalesModuleTeamMember?> UpdateTeamMemberAsync(
        int id,
        string name,
        string email,
        bool active,
        bool calendarSyncEnabled,
        bool isHunter = true,
        bool isFarmer = false,
        string? graphTenantId = null,
        string? graphClientId = null,
        string? graphClientSecret = null,
        CancellationToken ct = default)
    {
        await EnsureTeamSchemaAsync(ct);
        var row = await db.SalesModuleTeamMembers.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (row is null) return null;

        var trimmedName = (name ?? string.Empty).Trim();
        var trimmedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(trimmedName))
            throw new InvalidOperationException("Name is required.");
        if (string.IsNullOrWhiteSpace(trimmedEmail) || !trimmedEmail.Contains('@'))
            throw new InvalidOperationException("A valid email (Office 365 UPN) is required.");

        if (await db.SalesModuleTeamMembers.AnyAsync(m => m.Email == trimmedEmail && m.Id != id, ct))
            throw new InvalidOperationException($"Sales team member {trimmedEmail} already exists.");

        await ApplyGraphCredentialsFromTeamMemberAsync(
            trimmedEmail,
            calendarSyncEnabled,
            graphTenantId,
            graphClientId,
            graphClientSecret,
            ct);

        row.Name = trimmedName;
        row.Email = trimmedEmail;
        row.Active = active;
        row.IsHunter = isHunter;
        row.IsFarmer = isFarmer;
        row.CalendarSyncEnabled = calendarSyncEnabled;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        if (row.Active && row.CalendarSyncEnabled)
            await ProbeTeamMemberAsync(row, ct);

        return row;
    }

    /// <summary>
    /// Persists Graph app credentials from the Sales Team member form into the shared settings row.
    /// Member email is the mailbox UPN used for calendar sync.
    /// </summary>
    async Task ApplyGraphCredentialsFromTeamMemberAsync(
        string memberEmail,
        bool calendarSyncEnabled,
        string? graphTenantId,
        string? graphClientId,
        string? graphClientSecret,
        CancellationToken ct)
    {
        var hasAnyGraphField =
            !string.IsNullOrWhiteSpace(graphTenantId)
            || !string.IsNullOrWhiteSpace(graphClientId)
            || !string.IsNullOrWhiteSpace(graphClientSecret);
        if (!hasAnyGraphField && !calendarSyncEnabled)
            return;

        var settings = await GetOrCreateAsync(ct);
        if (hasAnyGraphField)
        {
            if (graphTenantId is not null) settings.GraphTenantId = graphTenantId.Trim();
            if (graphClientId is not null) settings.GraphClientId = graphClientId.Trim();
            if (!string.IsNullOrWhiteSpace(graphClientSecret))
                settings.GraphClientSecret = graphClientSecret.Trim();
        }

        if (calendarSyncEnabled
            && MicrosoftGraphAuth.LooksConfigured(settings.GraphTenantId, settings.GraphClientId, settings.GraphClientSecret))
        {
            settings.Enabled = true;
            if (string.IsNullOrWhiteSpace(settings.CalendarMailbox))
                settings.CalendarMailbox = memberEmail;
        }

        settings.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteTeamMemberAsync(int id, CancellationToken ct = default)
    {
        await EnsureTeamSchemaAsync(ct);
        var row = await db.SalesModuleTeamMembers.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (row is null) return false;
        db.SalesModuleTeamMembers.Remove(row);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<(bool Ok, string Message)> TestTeamMemberAsync(int id, CancellationToken ct = default)
    {
        await EnsureTeamSchemaAsync(ct);
        var row = await db.SalesModuleTeamMembers.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (row is null) return (false, "Sales team member not found.");
        await ProbeTeamMemberAsync(row, ct);
        var ok = string.IsNullOrWhiteSpace(row.LastSyncError);
        return (ok, ok
            ? $"Office 365 calendar connected for {row.Name} ({row.Email})."
            : row.LastSyncError);
    }

    /// <summary>Pull Office 365 events for all active sync-enabled sales team members.</summary>
    public async Task<object> PullTeamCalendarsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        await EnsureTeamSchemaAsync(ct);
        var settings = await GetOrCreateAsync(ct);
        var members = await db.SalesModuleTeamMembers
            .Where(m => m.Active && m.CalendarSyncEnabled)
            .OrderBy(m => m.Name)
            .ToListAsync(ct);

        var events = new List<object>();
        var errors = new List<object>();

        if (!MicrosoftGraphAuth.LooksConfigured(settings.GraphTenantId, settings.GraphClientId, settings.GraphClientSecret))
        {
            return new
            {
                configured = false,
                message = "Configure Office 365 Graph credentials in Sales Module to sync sales team calendars.",
                events,
                errors,
                members = members.Select(MapTeamMember),
            };
        }

        foreach (var member in members)
        {
            try
            {
                var listed = await MicrosoftGraphCalendarService.ListCalendarViewAsync(
                    settings.GraphTenantId,
                    settings.GraphClientId,
                    settings.GraphClientSecret,
                    member.Email,
                    fromUtc,
                    toUtc,
                    ct);

                member.LastSyncError = string.Empty;
                member.LastSyncedAt = DateTime.UtcNow;

                foreach (var ev in listed)
                {
                    events.Add(new
                    {
                        id = $"o365:{member.Id}:{ev.EventId}",
                        source = "office365",
                        salesTeamMemberId = member.Id,
                        salesTeamMemberName = member.Name,
                        salesTeamMemberEmail = member.Email,
                        outlookEventId = ev.EventId,
                        title = string.IsNullOrWhiteSpace(ev.Subject) ? "(No title)" : ev.Subject,
                        notes = ev.BodyPreview,
                        startsAt = ev.StartsAtUtc,
                        endsAt = ev.EndsAtUtc,
                        location = ev.Location,
                        outlookWebLink = ev.WebLink,
                        isAllDay = ev.IsAllDay,
                        readOnly = true,
                    });
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to pull O365 calendar for sales team member {Email}", member.Email);
                member.LastSyncError = MicrosoftGraphAuth.Trim(ex.Message, 400);
                member.LastSyncedAt = DateTime.UtcNow;
                errors.Add(new
                {
                    salesTeamMemberId = member.Id,
                    name = member.Name,
                    email = member.Email,
                    error = member.LastSyncError,
                });
            }
        }

        await db.SaveChangesAsync(ct);

        return new
        {
            configured = true,
            message = errors.Count == 0
                ? $"Synced {events.Count} event(s) from {members.Count} sales team calendar(s)."
                : $"Synced with {errors.Count} calendar error(s).",
            events,
            errors,
            members = members.Select(MapTeamMember),
        };
    }

    public static object MapTeamMember(SalesModuleTeamMember m) => new
    {
        m.Id,
        m.Name,
        m.Email,
        m.Active,
        m.IsHunter,
        m.IsFarmer,
        m.CalendarSyncEnabled,
        lastSyncError = string.IsNullOrWhiteSpace(m.LastSyncError) ? null : m.LastSyncError,
        lastSyncedAt = m.LastSyncedAt,
        createdAt = m.CreatedAt,
        updatedAt = m.UpdatedAt,
        calendarWired = m.Active && m.CalendarSyncEnabled && string.IsNullOrWhiteSpace(m.LastSyncError),
    };

    async Task ProbeTeamMemberAsync(SalesModuleTeamMember row, CancellationToken ct)
    {
        var settings = await GetOrCreateAsync(ct);
        if (!MicrosoftGraphAuth.LooksConfigured(settings.GraphTenantId, settings.GraphClientId, settings.GraphClientSecret))
        {
            row.LastSyncError = "Add Office 365 Graph credentials when creating/editing this Sales Team member.";
            row.LastSyncedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return;
        }

        var (ok, message) = await MicrosoftGraphCalendarService.TestAccessAsync(
            settings.GraphTenantId,
            settings.GraphClientId,
            settings.GraphClientSecret,
            row.Email,
            ct);
        row.LastSyncError = ok ? string.Empty : message;
        row.LastSyncedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    async Task<SalesModuleTeamMember?> ResolveTeamMailboxAsync(string? email, CancellationToken ct)
    {
        var key = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(key)) return null;
        await EnsureTeamSchemaAsync(ct);
        return await db.SalesModuleTeamMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.Active && m.CalendarSyncEnabled && m.Email == key, ct);
    }

    static MicrosoftGraphCalendarService.CalendarEventInput BuildEventInput(
        SalesModuleAppointment appointment,
        SalesModuleCustomer? customer,
        string calendarDisplayName)
    {
        var customerLabel = customer?.CompanyName ?? $"Customer #{appointment.SalesModuleCustomerId}";
        var subject = string.IsNullOrWhiteSpace(appointment.Title)
            ? $"Sales · {customerLabel}"
            : appointment.Title.Trim();

        var body = $"""
            <p><strong>Bisync Sales Module</strong> · {System.Net.WebUtility.HtmlEncode(calendarDisplayName)}</p>
            <p><strong>Customer:</strong> {System.Net.WebUtility.HtmlEncode(customerLabel)}</p>
            <p><strong>Engaged:</strong> {System.Net.WebUtility.HtmlEncode(appointment.EngagedUserEmail)}</p>
            <p>{System.Net.WebUtility.HtmlEncode(appointment.Notes).Replace("\n", "<br/>")}</p>
            <p style="color:#666;font-size:12px">Synced from Bisync.cloud Sales Module (appointment #{appointment.Id})</p>
            """;

        return new MicrosoftGraphCalendarService.CalendarEventInput(
            Subject: subject,
            BodyHtml: body,
            StartsAtUtc: appointment.StartsAt,
            EndsAtUtc: appointment.EndsAt,
            Location: appointment.Location);
    }
}
