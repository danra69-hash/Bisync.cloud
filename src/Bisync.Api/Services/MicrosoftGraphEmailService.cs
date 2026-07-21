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
        !string.IsNullOrWhiteSpace(tenantId)
        && !string.IsNullOrWhiteSpace(clientId)
        && !string.IsNullOrWhiteSpace(clientSecret);

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

        var token = await AcquireTokenAsync(tenant, appId, secret, ct);
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

    static async Task<string> AcquireTokenAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        CancellationToken ct)
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["scope"] = "https://graph.microsoft.com/.default",
        });

        HttpResponseMessage res;
        try
        {
            res = await http.PostAsync(
                $"https://login.microsoftonline.com/{Uri.EscapeDataString(tenantId)}/oauth2/v2.0/token",
                content,
                ct);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Could not reach Microsoft login: {ex.Message}", ex);
        }

        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(FormatTokenError(res.StatusCode, body));

        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("access_token", out var tokenEl))
            throw new InvalidOperationException("Microsoft login returned no access_token.");
        var token = tokenEl.GetString();
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Microsoft login returned an empty access_token.");
        return token;
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
        throw new InvalidOperationException(FormatGraphError(res.StatusCode, body));
    }

    static string FormatTokenError(System.Net.HttpStatusCode status, string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var error = doc.RootElement.TryGetProperty("error", out var e) ? e.GetString() : null;
            var desc = doc.RootElement.TryGetProperty("error_description", out var d) ? d.GetString() : null;
            if (!string.IsNullOrWhiteSpace(desc))
            {
                if (desc.Contains("AADSTS7000215", StringComparison.OrdinalIgnoreCase)
                    || desc.Contains("Invalid client secret", StringComparison.OrdinalIgnoreCase))
                    return "Microsoft Graph: invalid client secret. Create a new secret in Azure App registrations.";
                if (desc.Contains("AADSTS700016", StringComparison.OrdinalIgnoreCase)
                    || desc.Contains("Application with identifier", StringComparison.OrdinalIgnoreCase))
                    return "Microsoft Graph: Application (client) ID not found in this tenant. Check Directory ID and Client ID.";
                if (desc.Contains("AADSTS90002", StringComparison.OrdinalIgnoreCase))
                    return "Microsoft Graph: Directory (tenant) ID is invalid.";
                return $"Microsoft Graph login failed: {Trim(desc, 220)}";
            }
            if (!string.IsNullOrWhiteSpace(error))
                return $"Microsoft Graph login failed ({status}): {error}";
        }
        catch
        {
            // fall through
        }

        return $"Microsoft Graph login failed ({(int)status}). Check Tenant ID, Client ID, and Client secret.";
    }

    static string FormatGraphError(System.Net.HttpStatusCode status, string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err))
            {
                var code = err.TryGetProperty("code", out var c) ? c.GetString() : null;
                var message = err.TryGetProperty("message", out var m) ? m.GetString() : null;
                if (string.Equals(code, "ErrorAccessDenied", StringComparison.OrdinalIgnoreCase)
                    || (message?.Contains("Access is denied", StringComparison.OrdinalIgnoreCase) ?? false))
                {
                    return "Microsoft Graph: access denied. In Azure, add Application permission Mail.Send and click Grant admin consent.";
                }
                if (string.Equals(code, "ErrorInvalidUser", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(code, "Request_ResourceNotFound", StringComparison.OrdinalIgnoreCase)
                    || (message?.Contains("does not exist", StringComparison.OrdinalIgnoreCase) ?? false))
                {
                    return "Microsoft Graph: mailbox not found. Use the exact Microsoft 365 user principal / email address.";
                }
                if (!string.IsNullOrWhiteSpace(message))
                    return $"Microsoft Graph send failed ({code ?? status.ToString()}): {Trim(message, 220)}";
            }
        }
        catch
        {
            // fall through
        }

        return $"Microsoft Graph send failed ({(int)status}). Ensure Mail.Send application permission has admin consent.";
    }

    static string Trim(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";
}
