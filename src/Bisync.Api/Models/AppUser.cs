namespace Bisync.Api.Models;

public class AppUser
{
    public int Id { get; set; }
    public int? EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public string AccessJson { get; set; } = """{"modules":[]}""";
    public int? CompanyId { get; set; }
    public Company? Company { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public string? PasswordHash { get; set; }
    public string? ActivationToken { get; set; }
    public DateTime? ActivationTokenExpiresAt { get; set; }
    /// <summary>UI locale preference (en, ms, id, …).</summary>
    public string PreferredLanguage { get; set; } = "en";
    /// <summary>ISO country code used for the phone dial prefix at registration.</summary>
    public string? PhoneCountryCode { get; set; }
    /// <summary>EULA version accepted at registration (e.g. 2026-07-24).</summary>
    public string? EulaVersion { get; set; }
    /// <summary>UTC timestamp when the user accepted the EULA.</summary>
    public DateTime? AcceptedEulaAt { get; set; }
}
