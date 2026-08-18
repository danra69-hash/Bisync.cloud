using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>AR/AP open items, applications, FX rates, and bank statement shells (Phase 1 Malaysia-first).</summary>
public sealed class AccountingSubledgerService(
    BisyncDbContext db,
    LedgerPostingService ledger,
    MalaysiaAccountingPackService malaysiaPack)
{
    public async Task EnsureReadyAsync(int companyId, string? countryCode, CancellationToken ct = default)
    {
        await ledger.EnsureChartAndOpenPeriodsAsync(companyId, countryCode, ct);
        await malaysiaPack.EnsureCoreRolesAndSlaAsync(companyId, ct);
        if (!string.IsNullOrWhiteSpace(countryCode)
            && countryCode.Equals("MY", StringComparison.OrdinalIgnoreCase))
        {
            await malaysiaPack.EnsureMalaysiaPackAsync(companyId, ct);
        }
    }

    public async Task<GlFxRate> UpsertFxRateAsync(
        int companyId,
        string fromCurrency,
        string toCurrency,
        DateOnly rateDate,
        decimal rate,
        string rateType = "manual",
        string source = "manual",
        CancellationToken ct = default)
    {
        if (rate <= 0) throw new InvalidOperationException("FX rate must be positive.");
        fromCurrency = LedgerPostingService.NormalizeCurrency(fromCurrency);
        toCurrency = LedgerPostingService.NormalizeCurrency(toCurrency);

        var row = await db.GlFxRates.FirstOrDefaultAsync(r =>
            r.CompanyId == companyId
            && r.FromCurrency == fromCurrency
            && r.ToCurrency == toCurrency
            && r.RateDate == rateDate
            && r.RateType == rateType, ct);
        if (row is null)
        {
            row = new GlFxRate
            {
                CompanyId = companyId,
                FromCurrency = fromCurrency,
                ToCurrency = toCurrency,
                RateDate = rateDate,
                Rate = rate,
                RateType = rateType,
                Source = source,
                CreatedAt = DateTime.UtcNow,
            };
            db.GlFxRates.Add(row);
        }
        else
        {
            row.Rate = rate;
            row.Source = source;
        }
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<decimal?> FindFxRateAsync(
        int companyId,
        string fromCurrency,
        string toCurrency,
        DateOnly asOf,
        CancellationToken ct = default)
    {
        fromCurrency = LedgerPostingService.NormalizeCurrency(fromCurrency);
        toCurrency = LedgerPostingService.NormalizeCurrency(toCurrency);
        if (fromCurrency == toCurrency) return 1m;

        var row = await db.GlFxRates.AsNoTracking()
            .Where(r =>
                r.CompanyId == companyId
                && r.FromCurrency == fromCurrency
                && r.ToCurrency == toCurrency
                && r.RateDate <= asOf)
            .OrderByDescending(r => r.RateDate)
            .ThenByDescending(r => r.Id)
            .FirstOrDefaultAsync(ct);
        return row?.Rate;
    }

    public sealed record OpenItemLineInput(
        string Description,
        decimal Quantity,
        decimal UnitPrice,
        decimal Net,
        decimal TaxAmount,
        string? TaxCode,
        string? AccountCode,
        string? ProductRef);

    public async Task<GlOpenItem> CreateOpenItemAsync(
        int companyId,
        string? countryCode,
        string subledger,
        string kind,
        string counterpartyName,
        DateOnly issueDate,
        DateOnly dueDate,
        decimal gross,
        string? currency,
        string? taxCode,
        decimal taxAmount,
        string narration,
        bool postJournal,
        string? createdBy = null,
        bool requireApApproval = true,
        IReadOnlyList<OpenItemLineInput>? lines = null,
        CancellationToken ct = default)
    {
        await EnsureReadyAsync(companyId, countryCode, ct);
        subledger = subledger.Trim().ToLowerInvariant();
        if (subledger is not ("ar" or "ap"))
            throw new InvalidOperationException("subledger must be ar or ap.");
        kind = kind.Trim().ToLowerInvariant();
        var func = await ledger.ResolveFunctionalCurrencyAsync(companyId, countryCode, persist: true, ct);
        var cur = string.IsNullOrWhiteSpace(currency)
            ? func
            : LedgerPostingService.NormalizeCurrency(currency);
        var actor = string.IsNullOrWhiteSpace(createdBy) ? "accounting-ui" : createdBy.Trim();

        var approval = "approved";
        if (subledger == "ap" && requireApApproval && kind is "bill" or "payment" or "credit_note")
            approval = "draft";

        var series = subledger == "ar" ? "AR" : "AP";
        var journalSeries = subledger == "ar" ? "ARJ" : "APJ";
        var year = issueDate.Year;
        await ledger.EnsurePeriodsForYearAsync(companyId, year, ct);
        var docNo = await ledger.AllocateDocNumberAsync(companyId, series, year, ct);

        if (lines is { Count: > 0 })
        {
            gross = lines.Sum(l => l.Net + l.TaxAmount);
            taxAmount = lines.Sum(l => l.TaxAmount);
            if (string.IsNullOrWhiteSpace(taxCode))
                taxCode = lines.Select(l => l.TaxCode).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t));
        }

        var grossMinor = LedgerPostingService.ToMinor(gross, cur);
        var taxMinor = LedgerPostingService.ToMinor(taxAmount, cur);
        var item = new GlOpenItem
        {
            CompanyId = companyId,
            Subledger = subledger,
            Kind = kind,
            CounterpartyName = counterpartyName.Trim(),
            Currency = cur,
            IssueDate = issueDate,
            DueDate = dueDate,
            GrossMinor = grossMinor,
            OpenMinor = grossMinor,
            InternalDocumentNo = docNo,
            Status = "open",
            TaxCode = taxCode,
            TaxMinor = taxMinor,
            Narration = narration?.Trim() ?? "",
            CreatedAt = DateTime.UtcNow,
            ApprovalStatus = approval,
            CreatedBy = actor,
        };

        if (lines is { Count: > 0 })
        {
            var lineNo = 1;
            foreach (var l in lines)
            {
                if (l.Net < 0 || l.TaxAmount < 0)
                    throw new InvalidOperationException("Line net/tax cannot be negative.");
                var qty = l.Quantity <= 0 ? 1m : l.Quantity;
                item.Lines.Add(new GlOpenItemLine
                {
                    CompanyId = companyId,
                    LineNo = lineNo++,
                    Description = (l.Description ?? "").Trim(),
                    AccountCode = (l.AccountCode ?? "").Trim(),
                    Quantity = qty,
                    UnitPriceMinor = LedgerPostingService.ToMinor(l.UnitPrice, cur),
                    NetMinor = LedgerPostingService.ToMinor(l.Net, cur),
                    TaxMinor = LedgerPostingService.ToMinor(l.TaxAmount, cur),
                    TaxCode = l.TaxCode,
                    ProductRef = l.ProductRef,
                });
            }
        }

        var shouldPost = postJournal && approval == "approved";
        if (shouldPost)
        {
            var net = gross - taxAmount;
            if (net < 0) throw new InvalidOperationException("Tax cannot exceed gross.");
            var eventType = ResolveSlaEvent(subledger, kind);
            List<(string AccountCode, string Direction, decimal Amount, string LineNarration)> journalLines;
            if (lines is { Count: > 0 } && lines.Any(l => !string.IsNullOrWhiteSpace(l.AccountCode)))
            {
                journalLines = await BuildLinesFromDocumentAsync(companyId, subledger, kind, lines, gross, taxAmount, ct);
            }
            else
            {
                journalLines = await BuildSlaLinesAsync(companyId, eventType, net, taxAmount, gross, ct);
            }
            var journal = await ledger.PostAsync(
                companyId,
                countryCode,
                journalType: series,
                docSeries: journalSeries,
                effectiveDate: issueDate,
                documentDate: issueDate,
                sourceModule: "SUBLEDGER",
                sourceDocKey: docNo,
                narration: $"{kind} {docNo} · {counterpartyName}",
                createdBy: actor,
                idempotencyKey: $"open:{companyId}:{docNo}",
                journalLines,
                ct,
                txnCurrency: cur,
                fxRate: cur == func ? null : await FindFxRateAsync(companyId, cur, func, issueDate, ct),
                fxRateDate: issueDate);
            item.JournalId = journal.Id;
        }

        db.GlOpenItems.Add(item);
        await db.SaveChangesAsync(ct);
        return item;
    }

    async Task<List<(string AccountCode, string Direction, decimal Amount, string LineNarration)>> BuildLinesFromDocumentAsync(
        int companyId,
        string subledger,
        string kind,
        IReadOnlyList<OpenItemLineInput> lines,
        decimal gross,
        decimal taxAmount,
        CancellationToken ct)
    {
        var controlRole = subledger == "ar" ? "ar_control" : "ap_control";
        var controlFallback = subledger == "ar" ? "1110" : "2010";
        var control = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, controlRole, controlFallback, ct);
        var taxRole = subledger == "ar" ? "tax_output_payable" : "tax_expense_nonrecoverable";
        var taxFallback = subledger == "ar" ? "2210" : "5210";
        var taxAcct = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, taxRole, taxFallback, ct);
        var defaultIncome = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "revenue_default", "4000", ct);
        var defaultExpense = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, "cogs_default", "5200", ct);
        var isCreditNote = kind == "credit_note";

        var result = new List<(string AccountCode, string Direction, decimal Amount, string LineNarration)>();
        if (subledger == "ar")
        {
            if (!isCreditNote)
                result.Add((control, "D", gross, "AR control"));
            else
                result.Add((control, "C", gross, "AR control"));
        }
        else
        {
            if (!isCreditNote)
                result.Add((control, "C", gross, "AP control"));
            else
                result.Add((control, "D", gross, "AP control"));
        }

        foreach (var l in lines)
        {
            if (l.Net <= 0) continue;
            var acct = string.IsNullOrWhiteSpace(l.AccountCode)
                ? (subledger == "ar" ? defaultIncome : defaultExpense)
                : l.AccountCode.Trim();
            var dir = subledger == "ar"
                ? (isCreditNote ? "D" : "C")
                : (isCreditNote ? "C" : "D");
            result.Add((acct, dir, l.Net, string.IsNullOrWhiteSpace(l.Description) ? acct : l.Description));
        }

        if (taxAmount > 0)
        {
            var taxDir = subledger == "ar"
                ? (isCreditNote ? "D" : "C")
                : (isCreditNote ? "C" : "D");
            result.Add((taxAcct, taxDir, taxAmount, "Tax"));
        }

        return result;
    }

    public async Task PostDeferredJournalIfNeededAsync(int companyId, string? countryCode, int openItemId, CancellationToken ct = default)
    {
        var item = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Open item not found.");
        if (item.JournalId is not null || item.ApprovalStatus != "approved") return;
        if (item.Kind is not ("bill" or "invoice" or "payment")) return;

        var func = await ledger.ResolveFunctionalCurrencyAsync(companyId, countryCode, persist: false, ct);
        var gross = LedgerPostingService.FromMinor(item.GrossMinor, item.Currency);
        var tax = LedgerPostingService.FromMinor(item.TaxMinor, item.Currency);
        var net = gross - tax;
        var eventType = ResolveSlaEvent(item.Subledger, item.Kind);
        var lines = await BuildSlaLinesAsync(companyId, eventType, net, tax, gross, ct);
        var series = item.Subledger == "ar" ? "AR" : "AP";
        var journalSeries = item.Subledger == "ar" ? "ARJ" : "APJ";
        var journal = await ledger.PostAsync(
            companyId,
            countryCode,
            journalType: series,
            docSeries: journalSeries,
            effectiveDate: item.IssueDate,
            documentDate: item.IssueDate,
            sourceModule: "SUBLEDGER",
            sourceDocKey: item.InternalDocumentNo,
            narration: $"{item.Kind} {item.InternalDocumentNo} · {item.CounterpartyName}",
            createdBy: item.ApprovedBy ?? item.CreatedBy,
            idempotencyKey: $"open:{companyId}:{item.InternalDocumentNo}",
            lines,
            ct,
            txnCurrency: item.Currency,
            fxRate: item.Currency == func ? null : await FindFxRateAsync(companyId, item.Currency, func, item.IssueDate, ct),
            fxRateDate: item.IssueDate);
        item.JournalId = journal.Id;
        await db.SaveChangesAsync(ct);
    }

    async Task<List<(string AccountCode, string Direction, decimal Amount, string LineNarration)>> BuildSlaLinesAsync(
        int companyId,
        string eventType,
        decimal net,
        decimal tax,
        decimal gross,
        CancellationToken ct)
    {
        var set = await db.GlSlaRuleSets.AsNoTracking()
            .Include(s => s.Lines)
            .Where(s => s.CompanyId == companyId && s.EventType == eventType && s.Status == "active")
            .OrderByDescending(s => s.Version)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException($"No active SLA rule set for {eventType}. Ensure Malaysia pack is seeded.");

        var roles = await db.GlAccountRoles.AsNoTracking()
            .Where(r => r.CompanyId == companyId)
            .ToListAsync(ct);
        var accountIds = roles.Where(r => r.AccountId is > 0).Select(r => r.AccountId!.Value).Distinct().ToList();
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId && accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.Code, ct);

        var result = new List<(string, string, decimal, string)>();
        foreach (var line in set.Lines.OrderBy(l => l.Seq))
        {
            var role = roles.FirstOrDefault(r => r.RoleCode == line.AccountRole)
                ?? throw new InvalidOperationException($"SLA role '{line.AccountRole}' is not defined.");
            if (role.AccountId is null or <= 0 || !accounts.TryGetValue(role.AccountId.Value, out var code))
                throw new InvalidOperationException($"SLA role '{line.AccountRole}' is not mapped to an account.");

            var amount = line.AmountSource switch
            {
                "tax" => tax,
                "gross" => gross,
                "net" => net,
                _ => net,
            };
            if (amount <= 0 && line.AmountSource == "tax") continue;
            if (amount <= 0) continue;
            result.Add((code, line.Direction, amount, $"{set.EventType}:{line.AccountRole}"));
        }
        if (result.Count < 2)
            throw new InvalidOperationException("SLA produced fewer than two lines.");
        return result;
    }

    public async Task ApplyAsync(
        int companyId,
        int fromId,
        int toId,
        decimal amount,
        DateOnly effectiveDate,
        string createdBy,
        CancellationToken ct = default)
    {
        if (amount <= 0) throw new InvalidOperationException("Application amount must be positive.");
        var from = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == fromId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Applied-from item not found.");
        var to = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == toId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Applied-to item not found.");
        if (from.Currency != to.Currency)
            throw new InvalidOperationException("Cross-currency apply requires FX settlement (not yet). Use same currency.");
        if (from.Subledger != to.Subledger)
            throw new InvalidOperationException("Cannot apply across AR and AP.");
        if (from.Subledger == "ap"
            && (from.ApprovalStatus != "approved" || to.ApprovalStatus != "approved"))
            throw new InvalidOperationException("AP items must be approved before application.");
        if (!AreComplementaryKinds(from.Kind, to.Kind))
            throw new InvalidOperationException("Apply requires a payment/credit against an invoice or bill — not two invoices.");

        var minor = LedgerPostingService.ToMinor(amount, from.Currency);
        if (minor > from.OpenMinor || minor > to.OpenMinor)
            throw new InvalidOperationException("Application exceeds open balance.");

        from.OpenMinor -= minor;
        to.OpenMinor -= minor;
        from.Status = from.OpenMinor == 0 ? "settled" : "partial";
        to.Status = to.OpenMinor == 0 ? "settled" : "partial";

        db.GlItemApplications.Add(new GlItemApplication
        {
            CompanyId = companyId,
            AppliedFromId = fromId,
            AppliedToId = toId,
            AmountMinor = minor,
            AppliedAt = DateTime.UtcNow,
            EffectiveDate = effectiveDate,
            CreatedBy = createdBy,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<object> AgingAsync(int companyId, string subledger, DateOnly asOf, CancellationToken ct = default)
    {
        subledger = subledger.Trim().ToLowerInvariant();
        var items = await db.GlOpenItems.AsNoTracking()
            .Where(i => i.CompanyId == companyId
                && i.Subledger == subledger
                && i.Status != "void"
                && i.Status != "rejected"
                && i.OpenMinor > 0
                && i.JournalId != null
                && (i.Kind == "invoice" || i.Kind == "bill")
                && (i.Subledger != "ap" || i.ApprovalStatus == "approved"))
            .ToListAsync(ct);

        var byCurrency = new Dictionary<string, Dictionary<string, decimal>>(StringComparer.OrdinalIgnoreCase);
        var rows = new List<object>();
        foreach (var i in items)
        {
            var days = asOf.DayNumber - i.DueDate.DayNumber;
            var open = LedgerPostingService.FromMinor(i.OpenMinor, i.Currency);
            var bucket = days <= 0 ? "current"
                : days <= 30 ? "1-30"
                : days <= 60 ? "31-60"
                : days <= 90 ? "61-90"
                : "90+";
            if (!byCurrency.TryGetValue(i.Currency, out var buckets))
            {
                buckets = new Dictionary<string, decimal>
                {
                    ["current"] = 0,
                    ["1-30"] = 0,
                    ["31-60"] = 0,
                    ["61-90"] = 0,
                    ["90+"] = 0,
                };
                byCurrency[i.Currency] = buckets;
            }
            buckets[bucket] += open;
            rows.Add(new
            {
                i.Id,
                i.InternalDocumentNo,
                i.CounterpartyName,
                i.Currency,
                i.Kind,
                open,
                i.DueDate,
                daysPastDue = Math.Max(0, days),
                bucket,
            });
        }

        var primary = byCurrency.Count == 1
            ? byCurrency.Values.First()
            : new Dictionary<string, decimal>
            {
                ["current"] = 0,
                ["1-30"] = 0,
                ["31-60"] = 0,
                ["61-90"] = 0,
                ["90+"] = 0,
            };

        return new
        {
            asOf,
            subledger,
            buckets = primary,
            byCurrency = byCurrency.Select(kv => new { currency = kv.Key, buckets = kv.Value }),
            mixedCurrencies = byCurrency.Count > 1,
            rows,
        };
    }

    public async Task VoidOpenItemAsync(int companyId, int openItemId, string actor, CancellationToken ct = default)
    {
        var item = await db.GlOpenItems.FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Open item not found.");
        if (item.Status == "void") return;
        if (item.OpenMinor != item.GrossMinor)
            throw new InvalidOperationException("Cannot void an item that has been applied or matched. Un-apply first.");

        if (item.JournalId is int journalId)
            await ledger.ReverseAsync(companyId, journalId, actor, ct);

        item.Status = "void";
        item.OpenMinor = 0;
        item.ApprovalStatus = item.ApprovalStatus == "draft" || item.ApprovalStatus == "pending_approval"
            ? "rejected"
            : item.ApprovalStatus;
        await db.SaveChangesAsync(ct);
    }

    static string ResolveSlaEvent(string subledger, string kind)
        => kind switch
        {
            "payment" => subledger == "ar" ? "bank.receipt.posted" : "bank.payment.posted",
            "credit_note" => subledger == "ar" ? "ar.credit_note.posted" : "ap.credit_note.posted",
            _ => subledger == "ar" ? "ar.invoice.posted" : "ap.bill.posted",
        };

    static bool AreComplementaryKinds(string fromKind, string toKind)
    {
        static bool IsSource(string k) => k is "payment" or "credit_note" or "debit_note";
        static bool IsTarget(string k) => k is "invoice" or "bill";
        return (IsSource(fromKind) && IsTarget(toKind)) || (IsSource(toKind) && IsTarget(fromKind));
    }

    public async Task<object> ControlAccountReconciliationAsync(
        int companyId,
        string subledger,
        DateOnly asOf,
        CancellationToken ct = default)
    {
        subledger = subledger.Trim().ToLowerInvariant();
        if (subledger is not ("ar" or "ap"))
            throw new InvalidOperationException("subledger must be ar or ap.");

        var roleCode = subledger == "ar" ? "ar_control" : "ap_control";
        var fallback = subledger == "ar" ? "1110" : "2010";
        var accountCode = await malaysiaPack.ResolveRoleAccountCodeAsync(companyId, roleCode, fallback, ct);
        var account = await db.GlAccounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == accountCode, ct)
            ?? throw new InvalidOperationException($"Control account {accountCode} not found.");

        var func = await ledger.ResolveFunctionalCurrencyAsync(companyId, null, persist: false, ct);
        var period = await db.GlFiscalPeriods.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CompanyId == companyId && p.StartDate <= asOf && p.EndDate >= asOf, ct);
        long glMinor = 0;
        if (period is not null)
        {
            var bal = await db.GlPeriodBalances.AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.CompanyId == companyId
                    && b.AccountId == account.Id
                    && b.PeriodId == period.Id
                    && b.Currency == func, ct);
            if (bal is not null)
            {
                var closing = bal.OpeningDrMinor + bal.PeriodDrMinor - bal.OpeningCrMinor - bal.PeriodCrMinor;
                // AR normal debit; AP normal credit — report absolute control balance in natural sign.
                glMinor = account.NormalBalance == "D" ? closing : -closing;
            }
        }

        var openItems = await db.GlOpenItems.AsNoTracking()
            .Where(i => i.CompanyId == companyId
                && i.Subledger == subledger
                && i.Status != "void"
                && i.Status != "rejected"
                && i.OpenMinor > 0
                && i.JournalId != null
                && (i.Kind == "invoice" || i.Kind == "bill")
                && (i.Subledger != "ap" || i.ApprovalStatus == "approved")
                && i.IssueDate <= asOf)
            .ToListAsync(ct);

        var byCurrency = openItems
            .GroupBy(i => i.Currency)
            .Select(g => new
            {
                currency = g.Key,
                open = LedgerPostingService.FromMinor(g.Sum(x => x.OpenMinor), g.Key),
                count = g.Count(),
            })
            .ToList();

        var subledgerFuncMinor = openItems
            .Where(i => i.Currency == func)
            .Sum(i => i.OpenMinor);
        var drift = subledgerFuncMinor - glMinor;

        return new
        {
            asOf,
            subledger,
            controlAccount = accountCode,
            functionalCurrency = func,
            glControl = LedgerPostingService.FromMinor(glMinor, func),
            subledgerOpen = LedgerPostingService.FromMinor(subledgerFuncMinor, func),
            drift = LedgerPostingService.FromMinor(drift, func),
            reconciled = drift == 0,
            byCurrency,
            note = "Compares posted open invoices/bills in functional currency to the GL control closing balance. Foreign-currency open items are listed separately and excluded from the drift figure.",
        };
    }
}
