using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Period COGS / FIFO audit for System Configuration.
/// Maps stock-card movements to signed Debit (+) / Credit (−) and ME shortage.
/// </summary>
public class CogsAuditService(StockCardService stockCards)
{
    public async Task<CogsAuditSummaryResult> GetSummaryAsync(
        int? companyId,
        IReadOnlyList<string> locationIds,
        string? period,
        string uomMode = "inventory",
        string itemType = "component",
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
        {
            return new CogsAuditSummaryResult
            {
                PeriodMonth = string.IsNullOrWhiteSpace(period) ? DateTime.UtcNow.ToString("yyyy-MM") : period.Trim(),
                Rows = [],
            };
        }

        var list = await stockCards.ListAsync(
            companyId,
            locationIds,
            itemType,
            uomMode,
            period,
            cancellationToken);

        var rows = new List<CogsAuditIngredientRow>(list.Count);
        foreach (var item in list)
        {
            // Opening qty reconstructed from period identity:
            // OnHand = Open + Inbound − Outbound + Adjustment(signed)
            var openQty = item.OnHandQty - item.InboundQty + item.OutboundQty - item.AdjustmentQty;
            var debitQty = item.InboundQty;
            var creditQty = -item.OutboundQty;
            var meDebitQty = item.AdjustmentQty > 0 ? item.AdjustmentQty : 0m;
            var meCreditQty = item.AdjustmentQty < 0 ? item.AdjustmentQty : 0m;
            var shortageQty = meDebitQty + meCreditQty;

            var unitPrice = item.OnHandAverageCogs > 0
                ? item.OnHandAverageCogs
                : item.AverageCogs;
            var openVal = RoundMoney(openQty * unitPrice);
            var debitVal = RoundMoney(debitQty * (item.AverageCogs > 0 ? item.AverageCogs : unitPrice));
            var creditCogs = RoundMoney(creditQty * (item.AverageCogs > 0 ? item.AverageCogs : unitPrice));
            var meDebitVal = RoundMoney(meDebitQty * unitPrice);
            var meCreditCogs = RoundMoney(meCreditQty * unitPrice);
            var beforeInvQty = openQty + debitQty + creditQty;
            var beforeInvVal = RoundMoney(openVal + debitVal + creditCogs);
            var closeVal = RoundMoney(item.OnHandQty * (item.OnHandAverageCogs > 0 ? item.OnHandAverageCogs : unitPrice));
            var shortageVal = meDebitVal + meCreditCogs;
            var shortageUomPrice = shortageQty != 0 ? RoundUnit(shortageVal / shortageQty) : 0m;

            rows.Add(new CogsAuditIngredientRow
            {
                ItemType = item.ItemType,
                ItemKey = item.ItemKey,
                Code = item.ItemKey,
                Name = item.Name,
                Group = item.Group,
                Uom = item.Uom,
                OpenQty = RoundQty(openQty),
                OpenVal = openVal,
                DebitQty = RoundQty(debitQty),
                DebitVal = debitVal,
                CreditQty = RoundQty(creditQty),
                CreditCogs = creditCogs,
                BeforeInvQty = RoundQty(beforeInvQty),
                BeforeInvVal = beforeInvVal,
                MeDebitQty = RoundQty(meDebitQty),
                MeDebitVal = meDebitVal,
                MeCreditQty = RoundQty(meCreditQty),
                MeCreditCogs = meCreditCogs,
                CloseQty = RoundQty(item.OnHandQty),
                CloseVal = closeVal,
                ShortageQty = RoundQty(shortageQty),
                ShortageVal = shortageVal,
                ShortageUomPrice = shortageUomPrice,
                AverageCogs = RoundUnit(item.AverageCogs),
                OnHandAverageCogs = RoundUnit(item.OnHandAverageCogs),
            });
        }

        rows = rows
            .OrderBy(r => r.Group, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new CogsAuditSummaryResult
        {
            PeriodMonth = string.IsNullOrWhiteSpace(period)
                ? DateTime.UtcNow.ToString("yyyy-MM")
                : period.Trim(),
            DebitSign = "+",
            CreditSign = "−",
            Policy = "FIFO",
            IngredientCount = rows.Count,
            OpeningValue = RoundMoney(rows.Sum(r => r.OpenVal)),
            BeforeInventoryValue = RoundMoney(rows.Sum(r => r.BeforeInvVal)),
            CreditCogsBeforeInventory = RoundMoney(rows.Sum(r => r.CreditCogs)),
            ClosingValue = RoundMoney(rows.Sum(r => r.CloseVal)),
            ShortageQty = RoundQty(rows.Sum(r => r.ShortageQty)),
            ShortageValue = RoundMoney(rows.Sum(r => r.ShortageVal)),
            Rows = rows,
        };
    }

    public async Task<CogsAuditDetailResult?> GetDetailAsync(
        string itemType,
        string itemKey,
        int? companyId,
        IReadOnlyList<string> locationIds,
        string? period,
        string uomMode = "inventory",
        CancellationToken cancellationToken = default)
    {
        if (locationIds.Count == 0)
            return null;

        var detail = await stockCards.GetDetailAsync(
            itemType,
            itemKey,
            companyId,
            locationIds,
            uomMode,
            period,
            cancellationToken);

        if (detail is null)
            return null;

        var lines = new List<CogsAuditLedgerLine>(detail.Entries.Count);
        var seq = 0;
        decimal? runningValue = null;

        foreach (var e in detail.Entries)
        {
            seq++;
            var isBf = string.Equals(e.EntryType, "balance_forward", StringComparison.OrdinalIgnoreCase);
            var isInbound = IsInbound(e.EntryType);
            var isOutbound = IsOutbound(e.EntryType);

            decimal debitQty = 0;
            decimal creditQty = 0;
            if (isBf)
            {
                // Opening row — qty shown on running balance only
            }
            else if (isInbound)
            {
                debitQty = e.Quantity;
            }
            else if (isOutbound)
            {
                creditQty = -e.Quantity;
            }
            else if (e.SignedQty > 0)
            {
                debitQty = e.SignedQty;
            }
            else if (e.SignedQty < 0)
            {
                creditQty = e.SignedQty;
            }

            var fifoValue = isOutbound
                ? -Math.Abs(e.Subtotal)
                : (isInbound || isBf ? e.Subtotal : RoundMoney(e.SignedQty * e.UnitPrice));

            if (runningValue is null)
                runningValue = isBf ? e.Subtotal : fifoValue;
            else
                runningValue += isBf ? 0 : fifoValue;

            lines.Add(new CogsAuditLedgerLine
            {
                Seq = seq,
                OccurredAt = e.OccurredAt,
                LineType = MapLineType(e.EntryType),
                EntryType = e.EntryType,
                RefId = e.ReferenceNumber,
                Remark = e.Reason,
                DebitQty = RoundQty(debitQty),
                CreditQty = RoundQty(creditQty),
                UnitPrice = RoundUnit(e.UnitPrice),
                FifoValue = RoundMoney(fifoValue),
                RunningQty = RoundQty(e.RunningBalance),
                RunningValue = RoundMoney(runningValue.Value),
                FifoDetail = e.FifoDetail,
                FifoPolicy = e.FifoPolicy,
            });
        }

        var open = detail.Entries.FirstOrDefault(x =>
            string.Equals(x.EntryType, "balance_forward", StringComparison.OrdinalIgnoreCase));
        var periodEntries = detail.Entries
            .Where(x => !string.Equals(x.EntryType, "balance_forward", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var debitQtyTotal = periodEntries.Where(x => IsInbound(x.EntryType)).Sum(x => x.Quantity);
        var creditQtyTotal = -periodEntries.Where(x => IsOutbound(x.EntryType)).Sum(x => x.Quantity);
        var meDebitQty = periodEntries
            .Where(x => x.EntryType is "adjustment_in")
            .Sum(x => x.Quantity);
        var meCreditQty = -periodEntries
            .Where(x => x.EntryType is "adjustment_out")
            .Sum(x => x.Quantity);
        // Operational debit/credit exclude ME adjustments (Lotteria-style)
        var opDebitQty = debitQtyTotal - meDebitQty;
        var opCreditQty = creditQtyTotal - meCreditQty; // meCreditQty already negative
        var shortageQty = meDebitQty + meCreditQty;

        var openQty = detail.BalanceForward;
        var openVal = open?.Subtotal ?? 0m;
        var debitVal = RoundMoney(periodEntries.Where(x => IsInbound(x.EntryType) && x.EntryType != "adjustment_in")
            .Sum(x => x.Subtotal));
        var creditCogs = RoundMoney(-periodEntries.Where(x => IsOutbound(x.EntryType) && x.EntryType != "adjustment_out")
            .Sum(x => Math.Abs(x.Subtotal)));
        var meDebitVal = RoundMoney(periodEntries.Where(x => x.EntryType == "adjustment_in").Sum(x => x.Subtotal));
        var meCreditCogs = RoundMoney(-periodEntries.Where(x => x.EntryType == "adjustment_out").Sum(x => Math.Abs(x.Subtotal)));
        var beforeInvQty = openQty + opDebitQty + opCreditQty;
        var beforeInvVal = RoundMoney(openVal + debitVal + creditCogs);
        var closeQty = detail.OnHandQty;
        var closeVal = RoundMoney(closeQty * detail.OnHandAverageCogs);
        var shortageVal = meDebitVal + meCreditCogs;

        return new CogsAuditDetailResult
        {
            ItemType = detail.ItemType,
            ItemKey = detail.ItemKey,
            Code = detail.ItemKey,
            Name = detail.Name,
            Group = detail.Group,
            Uom = detail.Uom,
            PeriodMonth = detail.PeriodMonth,
            PeriodStart = detail.PeriodStart,
            PeriodEnd = detail.PeriodEnd,
            IsCurrentMonth = detail.IsCurrentMonth,
            FifoPolicy = detail.FifoPolicy,
            CanvasLineCount = lines.Count,
            Summary = new CogsAuditIngredientRow
            {
                ItemType = detail.ItemType,
                ItemKey = detail.ItemKey,
                Code = detail.ItemKey,
                Name = detail.Name,
                Group = detail.Group,
                Uom = detail.Uom,
                OpenQty = RoundQty(openQty),
                OpenVal = RoundMoney(openVal),
                DebitQty = RoundQty(opDebitQty),
                DebitVal = debitVal,
                CreditQty = RoundQty(opCreditQty),
                CreditCogs = creditCogs,
                BeforeInvQty = RoundQty(beforeInvQty),
                BeforeInvVal = beforeInvVal,
                MeDebitQty = RoundQty(meDebitQty),
                MeDebitVal = meDebitVal,
                MeCreditQty = RoundQty(meCreditQty),
                MeCreditCogs = meCreditCogs,
                CloseQty = RoundQty(closeQty),
                CloseVal = closeVal,
                ShortageQty = RoundQty(shortageQty),
                ShortageVal = shortageVal,
                ShortageUomPrice = shortageQty != 0 ? RoundUnit(shortageVal / shortageQty) : 0m,
                AverageCogs = RoundUnit(detail.AverageCogs),
                OnHandAverageCogs = RoundUnit(detail.OnHandAverageCogs),
            },
            Lines = lines,
        };
    }

    public Task<IReadOnlyList<string>> ListAvailablePeriodsAsync(
        int? companyId = null,
        CancellationToken cancellationToken = default)
    {
        _ = companyId;
        _ = cancellationToken;
        // Last 24 months including current month
        var now = DateTime.UtcNow;
        var months = new List<string>(24);
        for (var i = 0; i < 24; i++)
        {
            var cursor = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-i);
            months.Add($"{cursor:yyyy-MM}");
        }

        return Task.FromResult<IReadOnlyList<string>>(months);
    }

    static bool IsInbound(string entryType) =>
        entryType is "purchase" or "cash_purchase" or "transfer_in" or "adjustment_in" or "inbound" or "split_use_in";

    static bool IsOutbound(string entryType) =>
        // split_use is composition of inbound — not a COGS credit leave.
        entryType is "production" or "pos_sale" or "online_order" or "offline_order"
            or "wastage" or "transfer_out" or "adjustment_out" or "outbound";

    static string MapLineType(string entryType) => entryType switch
    {
        "balance_forward" => "OPENING_BF",
        "purchase" => "DEBIT_PURCHASE",
        "cash_purchase" => "DEBIT_CASH_PURCHASE",
        "transfer_in" => "DEBIT_TRANSFER_IN",
        "split_use_in" => "DEBIT_SPLIT",
        "split_use" => "MEMO_SPLIT",
        "adjustment_in" => "ME_DEBIT_ADJ",
        "pos_sale" => "CREDIT_SALES",
        "online_order" => "CREDIT_ONLINE",
        "offline_order" => "CREDIT_OFFLINE",
        "production" => "CREDIT_PRODUCTION",
        "wastage" => "CREDIT_WASTAGE",
        "transfer_out" => "CREDIT_TRANSFER_OUT",
        "adjustment_out" => "ME_CREDIT_ADJ",
        _ => entryType.ToUpperInvariant(),
    };

    static decimal RoundQty(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
    static decimal RoundMoney(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
    static decimal RoundUnit(decimal v) => Math.Round(v, 4, MidpointRounding.AwayFromZero);
}

public sealed class CogsAuditSummaryResult
{
    public string PeriodMonth { get; init; } = string.Empty;
    public string DebitSign { get; init; } = "+";
    public string CreditSign { get; init; } = "−";
    public string Policy { get; init; } = "FIFO";
    public int IngredientCount { get; init; }
    public decimal OpeningValue { get; init; }
    public decimal BeforeInventoryValue { get; init; }
    public decimal CreditCogsBeforeInventory { get; init; }
    public decimal ClosingValue { get; init; }
    public decimal ShortageQty { get; init; }
    public decimal ShortageValue { get; init; }
    public IReadOnlyList<CogsAuditIngredientRow> Rows { get; init; } = [];
}

public sealed class CogsAuditIngredientRow
{
    public string ItemType { get; init; } = string.Empty;
    public string ItemKey { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public string Uom { get; init; } = string.Empty;
    public decimal OpenQty { get; init; }
    public decimal OpenVal { get; init; }
    public decimal DebitQty { get; init; }
    public decimal DebitVal { get; init; }
    public decimal CreditQty { get; init; }
    public decimal CreditCogs { get; init; }
    public decimal BeforeInvQty { get; init; }
    public decimal BeforeInvVal { get; init; }
    public decimal MeDebitQty { get; init; }
    public decimal MeDebitVal { get; init; }
    public decimal MeCreditQty { get; init; }
    public decimal MeCreditCogs { get; init; }
    public decimal CloseQty { get; init; }
    public decimal CloseVal { get; init; }
    public decimal ShortageQty { get; init; }
    public decimal ShortageVal { get; init; }
    public decimal ShortageUomPrice { get; init; }
    public decimal AverageCogs { get; init; }
    public decimal OnHandAverageCogs { get; init; }
}

public sealed class CogsAuditDetailResult
{
    public string ItemType { get; init; } = string.Empty;
    public string ItemKey { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public string Uom { get; init; } = string.Empty;
    public string PeriodMonth { get; init; } = string.Empty;
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public bool IsCurrentMonth { get; init; }
    public string FifoPolicy { get; init; } = "FIFO";
    public int CanvasLineCount { get; init; }
    public CogsAuditIngredientRow Summary { get; init; } = new();
    public IReadOnlyList<CogsAuditLedgerLine> Lines { get; init; } = [];
}

public sealed class CogsAuditLedgerLine
{
    public int Seq { get; init; }
    public DateTime OccurredAt { get; init; }
    public string LineType { get; init; } = string.Empty;
    public string EntryType { get; init; } = string.Empty;
    public string RefId { get; init; } = string.Empty;
    public string Remark { get; init; } = string.Empty;
    public decimal DebitQty { get; init; }
    public decimal CreditQty { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal FifoValue { get; init; }
    public decimal RunningQty { get; init; }
    public decimal RunningValue { get; init; }
    public string FifoDetail { get; init; } = string.Empty;
    public string FifoPolicy { get; init; } = "FIFO";
}
