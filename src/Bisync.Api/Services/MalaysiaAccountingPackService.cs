using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Malaysia-first localisation pack seeding (SST non-recoverable, account roles, SLA defaults).
/// Other packs (SG/AU/ID/TH/US) remain reference docs in Dev Console until wired.
/// </summary>
public sealed class MalaysiaAccountingPackService(BisyncDbContext db)
{
    public const string PackId = "my";

    public static readonly (string Code, string Name, string Type, string Normal)[] MalaysiaExtraAccounts =
    [
        ("1110", "Trade receivables control", "asset", "D"),
        ("2010", "Trade payables control", "liability", "C"),
        ("2210", "SST output payable", "liability", "C"),
        ("5210", "SST expense (non-recoverable)", "expense", "D"),
        ("5710", "Realised FX gain/loss", "expense", "D"),
        ("5720", "Unrealised FX gain/loss", "expense", "D"),
        ("4010", "SST-inclusive sales clearing", "income", "C"),
    ];

    public static readonly (string Role, string AccountCode, string Notes)[] DefaultRoles =
    [
        ("ar_control", "1110", "Trade AR"),
        ("ap_control", "2010", "Trade AP"),
        ("revenue_default", "4000", "F&B sales"),
        ("cogs_default", "5200", "Inventory COGS"),
        ("tax_output_payable", "2210", "SST output"),
        ("tax_expense_nonrecoverable", "5210", "MY SST — no input credit"),
        ("fx_realised", "5710", "Realised FX"),
        ("fx_unrealised", "5720", "Unrealised FX"),
        ("bank_default", "1000", "Cash and bank"),
        ("retained_earnings", "3000", "Equity"),
        ("rounding_difference", "5900", "Suspense / rounding"),
        ("inventory_default", "1400", "Inventory"),
        ("deferred_revenue", "2400", "Contract liability"),
        ("accum_depreciation", "1510", "Accumulated depreciation"),
        ("dep_expense", "5810", "Depreciation expense"),
        ("sales_discount", "4100", "Discounts / other income"),
        ("pos_cash", "1000", "POS cash tender"),
        ("pos_card", "1000", "POS card/QR tender"),
        ("pos_non_revenue", "5800", "POS non-revenue settlement"),
    ];

    public static readonly (string Code, string Name, decimal Rate, string Recoverability)[] MalaysiaTaxCodes =
    [
        ("SST-0", "SST exempt / 0%", 0m, "none"),
        ("SST-5", "Sales tax 5%", 5m, "none"),
        ("SST-6", "Service tax 6%", 6m, "none"),
        ("SST-8", "Service tax 8%", 8m, "none"),
        ("SST-10", "Sales tax 10%", 10m, "none"),
        ("EXEMPT", "Out of scope / exempt", 0m, "none"),
    ];

    public async Task EnsureCoreRolesAndSlaAsync(int companyId, CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        await EnsureAccountRolesAsync(companyId, ct);
        await EnsureRolesAndSlaAsync(companyId, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task EnsureMalaysiaPackAsync(int companyId, CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);

        var pack = await db.GlLocalisationPacks
            .FirstOrDefaultAsync(p => p.CompanyId == companyId && p.PackId == PackId, ct);
        if (pack is null)
        {
            db.GlLocalisationPacks.Add(new GlLocalisationPack
            {
                CompanyId = companyId,
                PackId = PackId,
                Status = "active",
                Version = "1.0",
                ActivatedAt = DateTime.UtcNow,
            });
        }
        else if (pack.Status != "active")
        {
            pack.Status = "active";
            pack.ActivatedAt = DateTime.UtcNow;
        }

        // Mark other known packs as reference-only placeholders (not activated).
        foreach (var other in new[] { "sg", "au", "id", "th", "us" })
        {
            if (await db.GlLocalisationPacks.AnyAsync(p => p.CompanyId == companyId && p.PackId == other, ct))
                continue;
            db.GlLocalisationPacks.Add(new GlLocalisationPack
            {
                CompanyId = companyId,
                PackId = other,
                Status = "reference",
                Version = "0.0",
                ActivatedAt = DateTime.UtcNow,
            });
        }

        foreach (var a in MalaysiaExtraAccounts)
        {
            if (await db.GlAccounts.AnyAsync(x => x.CompanyId == companyId && x.Code == a.Code, ct))
                continue;
            db.GlAccounts.Add(new GlAccount
            {
                CompanyId = companyId,
                Code = a.Code,
                Name = a.Name,
                AccountType = a.Type,
                NormalBalance = a.Normal,
                Active = true,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync(ct);

        await EnsureAccountRolesAsync(companyId, ct);

        foreach (var tax in MalaysiaTaxCodes)
        {
            if (await db.GlTaxCodes.AnyAsync(t => t.CompanyId == companyId && t.Code == tax.Code, ct))
                continue;
            db.GlTaxCodes.Add(new GlTaxCode
            {
                CompanyId = companyId,
                Code = tax.Code,
                Name = tax.Name,
                RatePercent = tax.Rate,
                Recoverability = tax.Recoverability,
                PackId = PackId,
                Active = true,
            });
        }

        await EnsureRolesAndSlaAsync(companyId, ct);
        await db.SaveChangesAsync(ct);
    }

    async Task EnsureAccountRolesAsync(int companyId, CancellationToken ct)
    {
        var accounts = await db.GlAccounts.AsNoTracking()
            .Where(a => a.CompanyId == companyId)
            .ToDictionaryAsync(a => a.Code, a => a.Id, StringComparer.OrdinalIgnoreCase, ct);

        foreach (var role in DefaultRoles)
        {
            var existing = await db.GlAccountRoles
                .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RoleCode == role.Role, ct);
            accounts.TryGetValue(role.AccountCode, out var accountId);
            if (existing is null)
            {
                db.GlAccountRoles.Add(new GlAccountRole
                {
                    CompanyId = companyId,
                    RoleCode = role.Role,
                    AccountId = accountId == 0 ? null : accountId,
                    Notes = role.Notes,
                });
            }
            else if (existing.AccountId is null && accountId != 0)
            {
                existing.AccountId = accountId;
                existing.Notes ??= role.Notes;
            }
        }
    }

    public async Task<string> ResolveRoleAccountCodeAsync(int companyId, string roleCode, string fallbackCode, CancellationToken ct = default)
    {
        var role = await db.GlAccountRoles.AsNoTracking()
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.RoleCode == roleCode, ct);
        if (role?.AccountId is > 0)
        {
            var code = await db.GlAccounts.AsNoTracking()
                .Where(a => a.Id == role.AccountId && a.CompanyId == companyId)
                .Select(a => a.Code)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(code)) return code;
        }
        return fallbackCode;
    }

    async Task EnsureRolesAndSlaAsync(int companyId, CancellationToken ct)
    {
        async Task Seed(string eventType, string name, (string Role, string Dir, string Amt)[] lines)
        {
            if (await db.GlSlaRuleSets.AnyAsync(r =>
                    r.CompanyId == companyId && r.EventType == eventType && r.Status == "active", ct))
                return;

            var set = new GlSlaRuleSet
            {
                CompanyId = companyId,
                EventType = eventType,
                PackId = PackId,
                Version = 1,
                EffectiveFrom = new DateOnly(2026, 1, 1),
                Status = "active",
                Name = name,
            };
            var seq = 1;
            foreach (var line in lines)
            {
                set.Lines.Add(new GlSlaRuleLine
                {
                    CompanyId = companyId,
                    Seq = seq++,
                    ConditionJson = "{}",
                    AccountRole = line.Role,
                    Direction = line.Dir,
                    AmountSource = line.Amt,
                });
            }
            db.GlSlaRuleSets.Add(set);
        }

        await Seed("ops.purchase_affirmed", "MY purchase affirm (Inventory / AP)",
        [
            ("inventory_default", "D", "net"),
            ("tax_expense_nonrecoverable", "D", "tax"),
            ("ap_control", "C", "gross"),
        ]);

        await Seed("ar.invoice.posted", "MY AR invoice (AR / Revenue / SST)",
        [
            ("ar_control", "D", "gross"),
            ("revenue_default", "C", "net"),
            ("tax_output_payable", "C", "tax"),
        ]);

        await Seed("ap.bill.posted", "MY AP bill (Expense or Inventory / AP / SST expense)",
        [
            ("cogs_default", "D", "net"),
            ("tax_expense_nonrecoverable", "D", "tax"),
            ("ap_control", "C", "gross"),
        ]);

        await Seed("bank.payment.posted", "MY bank payment clearing",
        [
            ("ap_control", "D", "net"),
            ("bank_default", "C", "net"),
        ]);

        await Seed("bank.receipt.posted", "MY bank receipt clearing",
        [
            ("bank_default", "D", "net"),
            ("ar_control", "C", "net"),
        ]);

        await Seed("ar.credit_note.posted", "MY AR credit note (reverse invoice)",
        [
            ("revenue_default", "D", "net"),
            ("tax_output_payable", "D", "tax"),
            ("ar_control", "C", "gross"),
        ]);

        await Seed("ap.credit_note.posted", "MY AP credit note (reverse bill)",
        [
            ("ap_control", "D", "gross"),
            ("cogs_default", "C", "net"),
            ("tax_expense_nonrecoverable", "C", "tax"),
        ]);

        await Seed("pos.settlement.posted", "MY POS day settlement (tenders / sales / SST)",
        [
            ("pos_cash", "D", "gross"),
            ("revenue_default", "C", "net"),
            ("tax_output_payable", "C", "tax"),
        ]);
    }

    public async Task<object> GetPackStatusAsync(int companyId, string? countryCode = null, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(countryCode)
            && countryCode.Equals("MY", StringComparison.OrdinalIgnoreCase))
        {
            await EnsureMalaysiaPackAsync(companyId, ct);
        }
        var packs = await db.GlLocalisationPacks.AsNoTracking()
            .Where(p => p.CompanyId == companyId)
            .OrderBy(p => p.PackId)
            .Select(p => new { p.PackId, p.Status, p.Version, p.ActivatedAt })
            .ToListAsync(ct);
        var allRoles = await db.GlAccountRoles.AsNoTracking()
            .Where(r => r.CompanyId == companyId)
            .Select(r => new { r.RoleCode, r.AccountId, r.Notes })
            .ToListAsync(ct);
        var tax = await db.GlTaxCodes.AsNoTracking()
            .Where(t => t.CompanyId == companyId && t.Active)
            .OrderBy(t => t.Code)
            .Select(t => new { t.Code, t.Name, t.RatePercent, t.Recoverability, t.PackId })
            .ToListAsync(ct);
        var sla = await db.GlSlaRuleSets.AsNoTracking()
            .Where(s => s.CompanyId == companyId)
            .OrderBy(s => s.EventType)
            .Select(s => new { s.Id, s.EventType, s.Name, s.Version, s.Status, s.PackId, lineCount = s.Lines.Count })
            .ToListAsync(ct);

        return new
        {
            activePack = PackId,
            note = "Malaysia pack is active. SG/AU/ID/TH/US packs are reference-only in Dev Console until wired.",
            sst = new
            {
                model = "single-stage",
                inputCredit = false,
                recoverability = "none",
                filing = "SST-02 bimonthly",
                eInvoicing = "MyInvois clearance (intermediary model)",
            },
            packs,
            accountRoles = allRoles.Select(r => new
            {
                r.RoleCode,
                r.AccountId,
                r.Notes,
                mapped = r.AccountId is > 0,
            }),
            taxCodes = tax,
            slaRuleSets = sla,
        };
    }
}
