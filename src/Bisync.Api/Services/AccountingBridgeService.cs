using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Services;

/// <summary>
/// Bridges live Bisync modules (payroll, purchase consolidate / inventory affirmation)
/// into Books: outbox events + sealed journals when amounts are known.
/// </summary>
public sealed class AccountingBridgeService(
    BisyncDbContext db,
    LedgerPostingService ledger,
    MalaysiaAccountingPackService malaysiaPack,
    ILogger<AccountingBridgeService> logger)
{
    public async Task OnPayrollProcessedAsync(PayrollRun run, CancellationToken ct = default)
    {
        if (run.CompanyId <= 0) return;

        var idempotency = $"hrm.payroll_posted:{run.CompanyId}:{run.Year}:{run.Month}";
        try
        {
            await ledger.EnqueueOutboxAsync(
                run.CompanyId,
                "hrm.payroll_posted",
                new
                {
                    payrollRunId = run.Id,
                    run.CompanyId,
                    run.Year,
                    run.Month,
                    run.TotalGross,
                    run.TotalPayout,
                    run.EmployeeCount,
                    run.CountryCode,
                },
                idempotency,
                ct);

            var company = await db.Companies.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == run.CompanyId, ct);

            var epfEe = run.Lines.Sum(l => l.EpfEmployeeAmount);
            var epfEr = run.Lines.Sum(l => l.EpfEmployerAmount);
            var socsoEe = run.Lines.Sum(l => l.SocsoEmployeeAmount);
            var socsoEr = run.Lines.Sum(l => l.SocsoEmployerAmount);
            var tax = run.Lines.Sum(l => l.IncomeTaxAmount);
            var gross = run.TotalGross;
            var payout = run.TotalPayout;
            var employerStatutory = epfEr + socsoEr;

            // Balanced: Dr salaries (gross) + Dr employer statutory
            //          Cr net pay + Cr EPF (ee+er) + Cr SOCSO (ee+er) + Cr tax
            var lines = new List<(string, string, decimal, string)>
            {
                ("5100", "D", gross, $"Payroll {run.PeriodLabel} gross"),
            };
            if (employerStatutory > 0)
                lines.Add(("5110", "D", employerStatutory, $"Payroll {run.PeriodLabel} employer statutory"));
            if (payout > 0)
                lines.Add(("2100", "C", payout, $"Payroll {run.PeriodLabel} net pay"));
            if (epfEe + epfEr > 0)
                lines.Add(("2110", "C", epfEe + epfEr, $"Payroll {run.PeriodLabel} EPF"));
            if (socsoEe + socsoEr > 0)
                lines.Add(("2120", "C", socsoEe + socsoEr, $"Payroll {run.PeriodLabel} SOCSO"));
            if (tax > 0)
                lines.Add(("2130", "C", tax, $"Payroll {run.PeriodLabel} income tax"));

            // Plug residual rounding into salaries so the entry always balances.
            var debit = lines.Where(l => l.Item2 == "D").Sum(l => l.Item3);
            var credit = lines.Where(l => l.Item2 == "C").Sum(l => l.Item3);
            var residual = debit - credit;
            if (Math.Abs(residual) >= 0.01m)
            {
                if (residual > 0)
                    lines.Add(("2100", "C", residual, "Payroll rounding"));
                else
                    lines.Add(("5100", "D", -residual, "Payroll rounding"));
            }

            await ledger.PostAsync(
                run.CompanyId,
                company?.CountryCode ?? run.CountryCode,
                journalType: "PAYROLL",
                docSeries: "PAY",
                effectiveDate: run.PeriodEnd,
                documentDate: DateOnly.FromDateTime(run.ProcessedAt),
                sourceModule: "HRM",
                sourceDocKey: $"payroll-run:{run.Id}",
                narration: $"Payroll {run.PeriodLabel}",
                createdBy: "payroll-process",
                idempotencyKey: idempotency,
                lines,
                ct);

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Never fail payroll because Books posting failed — ops payroll is source of truth.
            logger.LogError(ex, "Accounting bridge failed for payroll run {RunId} company {CompanyId}", run.Id, run.CompanyId);
            try
            {
                await ledger.EnqueueOutboxAsync(
                    run.CompanyId,
                    "hrm.payroll_posted.bridge_error",
                    new { payrollRunId = run.Id, error = ex.Message },
                    $"{idempotency}:error:{DateTime.UtcNow:yyyyMMddHHmmss}",
                    ct);
                await db.SaveChangesAsync(ct);
            }
            catch (Exception enqueueEx)
            {
                logger.LogError(enqueueEx, "Failed to enqueue payroll bridge error outbox");
            }
        }
    }

    public async Task OnPurchaseAffirmedAsync(PurchaseOrder order, CancellationToken ct = default)
    {
        var companyId = order.CompanyId ?? 0;
        if (companyId <= 0) return;

        var stamp = order.ReconciledAt?.ToString("O") ?? DateTime.UtcNow.ToString("O");
        var idempotency = $"ops.purchase_affirmed:{order.Id}:{stamp}";

        try
        {
            var inventoryAmount = order.Items
                .Where(i => !i.IsReturnableDeposit && !string.IsNullOrWhiteSpace(i.ComponentId))
                .Sum(i =>
                {
                    var qty = i.ReconciledQuantity ?? i.DeliveredQuantity;
                    var price = i.ReconciledUnitPrice ?? i.UnitPrice;
                    return qty * price;
                });

            await ledger.EnqueueOutboxAsync(
                companyId,
                "ops.purchase_affirmed",
                new
                {
                    purchaseOrderId = order.Id,
                    companyId,
                    order.PoNumber,
                    inventoryAmount,
                    order.Status,
                    order.ReconciledAt,
                },
                idempotency,
                ct);

            if (inventoryAmount < 0.01m)
            {
                await db.SaveChangesAsync(ct);
                return;
            }

            var company = await db.Companies.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == companyId, ct);
            var effective = DateOnly.FromDateTime(order.ReconciledAt ?? DateTime.UtcNow);
            await malaysiaPack.EnsureCoreRolesAndSlaAsync(companyId, ct);
            var inventoryCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "inventory_default", "1400", ct);
            var apCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "ap_control", "2010", ct);

            await ledger.PostAsync(
                companyId,
                company?.CountryCode,
                journalType: "PURCH",
                docSeries: "PUR",
                effectiveDate: effective,
                documentDate: effective,
                sourceModule: "RMS",
                sourceDocKey: $"purchase-order:{order.Id}",
                narration: $"Purchase affirmed PO {order.PoNumber}",
                createdBy: "po-reconcile",
                idempotencyKey: idempotency,
                lines:
                [
                    (inventoryCode, "D", inventoryAmount, $"Inventory from PO {order.PoNumber}"),
                    (apCode, "C", inventoryAmount, $"AP from PO {order.PoNumber}"),
                ],
                ct);

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Accounting bridge failed for PO {PoId} company {CompanyId}", order.Id, companyId);
            try
            {
                await ledger.EnqueueOutboxAsync(
                    companyId,
                    "ops.purchase_affirmed.bridge_error",
                    new { purchaseOrderId = order.Id, error = ex.Message },
                    $"{idempotency}:error:{DateTime.UtcNow:yyyyMMddHHmmss}",
                    ct);
                await db.SaveChangesAsync(ct);
            }
            catch (Exception enqueueEx)
            {
                logger.LogError(enqueueEx, "Failed to enqueue purchase bridge error outbox");
            }
        }
    }

    /// <summary>
    /// Posts a balanced POS day-settlement journal for one location + business date.
    /// Idempotent on pos.settlement:{company}:{location}:{date}.
    /// </summary>
    public async Task<object?> OnPosDaySettlementAsync(
        int companyId,
        string locationExternalId,
        DateOnly businessDate,
        CancellationToken ct = default)
    {
        if (companyId <= 0) return null;
        locationExternalId = (locationExternalId ?? "").Trim();
        if (locationExternalId.Length == 0) return null;

        var idempotency = $"pos.settlement:{companyId}:{locationExternalId}:{businessDate:yyyy-MM-dd}";
        try
        {
            var start = new DateTimeOffset(businessDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var end = start.AddDays(1);

            var closed = await db.PosClosedChecks.AsNoTracking()
                .Where(x => x.CompanyId == companyId
                    && x.LocationExternalId == locationExternalId
                    && x.PaidAt >= start
                    && x.PaidAt < end)
                .ToListAsync(ct);
            var payments = await db.PosPayments.AsNoTracking()
                .Where(x => x.CompanyId == companyId
                    && x.LocationExternalId == locationExternalId
                    && x.PaidAt >= start
                    && x.PaidAt < end)
                .ToListAsync(ct);

            if (closed.Count == 0 && payments.Count == 0)
            {
                await ledger.EnqueueOutboxAsync(
                    companyId,
                    "pos.settlement.posted",
                    new { companyId, locationExternalId, businessDate, empty = true },
                    idempotency,
                    ct);
                await ledger.MarkOutboxProcessedAsync(companyId, idempotency, ct);
                await db.SaveChangesAsync(ct);
                return new { skipped = true, reason = "No closed checks for the day." };
            }

            await ledger.EnqueueOutboxAsync(
                companyId,
                "pos.settlement.posted",
                new
                {
                    companyId,
                    locationExternalId,
                    businessDate,
                    closedChecks = closed.Count,
                    grossCents = closed.Sum(c => c.GrossCents),
                    taxCents = closed.Sum(c => c.TaxCents),
                    discountCents = closed.Sum(c => c.DiscountCents),
                },
                idempotency,
                ct);

            var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
            await malaysiaPack.EnsureCoreRolesAndSlaAsync(companyId, ct);

            var cashCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "pos_cash", "1000", ct);
            var cardCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "pos_card", "1000", ct);
            var nonRevCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "pos_non_revenue", "5800", ct);
            var revenueCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "revenue_default", "4000", ct);
            var taxCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "tax_output_payable", "2210", ct);
            var discountCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "sales_discount", "4100", ct);

            static bool IsCash(string m) => string.Equals(m, "cash", StringComparison.OrdinalIgnoreCase);
            static bool IsNonRev(string m) =>
                m.Equals("entertainment", StringComparison.OrdinalIgnoreCase)
                || m.Equals("duty-meals", StringComparison.OrdinalIgnoreCase)
                || m.Equals("compliment", StringComparison.OrdinalIgnoreCase)
                || m.Equals("duty_meals", StringComparison.OrdinalIgnoreCase);

            long cashCents = 0, cardCents = 0, nonRevCents = 0;
            foreach (var p in payments)
            {
                if (IsCash(p.Method)) cashCents += p.AmountCents;
                else if (IsNonRev(p.Method)) nonRevCents += p.AmountCents;
                else cardCents += p.AmountCents;
            }

            var grossCents = closed.Sum(c => c.GrossCents);
            var taxCents = closed.Sum(c => c.TaxCents);
            var discountCents = closed.Sum(c => c.DiscountCents);
            // Net sales credited to revenue = gross - discount - tax (hospitality EOD convention).
            var revenueCents = Math.Max(0, grossCents - discountCents - taxCents);

            decimal Maj(long cents) => Math.Round(cents / 100m, 2, MidpointRounding.AwayFromZero);

            var lines = new List<(string, string, decimal, string)>();
            if (cashCents > 0) lines.Add((cashCode, "D", Maj(cashCents), "POS cash tenders"));
            if (cardCents > 0) lines.Add((cardCode, "D", Maj(cardCents), "POS card/QR tenders"));
            if (nonRevCents > 0) lines.Add((nonRevCode, "D", Maj(nonRevCents), "POS non-revenue"));
            if (revenueCents > 0) lines.Add((revenueCode, "C", Maj(revenueCents), "POS net sales"));
            if (taxCents > 0) lines.Add((taxCode, "C", Maj(taxCents), "POS output tax"));
            if (discountCents > 0) lines.Add((discountCode, "D", Maj(discountCents), "POS discounts"));

            // Plug residual into rounding so the day always posts.
            var debit = lines.Where(l => l.Item2 == "D").Sum(l => l.Item3);
            var credit = lines.Where(l => l.Item2 == "C").Sum(l => l.Item3);
            var residual = debit - credit;
            if (Math.Abs(residual) >= 0.01m)
            {
                var roundCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "rounding_difference", "5900", ct);
                if (residual > 0) lines.Add((roundCode, "C", residual, "POS settlement rounding"));
                else lines.Add((roundCode, "D", -residual, "POS settlement rounding"));
            }

            if (lines.Count < 2)
            {
                await ledger.MarkOutboxProcessedAsync(companyId, idempotency, ct);
                await db.SaveChangesAsync(ct);
                return new { skipped = true, reason = "Settlement amounts too small to post." };
            }

            var journal = await ledger.PostAsync(
                companyId,
                company?.CountryCode,
                journalType: "POS",
                docSeries: "POS",
                effectiveDate: businessDate,
                documentDate: businessDate,
                sourceModule: "POS",
                sourceDocKey: $"pos-day:{locationExternalId}:{businessDate:yyyy-MM-dd}",
                narration: $"POS settlement {locationExternalId} {businessDate:yyyy-MM-dd}",
                createdBy: "pos-eod",
                idempotencyKey: idempotency,
                lines,
                ct);

            await db.SaveChangesAsync(ct);
            return new
            {
                journalId = journal.Id,
                journal.DocNumber,
                locationExternalId,
                businessDate,
                closedChecks = closed.Count,
                cash = Maj(cashCents),
                card = Maj(cardCents),
                nonRevenue = Maj(nonRevCents),
                revenue = Maj(revenueCents),
                tax = Maj(taxCents),
                discount = Maj(discountCents),
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Accounting bridge failed for POS settlement company {CompanyId} location {Location} date {Date}",
                companyId, locationExternalId, businessDate);
            try
            {
                await ledger.EnqueueOutboxAsync(
                    companyId,
                    "pos.settlement.posted.bridge_error",
                    new { locationExternalId, businessDate, error = ex.Message },
                    $"{idempotency}:error:{DateTime.UtcNow:yyyyMMddHHmmss}",
                    ct);
                await db.SaveChangesAsync(ct);
            }
            catch (Exception enqueueEx)
            {
                logger.LogError(enqueueEx, "Failed to enqueue POS bridge error outbox");
            }
            return null;
        }
    }

    /// <summary>FIFO issue summary → Dr COGS / Cr Inventory (best-effort; never fails ops).</summary>
    public async Task OnFifoIssueAsync(
        int companyId,
        string locationExternalId,
        string componentId,
        string componentName,
        decimal quantity,
        string uom,
        decimal unitPrice,
        string referenceType,
        int referenceId,
        CancellationToken ct = default)
    {
        if (companyId <= 0 || quantity <= 0 || unitPrice < 0) return;
        if (string.Equals(referenceType, "credit_note", StringComparison.OrdinalIgnoreCase))
            return; // vendor CN has its own bridge

        var amount = Math.Round(quantity * unitPrice, 2, MidpointRounding.AwayFromZero);
        if (amount < 0.01m) return;

        var idempotency = $"ops.fifo_issue:{companyId}:{referenceType}:{referenceId}:{componentId}:{quantity:0.####}";
        try
        {
            await ledger.EnqueueOutboxAsync(
                companyId,
                "ops.fifo_issue",
                new { companyId, locationExternalId, componentId, componentName, quantity, uom, unitPrice, amount, referenceType, referenceId },
                idempotency,
                ct);

            var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
            await malaysiaPack.EnsureCoreRolesAndSlaAsync(companyId, ct);
            var cogs = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "cogs_default", "5200", ct);
            var inv = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "inventory_default", "1400", ct);
            var effective = DateOnly.FromDateTime(DateTime.UtcNow);
            await ledger.PostAsync(
                companyId,
                company?.CountryCode,
                "INV",
                "COGS",
                effective,
                effective,
                "RMS",
                $"fifo:{referenceType}:{referenceId}:{componentId}",
                $"FIFO issue {componentName} @ {locationExternalId}",
                "fifo-issue",
                idempotency,
                [
                    (cogs, "D", amount, $"COGS {componentName}"),
                    (inv, "C", amount, $"Inventory relief {componentName}"),
                ],
                ct);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "FIFO COGS bridge failed company {CompanyId} ref {Type}:{Id}", companyId, referenceType, referenceId);
        }
    }

    /// <summary>Vendor credit note confirmed → Dr AP / Cr Inventory (best-effort).</summary>
    public async Task OnVendorCreditNoteAsync(CreditNote note, CancellationToken ct = default)
    {
        var companyId = note.CompanyId ?? 0;
        if (companyId <= 0 || note.Amount < 0.01m) return;

        var idempotency = $"ops.vendor_credit_note:{companyId}:{note.Id}";
        try
        {
            await ledger.EnqueueOutboxAsync(
                companyId,
                "ops.vendor_credit_note",
                new
                {
                    creditNoteId = note.Id,
                    companyId,
                    note.PoNumber,
                    note.CreditNoteNumber,
                    note.Amount,
                    note.VendorExternalId,
                },
                idempotency,
                ct);

            var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
            await malaysiaPack.EnsureCoreRolesAndSlaAsync(companyId, ct);
            var ap = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "ap_control", "2010", ct);
            var inv = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "inventory_default", "1400", ct);
            var effective = note.CreditNoteDate;
            await ledger.PostAsync(
                companyId,
                company?.CountryCode,
                "AP",
                "APJ",
                effective,
                effective,
                "RMS",
                $"vendor-cn:{note.Id}",
                $"Vendor CN {note.CreditNoteNumber} · PO {note.PoNumber}",
                "vendor-cn",
                idempotency,
                [
                    (ap, "D", note.Amount, $"AP relief CN {note.CreditNoteNumber}"),
                    (inv, "C", note.Amount, $"Inventory return {note.ProductName}"),
                ],
                ct);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Vendor CN bridge failed for CN {Id} company {CompanyId}", note.Id, companyId);
        }
    }
}
