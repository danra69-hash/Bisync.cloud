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
    AccountingInternalBooksService internalBooks,
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
            i.ApprovalStatus,
            i.CreatedBy,
            i.ApprovedBy,
            i.ApprovedAt,
            i.RejectionReason,
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
        bool? PostJournal,
        string? CreatedBy,
        bool? RequireApApproval);

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
                body.PostJournal ?? true,
                body.CreatedBy,
                body.RequireApApproval ?? true);
            return Ok(new
            {
                item.Id,
                item.Subledger,
                item.Kind,
                item.InternalDocumentNo,
                item.JournalId,
                item.Status,
                item.ApprovalStatus,
                item.CreatedBy,
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

    [HttpGet("applications")]
    public async Task<ActionResult<object>> Applications([FromQuery] int? companyId, [FromQuery] int take = 50)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        take = Math.Clamp(take, 1, 200);
        var rows = await db.GlItemApplications.AsNoTracking()
            .Where(a => a.CompanyId == cid)
            .OrderByDescending(a => a.Id)
            .Take(take)
            .ToListAsync();
        return Ok(rows.Select(a => new
        {
            a.Id,
            a.AppliedFromId,
            a.AppliedToId,
            amount = a.AmountMinor / 100m,
            a.EffectiveDate,
            a.AppliedAt,
            a.ReversalOfId,
            a.CreatedBy,
        }));
    }

    [HttpPost("open-items/unapply/{applicationId:int}")]
    public async Task<ActionResult> Unapply(int applicationId, [FromQuery] int? companyId, [FromQuery] string? actor)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await internalBooks.UnapplyAsync(cid.Value, applicationId, actor ?? "accounting-ui");
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/submit")]
    public async Task<ActionResult> Submit(int id, [FromQuery] int? companyId, [FromQuery] string? actor)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await internalBooks.SubmitForApprovalAsync(cid.Value, id, actor ?? "clerk");
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/approve")]
    public async Task<ActionResult> Approve(int id, [FromQuery] int? companyId, [FromQuery] string? actor)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            await internalBooks.ApproveAsync(cid.Value, id, actor ?? "approver");
            await books.PostDeferredJournalIfNeededAsync(cid.Value, company?.CountryCode, id);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/reject")]
    public async Task<ActionResult> Reject(int id, [FromQuery] int? companyId, [FromQuery] string? actor, [FromBody] RejectBody? body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await internalBooks.RejectAsync(cid.Value, id, actor ?? "approver", body?.Reason);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record RejectBody(string? Reason);

    [HttpGet("bank/queue")]
    public async Task<ActionResult<object>> BankQueue([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid.Value, company?.CountryCode);
        return Ok(await internalBooks.BankQueueAsync(cid.Value));
    }

    [HttpGet("bank/suggest/{lineId:int}")]
    public async Task<ActionResult<object>> BankSuggest(int lineId, [FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try { return Ok(await internalBooks.SuggestMatchesAsync(cid.Value, lineId)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record MatchRequest(List<int> StatementLineIds, List<MatchItemDto> OpenItems, string? Notes, string? CreatedBy);
    public sealed record MatchItemDto(int OpenItemId, decimal Amount);

    [HttpPost("bank/match")]
    public async Task<ActionResult<object>> BankMatch([FromQuery] int? companyId, [FromBody] MatchRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            var group = await internalBooks.MatchAsync(
                cid.Value,
                body.StatementLineIds ?? [],
                (body.OpenItems ?? []).Select(x => (x.OpenItemId, x.Amount)).ToList(),
                body.CreatedBy ?? "accounting-ui",
                body.Notes);
            return Ok(new { group.Id, group.Cardinality, group.MatchedAt, group.Status });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("bank/unmatch/{matchGroupId:int}")]
    public async Task<ActionResult> BankUnmatch(int matchGroupId, [FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try
        {
            await internalBooks.UnmatchAsync(cid.Value, matchGroupId);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("bank/auto-match")]
    public async Task<ActionResult> BankAutoMatch([FromQuery] int? companyId, [FromQuery] string? actor)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        await internalBooks.AutoMatchAsync(cid.Value, actor ?? "auto");
        return NoContent();
    }

    public sealed record FixedAssetRequest(string AssetTag, string Name, string? AssetClass, DateOnly AcquiredOn, decimal Cost, string? Currency, int? LifeMonths);

    [HttpGet("fixed-assets")]
    public async Task<ActionResult<object>> FixedAssets([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        var rows = await db.GlFixedAssets.AsNoTracking().Include(a => a.Books)
            .Where(a => a.CompanyId == cid).OrderByDescending(a => a.Id).Take(80).ToListAsync();
        return Ok(rows.Select(a => new
        {
            a.Id, a.AssetTag, a.Name, a.AssetClass, a.AcquiredOn, a.Status, a.Currency,
            cost = LedgerPostingService.FromMinor(a.CostMinor, a.Currency),
            books = a.Books.Select(b => new { b.BookId, b.Method, b.LifeMonths, b.Status }),
        }));
    }

    [HttpPost("fixed-assets")]
    public async Task<ActionResult<object>> CreateFixedAsset([FromQuery] int? companyId, [FromBody] FixedAssetRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            var asset = await internalBooks.CreateFixedAssetAsync(
                cid.Value, body.AssetTag, body.Name, body.AssetClass ?? "equipment", body.AcquiredOn,
                body.Cost, body.Currency ?? LedgerPostingService.CurrencyForCountry(company?.CountryCode),
                body.LifeMonths ?? 60);
            return Ok(new { asset.Id, asset.AssetTag, asset.Name, bookCount = asset.Books.Count });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("fixed-assets/depreciate")]
    public async Task<ActionResult<object>> Depreciate([FromQuery] int? companyId, [FromQuery] int year, [FromQuery] int periodNo, [FromQuery] string? bookId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            return Ok(await internalBooks.RunDepreciationAsync(cid.Value, company?.CountryCode, year, periodNo, bookId ?? "ifrs"));
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record RevRecRequest(string ContractNo, string CustomerName, DateOnly StartDate, DateOnly? EndDate, decimal TransactionPrice, string? Currency, string? ObligationDescription);

    [HttpGet("revrec")]
    public async Task<ActionResult<object>> RevRec([FromQuery] int? companyId)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        var rows = await db.GlRevRecContracts.AsNoTracking().Include(c => c.Obligations)
            .Where(c => c.CompanyId == cid).OrderByDescending(c => c.Id).Take(40).ToListAsync();
        return Ok(rows.Select(c => new
        {
            c.Id, c.ContractNo, c.CustomerName, c.StartDate, c.EndDate, c.Status, c.Currency,
            transactionPrice = LedgerPostingService.FromMinor(c.TransactionPriceMinor, c.Currency),
            obligations = c.Obligations.Select(o => new
            {
                o.Id, o.Description, o.Pattern,
                allocated = LedgerPostingService.FromMinor(o.AllocatedMinor, c.Currency),
                recognised = LedgerPostingService.FromMinor(o.RecognisedMinor, c.Currency),
            }),
        }));
    }

    [HttpPost("revrec")]
    public async Task<ActionResult<object>> CreateRevRec([FromQuery] int? companyId, [FromBody] RevRecRequest body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            var c = await internalBooks.CreateRevRecContractAsync(
                cid.Value, body.ContractNo, body.CustomerName, body.StartDate, body.EndDate,
                body.TransactionPrice, body.Currency ?? LedgerPostingService.CurrencyForCountry(company?.CountryCode),
                body.ObligationDescription ?? "");
            return Ok(new { c.Id, c.ContractNo, obligationId = c.Obligations.FirstOrDefault()?.Id });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("revrec/obligations/{id:int}/recognise")]
    public async Task<ActionResult<object>> Recognise(int id, [FromQuery] int? companyId, [FromBody] RecogniseBody body)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try { return Ok(await internalBooks.RecogniseRevRecAsync(cid.Value, company?.CountryCode, id, body.Amount)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record RecogniseBody(decimal Amount);

    [HttpPost("returns/sst-02")]
    public async Task<ActionResult<object>> Sst02([FromQuery] int? companyId, [FromQuery] DateOnly periodStart, [FromQuery] DateOnly periodEnd)
    {
        var cid = ResolveCompany(companyId);
        if (cid is null or <= 0) return BadRequest(new { message = "Company context required." });
        try { return Ok(await internalBooks.ComputeSst02Async(cid.Value, periodStart, periodEnd)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
