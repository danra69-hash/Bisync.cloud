namespace Bisync.Api.Models;

/// <summary>Company localisation pack binding (Malaysia active first).</summary>
public class GlLocalisationPack
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>my | sg | au | id | th | us</summary>
    public string PackId { get; set; } = "my";
    /// <summary>draft | active | superseded | reference</summary>
    public string Status { get; set; } = "active";
    public string Version { get; set; } = "1.0";
    public DateTime ActivatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>FX rate store — functional units per 1 quote unit (IAS 21 direction explicit).</summary>
public class GlFxRate
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string FromCurrency { get; set; } = "USD";
    public string ToCurrency { get; set; } = "MYR";
    public DateOnly RateDate { get; set; }
    public decimal Rate { get; set; }
    /// <summary>spot | manual | average | closing | historical</summary>
    public string RateType { get; set; } = "manual";
    public string Source { get; set; } = "manual";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Portable account role → tenant COA mapping (SLA indirection).</summary>
public class GlAccountRole
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string RoleCode { get; set; } = "";
    public int? AccountId { get; set; }
    public string? Notes { get; set; }
}

public class GlTaxCode
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal RatePercent { get; set; }
    /// <summary>none | full | partial — MY SST = none</summary>
    public string Recoverability { get; set; } = "none";
    public string PackId { get; set; } = "my";
    public bool Active { get; set; } = true;
}

public class GlSlaRuleSet
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string EventType { get; set; } = "";
    public string PackId { get; set; } = "my";
    public int Version { get; set; } = 1;
    public DateOnly EffectiveFrom { get; set; }
    /// <summary>draft | active | superseded</summary>
    public string Status { get; set; } = "active";
    public string Name { get; set; } = "";
    public List<GlSlaRuleLine> Lines { get; set; } = [];
}

public class GlSlaRuleLine
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int RuleSetId { get; set; }
    public GlSlaRuleSet? RuleSet { get; set; }
    public int Seq { get; set; }
    public string ConditionJson { get; set; } = "{}";
    public string AccountRole { get; set; } = "";
    public string Direction { get; set; } = "D";
    /// <summary>net | tax | gross | withholding | rounding</summary>
    public string AmountSource { get; set; } = "net";
}

/// <summary>AR/AP open item (invoice, bill, credit, payment, adjustment).</summary>
public class GlOpenItem
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>ar | ap</summary>
    public string Subledger { get; set; } = "ap";
    /// <summary>invoice | bill | credit_note | debit_note | payment | adjustment</summary>
    public string Kind { get; set; } = "bill";
    public string CounterpartyName { get; set; } = "";
    public string? CounterpartyRef { get; set; }
    public string Currency { get; set; } = "MYR";
    public DateOnly IssueDate { get; set; }
    public DateOnly DueDate { get; set; }
    public long GrossMinor { get; set; }
    public long OpenMinor { get; set; }
    public string InternalDocumentNo { get; set; } = "";
    public string? StatutoryDocumentNo { get; set; }
    public int? JournalId { get; set; }
    /// <summary>open | partial | settled | void</summary>
    public string Status { get; set; } = "open";
    public string? TaxCode { get; set; }
    public long TaxMinor { get; set; }
    public string Narration { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Bi-temporal application between open items — never deleted; reverse via new row.</summary>
public class GlItemApplication
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int AppliedFromId { get; set; }
    public int AppliedToId { get; set; }
    public long AmountMinor { get; set; }
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    public DateOnly EffectiveDate { get; set; }
    public int? ReversalOfId { get; set; }
    public string CreatedBy { get; set; } = "";
}

/// <summary>Bank statement header for reconciliation (MY: DuitNow / FPX / file import).</summary>
public class GlBankStatement
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string AccountLabel { get; set; } = "Operating account";
    public string Currency { get; set; } = "MYR";
    public DateOnly StatementDate { get; set; }
    public string Source { get; set; } = "manual";
    public string Status { get; set; } = "open";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<GlBankStatementLine> Lines { get; set; } = [];
}

public class GlBankStatementLine
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int StatementId { get; set; }
    public GlBankStatement? Statement { get; set; }
    public int LineNo { get; set; }
    public DateOnly ValueDate { get; set; }
    public string Narrative { get; set; } = "";
    public long AmountMinor { get; set; }
    public string Currency { get; set; } = "MYR";
    public int? MatchGroupId { get; set; }
    public string? MatchRule { get; set; }
}

public class GlBankMatchGroup
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public DateTime MatchedAt { get; set; } = DateTime.UtcNow;
    public string Cardinality { get; set; } = "1:1";
    public string CreatedBy { get; set; } = "";
    public string Notes { get; set; } = "";
}
