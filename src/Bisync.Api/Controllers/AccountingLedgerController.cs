using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>Bisync Books Phase 0 — journals, trial balance, periods, outbox bridges.</summary>
[ApiController]
[Route("api/accounting")]
public class AccountingLedgerController(
    BisyncDbContext db,
    ITenantContext tenant,
    LedgerPostingService ledger) : ControllerBase
{
    bool TryGate(int? companyId, out int cid, out string actor, out ActionResult error)
    {
        if (AccountingAccess.TryResolve(tenant, companyId, out cid, out actor, out var failed))
        {
            error = null!;
            return true;
        }

        cid = 0;
        actor = "";
        error = failed!;
        return false;
    }

    [HttpGet("status")]
    public async Task<ActionResult<object>> Status([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        if (company is null) return NotFound(new { message = "Company not found." });

        await ledger.EnsureChartAndOpenPeriodsAsync(cid, company.CountryCode);

        var journalCount = await db.GlJournals.CountAsync(j => j.CompanyId == cid && j.PostedAt != null);
        var accountCount = await db.GlAccounts.CountAsync(a => a.CompanyId == cid);
        var outboxPending = await db.GlOutboxMessages.CountAsync(m => m.CompanyId == cid && m.ProcessedAt == null);
        var openPeriods = await db.GlFiscalPeriods.CountAsync(p => p.CompanyId == cid && p.Status == "open");

        return Ok(new
        {
            companyId = cid,
            currency = await ledger.ResolveFunctionalCurrencyAsync(cid, company.CountryCode),
            functionalCurrency = await ledger.ResolveFunctionalCurrencyAsync(cid, company.CountryCode),
            fiscalYearStartMonth = company.FiscalYearStartMonth is >= 1 and <= 12 ? company.FiscalYearStartMonth : 1,
            currencies = LedgerPostingService.CommonCurrencies,
            phase = "B",
            phaseLabel = "Ledger foundations: sealed journals, opening-balance TB/BS, tenant-scoped Books. Bank rec / AR-AP feed still partial.",
            accounts = accountCount,
            postedJournals = journalCount,
            pendingOutbox = outboxPending,
            openPeriods,
            bridges = new[]
            {
                new { eventType = "hrm.payroll_posted", module = "Payroll", status = "wired" },
                new { eventType = "ops.purchase_affirmed", module = "RMS consolidate", status = "wired" },
            },
        });
    }

    [HttpGet("accounts")]
    public async Task<ActionResult<IEnumerable<object>>> Accounts([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid, company?.CountryCode);

        var rows = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == cid)
            .OrderBy(a => a.Code)
            .Select(a => new { a.Id, a.Code, a.Name, a.AccountType, a.NormalBalance, a.Active })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpGet("journals")]
    public async Task<ActionResult<IEnumerable<object>>> Journals(
        [FromQuery] int? companyId,
        [FromQuery] int take = 50)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        take = Math.Clamp(take, 1, 200);

        var journals = await db.GlJournals.AsNoTracking()
            .Where(j => j.CompanyId == cid && j.PostedAt != null)
            .OrderByDescending(j => j.PostedAt)
            .Take(take)
            .Select(j => new
            {
                j.Id,
                j.DocNumber,
                j.JournalType,
                j.SourceModule,
                j.SourceDocKey,
                j.Narration,
                j.EffectiveDate,
                j.PostedAt,
                j.ReversesJournalId,
                lineCount = j.Lines.Count,
            })
            .ToListAsync();
        return Ok(journals);
    }

    [HttpGet("journals/{id:int}")]
    public async Task<ActionResult<object>> JournalDetail(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;

        var journal = await db.GlJournals.AsNoTracking()
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id && j.CompanyId == cid);
        if (journal is null) return NotFound();

        var accountIds = journal.Lines.Select(l => l.AccountId).Distinct().ToList();
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == cid && accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        return Ok(new
        {
            journal.Id,
            journal.DocNumber,
            journal.JournalType,
            journal.LedgerKind,
            journal.SourceModule,
            journal.SourceDocKey,
            journal.Narration,
            journal.EffectiveDate,
            journal.DocumentDate,
            journal.PostedAt,
            journal.ReversesJournalId,
            journal.IdempotencyKey,
            lines = journal.Lines.OrderBy(l => l.LineNo).Select(l =>
            {
                accounts.TryGetValue(l.AccountId, out var acct);
                return new
                {
                    l.LineNo,
                    accountCode = acct?.Code,
                    accountName = acct?.Name,
                    l.Direction,
                    amount = LedgerPostingService.FromMinor(l.AmountMinor, l.Currency),
                    currency = l.Currency,
                    funcAmount = LedgerPostingService.FromMinor(l.FuncAmountMinor, l.FuncCurrency),
                    funcCurrency = l.FuncCurrency,
                    fxRate = l.FxRate,
                    fxRateDate = l.FxRateDate,
                    fxRateType = l.FxRateType,
                    l.Narration,
                };
            }),
        });
    }

    [HttpGet("trial-balance")]
    public async Task<ActionResult<object>> TrialBalance(
        [FromQuery] int? companyId,
        [FromQuery] int? periodId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;

        GlFiscalPeriod? period;
        if (periodId is > 0)
        {
            period = await db.GlFiscalPeriods.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == periodId && p.CompanyId == cid);
            if (period is null) return NotFound(new { message = "Period not found." });
        }
        else
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            period = await db.GlFiscalPeriods.AsNoTracking()
                .FirstOrDefaultAsync(p => p.CompanyId == cid && p.StartDate <= today && p.EndDate >= today);
            if (period is null)
                return BadRequest(new { message = "No open period for today. Call /api/accounting/status first." });
        }

        var functional = await ledger.ResolveFunctionalCurrencyAsync(cid, null);

        var balances = await db.GlPeriodBalances.AsNoTracking()
            .Where(b => b.CompanyId == cid && b.PeriodId == period.Id && b.Currency == functional)
            .ToListAsync();
        var accountIds = balances.Select(b => b.AccountId).Distinct().ToList();
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == cid && accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        var rows = balances
            .Select(b =>
            {
                accounts.TryGetValue(b.AccountId, out var acct);
                var opening = b.OpeningDrMinor - b.OpeningCrMinor;
                var movement = b.PeriodDrMinor - b.PeriodCrMinor;
                var closing = opening + movement;
                var closingDr = closing >= 0 ? closing : 0;
                var closingCr = closing < 0 ? -closing : 0;
                return new
                {
                    accountCode = acct?.Code ?? "?",
                    accountName = acct?.Name ?? "?",
                    accountType = acct?.AccountType,
                    currency = b.Currency,
                    openingDr = LedgerPostingService.FromMinor(b.OpeningDrMinor, b.Currency),
                    openingCr = LedgerPostingService.FromMinor(b.OpeningCrMinor, b.Currency),
                    periodDr = LedgerPostingService.FromMinor(b.PeriodDrMinor, b.Currency),
                    periodCr = LedgerPostingService.FromMinor(b.PeriodCrMinor, b.Currency),
                    closingDr = LedgerPostingService.FromMinor(closingDr, b.Currency),
                    closingCr = LedgerPostingService.FromMinor(closingCr, b.Currency),
                    closing = LedgerPostingService.FromMinor(closing, b.Currency),
                };
            })
            .OrderBy(r => r.accountCode)
            .ToList();

        var totalDr = rows.Sum(r => r.closingDr);
        var totalCr = rows.Sum(r => r.closingCr);
        var periodDr = rows.Sum(r => r.periodDr);
        var periodCr = rows.Sum(r => r.periodCr);

        return Ok(new
        {
            period = new { period.Id, period.Year, period.PeriodNo, period.Status, period.StartDate, period.EndDate },
            currency = functional,
            basis = "closing-balance",
            balanced = totalDr == totalCr,
            totalDr,
            totalCr,
            periodDr,
            periodCr,
            rows,
        });
    }

    [HttpGet("periods")]
    public async Task<ActionResult<IEnumerable<object>>> Periods([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid, company?.CountryCode);

        var rows = await db.GlFiscalPeriods.AsNoTracking()
            .Where(p => p.CompanyId == cid)
            .OrderByDescending(p => p.Year).ThenByDescending(p => p.PeriodNo)
            .Select(p => new { p.Id, p.Year, p.PeriodNo, p.StartDate, p.EndDate, p.Status })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpPost("periods/{id:int}/soft-close")]
    public async Task<ActionResult> SoftClose(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await ledger.SoftClosePeriodAsync(cid, id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("periods/{id:int}/hard-close")]
    public async Task<ActionResult> HardClose(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (!tenant.IsPlatformAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Hard-close requires a platform admin." });
        try
        {
            await ledger.HardClosePeriodAsync(cid, id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("period-balances/rebuild")]
    public async Task<ActionResult<object>> RebuildBalances([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (!tenant.IsPlatformAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Rebuild requires a platform admin." });
        try
        {
            return Ok(await ledger.RebuildPeriodBalancesAsync(cid));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("period-balances/drift")]
    public async Task<ActionResult<object>> PeriodBalanceDrift([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        return Ok(await ledger.PeriodBalanceDriftAsync(cid));
    }

    [HttpPut("fiscal-year-start")]
    public async Task<ActionResult<object>> SetFiscalYearStart(
        [FromQuery] int? companyId,
        [FromBody] FiscalYearStartRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (!tenant.IsPlatformAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Fiscal year start requires a platform admin." });
        var month = body?.Month ?? 0;
        if (month is < 1 or > 12)
            return BadRequest(new { message = "Month must be 1–12." });

        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == cid);
        if (company is null) return NotFound(new { message = "Company not found." });

        var hasJournals = await db.GlJournals.AnyAsync(j => j.CompanyId == cid && j.PostedAt != null);
        if (hasJournals && company.FiscalYearStartMonth != month)
            return Conflict(new { message = "Cannot change fiscal year start after journals have been posted." });

        company.FiscalYearStartMonth = month;
        // Drop unposted period shells so the next ensure rebuilds on the new calendar.
        if (!hasJournals)
        {
            var emptyPeriods = await db.GlFiscalPeriods.Where(p => p.CompanyId == cid).ToListAsync();
            db.GlFiscalPeriods.RemoveRange(emptyPeriods);
        }
        await db.SaveChangesAsync();
        await ledger.EnsurePeriodsForYearAsync(cid, LedgerPostingService.ResolveFiscalYear(month, DateOnly.FromDateTime(DateTime.UtcNow)));
        return Ok(new { companyId = cid, fiscalYearStartMonth = month });
    }

    public sealed class FiscalYearStartRequest
    {
        public int Month { get; set; }
    }

    [HttpPost("journals/{id:int}/reverse")]
    public async Task<ActionResult<object>> Reverse(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            var reversal = await ledger.ReverseAsync(cid, id, createdBy: actor);
            return Ok(new { reversal.Id, reversal.DocNumber, reversal.ReversesJournalId });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("outbox")]
    public async Task<ActionResult<IEnumerable<object>>> Outbox(
        [FromQuery] int? companyId,
        [FromQuery] int take = 50)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        take = Math.Clamp(take, 1, 200);

        var rows = await db.GlOutboxMessages.AsNoTracking()
            .Where(m => m.CompanyId == cid)
            .OrderByDescending(m => m.CreatedAt)
            .Take(take)
            .Select(m => new
            {
                m.Id,
                m.EventType,
                m.IdempotencyKey,
                m.CreatedAt,
                m.ProcessedAt,
                m.PayloadJson,
            })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpPost("outbox/ack")]
    public async Task<ActionResult<object>> AckOutbox([FromQuery] int? companyId, [FromQuery] int take = 100)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (!tenant.IsPlatformAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Outbox ack requires a platform admin." });
        return Ok(await ledger.AckPendingOutboxAsync(cid, take));
    }

    public sealed record CreateAccountRequest(string Code, string Name, string AccountType, string NormalBalance);
    public sealed record UpdateAccountRequest(string? Name, bool? Active);
    public sealed record JournalLineRequest(string AccountCode, string Direction, decimal Amount, string? Narration);
    public sealed record PostJournalRequest(
        DateOnly? EffectiveDate,
        DateOnly? DocumentDate,
        string? Narration,
        string? JournalType,
        string? DocSeries,
        string? Currency,
        decimal? FxRate,
        DateOnly? FxRateDate,
        List<JournalLineRequest> Lines);

    [HttpPost("accounts")]
    public async Task<ActionResult<object>> CreateAccount(
        [FromQuery] int? companyId,
        [FromBody] CreateAccountRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid, company?.CountryCode);
        try
        {
            var row = await ledger.CreateAccountAsync(cid, body.Code, body.Name, body.AccountType, body.NormalBalance);
            return Ok(new { row.Id, row.Code, row.Name, row.AccountType, row.NormalBalance, row.Active });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("accounts/{id:int}")]
    public async Task<ActionResult<object>> UpdateAccount(
        int id,
        [FromQuery] int? companyId,
        [FromBody] UpdateAccountRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            var row = await ledger.UpdateAccountAsync(cid, id, body.Name, body.Active);
            return Ok(new { row.Id, row.Code, row.Name, row.AccountType, row.NormalBalance, row.Active });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("journals")]
    public async Task<ActionResult<object>> PostJournal(
        [FromQuery] int? companyId,
        [FromBody] PostJournalRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (body.Lines is null || body.Lines.Count < 2)
            return BadRequest(new { message = "At least two journal lines are required." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        if (company is null) return NotFound(new { message = "Company not found." });

        var effective = body.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var document = body.DocumentDate ?? effective;
        var lines = body.Lines
            .Select(l => (l.AccountCode, l.Direction, l.Amount, l.Narration ?? ""))
            .ToList();

        try
        {
            var journal = await ledger.PostAsync(
                cid,
                company.CountryCode,
                journalType: string.IsNullOrWhiteSpace(body.JournalType) ? "GEN" : body.JournalType.Trim().ToUpperInvariant(),
                docSeries: string.IsNullOrWhiteSpace(body.DocSeries) ? "GEN" : body.DocSeries.Trim().ToUpperInvariant(),
                effectiveDate: effective,
                documentDate: document,
                sourceModule: "MANUAL",
                sourceDocKey: null,
                narration: body.Narration?.Trim() ?? "",
                createdBy: actor,
                idempotencyKey: null,
                lines,
                CancellationToken.None,
                txnCurrency: body.Currency,
                fxRate: body.FxRate,
                fxRateDate: body.FxRateDate);

            return Ok(new
            {
                journal.Id,
                journal.DocNumber,
                journal.JournalType,
                journal.PostedAt,
                journal.Narration,
                lineCount = journal.Lines.Count,
                currency = journal.Lines.FirstOrDefault()?.Currency,
                functionalCurrency = journal.Lines.FirstOrDefault()?.FuncCurrency,
                fxRate = journal.Lines.FirstOrDefault()?.FxRate,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("statements")]
    public async Task<ActionResult<object>> Statements(
        [FromQuery] int? companyId,
        [FromQuery] int? periodId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid, company?.CountryCode);

        int resolvedPeriodId;
        if (periodId is > 0)
        {
            resolvedPeriodId = periodId.Value;
        }
        else
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var period = await db.GlFiscalPeriods.AsNoTracking()
                .FirstOrDefaultAsync(p => p.CompanyId == cid && p.StartDate <= today && p.EndDate >= today);
            if (period is null) return BadRequest(new { message = "No fiscal period for today." });
            resolvedPeriodId = period.Id;
        }

        try
        {
            return Ok(await ledger.BuildFinancialStatementsAsync(cid, resolvedPeriodId));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("periods/{id:int}/reopen")]
    public async Task<ActionResult> Reopen(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (!tenant.IsPlatformAdmin)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Reopen requires a platform admin." });
        try
        {
            await ledger.ReopenPeriodAsync(cid, id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
