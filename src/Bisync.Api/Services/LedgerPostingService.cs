using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Phase 0 ledger posting — immutable sealed journals, gapless numbers at post,
/// period balances updated in the same transaction. See docs/ACCOUNTING_ARCHITECTURE.md.
/// </summary>
public sealed class LedgerPostingService(BisyncDbContext db, MalaysiaAccountingPackService malaysiaPack)
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

    public static long ToMinor(decimal amount, string currency)
    {
        var decimals = MinorDecimals(currency);
        var scale = decimals == 0 ? 1m : (decimal)Math.Pow(10, decimals);
        return (long)decimal.Round(amount * scale, 0, MidpointRounding.AwayFromZero);
    }

    public static decimal FromMinor(long minor) => minor / 100m;

    public static decimal FromMinor(long minor, string currency)
    {
        var decimals = MinorDecimals(currency);
        var scale = decimals == 0 ? 1m : (decimal)Math.Pow(10, decimals);
        return minor / scale;
    }

    public static int MinorDecimals(string currency) =>
        currency.Trim().ToUpperInvariant() switch
        {
            "JPY" or "KRW" or "VND" or "XAF" or "XOF" => 0,
            "BHD" or "KWD" or "OMR" or "TND" => 3,
            _ => 2,
        };

    public static string NormalizeCurrency(string? code)
    {
        var c = (code ?? "").Trim().ToUpperInvariant();
        if (c.Length != 3 || c.Any(ch => ch is < 'A' or > 'Z'))
            throw new InvalidOperationException("Currency must be a 3-letter ISO code (e.g. USD).");
        return c;
    }

    public static readonly string[] CommonCurrencies =
    [
        "MYR", "SGD", "USD", "EUR", "GBP", "AUD", "NZD", "THB", "IDR", "JPY",
        "CNY", "HKD", "TWD", "KRW", "INR", "PHP", "VND", "AED", "SAR", "CHF",
    ];

    public async Task EnsureChartAndOpenPeriodsAsync(int companyId, string? countryCode, CancellationToken ct = default)
    {
        if (companyId <= 0)
            throw new InvalidOperationException("Company context is required for ledger operations.");

        await SchemaPatcher.EnsureGlLedgerTablesAsync(db);
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        await ResolveFunctionalCurrencyAsync(companyId, countryCode, persist: true, ct);
        await EnsureSeedAccountsAsync(companyId, ct);
        if (!string.IsNullOrWhiteSpace(countryCode)
            && countryCode.Equals("MY", StringComparison.OrdinalIgnoreCase))
        {
            await malaysiaPack.EnsureMalaysiaPackAsync(companyId, ct);
        }

        await EnsurePeriodsForYearAsync(companyId, DateTime.UtcNow.Year, ct);
    }

    public async Task EnsurePeriodsForYearAsync(int companyId, int year, CancellationToken ct = default)
    {
        if (year is < 2000 or > 2100)
            throw new InvalidOperationException($"Fiscal year {year} is out of range.");
        if (await db.GlFiscalPeriods.AnyAsync(p => p.CompanyId == companyId && p.Year == year, ct))
            return;

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
                Status = "open",
            });
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<string> ResolveFunctionalCurrencyAsync(
        int companyId,
        string? countryCode,
        bool persist = false,
        CancellationToken ct = default)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == companyId, ct);
        var stored = (company?.FunctionalCurrency ?? "").Trim().ToUpperInvariant();
        if (stored.Length == 3 && stored.All(ch => ch is >= 'A' and <= 'Z'))
            return stored;

        var derived = CurrencyForCountry(company?.CountryCode ?? countryCode);
        if (persist && company is not null && string.IsNullOrWhiteSpace(company.FunctionalCurrency))
        {
            company.FunctionalCurrency = derived;
            await db.SaveChangesAsync(ct);
        }
        return derived;
    }

    /// <summary>Hospitality-oriented default COA. Idempotent — adds any missing seed codes.</summary>
    public async Task EnsureSeedAccountsAsync(int companyId, CancellationToken ct = default)
    {
        var seeds = new (string Code, string Name, string Type, string Normal)[]
        {
            ("1000", "Cash and bank", "asset", "D"),
            ("1100", "Accounts receivable", "asset", "D"),
            ("1200", "Deposits and prepayments", "asset", "D"),
            ("1400", "Inventory", "asset", "D"),
            ("1500", "Fixed assets", "asset", "D"),
            ("1510", "Accumulated depreciation", "asset", "C"),
            ("2000", "Accounts payable", "liability", "C"),
            ("2010", "Trade payables control", "liability", "C"),
            ("2400", "Deferred revenue", "liability", "C"),
            ("2100", "Net pay payable", "liability", "C"),
            ("2110", "EPF payable", "liability", "C"),
            ("2120", "SOCSO payable", "liability", "C"),
            ("2130", "Income tax payable", "liability", "C"),
            ("2200", "Tax payable (GST/SST/VAT)", "liability", "C"),
            ("2300", "Accruals", "liability", "C"),
            ("3000", "Owner equity / retained earnings", "equity", "C"),
            ("4000", "Food and beverage sales", "income", "C"),
            ("4100", "Other operating income", "income", "C"),
            ("5100", "Salaries and wages", "expense", "D"),
            ("5110", "Employer statutory contributions", "expense", "D"),
            ("5200", "Cost of goods — inventory", "expense", "D"),
            ("5300", "Rent and premises", "expense", "D"),
            ("5400", "Utilities", "expense", "D"),
            ("5500", "Marketing and promotions", "expense", "D"),
            ("5600", "Repairs and maintenance", "expense", "D"),
            ("5700", "Bank charges and FX", "expense", "D"),
            ("5800", "Other operating expenses", "expense", "D"),
            ("5810", "Depreciation expense", "expense", "D"),
            ("5900", "Rounding / suspense", "expense", "D"),
        };

        var existing = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId)
            .Select(a => a.Code)
            .ToListAsync(ct);
        var have = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var added = false;
        foreach (var s in seeds)
        {
            if (have.Contains(s.Code)) continue;
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
            added = true;
        }
        if (added) await db.SaveChangesAsync(ct);
    }

    public async Task<GlAccount> CreateAccountAsync(
        int companyId,
        string code,
        string name,
        string accountType,
        string normalBalance,
        CancellationToken ct = default)
    {
        code = code.Trim();
        name = name.Trim();
        accountType = accountType.Trim().ToLowerInvariant();
        normalBalance = normalBalance.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            throw new InvalidOperationException("Account code and name are required.");
        if (accountType is not ("asset" or "liability" or "equity" or "income" or "expense"))
            throw new InvalidOperationException("Account type must be asset, liability, equity, income, or expense.");
        if (normalBalance is not ("D" or "C"))
            throw new InvalidOperationException("Normal balance must be D or C.");

        var exists = await db.GlAccounts.AnyAsync(a => a.CompanyId == companyId && a.Code == code, ct);
        if (exists) throw new InvalidOperationException($"Account code {code} already exists.");

        var row = new GlAccount
        {
            CompanyId = companyId,
            Code = code,
            Name = name,
            AccountType = accountType,
            NormalBalance = normalBalance,
            Active = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.GlAccounts.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<GlAccount> UpdateAccountAsync(
        int companyId,
        int accountId,
        string? name,
        bool? active,
        CancellationToken ct = default)
    {
        var row = await db.GlAccounts.FirstOrDefaultAsync(a => a.Id == accountId && a.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Account not found.");
        if (name is not null)
        {
            name = name.Trim();
            if (string.IsNullOrWhiteSpace(name))
                throw new InvalidOperationException("Account name cannot be empty.");
            row.Name = name;
        }
        if (active is not null) row.Active = active.Value;
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task ReopenPeriodAsync(int companyId, int periodId, CancellationToken ct = default)
    {
        var period = await db.GlFiscalPeriods
            .FirstOrDefaultAsync(p => p.Id == periodId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Period not found.");
        if (period.Status == "hard_closed")
            throw new InvalidOperationException("Hard-closed periods cannot be reopened.");
        period.Status = "open";
        await db.SaveChangesAsync(ct);
    }

    public async Task<object> BuildFinancialStatementsAsync(int companyId, int periodId, CancellationToken ct = default)
    {
        var period = await db.GlFiscalPeriods.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Period not found.");

        var functional = await ResolveFunctionalCurrencyAsync(companyId, null, persist: false, ct);

        var balances = await db.GlPeriodBalances.AsNoTracking()
            .Where(b => b.CompanyId == companyId && b.PeriodId == periodId && b.Currency == functional)
            .ToListAsync(ct);
        var accountIds = balances.Select(b => b.AccountId).Distinct().ToList();
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId && accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, ct);

        decimal SignedMovement(GlPeriodBalance b, GlAccount a)
        {
            var dr = FromMinor(b.PeriodDrMinor, b.Currency);
            var cr = FromMinor(b.PeriodCrMinor, b.Currency);
            return a.NormalBalance == "D" ? dr - cr : cr - dr;
        }

        decimal SignedClosing(GlPeriodBalance b, GlAccount a)
        {
            var opening = FromMinor(b.OpeningDrMinor - b.OpeningCrMinor, b.Currency);
            var movement = FromMinor(b.PeriodDrMinor - b.PeriodCrMinor, b.Currency);
            var closing = opening + movement;
            return a.NormalBalance == "D" ? closing : -closing;
        }

        var pnlRows = new List<(string Code, string Name, string AccountType, decimal Amount)>();
        var bsRows = new List<(string Code, string Name, string AccountType, decimal Amount)>();
        decimal income = 0, expense = 0, assets = 0, liabilities = 0, equity = 0;

        foreach (var b in balances)
        {
            if (!accounts.TryGetValue(b.AccountId, out var a)) continue;
            var move = SignedMovement(b, a);
            var close = SignedClosing(b, a);
            if (a.AccountType is "income" or "expense")
            {
                if (Math.Abs(move) < 0.005m) continue;
                pnlRows.Add((a.Code, a.Name, a.AccountType, move));
                if (a.AccountType == "income") income += move;
                else expense += move;
            }
            else
            {
                if (Math.Abs(close) < 0.005m) continue;
                bsRows.Add((a.Code, a.Name, a.AccountType, close));
                switch (a.AccountType)
                {
                    case "asset": assets += close; break;
                    case "liability": liabilities += close; break;
                    case "equity": equity += close; break;
                }
            }
        }

        var netIncome = income - expense;
        equity += netIncome;

        return new
        {
            period = new { period.Id, period.Year, period.PeriodNo, period.Status, period.StartDate, period.EndDate },
            profitAndLoss = new
            {
                income,
                expense,
                netIncome,
                rows = pnlRows.OrderBy(r => r.Code)
                    .Select(r => new { code = r.Code, name = r.Name, accountType = r.AccountType, amount = r.Amount })
                    .ToList(),
            },
            balanceSheet = new
            {
                assets,
                liabilities,
                equity,
                balanced = Math.Abs(assets - (liabilities + equity)) < 0.02m,
                rows = bsRows.OrderBy(r => r.Code)
                    .Select(r => new { code = r.Code, name = r.Name, accountType = r.AccountType, amount = r.Amount })
                    .ToList(),
                note = "Closing balances include prior-period openings rolled on soft-close. Equity includes current-period net income. Not a statutory book of record until Phase 0 exit criteria are met.",
                basis = "closing-balance",
            },
        };
    }

    public async Task<GlFiscalPeriod> RequireOpenPeriodAsync(int companyId, DateOnly effectiveDate, CancellationToken ct = default)
    {
        await EnsurePeriodsForYearAsync(companyId, effectiveDate.Year, ct);
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
    /// Posts a balanced journal. Line amounts are in <paramref name="txnCurrency"/> major units.
    /// When txn ≠ functional, <paramref name="fxRate"/> is functional units per 1 txn unit.
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
        CancellationToken ct = default,
        string? txnCurrency = null,
        decimal? fxRate = null,
        DateOnly? fxRateDate = null)
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

        var funcCurrency = await ResolveFunctionalCurrencyAsync(companyId, countryCode, persist: true, ct);
        var txn = string.IsNullOrWhiteSpace(txnCurrency)
            ? funcCurrency
            : NormalizeCurrency(txnCurrency);
        decimal rate;
        string? rateType;
        if (string.Equals(txn, funcCurrency, StringComparison.Ordinal))
        {
            rate = 1m;
            rateType = null;
        }
        else
        {
            if (fxRate is null or <= 0)
                throw new InvalidOperationException(
                    $"Conversion rate is required when posting in {txn} (functional currency is {funcCurrency}). Rate = {funcCurrency} per 1 {txn}.");
            rate = fxRate.Value;
            rateType = "manual";
        }

        var rateDate = fxRateDate ?? effectiveDate;
        var period = await RequireOpenPeriodAsync(companyId, effectiveDate, ct);

        var draftLines = new List<(GlAccount Account, string Direction, long TxnMinor, long FuncMinor, string Narration)>();
        foreach (var line in lines)
        {
            if (line.Amount <= 0) continue;
            var dir = line.Direction.Trim().ToUpperInvariant();
            if (dir is not ("D" or "C"))
                throw new InvalidOperationException($"Invalid direction '{line.Direction}'.");
            var account = await db.GlAccounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == line.AccountCode && a.Active, ct)
                ?? throw new InvalidOperationException($"Unknown account code {line.AccountCode}.");
            var txnMinor = ToMinor(line.Amount, txn);
            var funcMajor = decimal.Round(line.Amount * rate, MinorDecimals(funcCurrency), MidpointRounding.AwayFromZero);
            var funcMinor = ToMinor(funcMajor, funcCurrency);
            draftLines.Add((account, dir, txnMinor, funcMinor, line.LineNarration));
        }

        if (draftLines.Count < 2)
            throw new InvalidOperationException("A journal needs at least two lines.");

        long txnDebit = draftLines.Where(l => l.Direction == "D").Sum(l => l.TxnMinor);
        long txnCredit = draftLines.Where(l => l.Direction == "C").Sum(l => l.TxnMinor);
        if (txnDebit != txnCredit)
            throw new InvalidOperationException(
                $"Journal unbalanced in {txn}: debit {FromMinor(txnDebit, txn)} vs credit {FromMinor(txnCredit, txn)}.");

        long funcDebit = draftLines.Where(l => l.Direction == "D").Sum(l => l.FuncMinor);
        long funcCredit = draftLines.Where(l => l.Direction == "C").Sum(l => l.FuncMinor);
        if (funcDebit != funcCredit)
        {
            var diff = funcDebit - funcCredit;
            if (Math.Abs(diff) > 1)
                throw new InvalidOperationException(
                    $"Journal unbalanced in functional {funcCurrency} after FX: debit {FromMinor(funcDebit, funcCurrency)} vs credit {FromMinor(funcCredit, funcCurrency)}.");
            for (var i = draftLines.Count - 1; i >= 0; i--)
            {
                if (draftLines[i].Direction != "C") continue;
                var row = draftLines[i];
                draftLines[i] = (row.Account, row.Direction, row.TxnMinor, row.FuncMinor + diff, row.Narration);
                break;
            }
        }

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

        journal.DocNumber = await AllocateDocNumberAsync(companyId, docSeries, period.Year, ct);
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
                Currency = txn,
                AmountMinor = line.TxnMinor,
                FuncCurrency = funcCurrency,
                FuncAmountMinor = line.FuncMinor,
                FxRate = rateType is null ? null : rate,
                FxRateDate = rateType is null ? null : rateDate,
                FxRateType = rateType,
                Narration = line.Narration,
                EffectiveDate = effectiveDate,
                PeriodId = period.Id,
            });

            await ApplyPeriodBalanceAsync(
                companyId, line.Account.Id, period.Id, funcCurrency, line.Direction, line.FuncMinor, ct);
            if (!string.Equals(txn, funcCurrency, StringComparison.Ordinal))
            {
                await ApplyPeriodBalanceAsync(
                    companyId, line.Account.Id, period.Id, txn, line.Direction, line.TxnMinor, ct);
            }
        }

        db.GlJournals.Add(journal);
        await EnqueueOutboxAsync(
            companyId,
            "ledger.journal_posted",
            new { journal.DocNumber, journal.JournalType, journal.SourceModule, sourceDocKey, txn, funcCurrency, rate },
            idempotencyKey: idempotencyKey is null ? null : $"outbox:{idempotencyKey}",
            ct);
        await db.SaveChangesAsync(ct);
        return journal;
    }

    public async Task<string> AllocateDocNumberAsync(int companyId, string series, int fiscalYear, CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "GlDocCounters" ("CompanyId", "Series", "FiscalYear", "NextValue")
            VALUES ({companyId}, {series}, {fiscalYear}, 2)
            ON CONFLICT ("CompanyId", "Series", "FiscalYear")
            DO UPDATE SET "NextValue" = "GlDocCounters"."NextValue" + 1
            """, ct);

        var next = await db.GlDocCounters.AsNoTracking()
            .Where(c => c.CompanyId == companyId && c.Series == series && c.FiscalYear == fiscalYear)
            .Select(c => c.NextValue)
            .FirstAsync(ct);
        var n = next - 1;
        return $"{series}/{fiscalYear}/{n.ToString().PadLeft(6, '0')}";
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
        var existing = await db.GlPeriodBalances
            .FromSqlInterpolated($"""
                SELECT * FROM "GlPeriodBalances"
                WHERE "CompanyId" = {companyId}
                  AND "AccountId" = {accountId}
                  AND "PeriodId" = {periodId}
                  AND "Currency" = {currency}
                FOR UPDATE
                """)
            .AsTracking()
            .FirstOrDefaultAsync(ct);

        if (existing is null)
        {
            var (openDr, openCr) = await PriorClosingAsync(companyId, accountId, periodId, currency, ct);
            existing = new GlPeriodBalance
            {
                CompanyId = companyId,
                AccountId = accountId,
                PeriodId = periodId,
                Currency = currency,
                OpeningDrMinor = openDr,
                OpeningCrMinor = openCr,
            };
            db.GlPeriodBalances.Add(existing);
        }

        if (direction == "D") existing.PeriodDrMinor += minor;
        else existing.PeriodCrMinor += minor;
    }

    async Task<(long OpeningDr, long OpeningCr)> PriorClosingAsync(
        int companyId,
        int accountId,
        int periodId,
        string currency,
        CancellationToken ct)
    {
        var period = await db.GlFiscalPeriods.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodId && p.CompanyId == companyId, ct);
        if (period is null) return (0, 0);

        var prior = await db.GlFiscalPeriods.AsNoTracking()
            .Where(p => p.CompanyId == companyId
                && (p.Year < period.Year || (p.Year == period.Year && p.PeriodNo < period.PeriodNo)))
            .OrderByDescending(p => p.Year).ThenByDescending(p => p.PeriodNo)
            .FirstOrDefaultAsync(ct);
        if (prior is null) return (0, 0);

        var bal = await db.GlPeriodBalances.AsNoTracking()
            .FirstOrDefaultAsync(b =>
                b.CompanyId == companyId
                && b.AccountId == accountId
                && b.PeriodId == prior.Id
                && b.Currency == currency, ct);
        if (bal is null) return (0, 0);

        var account = await db.GlAccounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == accountId && a.CompanyId == companyId, ct);
        if (account is not null
            && prior.Year != period.Year
            && account.AccountType is "income" or "expense")
        {
            return (0, 0);
        }

        return (bal.OpeningDrMinor + bal.PeriodDrMinor, bal.OpeningCrMinor + bal.PeriodCrMinor);
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

        var first = original.Lines.OrderBy(l => l.LineNo).First();
        var lines = original.Lines
            .OrderBy(l => l.LineNo)
            .Select(l => (
                AccountCode: accounts[l.AccountId],
                Direction: l.Direction == "D" ? "C" : "D",
                Amount: FromMinor(l.AmountMinor, l.Currency),
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
            ct,
            txnCurrency: first.Currency,
            fxRate: first.FxRate,
            fxRateDate: first.FxRateDate);

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
        await RollForwardOpeningsAsync(companyId, period, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task RollForwardOpeningsAsync(int companyId, GlFiscalPeriod period, CancellationToken ct = default)
    {
        var nextStart = period.EndDate.AddDays(1);
        await EnsurePeriodsForYearAsync(companyId, nextStart.Year, ct);
        var next = await db.GlFiscalPeriods
            .FirstOrDefaultAsync(p =>
                p.CompanyId == companyId && p.StartDate <= nextStart && p.EndDate >= nextStart, ct);
        if (next is null) return;

        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId)
            .ToDictionaryAsync(a => a.Id, ct);
        var current = await db.GlPeriodBalances
            .Where(b => b.CompanyId == companyId && b.PeriodId == period.Id)
            .ToListAsync(ct);

        foreach (var bal in current)
        {
            accounts.TryGetValue(bal.AccountId, out var acct);
            var closeDr = bal.OpeningDrMinor + bal.PeriodDrMinor;
            var closeCr = bal.OpeningCrMinor + bal.PeriodCrMinor;
            if (acct is not null
                && next.Year != period.Year
                && acct.AccountType is "income" or "expense")
            {
                closeDr = 0;
                closeCr = 0;
            }

            var dest = await db.GlPeriodBalances
                .FirstOrDefaultAsync(b =>
                    b.CompanyId == companyId
                    && b.AccountId == bal.AccountId
                    && b.PeriodId == next.Id
                    && b.Currency == bal.Currency, ct);
            if (dest is null)
            {
                dest = new GlPeriodBalance
                {
                    CompanyId = companyId,
                    AccountId = bal.AccountId,
                    PeriodId = next.Id,
                    Currency = bal.Currency,
                };
                db.GlPeriodBalances.Add(dest);
            }
            dest.OpeningDrMinor = closeDr;
            dest.OpeningCrMinor = closeCr;
        }
    }
}
