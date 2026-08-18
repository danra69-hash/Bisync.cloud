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
        var pack = string.IsNullOrWhiteSpace(countryCode) || countryCode.Equals("MY", StringComparison.OrdinalIgnoreCase)
            ? MalaysiaAccountingPackService.PackId
            : countryCode.Trim().ToLowerInvariant();
        // Always ensure MY pack tables + seed; non-MY companies still get reference pack rows.
        await malaysiaPack.EnsureMalaysiaPackAsync(companyId, ct);
        _ = pack;
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
        CancellationToken ct = default)
    {
        await EnsureReadyAsync(companyId, countryCode, ct);
        subledger = subledger.Trim().ToLowerInvariant();
        if (subledger is not ("ar" or "ap"))
            throw new InvalidOperationException("subledger must be ar or ap.");
        kind = kind.Trim().ToLowerInvariant();
        var func = LedgerPostingService.CurrencyForCountry(countryCode);
        var cur = string.IsNullOrWhiteSpace(currency)
            ? func
            : LedgerPostingService.NormalizeCurrency(currency);

        var series = subledger == "ar" ? "AR" : "AP";
        var year = issueDate.Year;
        var counter = await db.GlDocCounters
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Series == series && c.FiscalYear == year, ct);
        if (counter is null)
        {
            counter = new GlDocCounter { CompanyId = companyId, Series = series, FiscalYear = year, NextValue = 1 };
            db.GlDocCounters.Add(counter);
            await db.SaveChangesAsync(ct);
        }
        var n = counter.NextValue;
        counter.NextValue = n + 1;
        var docNo = $"{series}/{year}/{n.ToString().PadLeft(6, '0')}";

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
        };

        if (postJournal)
        {
            var net = gross - taxAmount;
            if (net < 0) throw new InvalidOperationException("Tax cannot exceed gross.");
            var eventType = subledger == "ar" ? "ar.invoice.posted" : "ap.bill.posted";
            var lines = await BuildSlaLinesAsync(companyId, eventType, net, taxAmount, gross, ct);
            var journal = await ledger.PostAsync(
                companyId,
                countryCode,
                journalType: series,
                docSeries: series,
                effectiveDate: issueDate,
                documentDate: issueDate,
                sourceModule: "SUBLEDGER",
                sourceDocKey: docNo,
                narration: $"{kind} {docNo} · {counterpartyName}",
                createdBy: "subledger",
                idempotencyKey: $"open:{companyId}:{docNo}",
                lines,
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
            .Where(i => i.CompanyId == companyId && i.Subledger == subledger && i.Status != "void" && i.OpenMinor > 0)
            .ToListAsync(ct);

        var buckets = new Dictionary<string, decimal>
        {
            ["current"] = 0,
            ["1-30"] = 0,
            ["31-60"] = 0,
            ["61-90"] = 0,
            ["90+"] = 0,
        };
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
            buckets[bucket] += open;
            rows.Add(new
            {
                i.Id,
                i.InternalDocumentNo,
                i.CounterpartyName,
                i.Currency,
                open,
                i.DueDate,
                daysPastDue = Math.Max(0, days),
                bucket,
            });
        }

        return new { asOf, subledger, buckets, rows };
    }
}
