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
    AccountingScaleService scale,
    EinvoiceDispatchService einvoice,
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
                i.CounterpartyRef,
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
        List<CreateOpenItemLineRequest>? Lines,
        string? CounterpartyRef,
        decimal? FxRate,
        DateOnly? FxRateDate);

    [HttpPost("open-items")]
    public async Task<ActionResult<object>> CreateOpenItem(
        [FromQuery] int? companyId,
        [FromBody] CreateOpenItemRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var acKey = body.Subledger?.Trim().Equals("ap", StringComparison.OrdinalIgnoreCase) == true
            ? AccountingAccessControl.ApManage
            : AccountingAccessControl.ArManage;
        if (await AccountingAccessControl.RequireAsync(db, tenant, acKey) is { } denied) return denied;
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
                lineInputs,
                body.CounterpartyRef,
                body.FxRate,
                body.FxRateDate);
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
                item.CounterpartyName,
                item.CounterpartyRef,
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

    public sealed record ApplyRequest(
        int FromId,
        int ToId,
        decimal Amount,
        DateOnly? EffectiveDate,
        decimal? SettlementFxRate,
        DateOnly? SettlementFxRateDate);

    [HttpPost("open-items/apply")]
    public async Task<ActionResult> Apply(
        [FromQuery] int? companyId,
        [FromBody] ApplyRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var arDenied = await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.ArReceive);
        var apDenied = await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.ApPay);
        if (arDenied is not null && apDenied is not null) return arDenied;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            await books.ApplyAsync(
                cid,
                body.FromId,
                body.ToId,
                body.Amount,
                body.EffectiveDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                createdBy: actor,
                countryCode: company?.CountryCode,
                settlementFxRate: body.SettlementFxRate,
                settlementFxRateDate: body.SettlementFxRateDate);
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

    public sealed record ImportBankCsvRequest(
        string CsvText,
        string? AccountLabel,
        string? BankAccountCode,
        string? Currency,
        DateOnly? StatementDate,
        decimal? Opening,
        decimal? Closing);

    [HttpPost("bank-statements/import-csv")]
    public async Task<ActionResult<object>> ImportBankCsv(
        [FromQuery] int? companyId,
        [FromBody] ImportBankCsvRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.BankRec) is { } denied)
            return denied;
        try
        {
            return Ok(await books.ImportBankCsvAsync(
                cid,
                body.CsvText,
                body.AccountLabel,
                body.BankAccountCode,
                body.Currency,
                body.StatementDate,
                body.Opening,
                body.Closing));
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
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
            // Best-effort e-invoice queue (stub MyInvois in non-prod). Failure must not block approve.
            _ = await einvoice.QueueOpenItemAsync(cid, id);
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

    public sealed record DisposeFixedAssetRequest(DateOnly DisposedOn, decimal? Proceeds);

    [HttpPost("fixed-assets/{id:int}/dispose")]
    public async Task<ActionResult<object>> DisposeFixedAsset(
        int id,
        [FromQuery] int? companyId,
        [FromBody] DisposeFixedAssetRequest body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            return Ok(await internalBooks.DisposeFixedAssetAsync(
                cid, company?.CountryCode, id, body.DisposedOn, body.Proceeds ?? 0m));
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

    [HttpPost("revrec/run-schedule")]
    public async Task<ActionResult<object>> RunRevRecSchedule(
        [FromQuery] int? companyId,
        [FromQuery] DateOnly? asOf)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            return Ok(await internalBooks.RunRevRecScheduleAsync(
                cid, company?.CountryCode, asOf ?? DateOnly.FromDateTime(DateTime.UtcNow)));
        }
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

    [HttpGet("returns")]
    public async Task<ActionResult<object>> ListReturns([FromQuery] int? companyId, [FromQuery] int take = 40)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        take = Math.Clamp(take, 1, 200);
        var rows = await db.GlStatutoryReturns.AsNoTracking()
            .Where(r => r.CompanyId == cid)
            .OrderByDescending(r => r.ComputedAt)
            .Take(take)
            .Select(r => new
            {
                r.Id,
                r.ReturnType,
                r.PeriodStart,
                r.PeriodEnd,
                r.Status,
                r.TransmissionStatus,
                r.TransmissionRef,
                r.ComputedAt,
            })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpGet("returns/{id:int}/export")]
    public async Task<IActionResult> ExportReturn(int id, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try
        {
            var csv = await internalBooks.ExportSst02CsvAsync(cid, id);
            var bytes = System.Text.Encoding.UTF8.GetBytes(csv);
            return File(bytes, "text/csv", $"sst-02-{id}.csv");
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    // ── Wave D: budgets / saved reports / consolidation / take-on / e-invoice ──

    [HttpGet("budgets")]
    public async Task<ActionResult<object>> ListBudgets([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        await scale.EnsureScaleTablesAsync();
        var rows = await db.GlBudgets.AsNoTracking()
            .Where(b => b.CompanyId == cid)
            .OrderByDescending(b => b.FiscalYear)
            .ThenBy(b => b.Name)
            .Select(b => new { b.Id, b.Name, b.FiscalYear, b.Currency, b.Status, lineCount = b.Lines.Count, b.CreatedAt })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record BudgetLineBody(string AccountCode, int PeriodNo, decimal Amount, string? LocationExternalId);
    public sealed record UpsertBudgetBody(string Name, int FiscalYear, string? Currency, List<BudgetLineBody> Lines);

    [HttpPost("budgets")]
    public async Task<ActionResult<object>> UpsertBudget([FromQuery] int? companyId, [FromBody] UpsertBudgetBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.JournalManage) is { } denied)
            return denied;
        if (string.IsNullOrWhiteSpace(body.Name) || body.Lines is null || body.Lines.Count == 0)
            return BadRequest(new { message = "Name and at least one budget line are required." });
        try
        {
            var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
            var budget = await scale.UpsertBudgetAsync(
                cid,
                body.Name,
                body.FiscalYear,
                body.Currency ?? company?.FunctionalCurrency ?? "MYR",
                body.Lines.Select(l => (l.AccountCode, l.PeriodNo, l.Amount, l.LocationExternalId)).ToList());
            return Ok(new { budget.Id, budget.Name, budget.FiscalYear, budget.Currency, budget.Status, lineCount = budget.Lines.Count });
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("budgets/{id:int}/vs-actual")]
    public async Task<ActionResult<object>> BudgetVsActual(int id, [FromQuery] int? companyId, [FromQuery] int? periodNo)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try { return Ok(await scale.BudgetVsActualAsync(cid, id, periodNo)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("saved-reports")]
    public async Task<ActionResult<object>> ListSavedReports([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        await scale.EnsureScaleTablesAsync();
        var rows = await db.GlSavedReports.AsNoTracking()
            .Where(r => r.CompanyId == cid)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new { r.Id, r.Name, r.Kind, r.FiltersJson, r.CreatedBy, r.CreatedAt })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record SaveReportBody(string Name, string Kind, string? FiltersJson);

    [HttpPost("saved-reports")]
    public async Task<ActionResult<object>> SaveReport([FromQuery] int? companyId, [FromBody] SaveReportBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { message = "Name is required." });
        var row = await scale.SaveReportAsync(cid, body.Name, body.Kind ?? "trial_balance", body.FiltersJson ?? "{}", actor);
        return Ok(new { row.Id, row.Name, row.Kind, row.FiltersJson, row.CreatedBy, row.CreatedAt });
    }

    [HttpGet("consolidation-groups")]
    public async Task<ActionResult<object>> ListConsolGroups([FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        await scale.EnsureScaleTablesAsync();
        var rows = await db.GlConsolidationGroups.AsNoTracking()
            .Include(g => g.Members)
            .Where(g => g.ParentCompanyId == cid)
            .OrderBy(g => g.Name)
            .Select(g => new
            {
                g.Id,
                g.Name,
                g.Status,
                g.ParentCompanyId,
                members = g.Members.Select(m => new { m.MemberCompanyId, m.OwnershipPercent }),
            })
            .ToListAsync();
        return Ok(rows);
    }

    public sealed record ConsolMemberBody(int MemberCompanyId, decimal OwnershipPercent);
    public sealed record UpsertConsolBody(string Name, List<ConsolMemberBody> Members);

    [HttpPost("consolidation-groups")]
    public async Task<ActionResult<object>> UpsertConsol([FromQuery] int? companyId, [FromBody] UpsertConsolBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.HardClose) is { } denied)
            return denied;
        if (string.IsNullOrWhiteSpace(body.Name)) return BadRequest(new { message = "Name is required." });
        var group = await scale.UpsertConsolidationGroupAsync(
            cid,
            body.Name,
            (body.Members ?? []).Select(m => (m.MemberCompanyId, m.OwnershipPercent)).ToList());
        return Ok(new
        {
            group.Id,
            group.Name,
            group.Status,
            members = group.Members.Select(m => new { m.MemberCompanyId, m.OwnershipPercent }),
        });
    }

    public sealed record ElimLineBody(string AccountCode, string Direction, decimal Amount, string? LineNarration);
    public sealed record PostElimBody(int PartnerCompanyId, DateOnly EffectiveDate, string Narration, List<ElimLineBody> Lines);

    [HttpPost("consolidation/elim")]
    public async Task<ActionResult<object>> PostElim([FromQuery] int? companyId, [FromBody] PostElimBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.JournalManage) is { } denied)
            return denied;
        if (body.Lines is null || body.Lines.Count < 2)
            return BadRequest(new { message = "At least two elimination lines are required." });
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try
        {
            return Ok(await scale.PostEliminationAsync(
                cid,
                company?.CountryCode,
                body.PartnerCompanyId,
                body.EffectiveDate,
                body.Narration ?? "Elimination",
                body.Lines.Select(l => (l.AccountCode, l.Direction, l.Amount, l.LineNarration ?? "")).ToList(),
                actor));
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("pnl-by-location")]
    public async Task<ActionResult<object>> PnlByLocation([FromQuery] int? companyId, [FromQuery] int periodId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        try { return Ok(await scale.PnlByLocationAsync(cid, periodId)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    public sealed record TakeOnBody(string CsvText);

    [HttpPost("take-on/coa")]
    public async Task<ActionResult<object>> TakeOnCoa([FromQuery] int? companyId, [FromBody] TakeOnBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.JournalManage) is { } denied)
            return denied;
        try { return Ok(await scale.ImportCoaCsvAsync(cid, body.CsvText ?? "")); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("take-on/journals")]
    public async Task<ActionResult<object>> TakeOnJournals([FromQuery] int? companyId, [FromBody] TakeOnBody body)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.JournalManage) is { } denied)
            return denied;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid);
        try { return Ok(await scale.ImportJournalsCsvAsync(cid, company?.CountryCode, body.CsvText ?? "", actor)); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpGet("einvoice")]
    public async Task<ActionResult<object>> ListEinvoice([FromQuery] int? companyId, [FromQuery] int take = 40)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        take = Math.Clamp(take, 1, 200);
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        var rows = await db.GlEinvoiceTransmissions.AsNoTracking()
            .Where(t => t.CompanyId == cid)
            .OrderByDescending(t => t.CreatedAt)
            .Take(take)
            .Select(t => new
            {
                t.Id,
                t.Provider,
                t.DocumentType,
                t.SourceDocKey,
                t.OpenItemId,
                t.JournalId,
                t.Status,
                t.ExternalUin,
                t.CreatedAt,
                t.SubmittedAt,
            })
            .ToListAsync();
        return Ok(rows);
    }

    [HttpPost("einvoice/{openItemId:int}/queue")]
    public async Task<ActionResult<object>> QueueEinvoice(int openItemId, [FromQuery] int? companyId)
    {
        if (!TryGate(companyId, out var cid, out var actor, out var gateError)) return gateError;
        if (await AccountingAccessControl.RequireAsync(db, tenant, AccountingAccessControl.ArManage) is { } denied)
            return denied;
        var result = await einvoice.QueueOpenItemAsync(cid, openItemId);
        if (result is null) return NotFound(new { message = "Open item not found." });
        return Ok(result);
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
