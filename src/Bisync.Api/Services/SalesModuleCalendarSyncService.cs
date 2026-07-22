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
            INSERT INTO "SalesModuleCalendarSettings" ("Id", "Enabled", "CalendarDisplayName")
            SELECT 1, false, 'Cubevalue'
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
        if (!IsReady(settings)) return;

        try
        {
            var input = BuildEventInput(appointment, customer, settings.CalendarDisplayName);
            var result = await MicrosoftGraphCalendarService.CreateEventAsync(
                settings.GraphTenantId,
                settings.GraphClientId,
                settings.GraphClientSecret,
                settings.CalendarMailbox,
                input,
                ct);

            appointment.OutlookEventId = result.EventId;
            appointment.OutlookWebLink = result.WebLink ?? string.Empty;
            appointment.OutlookSyncError = string.Empty;
            appointment.OutlookSyncedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Sales Module O365 calendar create failed for appointment {Id}", appointment.Id);
            appointment.OutlookSyncError = MicrosoftGraphAuth.Trim(ex.Message, 400);
            appointment.OutlookSyncedAt = null;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task PushDeleteAsync(SalesModuleAppointment appointment, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(appointment.OutlookEventId)) return;

        var settings = await GetOrCreateAsync(ct);
        if (!MicrosoftGraphAuth.LooksConfigured(settings.GraphTenantId, settings.GraphClientId, settings.GraphClientSecret)
            || string.IsNullOrWhiteSpace(settings.CalendarMailbox))
            return;

        try
        {
            await MicrosoftGraphCalendarService.DeleteEventAsync(
                settings.GraphTenantId,
                settings.GraphClientId,
                settings.GraphClientSecret,
                settings.CalendarMailbox,
                appointment.OutlookEventId,
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Sales Module O365 calendar delete failed for appointment {Id}", appointment.Id);
        }
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
