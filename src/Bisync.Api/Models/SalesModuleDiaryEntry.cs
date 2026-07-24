namespace Bisync.Api.Models;

/// <summary>Sales Diary log entry for a Hunter (Sales Team member).</summary>
public class SalesModuleDiaryEntry
{
    public int Id { get; set; }

    /// <summary>Hunter who owns the diary entry.</summary>
    public int SalesTeamMemberId { get; set; }

    /// <summary>StatusChange or SalesCall.</summary>
    public string ActivityType { get; set; } = string.Empty;

    /// <summary>Tagged company when required; null for Cold Call / Email Blast.</summary>
    public int? SalesModuleCompanyId { get; set; }

    /// <summary>Resolved company display name (tagged company or free-text for Cold Call).</summary>
    public string CompanyName { get; set; } = string.Empty;

    /// <summary>Free-text brand for Cold Call (optional elsewhere).</summary>
    public string BrandName { get; set; } = string.Empty;

    /// <summary>Location visited — required for Cold Call.</summary>
    public string LocationVisited { get; set; } = string.Empty;

    /// <summary>Emails sent — required for Email Blast.</summary>
    public int? EmailsSent { get; set; }

    /// <summary>JSON array of status labels for Status Change activity.</summary>
    public string StatusesJson { get; set; } = "[]";

    /// <summary>Contact type for Sales Call activity.</summary>
    public string ContactType { get; set; } = string.Empty;

    public DateTime ContactDate { get; set; }

    /// <summary>JSON array of { name, position } contacts.</summary>
    public string ContactsJson { get; set; } = "[]";

    /// <summary>Required free-text comment when logging a Status Change.</summary>
    public string Comment { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedByEmail { get; set; } = string.Empty;
}
