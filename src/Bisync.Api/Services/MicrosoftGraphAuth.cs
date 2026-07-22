using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Bisync.Api.Services;

/// <summary>Shared Microsoft Graph client-credentials token helper.</summary>
public static class MicrosoftGraphAuth
{
    public static bool LooksConfigured(string? tenantId, string? clientId, string? clientSecret) =>
        !string.IsNullOrWhiteSpace(tenantId)
        && !string.IsNullOrWhiteSpace(clientId)
        && !string.IsNullOrWhiteSpace(clientSecret);

    public static async Task<string> AcquireTokenAsync(
        string tenantId,
        string clientId,
        string clientSecret,
        CancellationToken ct = default)
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

    public static string FormatTokenError(System.Net.HttpStatusCode status, string body)
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

    public static string FormatGraphError(System.Net.HttpStatusCode status, string body, string permissionHint)
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
                    return $"Microsoft Graph: access denied. In Azure, add Application permission {permissionHint} and Grant admin consent.";
                }
                if (string.Equals(code, "ErrorInvalidUser", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(code, "Request_ResourceNotFound", StringComparison.OrdinalIgnoreCase)
                    || (message?.Contains("does not exist", StringComparison.OrdinalIgnoreCase) ?? false))
                {
                    return "Microsoft Graph: mailbox not found. Use the exact Microsoft 365 user principal / email address.";
                }
                if (!string.IsNullOrWhiteSpace(message))
                    return $"Microsoft Graph failed ({code ?? status.ToString()}): {Trim(message, 220)}";
            }
        }
        catch
        {
            // fall through
        }

        return $"Microsoft Graph failed ({(int)status}). Ensure {permissionHint} application permission has admin consent.";
    }

    public static string Trim(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";
}
