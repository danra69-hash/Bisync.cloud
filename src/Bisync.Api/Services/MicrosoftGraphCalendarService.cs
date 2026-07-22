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

    public sealed record ListedCalendarEvent(
        string EventId,
        string Subject,
        string BodyPreview,
        DateTime StartsAtUtc,
        DateTime EndsAtUtc,
        string Location,
        string? WebLink,
        bool IsAllDay);

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

    /// <summary>Lists events from a mailbox calendar in the given UTC window (calendarView).</summary>
    public static async Task<IReadOnlyList<ListedCalendarEvent>> ListCalendarViewAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string mailbox,
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken ct = default)
    {
        var token = await MicrosoftGraphAuth.AcquireTokenAsync(tenantId, clientId, clientSecret, ct);
        using var http = CreateClient(token);
        http.DefaultRequestHeaders.TryAddWithoutValidation("Prefer", "outlook.timezone=\"UTC\"");

        var userPath = Uri.EscapeDataString(mailbox.Trim());
        var start = Uri.EscapeDataString(fromUtc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
        var end = Uri.EscapeDataString(toUtc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'"));
        var url =
            $"https://graph.microsoft.com/v1.0/users/{userPath}/calendar/calendarView" +
            $"?startDateTime={start}&endDateTime={end}" +
            "&$select=id,subject,bodyPreview,start,end,location,webLink,isAllDay" +
            "&$orderby=start/dateTime" +
            "&$top=100";

        var results = new List<ListedCalendarEvent>();
        while (!string.IsNullOrWhiteSpace(url) && results.Count < 500)
        {
            using var res = await http.GetAsync(url, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException(
                    MicrosoftGraphAuth.FormatGraphError(res.StatusCode, body, "Calendars.ReadWrite"));

            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("value", out var values) && values.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in values.EnumerateArray())
                {
                    var id = item.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(id)) continue;
                    var subject = item.TryGetProperty("subject", out var subEl) ? subEl.GetString() ?? "" : "";
                    var preview = item.TryGetProperty("bodyPreview", out var prevEl) ? prevEl.GetString() ?? "" : "";
                    var webLink = item.TryGetProperty("webLink", out var linkEl) ? linkEl.GetString() : null;
                    var isAllDay = item.TryGetProperty("isAllDay", out var allEl) && allEl.ValueKind == JsonValueKind.True;
                    var location = "";
                    if (item.TryGetProperty("location", out var loc) && loc.TryGetProperty("displayName", out var locName))
                        location = locName.GetString() ?? "";

                    var starts = ParseGraphDateTime(item, "start");
                    var ends = ParseGraphDateTime(item, "end");
                    if (starts is null || ends is null) continue;

                    results.Add(new ListedCalendarEvent(
                        id,
                        subject,
                        preview,
                        starts.Value,
                        ends.Value,
                        location,
                        webLink,
                        isAllDay));
                }
            }

            url = null;
            if (doc.RootElement.TryGetProperty("@odata.nextLink", out var next)
                && next.ValueKind == JsonValueKind.String)
            {
                url = next.GetString();
            }
        }

        return results;
    }

    static DateTime? ParseGraphDateTime(JsonElement item, string propertyName)
    {
        if (!item.TryGetProperty(propertyName, out var block)) return null;
        if (!block.TryGetProperty("dateTime", out var dtEl)) return null;
        var raw = dtEl.GetString();
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (DateTime.TryParse(
                raw,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var parsed))
            return parsed;
        return null;
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
