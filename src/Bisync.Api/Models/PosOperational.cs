namespace Bisync.Api.Models;

/// <summary>Open / unsettled POS check (blocks EOD until cleared).</summary>
public class PosOpenCheck
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public int CheckNumber { get; set; }
    public int Cover { get; set; }
    public string Dining { get; set; } = "dine-in";
    public string TableLabel { get; set; } = string.Empty;
    public string TakeoutCallLabel { get; set; } = string.Empty;
    public string LinesJson { get; set; } = "[]";
    public string ChargesJson { get; set; } = "{}";
    public string SplitSessionJson { get; set; } = string.Empty;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool Active { get; set; } = true;
}

/// <summary>Closed / paid POS check row for EOD sales detail.</summary>
public class PosClosedCheck
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public int CheckNumber { get; set; }
    public string CheckLabel { get; set; } = string.Empty;
    public int Covers { get; set; }
    public long DiscountCents { get; set; }
    public long TaxCents { get; set; }
    public long VoidCents { get; set; }
    public long GrossCents { get; set; }
    public DateTimeOffset PaidAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Payment tender against a check (cash, card, QR, non-revenue).</summary>
public class PosPayment
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public int CheckNumber { get; set; }
    public DateTimeOffset PaidAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>credit-card | qr-pay | cash | entertainment | duty-meals | compliment</summary>
    public string Method { get; set; } = string.Empty;
    public long AmountCents { get; set; }
    /// <summary>Non-revenue purpose label when applicable.</summary>
    public string Purpose { get; set; } = string.Empty;
    public string CardIin { get; set; } = string.Empty;
    public string CardIssuer { get; set; } = string.Empty;
    public string CardLast4 { get; set; } = string.Empty;
    public string CardMii { get; set; } = string.Empty;
    public string CardMiiLabel { get; set; } = string.Empty;
}

/// <summary>Voided line item for EOD voids reconciliation.</summary>
public class PosVoid
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public int CheckNumber { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public long AmountCents { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTimeOffset VoidedAt { get; set; } = DateTimeOffset.UtcNow;
    /// <summary>Staff who authorized the void.</summary>
    public string AuthorizedBy { get; set; } = string.Empty;
}

/// <summary>Canceled fired line (under 5 minutes) — reference only, no stock depletion.</summary>
public class PosCancel
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public int CheckNumber { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public long AmountCents { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string CanceledBy { get; set; } = string.Empty;
    public DateTimeOffset CanceledAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>End-of-day confirmation checklist per location / business date.</summary>
public class PosEodSession
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public DateOnly BusinessDate { get; set; }
    public bool CashConfirmed { get; set; }
    public long CashExpectedCents { get; set; }
    public long CashCountedCents { get; set; }
    public string CashCountQtysJson { get; set; } = "{}";
    public bool CreditQrConfirmed { get; set; }
    public bool NonRevenueConfirmed { get; set; }
    public bool VoidsConfirmed { get; set; }
    public bool DiscountConfirmed { get; set; }
    public bool DayClosed { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
