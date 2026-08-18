using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>Phase 1 Books — Malaysia pack, FX rates, AR/AP open items, bank shells.</summary>
[ApiController]
[Route("api/accounting/books")]
public class AccountingBooksController(
    BisyncDbContext db,
    ITenantContext tenant,
    AccountingSubledgerService books,
    MalaysiaAccountingPackService malaysiaPack) : ControllerBase
{
    int? ResolveCompany(int? companyId) => TenantQuery.ResolveCompanyId(tenant, companyId);

    [HttpGet("pack")]
    public async Task<ActionResult<object>> PackStatus([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        return Ok(await malaysiaPack.GetPackStatusAsync(cid.Value));
    }

    [HttpGet("fx-rates")]
    public async Task<ActionResult<object>> ListFxRates([FromQuery] int? companyId, [FromQuery] int take = 50)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        take = Math.Clamp(take, 1, 200);
        var rows = await db.GlFxRates.AsNoTracking()
            .Where(r => r.CompanyId == cid)
            .OrderByDescending(r => r.RateDate)
            .ThenByDescending(r => r.Id)
            .Take(take)
            .Select(r => new
            {
                r.Id,
                r.FromCurrency,
                r.ToCurrency,
                r.RateDate,
                r.Rate,
                r.RateType,
                r.Source,
                r.CreatedAt,
            })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record UpsertFxRateRequest(
        string FromCurrency,
        string ToCurrency,
        DateOnly RateDate,
        decimal Rate,
        string? RateType,
        string? Source);

    [HttpPost("fx-rates")]
    public async Task<ActionResult<object>> UpsertFxRate(
        [FromQuery] int? companyId,
        [FromBody] UpsertFxRateRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            var row = await books.UpsertFxRateAsync(
                cid.Value,
                body.FromCurrency,
                body.ToCurrency,
                body.RateDate,
                body.Rate,
                body.RateType ?? "manual",
                body.Source ?? "manual");
            return Ok(new
            {
                row.Id,
                row.FromCurrency,
                row.ToCurrency,
                row.RateDate,
                row.Rate,
                row.RateType,
                row.Source,
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("open-items")]
    public async Task<ActionResult<object>> ListOpenItems(
        [FromQuery] int? companyId,
        [FromQuery] string? subledger,
        [FromQuery] int take = 80)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        take = Math.Clamp(take, 1, 200);
        var q = db.GlOpenItems.AsNoTracking().Where(i => i.CompanyId == cid);
        if (!string.IsNullOrWhiteSpace(subledger))
        {
            var s = subledger.Trim().ToLowerInvariant();
            q = q.Where(i => i.Subledger == s);
        }
        var rows = await q.OrderByDescending(i => i.Id).Take(take).ToListAsync();
        return Ok(rows.Select(i => new
        {
            i.Id,
            i.Subledger,
            i.Kind,
            i.CounterpartyName,
            i.Currency,
            i.IssueDate,
            i.DueDate,
            gross = LedgerPostingService.FromMinor(i.GrossMinor, i.Currency),
            open = LedgerPostingService.FromMinor(i.OpenMinor, i.Currency),
            tax = LedgerPostingService.FromMinor(i.TaxMinor, i.Currency),
            i.TaxCode,
            i.InternalDocumentNo,
            i.StatutoryDocumentNo,
            i.JournalId,
            i.Status,
            i.Narration,
        }));
    }

    public sealed record CreateOpenItemRequest(
        string Subledger,
        string Kind,
        string CounterpartyName,
        DateOnly IssueDate,
        DateOnly DueDate,
        decimal Gross,
        string? Currency,
        string? TaxCode,
        decimal? TaxAmount,
        string? Narration,
        bool? PostJournal);

    [HttpPost("open-items")]
    public async Task<ActionResult<object>> CreateOpenItem(
        [FromQuery] int? companyId,
        [FromBody] CreateOpenItemRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        if (company is null) return NotFound(new { message = "Company not found." });
        try
        {
            var item = await books.CreateOpenItemAsync(
                cid.Value,
                company.CountryCode,
                body.Subledger,
                body.Kind,
                body.CounterpartyName,
                body.IssueDate,
                body.DueDate,
                body.Gross,
                body.Currency,
                body.TaxCode,
                body.TaxAmount ?? 0,
                body.Narration ?? "",
                body.PostJournal ?? true);
            return Ok(new
            {
                item.Id,
                item.Subledger,
                item.Kind,
                item.InternalDocumentNo,
                item.JournalId,
                item.Status,
                currency = item.Currency,
                gross = LedgerPostingService.FromMinor(item.GrossMinor, item.Currency),
                open = LedgerPostingService.FromMinor(item.OpenMinor, item.Currency),
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    public sealed record ApplyRequest(int FromId, int ToId, decimal Amount, DateOnly? EffectiveDate);

    [HttpPost("open-items/apply")]
    public async Task<ActionResult> Apply(
        [FromQuery] int? companyId,
        [FromBody] ApplyRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await books.ApplyAsync(
                cid.Value,
                body.FromId,
                body.ToId,
                body.Amount,
                body.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                createdBy: "accounting-ui");
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("aging")]
    public async Task<ActionResult<object>> Aging(
        [FromQuery] int? companyId,
        [FromQuery] string subledger = "ar",
        [FromQuery] DateOnly? asOf = null)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        return Ok(await books.AgingAsync(
            cid.Value,
            subledger,
            asOf ?? DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpGet("bank-statements")]
    public async Task<ActionResult<object>> BankStatements([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        var rows = await db.GlBankStatements.AsNoTracking()
            .Where(s => s.CompanyId == cid)
            .OrderByDescending(s => s.StatementDate)
            .Take(40)
            .Select(s => new
            {
                s.Id,
                s.AccountLabel,
                s.Currency,
                s.StatementDate,
                s.Source,
                s.Status,
                lineCount = s.Lines.Count,
            })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record CreateBankStatementRequest(
        string? AccountLabel,
        DateOnly StatementDate,
        string? Currency,
        string? Source,
        List<BankLineDto>? Lines);

    public sealed record BankLineDto(DateOnly ValueDate, string Narrative, decimal Amount);

    [HttpPost("bank-statements")]
    public async Task<ActionResult<object>> CreateBankStatement(
        [FromQuery] int? companyId,
        [FromBody] CreateBankStatementRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        var cur = string.IsNullOrWhiteSpace(body.Currency)
            ? LedgerPostingService.CurrencyForCountry(company?.CountryCode)
            : LedgerPostingService.NormalizeCurrency(body.Currency);
        var stmt = new GlBankStatement
        {
            CompanyId = cid.Value,
            AccountLabel = string.IsNullOrWhiteSpace(body.AccountLabel) ? "Operating account" : body.AccountLabel.Trim(),
            Currency = cur,
            StatementDate = body.StatementDate,
            Source = string.IsNullOrWhiteSpace(body.Source) ? "manual" : body.Source.Trim(),
            Status = "open",
            CreatedAt = DateTime.UtcNow,
        };
        var n = 1;
        foreach (var line in body.Lines ?? [])
        {
            stmt.Lines.Add(new GlBankStatementLine
            {
                CompanyId = cid.Value,
                LineNo = n++,
                ValueDate = line.ValueDate,
                Narrative = line.Narrative?.Trim() ?? "",
                AmountMinor = LedgerPostingService.ToMinor(line.Amount, cur),
                Currency = cur,
            });
        }
        db.GlBankStatements.Add(stmt);
        await db.SaveChangesAsync();
        return Ok(new { stmt.Id, stmt.AccountLabel, stmt.StatementDate, lineCount = stmt.Lines.Count });
    }
}
