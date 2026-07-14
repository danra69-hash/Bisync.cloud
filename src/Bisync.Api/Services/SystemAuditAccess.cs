using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class SystemAuditAccess
{
    public static bool IsAuditViewer(AppUser? user)
    {
        if (user is null || !user.Active) return false;
        var role = (user.Role ?? string.Empty).Trim();
        if (role.Contains("Super Admin", StringComparison.OrdinalIgnoreCase)
            || role.Equals("System Admin", StringComparison.OrdinalIgnoreCase)
            || role.Equals("DRA Super Admin", StringComparison.OrdinalIgnoreCase))
            return true;

        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(user.AccessJson) ? "{}" : user.AccessJson);
            if (doc.RootElement.TryGetProperty("superAdmin", out var flag)
                && flag.ValueKind == JsonValueKind.True)
                return true;
        }
        catch
        {
            // ignore malformed accessJson
        }

        return string.Equals(user.Email, SuperAdminAccess.SuperAdminEmail, StringComparison.OrdinalIgnoreCase);
    }
}
