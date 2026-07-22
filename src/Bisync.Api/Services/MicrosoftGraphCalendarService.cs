using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Bisync.Api.Services;

/// <summary>
/// Create / update / delete calendar events via Microsoft Graph (application Calendars.ReadWrite).
/// Targets a Cubevalue mailbox calendar: POST /users/{mailbox}/events
/// </summary>
public static class MicrosoftGraphCalendarService
{
    public const string SalesCategory = "Bisync Sales Module";

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public sealed record CalendarEventInput(
        string Subject,
        string BodyHtml,
        DateTime StartsAtUtc,
        DateTime EndsAtUtc,
        string? Location,
        string? Categories = null);

    public sealed record CalendarEventResult(string EventId, string? WebLink);

    public static async Task<CalendarEventResult> CreateEventAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string mailbox,
        CalendarEventInput input,
        CancellationToken ct = default)
    {
        var token = await MicrosoftGraphAuth.AcquireTokenAsync(tenantId, clientId, clientSecret, ct);
        return await PostEventAsync(token, mailbox, input, ct);
    }

    public static async Task<CalendarEventResult> UpdateEventAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string mailbox,
        string eventId,
        CalendarEventInput input,
        CancellationToken ct = default)
    {
        var token = await MicrosoftGraphAuth.AcquireTokenAsync(tenantId, clientId, clientSecret, ct);
        return await PatchEventAsync(token, mailbox, eventId, input, ct);
    }

    public static async Task DeleteEventAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string mailbox,
        string eventId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return;
        var token = await MicrosoftGraphAuth.AcquireTokenAsync(tenantId, clientId, clientSecret, ct);
        await DeleteEventRawAsync(token, mailbox, eventId, ct);
    }

    /// <summary>Verifies token + mailbox calendar access by listing one event page.</summary>
    public static async Task<(bool Ok, string Message)> TestAccessAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string mailbox,
        CancellationToken ct = default)
    {
        try
        {
            var token = await MicrosoftGraphAuth.AcquireTokenAsync(tenantId, clientId, clientSecret, ct);
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var userPath = Uri.EscapeDataString(mailbox.Trim());
            var url = $"https://graph.microsoft.com/v1.0/users/{userPath}/calendar/events?$top=1&$select=id,subject";
            using var res = await http.GetAsync(url, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                return (false, MicrosoftGraphAuth.FormatGraphError(res.StatusCode, body, "Calendars.ReadWrite"));
            return (true, $"Connected to Office 365 calendar for {mailbox.Trim()}.");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    static async Task<CalendarEventResult> PostEventAsync(
        string accessToken,
        string mailbox,
        CalendarEventInput input,
        CancellationToken ct)
    {
        using var http = CreateClient(accessToken);
        var payload = BuildPayload(input);
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        var userPath = Uri.EscapeDataString(mailbox.Trim());
        using var res = await http.PostAsync(
            $"https://graph.microsoft.com/v1.0/users/{userPath}/events",
            content,
            ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(
                MicrosoftGraphAuth.FormatGraphError(res.StatusCode, body, "Calendars.ReadWrite"));
        return ParseEventResult(body);
    }

    static async Task<CalendarEventResult> PatchEventAsync(
        string accessToken,
        string mailbox,
        string eventId,
        CalendarEventInput input,
        CancellationToken ct)
    {
        using var http = CreateClient(accessToken);
        var payload = BuildPayload(input);
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        var userPath = Uri.EscapeDataString(mailbox.Trim());
        var idPath = Uri.EscapeDataString(eventId.Trim());
        using var req = new HttpRequestMessage(
            HttpMethod.Patch,
            $"https://graph.microsoft.com/v1.0/users/{userPath}/events/{idPath}")
        {
            Content = content,
        };
        using var res = await http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(
                MicrosoftGraphAuth.FormatGraphError(res.StatusCode, body, "Calendars.ReadWrite"));
        return ParseEventResult(body);
    }

    static async Task DeleteEventRawAsync(
        string accessToken,
        string mailbox,
        string eventId,
        CancellationToken ct)
    {
        using var http = CreateClient(accessToken);
        var userPath = Uri.EscapeDataString(mailbox.Trim());
        var idPath = Uri.EscapeDataString(eventId.Trim());
        using var res = await http.DeleteAsync(
            $"https://graph.microsoft.com/v1.0/users/{userPath}/events/{idPath}",
            ct);
        if (res.IsSuccessStatusCode || res.StatusCode == System.Net.HttpStatusCode.NotFound)
            return;
        var body = await res.Content.ReadAsStringAsync(ct);
        throw new InvalidOperationException(
            MicrosoftGraphAuth.FormatGraphError(res.StatusCode, body, "Calendars.ReadWrite"));
    }

    static HttpClient CreateClient(string accessToken)
    {
        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return http;
    }

    static object BuildPayload(CalendarEventInput input)
    {
        var categories = string.IsNullOrWhiteSpace(input.Categories)
            ? new[] { SalesCategory }
            : input.Categories.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (string.IsNullOrWhiteSpace(input.Location))
        {
            return new
            {
                subject = input.Subject,
                body = new
                {
                    contentType = "HTML",
                    content = input.BodyHtml,
                },
                start = new
                {
                    dateTime = input.StartsAtUtc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff"),
                    timeZone = "UTC",
                },
                end = new
                {
                    dateTime = input.EndsAtUtc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff"),
                    timeZone = "UTC",
                },
                categories,
                isReminderOn = true,
                reminderMinutesBeforeStart = 30,
            };
        }

        return new
        {
            subject = input.Subject,
            body = new
            {
                contentType = "HTML",
                content = input.BodyHtml,
            },
            start = new
            {
                dateTime = input.StartsAtUtc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff"),
                timeZone = "UTC",
            },
            end = new
            {
                dateTime = input.EndsAtUtc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff"),
                timeZone = "UTC",
            },
            location = new { displayName = input.Location.Trim() },
            categories,
            isReminderOn = true,
            reminderMinutesBeforeStart = 30,
        };
    }

    static CalendarEventResult ParseEventResult(string body)
    {
        using var doc = JsonDocument.Parse(body);
        var id = doc.RootElement.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(id))
            throw new InvalidOperationException("Microsoft Graph returned an event without an id.");
        var webLink = doc.RootElement.TryGetProperty("webLink", out var linkEl) ? linkEl.GetString() : null;
        return new CalendarEventResult(id, webLink);
    }
}
