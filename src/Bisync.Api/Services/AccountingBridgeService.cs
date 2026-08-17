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
                    ("1400", "D", inventoryAmount, $"Inventory from PO {order.PoNumber}"),
                    ("2000", "C", inventoryAmount, $"AP from PO {order.PoNumber}"),
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
}
