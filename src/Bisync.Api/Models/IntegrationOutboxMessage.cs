namespace Bisync.Api.Models;

/// <summary>
/// Durable integration outbox for cross-module / accounting / webhook delivery.
/// Required before AWS 5k scale so POS, COGS, payroll, and accounting do not dual-write synchronously.
/// </summary>
public class IntegrationOutboxMessage
{
    public long Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>Optional location scope (external id).</summary>
    public string LocationExternalId { get; set; } = string.Empty;
    /// <summary>e.g. pos.check_closed, inventory.cogs_posted, accounting.journal_requested</summary>
    public string EventType { get; set; } = string.Empty;
    /// <summary>JSON payload (cloud-agnostic contract).</summary>
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "pending"; // pending | processing | done | dead
    public int AttemptCount { get; set; }
    public string LastError { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AvailableAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
