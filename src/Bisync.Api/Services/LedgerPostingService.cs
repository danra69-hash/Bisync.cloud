using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Phase 0 ledger posting — immutable sealed journals, gapless numbers at post,
/// period balances updated in the same transaction. See docs/ACCOUNTING_ARCHITECTURE.md.
/// </summary>
public sealed class LedgerPostingService(BisyncDbContext db)
{
    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static string CurrencyForCountry(string? countryCode) =>
        (countryCode ?? "MY").Trim().ToUpperInvariant() switch
        {
            "SG" => "SGD",
            "US" => "USD",
            "GB" or "UK" => "GBP",
            "EU" or "DE" or "FR" or "IT" or "ES" or "NL" or "BE" => "EUR",
            "AU" => "AUD",
            "NZ" => "NZD",
            "TH" => "THB",
            "ID" => "IDR",
            "JP" => "JPY",
            "KR" => "KRW",
            "CN" or "HK" => "CNY",
            _ => "MYR",
        };

    public static long ToMinor(decimal amount) =>
        (long)decimal.Round(amount * 100m, 0, MidpointRounding.AwayFromZero);

    public static decimal FromMinor(long minor) => minor / 100m;

    public async Task EnsureChartAndOpenPeriodsAsync(int companyId, string? countryCode, CancellationToken ct = default)
    {
        if (companyId <= 0)
            throw new InvalidOperationException("Company context is required for ledger operations.");

        var currency = CurrencyForCountry(countryCode);
        _ = currency;

        if (!await db.GlAccounts.AnyAsync(a => a.CompanyId == companyId, ct))
        {
            var seeds = new (string Code, string Name, string Type, string Normal)[]
            {
                ("1000", "Cash and bank", "asset", "D"),
                ("1400", "Inventory", "asset", "D"),
                ("2000", "Accounts payable", "liability", "C"),
                ("2100", "Net pay payable", "liability", "C"),
                ("2110", "EPF payable", "liability", "C"),
                ("2120", "SOCSO payable", "liability", "C"),
                ("2130", "Income tax payable", "liability", "C"),
                ("5100", "Salaries and wages", "expense", "D"),
                ("5110", "Employer statutory contributions", "expense", "D"),
                ("5200", "Cost of goods — inventory", "expense", "D"),
            };
            foreach (var s in seeds)
            {
                db.GlAccounts.Add(new GlAccount
                {
                    CompanyId = companyId,
                    Code = s.Code,
                    Name = s.Name,
                    AccountType = s.Type,
                    NormalBalance = s.Normal,
                    Active = true,
                    CreatedAt = DateTime.UtcNow,
                });
            }
            await db.SaveChangesAsync(ct);
        }

        var year = DateTime.UtcNow.Year;
        if (!await db.GlFiscalPeriods.AnyAsync(p => p.CompanyId == companyId && p.Year == year, ct))
        {
            for (var m = 1; m <= 12; m++)
            {
                var start = new DateOnly(year, m, 1);
                var end = start.AddMonths(1).AddDays(-1);
                db.GlFiscalPeriods.Add(new GlFiscalPeriod
                {
                    CompanyId = companyId,
                    Year = year,
                    PeriodNo = m,
                    StartDate = start,
                    EndDate = end,
                    Status = m >= DateTime.UtcNow.Month - 1 ? "open" : "open",
                });
            }
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<GlFiscalPeriod> RequireOpenPeriodAsync(int companyId, DateOnly effectiveDate, CancellationToken ct = default)
    {
        var period = await db.GlFiscalPeriods
            .FirstOrDefaultAsync(p =>
                p.CompanyId == companyId
                && p.StartDate <= effectiveDate
                && p.EndDate >= effectiveDate, ct)
            ?? throw new InvalidOperationException($"No fiscal period covers {effectiveDate:yyyy-MM-dd} for company {companyId}.");

        if (period.Status is "closed" or "hard_closed")
            throw new InvalidOperationException($"Period {period.Year}-{period.PeriodNo:00} is {period.Status}; posting rejected.");

        return period;
    }

    public async Task EnqueueOutboxAsync(
        int companyId,
        string eventType,
        object payload,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        if (companyId <= 0)
            throw new InvalidOperationException("Company context is required for outbox enqueue.");

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var exists = await db.GlOutboxMessages.AnyAsync(
                m => m.CompanyId == companyId && m.IdempotencyKey == idempotencyKey, ct);
            if (exists) return;
        }

        db.GlOutboxMessages.Add(new GlOutboxMessage
        {
            CompanyId = companyId,
            EventType = eventType,
            PayloadJson = JsonSerializer.Serialize(payload, JsonOpts),
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow,
        });
    }

    /// <summary>
    /// Posts a balanced journal. Amounts are decimal major units; stored as integer minor units.
    /// Idempotent when <paramref name="idempotencyKey"/> is set.
    /// </summary>
    public async Task<GlJournal> PostAsync(
        int companyId,
        string? countryCode,
        string journalType,
        string docSeries,
        DateOnly effectiveDate,
        DateOnly documentDate,
        string sourceModule,
        string? sourceDocKey,
        string narration,
        string createdBy,
        string? idempotencyKey,
        IReadOnlyList<(string AccountCode, string Direction, decimal Amount, string LineNarration)> lines,
        CancellationToken ct = default)
    {
        if (companyId <= 0)
            throw new InvalidOperationException("Company context is required for posting.");

        await EnsureChartAndOpenPeriodsAsync(companyId, countryCode, ct);

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existing = await db.GlJournals
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.CompanyId == companyId && j.IdempotencyKey == idempotencyKey, ct);
            if (existing is not null) return existing;
        }

        var currency = CurrencyForCountry(countryCode);
        var period = await RequireOpenPeriodAsync(companyId, effectiveDate, ct);

        var draftLines = new List<(GlAccount Account, string Direction, long Minor, string Narration)>();
        foreach (var line in lines)
        {
            if (line.Amount <= 0) continue;
            var dir = line.Direction.Trim().ToUpperInvariant();
            if (dir is not ("D" or "C"))
                throw new InvalidOperationException($"Invalid direction '{line.Direction}'.");
            var account = await db.GlAccounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == line.AccountCode && a.Active, ct)
                ?? throw new InvalidOperationException($"Unknown account code {line.AccountCode}.");
            draftLines.Add((account, dir, ToMinor(line.Amount), line.LineNarration));
        }

        if (draftLines.Count < 2)
            throw new InvalidOperationException("A journal needs at least two lines.");

        long debit = draftLines.Where(l => l.Direction == "D").Sum(l => l.Minor);
        long credit = draftLines.Where(l => l.Direction == "C").Sum(l => l.Minor);
        if (debit != credit)
            throw new InvalidOperationException($"Journal unbalanced: debit {debit} vs credit {credit} minor units.");

        var journal = new GlJournal
        {
            CompanyId = companyId,
            LedgerKind = "primary",
            JournalType = journalType,
            DocSeries = docSeries,
            FiscalYear = period.Year,
            EffectiveDate = effectiveDate,
            DocumentDate = documentDate,
            PeriodId = period.Id,
            SourceModule = sourceModule,
            SourceDocKey = sourceDocKey,
            IdempotencyKey = idempotencyKey,
            Narration = narration,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
        };

        // Number last — lock counter in this transaction.
        var counter = await db.GlDocCounters
            .FirstOrDefaultAsync(c =>
                c.CompanyId == companyId && c.Series == docSeries && c.FiscalYear == period.Year, ct);
        if (counter is null)
        {
            counter = new GlDocCounter
            {
                CompanyId = companyId,
                Series = docSeries,
                FiscalYear = period.Year,
                NextValue = 1,
            };
            db.GlDocCounters.Add(counter);
            await db.SaveChangesAsync(ct);
        }

        var n = counter.NextValue;
        counter.NextValue = n + 1;
        journal.DocNumber = $"{docSeries}/{period.Year}/{n.ToString().PadLeft(6, '0')}";
        journal.PostedAt = DateTime.UtcNow;

        var lineNo = 1;
        foreach (var line in draftLines)
        {
            journal.Lines.Add(new GlJournalLine
            {
                CompanyId = companyId,
                LineNo = lineNo++,
                AccountId = line.Account.Id,
                Direction = line.Direction,
                Currency = currency,
                AmountMinor = line.Minor,
                FuncCurrency = currency,
                FuncAmountMinor = line.Minor,
                Narration = line.Narration,
                EffectiveDate = effectiveDate,
                PeriodId = period.Id,
            });

            await ApplyPeriodBalanceAsync(
                companyId, line.Account.Id, period.Id, currency, line.Direction, line.Minor, ct);
        }

        db.GlJournals.Add(journal);
        await EnqueueOutboxAsync(
            companyId,
            "ledger.journal_posted",
            new { journal.DocNumber, journal.JournalType, journal.SourceModule, sourceDocKey },
            idempotencyKey: idempotencyKey is null ? null : $"outbox:{idempotencyKey}",
            ct);
        await db.SaveChangesAsync(ct);
        return journal;
    }

    async Task ApplyPeriodBalanceAsync(
        int companyId,
        int accountId,
        int periodId,
        string currency,
        string direction,
        long minor,
        CancellationToken ct)
    {
        var bal = await db.GlPeriodBalances
            .FirstOrDefaultAsync(b =>
                b.CompanyId == companyId
                && b.AccountId == accountId
                && b.PeriodId == periodId
                && b.Currency == currency, ct);
        if (bal is null)
        {
            bal = new GlPeriodBalance
            {
                CompanyId = companyId,
                AccountId = accountId,
                PeriodId = periodId,
                Currency = currency,
            };
            db.GlPeriodBalances.Add(bal);
        }

        if (direction == "D") bal.PeriodDrMinor += minor;
        else bal.PeriodCrMinor += minor;
    }

    public async Task<GlJournal> ReverseAsync(
        int companyId,
        int journalId,
        string createdBy,
        CancellationToken ct = default)
    {
        var original = await db.GlJournals
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == journalId && j.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Journal not found.");

        if (original.PostedAt is null)
            throw new InvalidOperationException("Cannot reverse an unposted draft.");

        var reverseKey = $"reverse:{original.Id}";
        var existing = await db.GlJournals
            .FirstOrDefaultAsync(j => j.CompanyId == companyId && j.IdempotencyKey == reverseKey, ct);
        if (existing is not null) return existing;

        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId, ct);
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId)
            .ToDictionaryAsync(a => a.Id, a => a.Code, ct);

        var lines = original.Lines
            .OrderBy(l => l.LineNo)
            .Select(l => (
                AccountCode: accounts[l.AccountId],
                Direction: l.Direction == "D" ? "C" : "D",
                Amount: FromMinor(l.AmountMinor),
                LineNarration: $"Reversal of {original.DocNumber}: {l.Narration}"))
            .ToList();

        var reversal = await PostAsync(
            companyId,
            company?.CountryCode,
            original.JournalType,
            original.DocSeries,
            DateOnly.FromDateTime(DateTime.UtcNow),
            original.DocumentDate,
            original.SourceModule,
            original.SourceDocKey,
            $"Reversal of {original.DocNumber}",
            createdBy,
            reverseKey,
            lines,
            ct);

        reversal.ReversesJournalId = original.Id;
        await db.SaveChangesAsync(ct);
        return reversal;
    }

    public async Task SoftClosePeriodAsync(int companyId, int periodId, CancellationToken ct = default)
    {
        var period = await db.GlFiscalPeriods
            .FirstOrDefaultAsync(p => p.Id == periodId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Period not found.");
        if (period.Status == "hard_closed")
            throw new InvalidOperationException("Hard-closed periods cannot be changed.");
        period.Status = "closed";
        await db.SaveChangesAsync(ct);
    }
}
