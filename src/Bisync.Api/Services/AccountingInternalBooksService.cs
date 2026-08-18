using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Internal Phase 1–3 Books features that do not require external connections:
/// bank matching, AP approval SoD, payment un-apply, fixed assets, revrec shells, SST-02 draft return.
/// </summary>
public sealed class AccountingInternalBooksService(
    BisyncDbContext db,
    LedgerPostingService ledger,
    AccountingSubledgerService subledger)
{
    public async Task UnapplyAsync(int companyId, int applicationId, string createdBy, CancellationToken ct = default)
    {
        var app = await db.GlItemApplications
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Application not found.");
        if (app.ReversalOfId is not null)
            throw new InvalidOperationException("This row is already a reversal.");
        var already = await db.GlItemApplications.AnyAsync(a =>
            a.CompanyId == companyId && a.ReversalOfId == applicationId, ct);
        if (already)
            throw new InvalidOperationException("Application already un-applied.");

        var from = await db.GlOpenItems.FirstAsync(i => i.Id == app.AppliedFromId && i.CompanyId == companyId, ct);
        var to = await db.GlOpenItems.FirstAsync(i => i.Id == app.AppliedToId && i.CompanyId == companyId, ct);
        from.OpenMinor += app.AmountMinor;
        to.OpenMinor += app.AmountMinor;
        from.Status = from.OpenMinor >= from.GrossMinor ? "open" : "partial";
        to.Status = to.OpenMinor >= to.GrossMinor ? "open" : "partial";

        db.GlItemApplications.Add(new GlItemApplication
        {
            CompanyId = companyId,
            AppliedFromId = app.AppliedFromId,
            AppliedToId = app.AppliedToId,
            AmountMinor = -app.AmountMinor,
            AppliedAt = DateTime.UtcNow,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReversalOfId = applicationId,
            CreatedBy = createdBy,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task SubmitForApprovalAsync(int companyId, int openItemId, string actor, CancellationToken ct = default)
    {
        var item = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Open item not found.");
        if (item.Subledger != "ap")
            throw new InvalidOperationException("Only AP items require approval workflow.");
        if (item.ApprovalStatus is not ("draft" or "rejected"))
            throw new InvalidOperationException($"Cannot submit from status {item.ApprovalStatus}.");
        item.ApprovalStatus = "pending_approval";
        item.CreatedBy = string.IsNullOrWhiteSpace(item.CreatedBy) ? actor : item.CreatedBy;
        item.RejectionReason = null;
        await db.SaveChangesAsync(ct);
    }

    public async Task ApproveAsync(int companyId, int openItemId, string actor, CancellationToken ct = default)
    {
        var item = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Open item not found.");
        if (item.ApprovalStatus != "pending_approval")
            throw new InvalidOperationException("Item is not pending approval.");
        if (!string.IsNullOrWhiteSpace(item.CreatedBy)
            && string.Equals(item.CreatedBy, actor, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Segregation of duties: creator cannot approve their own AP item.");
        item.ApprovalStatus = "approved";
        item.ApprovedBy = actor;
        item.ApprovedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task RejectAsync(int companyId, int openItemId, string actor, string? reason, CancellationToken ct = default)
    {
        var item = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Open item not found.");
        if (item.ApprovalStatus != "pending_approval")
            throw new InvalidOperationException("Item is not pending approval.");
        if (!string.IsNullOrWhiteSpace(item.CreatedBy)
            && string.Equals(item.CreatedBy, actor, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Segregation of duties: creator cannot reject their own AP item.");
        item.ApprovalStatus = "rejected";
        item.ApprovedBy = actor;
        item.ApprovedAt = DateTime.UtcNow;
        item.RejectionReason = reason?.Trim() ?? "";
        await db.SaveChangesAsync(ct);
    }

    public async Task<object> BankQueueAsync(int companyId, CancellationToken ct = default)
    {
        var unmatched = await db.GlBankStatementLines.AsNoTracking()
            .Where(l => l.CompanyId == companyId && l.MatchGroupId == null)
            .OrderByDescending(l => l.ValueDate)
            .Take(100)
            .Select(l => new
            {
                l.Id,
                l.StatementId,
                l.LineNo,
                l.ValueDate,
                l.Narrative,
                amount = LedgerPostingService.FromMinor(l.AmountMinor, l.Currency),
                l.Currency,
            })
            .ToListAsync(ct);

        var openItems = await db.GlOpenItems.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.OpenMinor > 0 && i.Status != "void"
                && (i.ApprovalStatus == "approved" || i.Subledger == "ar"))
            .OrderByDescending(i => i.Id)
            .Take(200)
            .Select(i => new
            {
                i.Id,
                i.Subledger,
                i.Kind,
                i.InternalDocumentNo,
                i.CounterpartyName,
                open = LedgerPostingService.FromMinor(i.OpenMinor, i.Currency),
                i.Currency,
            })
            .ToListAsync(ct);

        var matches = await db.GlBankMatchGroups.AsNoTracking()
            .Where(g => g.CompanyId == companyId && g.Status == "active")
            .OrderByDescending(g => g.MatchedAt)
            .Take(40)
            .Select(g => new { g.Id, g.Cardinality, g.MatchedAt, g.CreatedBy, g.Notes })
            .ToListAsync(ct);

        return new { unmatched, openItems, matches };
    }

    public async Task<object> SuggestMatchesAsync(int companyId, int statementLineId, CancellationToken ct = default)
    {
        var line = await db.GlBankStatementLines.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == statementLineId && l.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Statement line not found.");

        var abs = Math.Abs(line.AmountMinor);
        var candidates = await db.GlOpenItems.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.Currency == line.Currency && i.OpenMinor > 0
                && i.Status != "void"
                && (i.ApprovalStatus == "approved" || i.Subledger == "ar"))
            .ToListAsync(ct);

        var scored = candidates
            .Select(i =>
            {
                var score = 0;
                var rule = "scored";
                if (i.OpenMinor == abs)
                {
                    score += 100;
                    rule = "exact_amount";
                }
                else if (Math.Abs(i.OpenMinor - abs) <= LedgerPostingService.ToMinor(0.05m, i.Currency))
                {
                    score += 70;
                    rule = "amount_tolerance";
                }

                var days = Math.Abs(i.IssueDate.DayNumber - line.ValueDate.DayNumber);
                if (days <= 3) score += 25;
                else if (days <= 7) score += 10;

                var narr = (line.Narrative ?? "").ToLowerInvariant();
                var party = (i.CounterpartyName ?? "").ToLowerInvariant();
                var doc = (i.InternalDocumentNo ?? "").ToLowerInvariant();
                if (!string.IsNullOrEmpty(party) && narr.Contains(party)) score += 40;
                if (!string.IsNullOrEmpty(doc) && narr.Contains(doc.ToLowerInvariant())) score += 50;
                if (score >= 40 && rule == "scored") rule = "narrative_or_date";

                return new
                {
                    openItemId = i.Id,
                    i.InternalDocumentNo,
                    i.CounterpartyName,
                    i.Subledger,
                    i.Kind,
                    open = LedgerPostingService.FromMinor(i.OpenMinor, i.Currency),
                    score,
                    rule,
                };
            })
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .Take(15)
            .ToList();

        return new
        {
            lineId = line.Id,
            amount = LedgerPostingService.FromMinor(line.AmountMinor, line.Currency),
            line.Narrative,
            candidates = scored,
        };
    }

    public async Task<GlBankMatchGroup> MatchAsync(
        int companyId,
        IReadOnlyList<int> statementLineIds,
        IReadOnlyList<(int OpenItemId, decimal Amount)> openItemAmounts,
        string createdBy,
        string? notes,
        CancellationToken ct = default)
    {
        if (statementLineIds.Count == 0 || openItemAmounts.Count == 0)
            throw new InvalidOperationException("Match requires at least one statement line and one open item.");

        var lines = await db.GlBankStatementLines
            .Where(l => l.CompanyId == companyId && statementLineIds.Contains(l.Id))
            .ToListAsync(ct);
        if (lines.Count != statementLineIds.Count)
            throw new InvalidOperationException("One or more statement lines were not found.");
        if (lines.Any(l => l.MatchGroupId is not null))
            throw new InvalidOperationException("A selected statement line is already matched.");

        long lineSum = lines.Sum(l => Math.Abs(l.AmountMinor));
        long itemSum = 0;
        var links = new List<GlBankMatchLink>();
        foreach (var (openItemId, amount) in openItemAmounts)
        {
            var item = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct)
                ?? throw new InvalidOperationException($"Open item {openItemId} not found.");
            if (item.Subledger == "ap" && item.ApprovalStatus != "approved")
                throw new InvalidOperationException($"AP item {item.InternalDocumentNo} is not approved.");
            var minor = LedgerPostingService.ToMinor(amount, item.Currency);
            if (minor <= 0 || minor > item.OpenMinor)
                throw new InvalidOperationException($"Invalid match amount for {item.InternalDocumentNo}.");
            itemSum += minor;
            links.Add(new GlBankMatchLink
            {
                CompanyId = companyId,
                OpenItemId = openItemId,
                AmountMinor = minor,
            });
        }

        if (lineSum != itemSum)
            throw new InvalidOperationException(
                $"Match unbalanced: statement {LedgerPostingService.FromMinor(lineSum, lines[0].Currency)} vs items {LedgerPostingService.FromMinor(itemSum, lines[0].Currency)}.");

        var cardinality = $"{statementLineIds.Count}:{openItemAmounts.Count}";
        var group = new GlBankMatchGroup
        {
            CompanyId = companyId,
            MatchedAt = DateTime.UtcNow,
            Cardinality = cardinality,
            CreatedBy = createdBy,
            Notes = notes?.Trim() ?? "",
            Status = "active",
        };
        db.GlBankMatchGroups.Add(group);
        await db.SaveChangesAsync(ct);

        foreach (var line in lines)
        {
            line.MatchGroupId = group.Id;
            line.MatchRule = openItemAmounts.Count == 1 && statementLineIds.Count == 1 ? "manual_1_1" : "manual_group";
        }
        foreach (var link in links)
        {
            link.MatchGroupId = group.Id;
            db.GlBankMatchLinks.Add(link);
        }
        await db.SaveChangesAsync(ct);
        return group;
    }

    public async Task UnmatchAsync(int companyId, int matchGroupId, CancellationToken ct = default)
    {
        var group = await db.GlBankMatchGroups
            .FirstOrDefaultAsync(g => g.Id == matchGroupId && g.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Match group not found.");
        if (group.Status == "void") return;

        var lines = await db.GlBankStatementLines
            .Where(l => l.CompanyId == companyId && l.MatchGroupId == matchGroupId)
            .ToListAsync(ct);
        foreach (var line in lines)
        {
            line.MatchGroupId = null;
            line.MatchRule = null;
        }
        var links = await db.GlBankMatchLinks
            .Where(l => l.CompanyId == companyId && l.MatchGroupId == matchGroupId)
            .ToListAsync(ct);
        db.GlBankMatchLinks.RemoveRange(links);
        group.Status = "void";
        await db.SaveChangesAsync(ct);
    }

    public async Task AutoMatchAsync(int companyId, string createdBy, CancellationToken ct = default)
    {
        var unmatched = await db.GlBankStatementLines
            .Where(l => l.CompanyId == companyId && l.MatchGroupId == null)
            .OrderBy(l => l.ValueDate)
            .Take(80)
            .ToListAsync(ct);

        foreach (var line in unmatched)
        {
            var abs = Math.Abs(line.AmountMinor);
            var candidates = await db.GlOpenItems
                .Where(i => i.CompanyId == companyId
                    && i.Currency == line.Currency
                    && i.OpenMinor == abs
                    && i.Status != "void"
                    && (i.ApprovalStatus == "approved" || i.Subledger == "ar"))
                .ToListAsync(ct);
            var hit = candidates
                .OrderBy(i => Math.Abs(i.IssueDate.DayNumber - line.ValueDate.DayNumber))
                .FirstOrDefault();
            if (hit is null) continue;
            try
            {
                await MatchAsync(
                    companyId,
                    [line.Id],
                    [(hit.Id, LedgerPostingService.FromMinor(hit.OpenMinor, hit.Currency))],
                    createdBy,
                    notes: "auto:exact_amount",
                    ct);
            }
            catch
            {
                // skip contention / race
            }
        }
    }

    public async Task<GlFixedAsset> CreateFixedAssetAsync(
        int companyId,
        string assetTag,
        string name,
        string assetClass,
        DateOnly acquiredOn,
        decimal cost,
        string currency,
        int lifeMonths,
        CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        var cur = LedgerPostingService.NormalizeCurrency(currency);
        var asset = new GlFixedAsset
        {
            CompanyId = companyId,
            AssetTag = assetTag.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            AssetClass = assetClass.Trim(),
            AcquiredOn = acquiredOn,
            CostMinor = LedgerPostingService.ToMinor(cost, cur),
            Currency = cur,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
        };
        asset.Books.Add(new GlFixedAssetBook
        {
            CompanyId = companyId,
            BookId = "ifrs",
            Method = "straight_line",
            LifeMonths = Math.Max(1, lifeMonths),
            SalvageMinor = 0,
            StartDate = acquiredOn,
            Status = "active",
        });
        // Malaysia tax book placeholder (capital allowances later via pack)
        asset.Books.Add(new GlFixedAssetBook
        {
            CompanyId = companyId,
            BookId = "tax",
            Method = "straight_line",
            LifeMonths = Math.Max(1, lifeMonths),
            SalvageMinor = 0,
            StartDate = acquiredOn,
            Status = "active",
        });
        db.GlFixedAssets.Add(asset);
        await db.SaveChangesAsync(ct);
        return asset;
    }

    public async Task<object> RunDepreciationAsync(
        int companyId,
        string? countryCode,
        int year,
        int periodNo,
        string bookId,
        CancellationToken ct = default)
    {
        await subledger.EnsureReadyAsync(companyId, countryCode, ct);
        var assets = await db.GlFixedAssets
            .Include(a => a.Books)
            .Where(a => a.CompanyId == companyId && a.Status == "active")
            .ToListAsync(ct);

        var posted = new List<object>();
        foreach (var asset in assets)
        {
            var book = asset.Books.FirstOrDefault(b => b.BookId == bookId && b.Status == "active");
            if (book is null || book.Method == "none") continue;

            var exists = await db.GlDepreciationRuns.AnyAsync(r =>
                r.CompanyId == companyId && r.AssetId == asset.Id && r.BookId == bookId
                && r.Year == year && r.PeriodNo == periodNo, ct);
            if (exists) continue;

            var prior = await db.GlDepreciationRuns
                .Where(r => r.CompanyId == companyId && r.AssetId == asset.Id && r.BookId == bookId)
                .SumAsync(r => (long?)r.AmountMinor, ct) ?? 0;
            var depreciable = asset.CostMinor - book.SalvageMinor;
            var monthly = book.LifeMonths <= 0 ? 0 : depreciable / book.LifeMonths;
            if (monthly <= 0) continue;
            var remaining = depreciable - prior;
            if (remaining <= 0) continue;
            var amount = Math.Min(monthly, remaining);
            var nbv = remaining - amount;

            var amountMajor = LedgerPostingService.FromMinor(amount, asset.Currency);
            GlJournal? journal = null;
            try
            {
                journal = await ledger.PostAsync(
                    companyId,
                    countryCode,
                    "FA",
                    "FA",
                    new DateOnly(year, Math.Clamp(periodNo, 1, 12), 1),
                    new DateOnly(year, Math.Clamp(periodNo, 1, 12), 1),
                    "FIXED_ASSETS",
                    $"{asset.AssetTag}:{bookId}:{year}-{periodNo:00}",
                    $"Depreciation {asset.AssetTag} ({bookId})",
                    "fa-run",
                    $"fa-dep:{companyId}:{asset.Id}:{bookId}:{year}:{periodNo}",
                    [
                        ("5800", "D", amountMajor, "Depreciation expense"),
                        ("1500", "C", amountMajor, "Accumulated depreciation (net FA)"),
                    ],
                    ct,
                    txnCurrency: asset.Currency);
            }
            catch (InvalidOperationException)
            {
                // If period closed or accounts missing, still record schedule row without journal.
            }

            db.GlDepreciationRuns.Add(new GlDepreciationRun
            {
                CompanyId = companyId,
                AssetId = asset.Id,
                BookId = bookId,
                Year = year,
                PeriodNo = periodNo,
                AmountMinor = amount,
                RemainingNbvMinor = nbv,
                JournalId = journal?.Id,
                PostedAt = DateTime.UtcNow,
            });
            posted.Add(new { asset.AssetTag, bookId, amount = amountMajor, journalId = journal?.Id });
        }
        await db.SaveChangesAsync(ct);
        return new { year, periodNo, bookId, posted };
    }

    public async Task<GlRevRecContract> CreateRevRecContractAsync(
        int companyId,
        string contractNo,
        string customerName,
        DateOnly start,
        DateOnly? end,
        decimal transactionPrice,
        string currency,
        string obligationDescription,
        CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        var cur = LedgerPostingService.NormalizeCurrency(currency);
        var price = LedgerPostingService.ToMinor(transactionPrice, cur);
        var contract = new GlRevRecContract
        {
            CompanyId = companyId,
            ContractNo = contractNo.Trim(),
            CustomerName = customerName.Trim(),
            StartDate = start,
            EndDate = end,
            TransactionPriceMinor = price,
            Currency = cur,
            Status = "active",
            CreatedAt = DateTime.UtcNow,
        };
        contract.Obligations.Add(new GlRevRecObligation
        {
            CompanyId = companyId,
            Description = string.IsNullOrWhiteSpace(obligationDescription) ? "Performance obligation" : obligationDescription.Trim(),
            AllocatedMinor = price,
            RecognisedMinor = 0,
            Pattern = "over_time",
        });
        db.GlRevRecContracts.Add(contract);
        await db.SaveChangesAsync(ct);
        return contract;
    }

    public async Task<object> RecogniseRevRecAsync(
        int companyId,
        string? countryCode,
        int obligationId,
        decimal amount,
        CancellationToken ct = default)
    {
        await subledger.EnsureReadyAsync(companyId, countryCode, ct);
        var obl = await db.GlRevRecObligations
            .Include(o => o.Contract)
            .FirstOrDefaultAsync(o => o.Id == obligationId && o.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Obligation not found.");
        var cur = obl.Contract?.Currency ?? "MYR";
        var minor = LedgerPostingService.ToMinor(amount, cur);
        if (minor <= 0) throw new InvalidOperationException("Amount must be positive.");
        if (obl.RecognisedMinor + minor > obl.AllocatedMinor)
            throw new InvalidOperationException("Recognition exceeds allocated transaction price.");

        var journal = await ledger.PostAsync(
            companyId,
            countryCode,
            "REV",
            "REV",
            DateOnly.FromDateTime(DateTime.UtcNow),
            DateOnly.FromDateTime(DateTime.UtcNow),
            "REVREC",
            $"obl:{obligationId}:{obl.RecognisedMinor + minor}",
            $"RevRec {obl.Contract?.ContractNo}: {obl.Description}",
            "revrec",
            $"revrec:{companyId}:{obligationId}:{obl.RecognisedMinor + minor}",
            [
                ("1200", "D", amount, "Contract liability / deferred release"),
                ("4000", "C", amount, "Revenue recognised"),
            ],
            ct,
            txnCurrency: cur);

        obl.RecognisedMinor += minor;
        await db.SaveChangesAsync(ct);
        return new
        {
            obl.Id,
            recognised = LedgerPostingService.FromMinor(obl.RecognisedMinor, cur),
            allocated = LedgerPostingService.FromMinor(obl.AllocatedMinor, cur),
            journalId = journal.Id,
        };
    }

    public async Task<object> ComputeSst02Async(
        int companyId,
        DateOnly periodStart,
        DateOnly periodEnd,
        CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        // Internal draft only — no MyInvois / Customs transmission.
        var arTax = await db.GlOpenItems.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.Subledger == "ar"
                && i.IssueDate >= periodStart && i.IssueDate <= periodEnd
                && i.Status != "void")
            .GroupBy(i => i.TaxCode ?? "EXEMPT")
            .Select(g => new { taxCode = g.Key, tax = g.Sum(x => x.TaxMinor), gross = g.Sum(x => x.GrossMinor) })
            .ToListAsync(ct);

        var apTax = await db.GlOpenItems.AsNoTracking()
            .Where(i => i.CompanyId == companyId && i.Subledger == "ap"
                && i.IssueDate >= periodStart && i.IssueDate <= periodEnd
                && i.Status != "void"
                && i.ApprovalStatus == "approved")
            .GroupBy(i => i.TaxCode ?? "EXEMPT")
            .Select(g => new { taxCode = g.Key, tax = g.Sum(x => x.TaxMinor), gross = g.Sum(x => x.GrossMinor) })
            .ToListAsync(ct);

        var outputTax = arTax.Sum(x => x.tax);
        // MY SST: no input credit — purchase tax is expense, shown for disclosure only.
        var nonRecoverablePurchaseTax = apTax.Sum(x => x.tax);
        var boxes = new Dictionary<string, object>
        {
            ["A_output_tax_minor"] = outputTax,
            ["B_taxable_sales_gross_minor"] = arTax.Sum(x => x.gross),
            ["C_purchase_tax_expense_minor"] = nonRecoverablePurchaseTax,
            ["D_note"] = "Malaysia SST has no input tax credit. Box C is disclosure only; do not offset output.",
            ["by_tax_code_ar"] = arTax.Select(x => new
            {
                x.taxCode,
                tax = LedgerPostingService.FromMinor(x.tax),
                gross = LedgerPostingService.FromMinor(x.gross),
            }),
            ["by_tax_code_ap"] = apTax.Select(x => new
            {
                x.taxCode,
                tax = LedgerPostingService.FromMinor(x.tax),
                gross = LedgerPostingService.FromMinor(x.gross),
            }),
            ["filing"] = "SST-02 bimonthly (draft computation — transmission external)",
        };

        var row = new GlStatutoryReturn
        {
            CompanyId = companyId,
            PackId = "my",
            ReturnType = "SST-02",
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Status = "draft",
            BoxesJson = JsonSerializer.Serialize(boxes),
            ComputedAt = DateTime.UtcNow,
        };
        db.GlStatutoryReturns.Add(row);
        await db.SaveChangesAsync(ct);
        return new
        {
            row.Id,
            row.ReturnType,
            row.PeriodStart,
            row.PeriodEnd,
            row.Status,
            boxes,
            transmission = "not_connected",
        };
    }
}
