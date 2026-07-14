namespace Bisync.Api.Models;

/// <summary>Live system audit trail row (kept for 1 year, then moved to archived table).</summary>
public class SystemAuditEvent
{
    public long Id { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    /// <summary>Wall-clock local time for the company's registered country.</summary>
    public DateTime OccurredAtLocal { get; set; }
    public string TimeZoneId { get; set; } = "UTC";
    public int Year { get; set; }
    public int Month { get; set; }
    /// <summary>Login | Logout | DbUpdate | Computation</summary>
    public string Category { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string? CompanyName { get; set; }
    public string? CountryCode { get; set; }
    public int? LocationId { get; set; }
    public string? LocationExternalId { get; set; }
    public string? LocationName { get; set; }
    /// <summary>Operational / archive / control-plane database name affected by the activity.</summary>
    public string? DatabaseBucket { get; set; }
    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public string? EntityType { get; set; }
    public string? EntityKey { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string DetailsJson { get; set; } = "{}";
}

/// <summary>Archived audit trail (&gt; 1 year old). Same shape as live events.</summary>
public class ArchivedSystemAuditEvent
{
    public long Id { get; set; }
    public long OriginalId { get; set; }
    public DateTime OccurredAtUtc { get; set; }
    public DateTime OccurredAtLocal { get; set; }
    public string TimeZoneId { get; set; } = "UTC";
    public int Year { get; set; }
    public int Month { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public int? CompanyId { get; set; }
    public string? CompanyName { get; set; }
    public string? CountryCode { get; set; }
    public int? LocationId { get; set; }
    public string? LocationExternalId { get; set; }
    public string? LocationName { get; set; }
    public string? DatabaseBucket { get; set; }
    public int? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public string? EntityType { get; set; }
    public string? EntityKey { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string DetailsJson { get; set; } = "{}";
    public DateTime ArchivedAtUtc { get; set; }
}

public static class SystemAuditCategories
{
    public const string Login = "Login";
    public const string Logout = "Logout";
    public const string DbUpdate = "DbUpdate";
    public const string Computation = "Computation";
}
