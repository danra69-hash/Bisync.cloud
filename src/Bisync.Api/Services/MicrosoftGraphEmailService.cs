using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Bisync.Api.Services;

/// <summary>
/// Send mail via Microsoft Graph (application permissions) — no Exchange SMTP AUTH required.
/// Azure app needs Application permission Mail.Send + admin consent.
/// </summary>
public static class MicrosoftGraphEmailService
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static bool LooksConfigured(string? tenantId, string? clientId, string? clientSecret) =>
        MicrosoftGraphAuth.LooksConfigured(tenantId, clientId, clientSecret);

    public static async Task SendAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string fromEmail,
        string? fromName,
        string toEmail,
        string subject,
        string plainTextBody,
        CancellationToken ct = default)
    {
        var tenant = (tenantId ?? string.Empty).Trim();
        var appId = (clientId ?? string.Empty).Trim();
        var secret = (clientSecret ?? string.Empty).Trim();
        var from = (fromEmail ?? string.Empty).Trim();
        var to = (toEmail ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(tenant) || string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException(
                "Microsoft Graph requires Directory (tenant) ID, Application (client) ID, and Client secret.");
        if (!CompanyOutboundEmailService.IsLikelyEmail(from))
            throw new InvalidOperationException("A valid outbound email address is required.");
        if (!CompanyOutboundEmailService.IsLikelyEmail(to))
            throw new InvalidOperationException("A valid recipient email is required.");

        var token = await MicrosoftGraphAuth.AcquireTokenAsync(tenant, appId, secret, ct);
        await SendMailAsync(token, from, fromName, to, subject, plainTextBody, ct);
    }

    public static async Task SendTestAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        string fromEmail,
        string? fromName,
        string toEmail,
        string companyName,
        CancellationToken ct = default)
    {
        var name = string.IsNullOrWhiteSpace(companyName) ? "your company" : companyName.Trim();
        await SendAsync(
            tenantId,
            clientId,
            clientSecret,
            fromEmail,
            fromName,
            toEmail,
            subject: $"Bisync.cloud outbound email test — {name}",
            plainTextBody:
                $"This is a test message from Bisync.cloud for {name}, sent via Microsoft Graph.\n\n" +
                "If you received this, outbound email is configured correctly (no SMTP AUTH required).\n\n" +
                $"Sent at {DateTime.UtcNow:u} UTC.",
            ct);
    }

    static async Task SendMailAsync(
        string accessToken,
        string fromEmail,
        string? fromName,
        string toEmail,
        string subject,
        string plainTextBody,
        CancellationToken ct)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var payload = new
        {
            message = new
            {
                subject,
                body = new
                {
                    contentType = "Text",
                    content = plainTextBody,
                },
                toRecipients = new[]
                {
                    new { emailAddress = new { address = toEmail } },
                },
                from = new
                {
                    emailAddress = new
                    {
                        address = fromEmail,
                        name = string.IsNullOrWhiteSpace(fromName) ? fromEmail : fromName.Trim(),
                    },
                },
            },
            saveToSentItems = true,
        };

        var json = JsonSerializer.Serialize(payload, JsonOptions);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        // Send as the mailbox user (application Mail.Send).
        var userPath = Uri.EscapeDataString(fromEmail);
        HttpResponseMessage res;
        try
        {
            res = await http.PostAsync(
                $"https://graph.microsoft.com/v1.0/users/{userPath}/sendMail",
                content,
                ct);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Could not reach Microsoft Graph: {ex.Message}", ex);
        }

        if (res.IsSuccessStatusCode || res.StatusCode == System.Net.HttpStatusCode.Accepted)
            return;

        var body = await res.Content.ReadAsStringAsync(ct);
        throw new InvalidOperationException(
            MicrosoftGraphAuth.FormatGraphError(res.StatusCode, body, "Mail.Send"));
    }
}
