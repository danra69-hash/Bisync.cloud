namespace Bisync.Api.Services;

/// <summary>
/// Hard allowlist for Dev Console Team (control panel) create/edit access.
/// No other Dev Console operator may manage team members.
/// </summary>
public static class DevConsoleControlPanelAccess
{
    public static readonly string[] AllowedEmails =
    [
        "dra@cubevalue.com",
        "james@cubevalue.com",
        "james@pasar.ai",
    ];

    public static bool CanManageTeam(string? email)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Length == 0) return false;
        return AllowedEmails.Any(a => string.Equals(a, normalized, StringComparison.OrdinalIgnoreCase));
    }
}
