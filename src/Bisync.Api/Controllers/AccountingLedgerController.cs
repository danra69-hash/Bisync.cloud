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
    int? ResolveCompany(int? companyId) => TenantQuery.ResolveCompanyId(tenant, companyId);

    [HttpGet("status")]
    public async Task<ActionResult<object>> Status([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0)
            return BadRequest(new { message = "Company context required (X-Bisync-Company-Id or companyId)." });

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        if (company is null) return NotFound(new { message = "Company not found." });

        await ledger.EnsureChartAndOpenPeriodsAsync(cid.Value, company.CountryCode);

        var journalCount = await db.GlJournals.CountAsync(j => j.CompanyId == cid && j.PostedAt != null);
        var accountCount = await db.GlAccounts.CountAsync(a => a.CompanyId == cid);
        var outboxPending = await db.GlOutboxMessages.CountAsync(m => m.CompanyId == cid && m.ProcessedAt == null);
        var openPeriods = await db.GlFiscalPeriods.CountAsync(p => p.CompanyId == cid && p.Status == "open");

        return Ok(new
        {
            companyId = cid,
            currency = LedgerPostingService.CurrencyForCountry(company.CountryCode),
            functionalCurrency = LedgerPostingService.CurrencyForCountry(company.CountryCode),
            currencies = LedgerPostingService.CommonCurrencies,
            phase = "C1",
            phaseLabel = "Malaysia Books + bank match, AP approval, FA/RevRec, SST-02 draft (no external links)",
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid.Value, company?.CountryCode);

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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });

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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });

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

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        var functional = LedgerPostingService.CurrencyForCountry(company?.CountryCode);

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
                return new
                {
                    accountCode = acct?.Code ?? "?",
                    accountName = acct?.Name ?? "?",
                    accountType = acct?.AccountType,
                    currency = b.Currency,
                    periodDr = LedgerPostingService.FromMinor(b.PeriodDrMinor, b.Currency),
                    periodCr = LedgerPostingService.FromMinor(b.PeriodCrMinor, b.Currency),
                    closing = LedgerPostingService.FromMinor(closing, b.Currency),
                };
            })
            .OrderBy(r => r.accountCode)
            .ToList();

        var totalDr = rows.Sum(r => r.periodDr);
        var totalCr = rows.Sum(r => r.periodCr);

        return Ok(new
        {
            period = new { period.Id, period.Year, period.PeriodNo, period.Status, period.StartDate, period.EndDate },
            currency = functional,
            balanced = totalDr == totalCr,
            totalDr,
            totalCr,
            rows,
        });
    }

    [HttpGet("periods")]
    public async Task<ActionResult<IEnumerable<object>>> Periods([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid.Value, company?.CountryCode);

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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await ledger.SoftClosePeriodAsync(cid.Value, id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("journals/{id:int}/reverse")]
    public async Task<ActionResult<object>> Reverse(int id, [FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            var reversal = await ledger.ReverseAsync(cid.Value, id, createdBy: "api");
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid.Value, company?.CountryCode);
        try
        {
            var row = await ledger.CreateAccountAsync(cid.Value, body.Code, body.Name, body.AccountType, body.NormalBalance);
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            var row = await ledger.UpdateAccountAsync(cid.Value, id, body.Name, body.Active);
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
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
                cid.Value,
                company.CountryCode,
                journalType: string.IsNullOrWhiteSpace(body.JournalType) ? "GEN" : body.JournalType.Trim().ToUpperInvariant(),
                docSeries: string.IsNullOrWhiteSpace(body.DocSeries) ? "GEN" : body.DocSeries.Trim().ToUpperInvariant(),
                effectiveDate: effective,
                documentDate: document,
                sourceModule: "MANUAL",
                sourceDocKey: null,
                narration: body.Narration?.Trim() ?? "",
                createdBy: "accounting-ui",
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
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await ledger.EnsureChartAndOpenPeriodsAsync(cid.Value, company?.CountryCode);

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
            return Ok(await ledger.BuildFinancialStatementsAsync(cid.Value, resolvedPeriodId));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("periods/{id:int}/reopen")]
    public async Task<ActionResult> Reopen(int id, [FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await ledger.ReopenPeriodAsync(cid.Value, id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
