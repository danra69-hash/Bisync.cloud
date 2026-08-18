namespace Bisync.Api.Models;

/// <summary>Chart-of-accounts row for Bisync Books (Phase 0+). Company-scoped.</summary>
public class GlAccount
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>asset | liability | equity | income | expense</summary>
    public string AccountType { get; set; } = "expense";
    /// <summary>D or C — normal balance</summary>
    public string NormalBalance { get; set; } = "D";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Fiscal period with soft / hard lock tiers (Odoo-shaped).</summary>
public class GlFiscalPeriod
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int Year { get; set; }
    public int PeriodNo { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    /// <summary>future | open | closing | closed | hard_closed</summary>
    public string Status { get; set; } = "open";
}

public class GlJournal
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>primary | tax | ifrs | local_gaap | consolidation</summary>
    public string LedgerKind { get; set; } = "primary";
    /// <summary>GEN | PAYROLL | PURCH | SALES | BANK | ELIM</summary>
    public string JournalType { get; set; } = "GEN";
    public string DocSeries { get; set; } = "GEN";
    public int FiscalYear { get; set; }
    public string? DocNumber { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly DocumentDate { get; set; }
    /// <summary>Null = draft; set = sealed (immutable).</summary>
    public DateTime? PostedAt { get; set; }
    public int PeriodId { get; set; }
    public GlFiscalPeriod? Period { get; set; }
    public string SourceModule { get; set; } = "MANUAL";
    public string? SourceDocKey { get; set; }
    public int? ReversesJournalId { get; set; }
    public string? IdempotencyKey { get; set; }
    public string Narration { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<GlJournalLine> Lines { get; set; } = [];
}

public class GlJournalLine
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int JournalId { get; set; }
    public GlJournal? Journal { get; set; }
    public int LineNo { get; set; }
    public int AccountId { get; set; }
    public GlAccount? Account { get; set; }
    /// <summary>D or C</summary>
    public string Direction { get; set; } = "D";
    /// <summary>Transaction (document) currency ISO 4217.</summary>
    public string Currency { get; set; } = "MYR";
    public long AmountMinor { get; set; }
    /// <summary>Company functional currency.</summary>
    public string FuncCurrency { get; set; } = "MYR";
    public long FuncAmountMinor { get; set; }
    /// <summary>Functional units per 1 transaction-currency unit (e.g. MYR per 1 USD).</summary>
    public decimal? FxRate { get; set; }
    public DateOnly? FxRateDate { get; set; }
    /// <summary>spot | manual | average | closing | historical</summary>
    public string? FxRateType { get; set; }
    public string Narration { get; set; } = "";
    public DateOnly EffectiveDate { get; set; }
    public int PeriodId { get; set; }
    /// <summary>Ops location external id (hospitality dimension).</summary>
    public string? LocationExternalId { get; set; }
    /// <summary>HR department id (optional cost centre dimension).</summary>
    public int? DepartmentId { get; set; }
    /// <summary>Intercompany partner company id (consolidation).</summary>
    public int? PartnerCompanyId { get; set; }
}

public class GlPeriodBalance
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AccountId { get; set; }
    public int PeriodId { get; set; }
    public string Currency { get; set; } = "MYR";
    public long OpeningDrMinor { get; set; }
    public long OpeningCrMinor { get; set; }
    public long PeriodDrMinor { get; set; }
    public long PeriodCrMinor { get; set; }
    public bool IsFrozen { get; set; }
    public DateTime? RecomputeAfter { get; set; }
}

public class GlDocCounter
{
    public int CompanyId { get; set; }
    public string Series { get; set; } = "";
    public int FiscalYear { get; set; }
    public long NextValue { get; set; } = 1;
}

/// <summary>Transactional outbox for side effects of postings / ops bridges.</summary>
public class GlOutboxMessage
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string EventType { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public string? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}
