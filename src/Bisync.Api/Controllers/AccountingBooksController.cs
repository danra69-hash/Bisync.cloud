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
    AccountingBridgeService accountingBridge,
    MalaysiaAccountingPackService malaysiaPack) : ControllerBase
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

    [HttpGet("pack")]
    public async Task<ActionResult<object>> PackStatus([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        return Ok(await malaysiaPack.GetPackStatusAsync(cid, company?.CountryCode));
    }

    [HttpGet("fx-rates")]
    public async Task<ActionResult<object>> ListFxRates([FromQuery] int? companyId, [FromQuery] int take = 50)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
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
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            var row = await books.UpsertFxRateAsync(
                cid,
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
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        take = Math.Clamp(take, 1, 200);
        var q = db.GlOpenItems.AsNoTracking().Where(i => i.CompanyId == cid);
        if (!string.IsNullOrWhiteSpace(subledger))
        {
            var s = subledger.Trim().ToLowerInvariant();
            q = q.Where(i => i.Subledger == s);
        }
        var rows = await q.OrderByDescending(i => i.Id).Take(take)
            .Select(i => new
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
                lineCount = i.Lines.Count,
            })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record CreateOpenItemLineRequest(
        string? Description,
        decimal? Quantity,
        decimal? UnitPrice,
        decimal Net,
        decimal? TaxAmount,
        string? TaxCode,
        string? AccountCode,
        string? ProductRef);

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
        bool? RequireApApproval,
        List<CreateOpenItemLineRequest>? Lines);

    [HttpPost("open-items")]
    public async Task<ActionResult<object>> CreateOpenItem(
        [FromQuery] int? companyId,
        [FromBody] CreateOpenItemRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        if (company is null) return NotFound(new { message = "Company not found." });
        try
        {
            IReadOnlyList<AccountingSubledgerService.OpenItemLineInput>? lineInputs = null;
            if (body.Lines is { Count: > 0 })
            {
                lineInputs = body.Lines.Select(l => new AccountingSubledgerService.OpenItemLineInput(
                    l.Description ?? "",
                    l.Quantity ?? 1m,
                    l.UnitPrice ?? l.Net,
                    l.Net,
                    l.TaxAmount ?? 0m,
                    l.TaxCode,
                    l.AccountCode,
                    l.ProductRef)).ToList();
            }

            var item = await books.CreateOpenItemAsync(
                cid,
                company.CountryCode,
                body.Subledger,
                body.Kind,
                body.CounterpartyName,
                body.IssueDate,
                body.DueDate,
                body.Gross,
                body.Currency,
                body.TaxCode,
                body.TaxAmount ?? 0m,
                body.Narration ?? "",
                body.PostJournal ?? true,
                string.IsNullOrWhiteSpace(body.CreatedBy) ? actor : body.CreatedBy,
                body.RequireApApproval ?? true,
                lineInputs);
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
                lineCount = item.Lines.Count,
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
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await books.ApplyAsync(
                cid,
                body.FromId,
                body.ToId,
                body.Amount,
                body.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                createdBy: actor);
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
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        return Ok(await books.AgingAsync(
            cid,
            subledger,
            asOf ?? DateOnly.FromDateTime(DateTime.UtcNow)));
    }

    [HttpGet("control-reconciliation")]
    public async Task<ActionResult<object>> ControlReconciliation(
        [FromQuery] int? companyId,
        [FromQuery] string subledger = "ar",
        [FromQuery] DateOnly? asOf = null)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        try
        {
            return Ok(await books.ControlAccountReconciliationAsync(
                cid,
                subledger,
                asOf ?? DateOnly.FromDateTime(DateTime.UtcNow)));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("bank-statements")]
    public async Task<ActionResult<object>> BankStatements([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        var rows = await db.GlBankStatements.AsNoTracking()
            .Where(s => s.CompanyId == cid)
            .OrderByDescending(s => s.StatementDate)
            .Take(40)
            .Select(s => new
            {
                s.Id,
                s.AccountLabel,
                s.BankAccountCode,
                s.Currency,
                s.StatementDate,
                opening = LedgerPostingService.FromMinor(s.OpeningMinor, s.Currency),
                closing = LedgerPostingService.FromMinor(s.ClosingMinor, s.Currency),
                s.Source,
                s.Status,
                lineCount = s.Lines.Count,
            })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record CreateBankStatementRequest(
        string? AccountLabel,
        string? BankAccountCode,
        DateOnly StatementDate,
        string? Currency,
        string? Source,
        decimal? Opening,
        decimal? Closing,
        List<BankLineDto>? Lines);

    public sealed record BankLineDto(DateOnly ValueDate, string Narrative, decimal Amount);

    [HttpPost("bank-statements")]
    public async Task<ActionResult<object>> CreateBankStatement(
        [FromQuery] int? companyId,
        [FromBody] CreateBankStatementRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        var cur = string.IsNullOrWhiteSpace(body.Currency)
            ? await db.Companies.Where(c => c.Id == cid).Select(c => c.FunctionalCurrency).FirstOrDefaultAsync()
                is { Length: 3 } fc
                ? fc
                : LedgerPostingService.CurrencyForCountry(company?.CountryCode)
            : LedgerPostingService.NormalizeCurrency(body.Currency);
        var bankCode = string.IsNullOrWhiteSpace(body.BankAccountCode) ? "1000" : body.BankAccountCode.Trim();
        var opening = LedgerPostingService.ToMinor(body.Opening ?? 0, cur);
        var lines = body.Lines ?? [];
        var lineSum = lines.Sum(l => LedgerPostingService.ToMinor(l.Amount, cur));
        var closing = body.Closing is null
            ? opening + lineSum
            : LedgerPostingService.ToMinor(body.Closing.Value, cur);
        var stmt = new GlBankStatement
        {
            CompanyId = cid,
            AccountLabel = string.IsNullOrWhiteSpace(body.AccountLabel) ? "Operating account" : body.AccountLabel.Trim(),
            BankAccountCode = bankCode,
            Currency = cur,
            StatementDate = body.StatementDate,
            OpeningMinor = opening,
            ClosingMinor = closing,
            Source = string.IsNullOrWhiteSpace(body.Source) ? "manual" : body.Source.Trim(),
            Status = "open",
            CreatedAt = DateTime.UtcNow,
        };
        var n = 1;
        foreach (var line in lines)
        {
            stmt.Lines.Add(new GlBankStatementLine
            {
                CompanyId = cid,
                LineNo = n++,
                ValueDate = line.ValueDate,
                Narrative = line.Narrative?.Trim() ?? "",
                AmountMinor = LedgerPostingService.ToMinor(line.Amount, cur),
                Currency = cur,
            });
        }
        db.GlBankStatements.Add(stmt);
        await db.SaveChangesAsync();
        return Ok(new
        {
            stmt.Id,
            stmt.AccountLabel,
            stmt.BankAccountCode,
            stmt.StatementDate,
            opening = LedgerPostingService.FromMinor(stmt.OpeningMinor, cur),
            closing = LedgerPostingService.FromMinor(stmt.ClosingMinor, cur),
            lineCount = stmt.Lines.Count,
        });
    }

    [HttpPost("bank-statements/{id:int}/finalise")]
    public async Task<ActionResult<object>> FinaliseBankStatement(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            return Ok(await internalBooks.FinaliseBankStatementAsync(cid, id));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("applications")]
    public async Task<ActionResult<object>> Applications([FromQuery] int? companyId, [FromQuery] int take = 50)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
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
    public async Task<ActionResult> Unapply(int applicationId, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await internalBooks.UnapplyAsync(cid, applicationId, actor);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/submit")]
    public async Task<ActionResult> Submit(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await internalBooks.SubmitForApprovalAsync(cid, id, actor);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/approve")]
    public async Task<ActionResult> Approve(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            await internalBooks.ApproveAsync(cid, id, actor);
            await books.PostDeferredJournalIfNeededAsync(cid, company?.CountryCode, id);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/reject")]
    public async Task<ActionResult> Reject(int id, [FromQuery] int? companyId, [FromBody] RejectBody? body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await internalBooks.RejectAsync(cid, id, actor, body?.Reason);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("open-items/{id:int}/void")]
    public async Task<ActionResult> VoidOpenItem(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await books.VoidOpenItemAsync(cid, id, actor);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record RejectBody(string? Reason);

    [HttpGet("bank/queue")]
    public async Task<ActionResult<object>> BankQueue([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        await books.EnsureReadyAsync(cid, company?.CountryCode);
        return Ok(await internalBooks.BankQueueAsync(cid));
    }

    [HttpGet("bank/suggest/{lineId:int}")]
    public async Task<ActionResult<object>> BankSuggest(int lineId, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try { return Ok(await internalBooks.SuggestMatchesAsync(cid, lineId)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record MatchRequest(List<int> StatementLineIds, List<MatchItemDto> OpenItems, string? Notes, string? CreatedBy);
    public sealed record MatchItemDto(int OpenItemId, decimal Amount);

    [HttpPost("bank/match")]
    public async Task<ActionResult<object>> BankMatch([FromQuery] int? companyId, [FromBody] MatchRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            var group = await internalBooks.MatchAsync(
                cid,
                body.StatementLineIds ?? [],
                (body.OpenItems ?? []).Select(x => (x.OpenItemId, x.Amount)).ToList(),
                actor,
                body.Notes);
            return Ok(new { group.Id, group.Cardinality, group.MatchedAt, group.Status });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("bank/unmatch/{matchGroupId:int}")]
    public async Task<ActionResult> BankUnmatch(int matchGroupId, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            await internalBooks.UnmatchAsync(cid, matchGroupId);
            return NoContent();
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("bank/auto-match")]
    public async Task<ActionResult> BankAutoMatch([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        await internalBooks.AutoMatchAsync(cid, actor);
        return NoContent();
    }

    public sealed record FixedAssetRequest(string AssetTag, string Name, string? AssetClass, DateOnly AcquiredOn, decimal Cost, string? Currency, int? LifeMonths);

    [HttpGet("fixed-assets")]
    public async Task<ActionResult<object>> FixedAssets([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
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
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            var asset = await internalBooks.CreateFixedAssetAsync(
                cid, body.AssetTag, body.Name, body.AssetClass ?? "equipment", body.AcquiredOn,
                body.Cost, body.Currency ?? LedgerPostingService.CurrencyForCountry(company?.CountryCode),
                body.LifeMonths ?? 60);
            return Ok(new { asset.Id, asset.AssetTag, asset.Name, bookCount = asset.Books.Count });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("fixed-assets/depreciate")]
    public async Task<ActionResult<object>> Depreciate([FromQuery] int? companyId, [FromQuery] int year, [FromQuery] int periodNo, [FromQuery] string? bookId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            return Ok(await internalBooks.RunDepreciationAsync(cid, company?.CountryCode, year, periodNo, bookId ?? "ifrs"));
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record RevRecRequest(string ContractNo, string CustomerName, DateOnly StartDate, DateOnly? EndDate, decimal TransactionPrice, string? Currency, string? ObligationDescription);

    [HttpGet("revrec")]
    public async Task<ActionResult<object>> RevRec([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
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
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            var c = await internalBooks.CreateRevRecContractAsync(
                cid, body.ContractNo, body.CustomerName, body.StartDate, body.EndDate,
                body.TransactionPrice, body.Currency ?? LedgerPostingService.CurrencyForCountry(company?.CountryCode),
                body.ObligationDescription ?? "");
            return Ok(new { c.Id, c.ContractNo, obligationId = c.Obligations.FirstOrDefault()?.Id });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("revrec/obligations/{id:int}/recognise")]
    public async Task<ActionResult<object>> Recognise(int id, [FromQuery] int? companyId, [FromBody] RecogniseBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try { return Ok(await internalBooks.RecogniseRevRecAsync(cid, company?.CountryCode, id, body.Amount)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record RecogniseBody(decimal Amount);

    [HttpPost("returns/sst-02")]
    public async Task<ActionResult<object>> Sst02([FromQuery] int? companyId, [FromQuery] DateOnly periodStart, [FromQuery] DateOnly periodEnd)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try { return Ok(await internalBooks.ComputeSst02Async(cid, periodStart, periodEnd)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record PosSettlementRequest(string LocationExternalId, DateOnly BusinessDate);

    /// <summary>Manual / replay POS day settlement into Books (also runs automatically on EOD close).</summary>
    [HttpPost("pos-settlement")]
    public async Task<ActionResult<object>> PosSettlement(
        [FromQuery] int? companyId,
        [FromBody] PosSettlementRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (string.IsNullOrWhiteSpace(body.LocationExternalId))
            return BadRequest(new { message = "locationExternalId is required." });
        var result = await accountingBridge.OnPosDaySettlementAsync(cid, body.LocationExternalId.Trim(), body.BusinessDate);
        if (result is null)
            return Conflict(new { message = "POS settlement failed — see bridge_error outbox." });
        return Ok(result);
    }
}
