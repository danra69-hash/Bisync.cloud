using System.Collections.Concurrent;
using System.Globalization;
using System.Text;

namespace Bisync.Api.Services;

/// <summary>
/// Independent COGS audit from an uploaded ingredient stock-ledger CSV (Lotteria-style).
/// Debit = stock in (+), Credit = stock out (−). Month-end inventory adj = shortage.
/// </summary>
public class IndependentCogsAuditService(IndependentCogsAuditHistoryStore historyStore)
{
    static readonly ConcurrentDictionary<string, IndependentAuditSession> Sessions = new(StringComparer.Ordinal);
    static readonly TimeSpan SessionTtl = TimeSpan.FromHours(2);

    public async Task<IndependentAuditUploadResult> RunFromCsvAsync(
        Stream csvStream,
        string fileName,
        string periodMonth,
        CancellationToken cancellationToken = default)
    {
        if (!TryParseMonth(periodMonth, out var year, out var month))
            throw new InvalidOperationException("Period must be yyyy-MM.");

        var monthStart = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthEnd = monthStart.AddMonths(1);
        var priorStart = monthStart.AddMonths(-1);
        var lastDayOfMonth = monthEnd.AddDays(-1).Date;

        PurgeExpiredSessions();

        var bf = new Dictionary<string, BroughtForward>(StringComparer.Ordinal);
        var meta = new Dictionary<string, IngredientMeta>(StringComparer.Ordinal);
        var periodRows = new Dictionary<string, List<LedgerTxn>>(StringComparer.Ordinal);

        using (var reader = new StreamReader(csvStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true))
        {
            var headerLine = await reader.ReadLineAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(headerLine))
                throw new InvalidOperationException("CSV is empty.");

            var headers = ParseCsvLine(headerLine);
            var map = BuildHeaderMap(headers);
            RequireColumns(map, "CreatedDateUtc", "IngredientId", "Debit", "Credit", "CloseBalance", "OpenBalance", "Price");

            string? line;
            while ((line = await reader.ReadLineAsync(cancellationToken)) is not null)
            {
                if (string.IsNullOrWhiteSpace(line))
                    continue;

                var cols = ParseCsvLine(line);
                var createdRaw = Get(cols, map, "CreatedDateUtc");
                if (!TryParseDate(createdRaw, out var dt))
                    continue;

                var ing = Get(cols, map, "IngredientId");
                if (string.IsNullOrWhiteSpace(ing))
                    continue;

                var code = NullIfEmpty(Get(cols, map, "Code"));
                var uom = NullIfEmpty(Get(cols, map, "UOM")) ?? "";
                if (!string.IsNullOrEmpty(code) || !string.IsNullOrEmpty(uom))
                {
                    if (!meta.TryGetValue(ing, out var m))
                    {
                        m = new IngredientMeta();
                        meta[ing] = m;
                    }
                    if (!string.IsNullOrEmpty(code))
                        m.Code = code;
                    if (!string.IsNullOrEmpty(uom))
                        m.Uom = uom;
                }

                // Prior-month B/F: last CloseBalance for POS CreatedBy=0
                if (dt >= priorStart && dt < monthStart)
                {
                    var createdBy = Get(cols, map, "CreatedBy");
                    if (createdBy == "0")
                    {
                        var close = ParseDec(Get(cols, map, "CloseBalance"));
                        var price = ParseDec(Get(cols, map, "Price"));
                        if (!bf.TryGetValue(ing, out var prev) || dt >= prev.At)
                        {
                            bf[ing] = new BroughtForward(dt, close, price, uom, code);
                        }
                    }
                    continue;
                }

                if (dt < monthStart || dt >= monthEnd)
                    continue;

                if (!periodRows.TryGetValue(ing, out var list))
                {
                    list = [];
                    periodRows[ing] = list;
                }

                list.Add(new LedgerTxn(
                    Get(cols, map, "Id"),
                    dt,
                    ing,
                    ParseDec(Get(cols, map, "Debit")),
                    ParseDec(Get(cols, map, "Credit")),
                    ParseDec(Get(cols, map, "Price")),
                    ParseDec(Get(cols, map, "OpenBalance")),
                    ParseDec(Get(cols, map, "CloseBalance")),
                    Get(cols, map, "EntityType"),
                    Truncate(Get(cols, map, "Remark"), 120),
                    uom,
                    code,
                    Get(cols, map, "CreatedBy")));
            }
        }

        foreach (var list in periodRows.Values)
            list.Sort((a, b) =>
            {
                var c = a.At.CompareTo(b.At);
                return c != 0 ? c : string.CompareOrdinal(a.Id, b.Id);
            });

        // Detect Debit/Credit sign convention from Open/Close identity before FIFO analysis.
        var convention = DetectDebitCreditConvention(periodRows.Values.SelectMany(x => x));
        foreach (var key in periodRows.Keys.ToList())
        {
            var list = periodRows[key];
            for (var i = 0; i < list.Count; i++)
            {
                var t = list[i];
                var (stockIn, stockOut) = NormalizeDebitCredit(t.Debit, t.Credit, convention.Mode);
                list[i] = t with { Debit = stockIn, Credit = stockOut };
            }
        }

        var allIds = bf.Keys
            .Union(periodRows.Keys)
            .OrderBy(id =>
            {
                meta.TryGetValue(id, out var m);
                bf.TryGetValue(id, out var b);
                return m?.Code ?? b?.Code ?? "";
            }, StringComparer.OrdinalIgnoreCase)
            .ThenBy(id => id, StringComparer.Ordinal)
            .ToList();

        var summaryRows = new List<CogsAuditIngredientRow>();
        var details = new Dictionary<string, CogsAuditDetailResult>(StringComparer.Ordinal);

        foreach (var ing in allIds)
        {
            meta.TryGetValue(ing, out var m);
            bf.TryGetValue(ing, out var b);
            var txns = periodRows.GetValueOrDefault(ing) ?? [];
            var code = m?.Code ?? b?.Code ?? txns.FirstOrDefault()?.Code ?? ing;
            var uom = m?.Uom ?? b?.Uom ?? txns.FirstOrDefault()?.Uom ?? "";

            // Prefer prior-month B/F; if the upload is month-only (e.g. June extract),
            // use the first period row's OpenBalance as opening qty.
            decimal openingQty;
            decimal openingPrice;
            if (b is not null)
            {
                openingQty = b.Qty;
                openingPrice = b.Price;
            }
            else if (txns.Count > 0)
            {
                var anchor = txns.FirstOrDefault(t => t.CreatedBy == "0") ?? txns[0];
                openingQty = anchor.Open;
                openingPrice = anchor.Price;
                // If first row price is 0, take first non-zero price in the month
                if (openingPrice == 0)
                {
                    var priced = txns.FirstOrDefault(t => t.Price > 0);
                    if (priced is not null)
                        openingPrice = priced.Price;
                }
            }
            else
            {
                openingQty = 0m;
                openingPrice = 0m;
            }

            var openingValue = openingQty > 0 ? RoundMoney(openingQty * openingPrice) : 0m;

            var layers = new LinkedList<FifoLayer>();
            if (openingQty > 0)
                layers.AddLast(new FifoLayer(openingQty, openingPrice));

            var lines = new List<CogsAuditLedgerLine>();
            var seq = 0;
            var (runQ, runV) = LayerTotals(layers);
            if (openingQty < 0)
            {
                runQ = openingQty;
                runV = 0m;
            }

            void AddLine(
                string lineType,
                DateTime at,
                string refId,
                string remark,
                decimal debitQty,
                decimal creditQty,
                decimal unitPrice,
                decimal fifoValue,
                decimal runningQty,
                decimal runningValue)
            {
                seq++;
                lines.Add(new CogsAuditLedgerLine
                {
                    Seq = seq,
                    OccurredAt = at,
                    LineType = lineType,
                    EntryType = lineType,
                    RefId = refId,
                    Remark = remark,
                    DebitQty = RoundQty(debitQty),
                    CreditQty = RoundQty(creditQty),
                    UnitPrice = RoundUnit(unitPrice),
                    FifoValue = RoundMoney(fifoValue),
                    RunningQty = RoundQty(runningQty),
                    RunningValue = RoundMoney(runningValue),
                    FifoPolicy = "FIFO",
                });
            }

            AddLine(
                "OPENING_BF",
                monthStart.AddDays(-1),
                "",
                $"Opening B/F from {priorStart:yyyy-MM} period end",
                0,
                0,
                openingPrice,
                openingValue,
                runQ,
                runV);

            decimal debitQtyB = 0, debitValB = 0, creditQtyB = 0, creditCogsB = 0;
            decimal meDebitQty = 0, meDebitVal = 0, meCreditQty = 0, meCreditCogs = 0;

            foreach (var t in txns)
            {
                var isMeInv = string.Equals(t.EntityType, "InventoryAdjustmentRequestIngredient", StringComparison.OrdinalIgnoreCase)
                    && t.At.Date == lastDayOfMonth;

                if (t.Debit == 0 && t.Credit == 0)
                    continue;

                if (t.Debit > 0)
                {
                    layers.AddLast(new FifoLayer(t.Debit, t.Price));
                    var addVal = RoundMoney(t.Debit * t.Price);
                    (runQ, runV) = LayerTotals(layers);
                    var lt = isMeInv
                        ? "ME_DEBIT_ADJ"
                        : t.EntityType switch
                        {
                            "TblInvoiceDetail" => "DEBIT_PURCHASE",
                            "InventoryAdjustmentRequestIngredient" => "DEBIT_ADJ_IN",
                            _ => "DEBIT_OTHER",
                        };
                    if (isMeInv)
                    {
                        meDebitQty += t.Debit;
                        meDebitVal += addVal;
                    }
                    else
                    {
                        debitQtyB += t.Debit;
                        debitValB += addVal;
                    }

                    AddLine(lt, t.At, t.Id, t.Remark, t.Debit, 0, t.Price, addVal, runQ, runV);
                }

                if (t.Credit > 0)
                {
                    var (cogs, _) = Consume(layers, t.Credit, t.Price);
                    (runQ, runV) = LayerTotals(layers);
                    var creditSigned = -t.Credit;
                    var cogsSigned = -RoundMoney(cogs);
                    var lt = isMeInv
                        ? "ME_CREDIT_ADJ"
                        : t.EntityType switch
                        {
                            "TransactionDetails" => "CREDIT_SALES",
                            "WastageHistoryDetail" => "CREDIT_WASTAGE",
                            "InventoryAdjustmentRequestIngredient" => "CREDIT_ADJ_OUT",
                            _ => "CREDIT_OTHER",
                        };
                    if (isMeInv)
                    {
                        meCreditQty += creditSigned;
                        meCreditCogs += cogsSigned;
                    }
                    else
                    {
                        creditQtyB += creditSigned;
                        creditCogsB += cogsSigned;
                    }

                    AddLine(lt, t.At, t.Id, t.Remark, 0, creditSigned, t.Price, cogsSigned, runQ, runV);
                }
            }

            var beforeInvQty = openingQty + debitQtyB + creditQtyB;
            var beforeInvVal = RoundMoney(openingValue + debitValB + creditCogsB);
            var shortageQty = meDebitQty + meCreditQty;
            var shortageVal = RoundMoney(meDebitVal + meCreditCogs);
            var closeQty = runQ;
            var closeVal = RoundMoney(runV);
            var shortagePx = shortageQty != 0 ? RoundUnit(shortageVal / shortageQty) : 0m;

            var row = new CogsAuditIngredientRow
            {
                ItemType = "independent",
                ItemKey = ing,
                Code = code,
                Name = code,
                Group = "",
                Uom = uom,
                OpenQty = RoundQty(openingQty),
                OpenVal = RoundMoney(openingValue),
                DebitQty = RoundQty(debitQtyB),
                DebitVal = RoundMoney(debitValB),
                CreditQty = RoundQty(creditQtyB),
                CreditCogs = RoundMoney(creditCogsB),
                BeforeInvQty = RoundQty(beforeInvQty),
                BeforeInvVal = beforeInvVal,
                MeDebitQty = RoundQty(meDebitQty),
                MeDebitVal = RoundMoney(meDebitVal),
                MeCreditQty = RoundQty(meCreditQty),
                MeCreditCogs = RoundMoney(meCreditCogs),
                CloseQty = RoundQty(closeQty),
                CloseVal = closeVal,
                ShortageQty = RoundQty(shortageQty),
                ShortageVal = shortageVal,
                ShortageUomPrice = shortagePx,
            };

            summaryRows.Add(row);
            details[ing] = new CogsAuditDetailResult
            {
                ItemType = "independent",
                ItemKey = ing,
                Code = code,
                Name = code,
                Group = "",
                Uom = uom,
                PeriodMonth = $"{year:D4}-{month:D2}",
                PeriodStart = monthStart,
                PeriodEnd = monthEnd.AddTicks(-1),
                IsCurrentMonth = monthStart.Year == DateTime.UtcNow.Year && monthStart.Month == DateTime.UtcNow.Month,
                FifoPolicy = "FIFO",
                CanvasLineCount = lines.Count,
                Summary = row,
                Lines = lines,
            };
        }

        var summary = new CogsAuditSummaryResult
        {
            PeriodMonth = $"{year:D4}-{month:D2}",
            DebitSign = "+",
            CreditSign = "−",
            Policy = "FIFO",
            IngredientCount = summaryRows.Count,
            OpeningValue = RoundMoney(summaryRows.Sum(r => r.OpenVal)),
            BeforeInventoryValue = RoundMoney(summaryRows.Sum(r => r.BeforeInvVal)),
            CreditCogsBeforeInventory = RoundMoney(summaryRows.Sum(r => r.CreditCogs)),
            ClosingValue = RoundMoney(summaryRows.Sum(r => r.CloseVal)),
            ShortageQty = RoundQty(summaryRows.Sum(r => r.ShortageQty)),
            ShortageValue = RoundMoney(summaryRows.Sum(r => r.ShortageVal)),
            Rows = summaryRows,
        };

        var sessionId = Guid.NewGuid().ToString("N");
        var createdAt = DateTime.UtcNow;
        Sessions[sessionId] = new IndependentAuditSession(
            sessionId,
            fileName,
            summary.PeriodMonth,
            createdAt,
            summary,
            details,
            convention);

        var result = new IndependentAuditUploadResult
        {
            SessionId = sessionId,
            FileName = fileName,
            PeriodMonth = summary.PeriodMonth,
            DebitCreditMode = convention.Mode.ToString(),
            DebitCreditConvention = convention.Description,
            DebitMeans = convention.DebitMeans,
            CreditMeans = convention.CreditMeans,
            ConventionSampleCount = convention.SampleCount,
            ConventionMatchCount = convention.MatchCount,
            ConventionConfidence = convention.Confidence,
            ColumnsSwapped = convention.ColumnsSwapped,
            Summary = summary,
            SavedToHistory = false,
            HistoryPath = historyStore.HistoryDirectory,
        };

        try
        {
            historyStore.Save(result, details, createdAt);
            result.SavedToHistory = true;
        }
        catch
        {
            // Analysis result is still returned even if history write fails.
            result.SavedToHistory = false;
        }

        return result;
    }

    public IReadOnlyList<IndependentAuditHistoryEntry> ListHistory(int take = 50) =>
        historyStore.List(take);

    public IndependentAuditUploadResult? OpenHistory(string sessionId)
    {
        if (Sessions.TryGetValue(sessionId, out var existing)
            && DateTime.UtcNow - existing.CreatedAtUtc <= SessionTtl)
        {
            return ToUploadResult(existing, savedToHistory: true);
        }

        var file = historyStore.Load(sessionId);
        if (file is null)
            return null;

        var convention = new DetectedDebitCreditConvention(
            Enum.TryParse<DebitCreditMode>(file.Entry.DebitCreditMode, out var mode)
                ? mode
                : DebitCreditMode.DebitInCreditOutAbsolute,
            file.Entry.DebitCreditConvention,
            file.Entry.DebitMeans,
            file.Entry.CreditMeans,
            file.Entry.ConventionSampleCount,
            file.Entry.ConventionMatchCount,
            file.Entry.ConventionConfidence,
            file.Entry.ColumnsSwapped);

        var session = new IndependentAuditSession(
            sessionId,
            file.Entry.FileName,
            file.Entry.PeriodMonth,
            DateTime.UtcNow, // refresh memory TTL when opened from history
            file.Summary,
            file.Details,
            convention);
        Sessions[sessionId] = session;

        return ToUploadResult(session, savedToHistory: true);
    }

    public bool DeleteHistory(string sessionId)
    {
        Sessions.TryRemove(sessionId, out _);
        return historyStore.Delete(sessionId);
    }

    public IndependentAuditUploadResult? GetSession(string sessionId)
    {
        if (Sessions.TryGetValue(sessionId, out var session)
            && DateTime.UtcNow - session.CreatedAtUtc <= SessionTtl)
        {
            return ToUploadResult(session, savedToHistory: true);
        }

        if (Sessions.ContainsKey(sessionId))
            Sessions.TryRemove(sessionId, out _);

        return OpenHistory(sessionId);
    }

    public CogsAuditDetailResult? GetDetail(string sessionId, string ingredientId)
    {
        if (!Sessions.TryGetValue(sessionId, out var session)
            || DateTime.UtcNow - session.CreatedAtUtc > SessionTtl)
        {
            if (OpenHistory(sessionId) is null)
                return null;
            if (!Sessions.TryGetValue(sessionId, out session))
                return null;
        }

        return session.Details.TryGetValue(ingredientId, out var detail) ? detail : null;
    }

    static IndependentAuditUploadResult ToUploadResult(IndependentAuditSession session, bool savedToHistory) =>
        new()
        {
            SessionId = session.SessionId,
            FileName = session.FileName,
            PeriodMonth = session.PeriodMonth,
            DebitCreditMode = session.Convention.Mode.ToString(),
            DebitCreditConvention = session.Convention.Description,
            DebitMeans = session.Convention.DebitMeans,
            CreditMeans = session.Convention.CreditMeans,
            ConventionSampleCount = session.Convention.SampleCount,
            ConventionMatchCount = session.Convention.MatchCount,
            ConventionConfidence = session.Convention.Confidence,
            ColumnsSwapped = session.Convention.ColumnsSwapped,
            Summary = session.Summary,
            SavedToHistory = savedToHistory,
        };

    static void PurgeExpiredSessions()
    {
        var cutoff = DateTime.UtcNow - SessionTtl;
        foreach (var kv in Sessions)
        {
            if (kv.Value.CreatedAtUtc < cutoff)
                Sessions.TryRemove(kv.Key, out _);
        }
    }

    /// <summary>
    /// Infer whether Debit/Credit are stock-in vs stock-out (and absolute vs signed)
    /// by scoring OpenBalance/CloseBalance identities on sample rows.
    /// Analysis always normalizes to: Debit = stock in (+), Credit = stock out (magnitude).
    /// </summary>
    static DetectedDebitCreditConvention DetectDebitCreditConvention(IEnumerable<LedgerTxn> rows)
    {
        const decimal eps = 0.02m;
        int scoreAbsDebitIn = 0;
        int scoreAbsSwapped = 0;
        int scoreSigned = 0;
        int sample = 0;
        int debitPositive = 0, debitNegative = 0, creditPositive = 0, creditNegative = 0;
        int absNonNegative = 0;

        foreach (var t in rows)
        {
            if (Math.Abs(t.Debit) < 0.0000001m && Math.Abs(t.Credit) < 0.0000001m)
                continue;

            sample++;
            if (t.Debit > eps) debitPositive++;
            else if (t.Debit < -eps) debitNegative++;
            if (t.Credit > eps) creditPositive++;
            else if (t.Credit < -eps) creditNegative++;
            if (t.Debit >= -eps && t.Credit >= -eps)
                absNonNegative++;

            var open = t.Open;
            var close = t.Close;
            var d = t.Debit;
            var c = t.Credit;

            // Classic Lotteria: Close = Open + Debit − Credit (both columns absolute magnitudes)
            if (Near(close, open + d - c, eps))
                scoreAbsDebitIn++;
            // Swapped absolute: Close = Open − Debit + Credit
            if (Near(close, open - d + c, eps))
                scoreAbsSwapped++;
            // Signed contributions: Close = Open + Debit + Credit
            if (Near(close, open + d + c, eps))
                scoreSigned++;
        }

        if (sample == 0)
        {
            return new DetectedDebitCreditConvention(
                DebitCreditMode.DebitInCreditOutAbsolute,
                "No non-zero Debit/Credit rows to test — defaulting to Debit = stock in (+), Credit = stock out (−).",
                "stock in (+)",
                "stock out (−)",
                0,
                0,
                0,
                false);
        }

        var absLikely = absNonNegative >= sample * 0.85;

        DebitCreditMode mode;
        int bestScore;
        bool swapped;

        if (absLikely && scoreAbsDebitIn >= scoreAbsSwapped && scoreAbsDebitIn >= scoreSigned)
        {
            mode = DebitCreditMode.DebitInCreditOutAbsolute;
            bestScore = scoreAbsDebitIn;
            swapped = false;
        }
        else if (absLikely && scoreAbsSwapped > scoreAbsDebitIn && scoreAbsSwapped >= scoreSigned)
        {
            mode = DebitCreditMode.DebitOutCreditInAbsolute;
            bestScore = scoreAbsSwapped;
            swapped = true;
        }
        else if (scoreSigned >= scoreAbsDebitIn && scoreSigned >= scoreAbsSwapped)
        {
            // Signed: decide which column is typically inbound (+)
            // Debit mostly +, Credit mostly − → standard
            // Debit mostly −, Credit mostly + → swapped
            if (debitNegative + creditPositive > debitPositive + creditNegative)
            {
                mode = DebitCreditMode.DebitOutCreditInSigned;
                swapped = true;
            }
            else
            {
                mode = DebitCreditMode.DebitInCreditOutSigned;
                swapped = false;
            }
            bestScore = scoreSigned;
        }
        else if (scoreAbsSwapped > scoreAbsDebitIn)
        {
            mode = DebitCreditMode.DebitOutCreditInAbsolute;
            bestScore = scoreAbsSwapped;
            swapped = true;
        }
        else
        {
            mode = DebitCreditMode.DebitInCreditOutAbsolute;
            bestScore = scoreAbsDebitIn;
            swapped = false;
        }

        var confidence = sample == 0 ? 0 : Math.Round((decimal)bestScore / sample, 4);
        var description = mode switch
        {
            DebitCreditMode.DebitInCreditOutAbsolute =>
                $"Detected absolute columns: Close = Open + Debit − Credit ({bestScore}/{sample} rows). Debit = stock in (+), Credit = stock out (−).",
            DebitCreditMode.DebitOutCreditInAbsolute =>
                $"Detected absolute columns swapped: Close = Open − Debit + Credit ({bestScore}/{sample} rows). Columns swapped before analysis — Debit treated as stock out, Credit as stock in.",
            DebitCreditMode.DebitInCreditOutSigned =>
                $"Detected signed amounts: Close = Open + Debit + Credit ({bestScore}/{sample} rows). Debit typically +, Credit typically −.",
            DebitCreditMode.DebitOutCreditInSigned =>
                $"Detected signed amounts swapped: Close = Open + Debit + Credit ({bestScore}/{sample} rows). Columns swapped before analysis — Debit typically − (out), Credit typically + (in).",
            _ => "Unknown Debit/Credit convention.",
        };

        return new DetectedDebitCreditConvention(
            mode,
            description,
            swapped ? "stock out (−)" : "stock in (+)",
            swapped ? "stock in (+)" : "stock out (−)",
            sample,
            bestScore,
            confidence,
            swapped);
    }

    static (decimal StockIn, decimal StockOut) NormalizeDebitCredit(
        decimal rawDebit,
        decimal rawCredit,
        DebitCreditMode mode)
    {
        return mode switch
        {
            DebitCreditMode.DebitInCreditOutAbsolute =>
                (Math.Abs(rawDebit), Math.Abs(rawCredit)),

            DebitCreditMode.DebitOutCreditInAbsolute =>
                (Math.Abs(rawCredit), Math.Abs(rawDebit)),

            DebitCreditMode.DebitInCreditOutSigned =>
                (
                    rawDebit > 0 ? rawDebit : 0m,
                    rawCredit < 0 ? -rawCredit : 0m
                ),

            DebitCreditMode.DebitOutCreditInSigned =>
                (
                    rawCredit > 0 ? rawCredit : 0m,
                    rawDebit < 0 ? -rawDebit : 0m
                ),

            _ => (Math.Abs(rawDebit), Math.Abs(rawCredit)),
        };
    }

    static bool Near(decimal actual, decimal expected, decimal eps) =>
        Math.Abs(actual - expected) <= eps;

    static (decimal Qty, decimal Value) LayerTotals(LinkedList<FifoLayer> layers)
    {
        decimal q = 0, v = 0;
        for (var n = layers.First; n is not null; n = n.Next)
        {
            q += n.Value.Qty;
            v += n.Value.Qty * n.Value.Price;
        }
        return (q, v);
    }

    static (decimal Cogs, decimal Short) Consume(LinkedList<FifoLayer> layers, decimal qty, decimal fallbackPrice)
    {
        var left = qty;
        decimal cogs = 0;
        while (left > 0.000000000001m && layers.First is not null)
        {
            var layer = layers.First.Value;
            var take = Math.Min(layer.Qty, left);
            cogs += take * layer.Price;
            layer.Qty -= take;
            left -= take;
            if (layer.Qty <= 0.000000000001m)
                layers.RemoveFirst();
        }

        decimal shortfall = 0;
        if (left > 0.000000000001m)
        {
            shortfall = left;
            cogs += shortfall * fallbackPrice;
        }

        return (cogs, shortfall);
    }

    static Dictionary<string, int> BuildHeaderMap(IReadOnlyList<string> headers)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Count; i++)
        {
            var h = headers[i].Trim().Trim('\uFEFF');
            if (!string.IsNullOrEmpty(h) && !map.ContainsKey(h))
                map[h] = i;
        }

        // Positional fallback for headerless Lotteria exports (31 columns)
        if (!map.ContainsKey("CreatedDateUtc") && headers.Count >= 21)
        {
            map["Id"] = 0;
            map["CloseBalance"] = 1;
            map["Code"] = 2;
            map["CreatedBy"] = 3;
            map["CreatedDateUtc"] = 4;
            map["Credit"] = 5;
            map["Debit"] = 6;
            map["Details"] = 7;
            map["IngredientId"] = 8;
            map["OpenBalance"] = 12;
            map["Remark"] = 13;
            map["UOM"] = 16;
            map["Price"] = 19;
            map["EntityType"] = 20;
            map["EntityId"] = 21;
        }

        return map;
    }

    static void RequireColumns(Dictionary<string, int> map, params string[] names)
    {
        foreach (var n in names)
        {
            if (!map.ContainsKey(n))
                throw new InvalidOperationException($"CSV missing required column '{n}'.");
        }
    }

    static string Get(IReadOnlyList<string> cols, Dictionary<string, int> map, string name)
    {
        if (!map.TryGetValue(name, out var idx) || idx < 0 || idx >= cols.Count)
            return "";
        var v = cols[idx];
        return string.Equals(v, "NULL", StringComparison.OrdinalIgnoreCase) ? "" : v.Trim();
    }

    static string? NullIfEmpty(string s) => string.IsNullOrWhiteSpace(s) ? null : s;

    static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) ? "" : (s.Length <= max ? s : s[..max]);

    static decimal ParseDec(string s)
    {
        if (string.IsNullOrWhiteSpace(s))
            return 0m;
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : 0m;
    }

    static bool TryParseMonth(string? period, out int year, out int month)
    {
        year = 0;
        month = 0;
        if (string.IsNullOrWhiteSpace(period))
            return false;
        return DateOnly.TryParse($"{period.Trim()}-01", out var d) && (year = d.Year) > 0 && (month = d.Month) > 0;
    }

    static bool TryParseDate(string s, out DateTime dt)
    {
        dt = default;
        if (string.IsNullOrWhiteSpace(s))
            return false;
        s = s.Trim();
        string[] formats =
        [
            "yyyy-MM-dd HH:mm:ss.fffffff",
            "yyyy-MM-dd HH:mm:ss.fff",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-ddTHH:mm:ss.fffffff",
            "yyyy-MM-ddTHH:mm:ss.fff",
            "yyyy-MM-ddTHH:mm:ss",
            "yyyy-MM-dd",
        ];
        return DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out dt)
            || DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out dt);
    }

    static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var sb = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        sb.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    sb.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == ',')
            {
                result.Add(sb.ToString());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }
        result.Add(sb.ToString());
        return result;
    }

    static decimal RoundQty(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
    static decimal RoundMoney(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);
    static decimal RoundUnit(decimal v) => Math.Round(v, 4, MidpointRounding.AwayFromZero);

    sealed class FifoLayer(decimal qty, decimal price)
    {
        public decimal Qty = qty;
        public decimal Price = price;
    }

    sealed record BroughtForward(DateTime At, decimal Qty, decimal Price, string? Uom, string? Code);
    sealed class IngredientMeta
    {
        public string? Code { get; set; }
        public string? Uom { get; set; }
    }

    sealed record LedgerTxn(
        string Id,
        DateTime At,
        string IngredientId,
        decimal Debit,
        decimal Credit,
        decimal Price,
        decimal Open,
        decimal Close,
        string EntityType,
        string Remark,
        string? Uom,
        string? Code,
        string CreatedBy);

    sealed record IndependentAuditSession(
        string SessionId,
        string FileName,
        string PeriodMonth,
        DateTime CreatedAtUtc,
        CogsAuditSummaryResult Summary,
        Dictionary<string, CogsAuditDetailResult> Details,
        DetectedDebitCreditConvention Convention);
}

public enum DebitCreditMode
{
    /// <summary>Close = Open + Debit − Credit; both columns are absolute magnitudes.</summary>
    DebitInCreditOutAbsolute = 0,
    /// <summary>Close = Open − Debit + Credit; absolute magnitudes with columns swapped.</summary>
    DebitOutCreditInAbsolute = 1,
    /// <summary>Close = Open + Debit + Credit; Debit typically +, Credit typically −.</summary>
    DebitInCreditOutSigned = 2,
    /// <summary>Close = Open + Debit + Credit; Debit typically − (out), Credit typically + (in).</summary>
    DebitOutCreditInSigned = 3,
}

public sealed record DetectedDebitCreditConvention(
    DebitCreditMode Mode,
    string Description,
    string DebitMeans,
    string CreditMeans,
    int SampleCount,
    int MatchCount,
    decimal Confidence,
    bool ColumnsSwapped);

public sealed class IndependentAuditUploadResult
{
    public string SessionId { get; init; } = string.Empty;
    public string FileName { get; init; } = string.Empty;
    public string PeriodMonth { get; init; } = string.Empty;
    public string DebitCreditMode { get; init; } = string.Empty;
    public string DebitCreditConvention { get; init; } = string.Empty;
    public string DebitMeans { get; init; } = string.Empty;
    public string CreditMeans { get; init; } = string.Empty;
    public int ConventionSampleCount { get; init; }
    public int ConventionMatchCount { get; init; }
    public decimal ConventionConfidence { get; init; }
    public bool ColumnsSwapped { get; init; }
    public bool SavedToHistory { get; set; }
    public string? HistoryPath { get; set; }
    public CogsAuditSummaryResult Summary { get; init; } = new();
}
