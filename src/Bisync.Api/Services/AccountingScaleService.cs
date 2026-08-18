using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>Wave D scale: budgets, saved reports, consolidation groups, take-on import helpers.</summary>
public sealed class AccountingScaleService(
    BisyncDbContext db,
    LedgerPostingService ledger,
    MalaysiaAccountingPackService malaysiaPack)
{
    public async Task EnsureScaleTablesAsync(CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        await Task.CompletedTask;
    }

    public async Task<GlBudget> UpsertBudgetAsync(
        int companyId,
        string name,
        int fiscalYear,
        string currency,
        IReadOnlyList<(string AccountCode, int PeriodNo, decimal Amount, string? LocationExternalId)> lines,
        CancellationToken ct = default)
    {
        await EnsureScaleTablesAsync(ct);
        var cur = LedgerPostingService.NormalizeCurrency(currency);
        var budget = await db.GlBudgets
            .Include(b => b.Lines)
            .FirstOrDefaultAsync(b => b.CompanyId == companyId && b.FiscalYear == fiscalYear && b.Name == name.Trim(), ct);
        if (budget is null)
        {
            budget = new GlBudget
            {
                CompanyId = companyId,
                Name = name.Trim(),
                FiscalYear = fiscalYear,
                Currency = cur,
                Status = "active",
                CreatedAt = DateTime.UtcNow,
            };
            db.GlBudgets.Add(budget);
        }
        else
        {
            db.GlBudgetLines.RemoveRange(budget.Lines);
            budget.Lines.Clear();
            budget.Currency = cur;
            budget.Status = "active";
        }

        foreach (var l in lines)
        {
            var acct = await db.GlAccounts.AsNoTracking()
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == l.AccountCode.Trim(), ct)
                ?? throw new InvalidOperationException($"Unknown account {l.AccountCode}");
            budget.Lines.Add(new GlBudgetLine
            {
                CompanyId = companyId,
                AccountId = acct.Id,
                PeriodNo = Math.Clamp(l.PeriodNo, 1, 12),
                AmountMinor = LedgerPostingService.ToMinor(l.Amount, cur),
                LocationExternalId = string.IsNullOrWhiteSpace(l.LocationExternalId) ? null : l.LocationExternalId.Trim(),
            });
        }
        await db.SaveChangesAsync(ct);
        return budget;
    }

    public async Task<object> BudgetVsActualAsync(int companyId, int budgetId, int? periodNo, CancellationToken ct = default)
    {
        await EnsureScaleTablesAsync(ct);
        var budget = await db.GlBudgets.AsNoTracking().Include(b => b.Lines)
            .FirstOrDefaultAsync(b => b.Id == budgetId && b.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Budget not found.");
        var periods = await db.GlFiscalPeriods.AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.Year == budget.FiscalYear)
            .ToListAsync(ct);
        var periodIds = periods
            .Where(p => periodNo is null || p.PeriodNo == periodNo)
            .Select(p => p.Id)
            .ToHashSet();
        var balances = await db.GlPeriodBalances.AsNoTracking()
            .Where(b => b.CompanyId == companyId && periodIds.Contains(b.PeriodId) && b.Currency == budget.Currency)
            .ToListAsync(ct);
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId)
            .ToDictionaryAsync(a => a.Id, a => a, ct);

        var rows = budget.Lines
            .Where(l => periodNo is null || l.PeriodNo == periodNo)
            .GroupBy(l => l.AccountId)
            .Select(g =>
            {
                var acct = accounts.GetValueOrDefault(g.Key);
                var budgetAmt = g.Sum(x => x.AmountMinor);
                var actual = balances.Where(b => b.AccountId == g.Key)
                    .Sum(b => b.PeriodDrMinor - b.PeriodCrMinor);
                if (acct?.NormalBalance == "C")
                    actual = balances.Where(b => b.AccountId == g.Key).Sum(b => b.PeriodCrMinor - b.PeriodDrMinor);
                return new
                {
                    accountId = g.Key,
                    accountCode = acct?.Code,
                    accountName = acct?.Name,
                    budget = LedgerPostingService.FromMinor(budgetAmt, budget.Currency),
                    actual = LedgerPostingService.FromMinor(actual, budget.Currency),
                    variance = LedgerPostingService.FromMinor(budgetAmt - actual, budget.Currency),
                };
            })
            .OrderBy(r => r.accountCode)
            .ToList();

        return new
        {
            budget.Id,
            budget.Name,
            budget.FiscalYear,
            budget.Currency,
            periodNo,
            rows,
        };
    }

    public async Task<GlSavedReport> SaveReportAsync(
        int companyId, string name, string kind, string filtersJson, string createdBy, CancellationToken ct = default)
    {
        await EnsureScaleTablesAsync(ct);
        var row = new GlSavedReport
        {
            CompanyId = companyId,
            Name = name.Trim(),
            Kind = kind.Trim().ToLowerInvariant(),
            FiltersJson = string.IsNullOrWhiteSpace(filtersJson) ? "{}" : filtersJson,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
        };
        db.GlSavedReports.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    public async Task<GlConsolidationGroup> UpsertConsolidationGroupAsync(
        int parentCompanyId,
        string name,
        IReadOnlyList<(int MemberCompanyId, decimal OwnershipPercent)> members,
        CancellationToken ct = default)
    {
        await EnsureScaleTablesAsync(ct);
        var group = await db.GlConsolidationGroups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.ParentCompanyId == parentCompanyId && g.Name == name.Trim(), ct);
        if (group is null)
        {
            group = new GlConsolidationGroup
            {
                ParentCompanyId = parentCompanyId,
                Name = name.Trim(),
                Status = "active",
                CreatedAt = DateTime.UtcNow,
            };
            db.GlConsolidationGroups.Add(group);
        }
        else
        {
            db.GlConsolidationMembers.RemoveRange(group.Members);
            group.Members.Clear();
        }

        foreach (var m in members)
        {
            if (m.MemberCompanyId == parentCompanyId) continue;
            group.Members.Add(new GlConsolidationMember
            {
                MemberCompanyId = m.MemberCompanyId,
                OwnershipPercent = Math.Clamp(m.OwnershipPercent, 0m, 100m),
            });
        }
        await db.SaveChangesAsync(ct);
        return group;
    }

    /// <summary>Post an elimination journal in the consolidation ledger for the parent company.</summary>
    public async Task<object> PostEliminationAsync(
        int parentCompanyId,
        string? countryCode,
        int partnerCompanyId,
        DateOnly effectiveDate,
        string narration,
        IReadOnlyList<(string AccountCode, string Direction, decimal Amount, string LineNarration)> lines,
        string createdBy,
        CancellationToken ct = default)
    {
        await malaysiaPack.EnsureCoreRolesAndSlaAsync(parentCompanyId, ct);
        var journal = await ledger.PostAsync(
            parentCompanyId,
            countryCode,
            journalType: "ELIM",
            docSeries: "ELIM",
            effectiveDate: effectiveDate,
            documentDate: effectiveDate,
            sourceModule: "CONSOL",
            sourceDocKey: $"elim:{parentCompanyId}:{partnerCompanyId}:{effectiveDate:yyyyMMdd}:{narration.GetHashCode()}",
            narration: narration,
            createdBy: createdBy,
            idempotencyKey: $"elim:{parentCompanyId}:{partnerCompanyId}:{effectiveDate:yyyyMMdd}:{string.Join('|', lines.Select(l => $"{l.AccountCode}:{l.Direction}:{l.Amount}"))}",
            lines,
            ct,
            ledgerKind: "consolidation",
            partnerCompanyId: partnerCompanyId);
        return new { journal.Id, journal.DocNumber, journal.LedgerKind, journal.JournalType, partnerCompanyId };
    }

    /// <summary>CSV take-on: accountCode,name,type,normal — creates missing COA rows.</summary>
    public async Task<object> ImportCoaCsvAsync(int companyId, string csvText, CancellationToken ct = default)
    {
        await ledger.EnsureChartAndOpenPeriodsAsync(companyId, null, ct);
        var created = 0;
        var skipped = 0;
        using var reader = new StringReader(csvText ?? "");
        string? raw;
        var rowNo = 0;
        while ((raw = reader.ReadLine()) is not null)
        {
            rowNo++;
            var line = raw.Trim();
            if (line.Length == 0) continue;
            if (rowNo == 1 && line.Contains("code", StringComparison.OrdinalIgnoreCase)) continue;
            var parts = line.Split(',');
            if (parts.Length < 2) continue;
            var code = parts[0].Trim().Trim('"');
            var name = parts[1].Trim().Trim('"');
            var type = parts.Length > 2 ? parts[2].Trim().Trim('"').ToLowerInvariant() : "expense";
            var normal = parts.Length > 3 ? parts[3].Trim().Trim('"').ToUpperInvariant() : (type is "liability" or "equity" or "income" ? "C" : "D");
            if (string.IsNullOrWhiteSpace(code)) continue;
            if (await db.GlAccounts.AnyAsync(a => a.CompanyId == companyId && a.Code == code, ct))
            {
                skipped++;
                continue;
            }
            db.GlAccounts.Add(new GlAccount
            {
                CompanyId = companyId,
                Code = code,
                Name = string.IsNullOrWhiteSpace(name) ? code : name,
                AccountType = type is "asset" or "liability" or "equity" or "income" or "expense" ? type : "expense",
                NormalBalance = normal is "C" ? "C" : "D",
                Active = true,
                CreatedAt = DateTime.UtcNow,
            });
            created++;
        }
        await db.SaveChangesAsync(ct);
        return new { created, skipped, source = "coa-csv" };
    }

    /// <summary>
    /// CSV take-on journals: effectiveDate,accountCode,direction,amount,narration[,locationExternalId].
    /// Groups consecutive rows sharing the same effectiveDate+narration into balanced journals.
    /// </summary>
    public async Task<object> ImportJournalsCsvAsync(
        int companyId,
        string? countryCode,
        string csvText,
        string createdBy,
        CancellationToken ct = default)
    {
        await ledger.EnsureChartAndOpenPeriodsAsync(companyId, countryCode, ct);
        var batches = new List<(DateOnly Date, string Narration, string? Location, List<(string Acct, string Dir, decimal Amt, string Note)> Lines)>();
        using var reader = new StringReader(csvText ?? "");
        string? raw;
        var rowNo = 0;
        (DateOnly Date, string Narration, string? Location, List<(string, string, decimal, string)> Lines)? current = null;
        while ((raw = reader.ReadLine()) is not null)
        {
            rowNo++;
            var line = raw.Trim();
            if (line.Length == 0) continue;
            if (rowNo == 1 && line.Contains("effective", StringComparison.OrdinalIgnoreCase)) continue;
            var parts = SplitCsv(line);
            if (parts.Count < 4)
                throw new InvalidOperationException($"Row {rowNo}: expected effectiveDate,accountCode,direction,amount,narration");
            if (!DateOnly.TryParse(parts[0].Trim(), out var date))
                throw new InvalidOperationException($"Row {rowNo}: bad date");
            var acct = parts[1].Trim();
            var dir = parts[2].Trim().ToUpperInvariant().StartsWith('C') ? "C" : "D";
            if (!decimal.TryParse(parts[3].Trim(), System.Globalization.NumberStyles.Number,
                    System.Globalization.CultureInfo.InvariantCulture, out var amt))
                throw new InvalidOperationException($"Row {rowNo}: bad amount");
            var narr = parts.Count > 4 ? parts[4].Trim() : "Take-on";
            var loc = parts.Count > 5 ? parts[5].Trim() : null;
            if (current is null || current.Value.Date != date || current.Value.Narration != narr)
            {
                if (current is not null) batches.Add(current.Value);
                current = (date, narr, string.IsNullOrWhiteSpace(loc) ? null : loc,
                    new List<(string, string, decimal, string)>());
            }
            current.Value.Lines.Add((acct, dir, amt, narr));
        }
        if (current is not null) batches.Add(current.Value);

        var posted = 0;
        foreach (var batch in batches)
        {
            if (batch.Lines.Count < 2) continue;
            await ledger.PostAsync(
                companyId,
                countryCode,
                "GEN",
                "TAKE",
                batch.Date,
                batch.Date,
                "TAKEON",
                $"takeon:{companyId}:{batch.Date:yyyyMMdd}:{batch.Narration.GetHashCode()}:{posted}",
                batch.Narration,
                createdBy,
                $"takeon:{companyId}:{batch.Date:yyyyMMdd}:{posted}:{batch.Narration}",
                batch.Lines.Select(l => (l.Acct, l.Dir, l.Amt, l.Note)).ToList(),
                ct,
                locationExternalId: batch.Location);
            posted++;
        }
        return new { journalsPosted = posted, source = "journals-csv", note = "QBO/Xero field mapping lands as CSV export → this importer for v1 take-on." };
    }

    public async Task<object> PnlByLocationAsync(int companyId, int periodId, CancellationToken ct = default)
    {
        var period = await db.GlFiscalPeriods.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == periodId && p.CompanyId == companyId, ct)
            ?? throw new InvalidOperationException("Period not found.");
        var lines = await db.GlJournalLines.AsNoTracking()
            .Include(l => l.Account)
            .Where(l => l.CompanyId == companyId
                && l.PeriodId == periodId
                && l.Account != null
                && (l.Account.AccountType == "income" || l.Account.AccountType == "expense"))
            .ToListAsync(ct);
        var byLoc = lines
            .GroupBy(l => string.IsNullOrWhiteSpace(l.LocationExternalId) ? "(unassigned)" : l.LocationExternalId!)
            .Select(g =>
            {
                var income = g.Where(l => l.Account!.AccountType == "income")
                    .Sum(l => l.Direction == "C" ? l.FuncAmountMinor : -l.FuncAmountMinor);
                var expense = g.Where(l => l.Account!.AccountType == "expense")
                    .Sum(l => l.Direction == "D" ? l.FuncAmountMinor : -l.FuncAmountMinor);
                return new
                {
                    locationExternalId = g.Key,
                    income = LedgerPostingService.FromMinor(income),
                    expense = LedgerPostingService.FromMinor(expense),
                    net = LedgerPostingService.FromMinor(income - expense),
                };
            })
            .OrderBy(x => x.locationExternalId)
            .ToList();
        return new { period.Id, period.Year, period.PeriodNo, rows = byLoc };
    }

    static List<string> SplitCsv(string line)
    {
        var result = new List<string>();
        var sb = new System.Text.StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                else inQuotes = !inQuotes;
                continue;
            }
            if (ch == ',' && !inQuotes) { result.Add(sb.ToString()); sb.Clear(); continue; }
            sb.Append(ch);
        }
        result.Add(sb.ToString());
        return result;
    }
}
