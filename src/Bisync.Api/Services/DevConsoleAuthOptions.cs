namespace Bisync.Api.Services;

public class DevConsoleAuthOptions
{
    public const string SectionName = "DevConsole";

    /// <summary>Google OAuth Web client ID (GIS / ID token aud).</summary>
    public string GoogleClientId { get; set; } = string.Empty;

    public string[] AllowedEmailDomains { get; set; } = ["cubevalue.com", "pasar.ai"];

    public string RootEmail { get; set; } = SuperAdminAccess.SuperAdminEmail;

    public int SessionHours { get; set; } = 12;

    public int PasswordTicketMinutes { get; set; } = 10;

    /// <summary>
    /// When true and GoogleClientId is empty, password-only login is allowed in Development
    /// or when DEV_CONSOLE_ENABLED=true (e.g. cloud deploy without OAuth yet).
    /// </summary>
    public bool AllowPasswordOnlyWhenGoogleUnconfigured { get; set; } = true;
}
