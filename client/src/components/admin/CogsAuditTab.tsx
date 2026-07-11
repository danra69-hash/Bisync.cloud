import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, History, Search, X } from 'lucide-react';
import {
  api,
  type CogsAuditDetailResult,
  type CogsAuditIngredientRow,
  type CogsAuditSummaryResult,
  type SystemCogsAuditHistoryEntry,
} from '../../api';
import { filterSelectCls, inputCls } from '../layout/formControls';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { formatCountryNumber } from '../../utils/numberFormat';
import {
  currentStockCardMonth,
  formatStockCardMonthLabel,
} from '../revenue/stockCardPeriod';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type Screen = 'summary' | 'detail';

const COGS_AUDIT_MONTH_COUNT = 24;

function fmt2(value: number, countryCode: string) {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  return formatCountryNumber(value, countryCode);
}

/** Last 24 months including the current month (newest first). */
function last24MonthOptions(): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < COGS_AUDIT_MONTH_COUNT; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${d.getFullYear()}-${month}`);
  }
  return options;
}

export function CogsAuditTab({ selectedCompanyId, selectedLocationIds }: Props) {
  const countryCode = useOrgCountryCode();
  const [screen, setScreen] = useState<Screen>('summary');
  const [period, setPeriod] = useState(currentStockCardMonth);
  const [uomMode, setUomMode] = useState<'inventory' | 'recipe'>('inventory');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<CogsAuditSummaryResult | null>(null);
  const [detail, setDetail] = useState<CogsAuditDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [systemHistoryRows, setSystemHistoryRows] = useState<SystemCogsAuditHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [systemViewLabel, setSystemViewLabel] = useState<string | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const periods = useMemo(() => last24MonthOptions(), []);
  const isSystemHistoryView = Boolean(systemViewLabel);
  const freezeLiveLoad = isSystemHistoryView;

  useEffect(() => {
    if (freezeLiveLoad) return;
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .cogsAuditSummary(selectedCompanyId, selectedLocationIds, { period, uomMode, itemType: 'component' })
      .then(setSummary)
      .catch(() => {
        setSummary(null);
        setError('Could not load COGS audit summary.');
      })
      .finally(() => setLoading(false));
  }, [selectedCompanyId, selectedLocationIds, period, uomMode, freezeLiveLoad]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = summary?.rows ?? [];
    if (!q) return rows;
    return rows.filter(
      r =>
        r.itemKey.toLowerCase().includes(q)
        || r.code.toLowerCase().includes(q)
        || r.name.toLowerCase().includes(q)
        || r.group.toLowerCase().includes(q),
    );
  }, [summary, search]);

  const {
    visibleItems: pagedRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(filteredRows, { scrollRootRef });

  async function openDetail(row: CogsAuditIngredientRow) {
    if (!selectedCompanyId || selectedLocationIds.length === 0) return;
    setDetailLoading(true);
    setError(null);
    setScreen('detail');
    try {
      const data = await api.cogsAuditDetail(
        row.itemType,
        row.itemKey,
        selectedCompanyId,
        selectedLocationIds,
        { period, uomMode },
      );
      setDetail(data);
    } catch {
      setDetail(null);
      setError('Could not load ingredient FIFO ledger.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function openHistoryPanel() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const system = await api.cogsAuditSystemHistory(100);
      setSystemHistoryRows(system);
    } catch (err) {
      setSystemHistoryRows([]);
      setHistoryError(err instanceof Error ? err.message : 'Could not load history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openSystemHistoryRun(row: SystemCogsAuditHistoryEntry) {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const file = await api.cogsAuditSystemHistoryOpen(row.runId);
      setSummary(file.summary);
      setPeriod(file.entry.periodMonth);
      setScreen('summary');
      setDetail(null);
      setHistoryOpen(false);
      setSystemViewLabel(
        `${file.entry.companyName} / ${file.entry.locationName} / ${file.entry.monthName} / ${file.entry.year}`
        + (file.entry.isRevised && file.entry.revisedAtUtc
          ? ` / Revised ${file.entry.revisedAtUtc.slice(0, 10)}`
          : ''),
      );
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Could not open system history run.');
    } finally {
      setHistoryLoading(false);
    }
  }

  function exitSystemHistoryView() {
    setSystemViewLabel(null);
    setScreen('summary');
    setDetail(null);
  }

  const historyButton = (
    <button
      type="button"
      onClick={() => void openHistoryPanel()}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
    >
      <History className="h-3.5 w-3.5" />
      History
    </button>
  );

  const historyPanel = historyOpen ? (
    <HistoryPanel
      systemRows={systemHistoryRows}
      loading={historyLoading}
      error={historyError}
      countryCode={countryCode}
      onClose={() => setHistoryOpen(false)}
      onRefresh={() => void openHistoryPanel()}
      onOpenSystem={row => void openSystemHistoryRun(row)}
    />
  ) : null;

  if (!isSystemHistoryView && (!selectedCompanyId || selectedLocationIds.length === 0)) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {historyButton}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Select a company and at least one location for live COGS Audit.
        </div>
        {historyPanel}
      </div>
    );
  }

  if (screen === 'detail') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
            onClick={() => {
              setScreen('summary');
              setDetail(null);
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to summary
          </button>
          {detail && (
            <p className="text-sm font-medium">
              {detail.name} · {detail.itemKey} · {detail.uom}
            </p>
          )}
        </div>

        {detailLoading && <p className="text-xs text-muted-foreground">Loading dated FIFO ledger…</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {detail && !detailLoading && (
          <>
            <p className="text-xs text-muted-foreground">
              {formatStockCardMonthLabel(detail.periodMonth, detail.isCurrentMonth)} · {detail.fifoPolicy} · Debit=+ ·
              Credit=− · {detail.canvasLineCount} lines
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Open qty" value={fmt2(detail.summary.openQty, countryCode)} />
              <Metric label="Debit qty (+)" value={fmt2(detail.summary.debitQty, countryCode)} />
              <Metric label="Credit qty (−)" value={fmt2(detail.summary.creditQty, countryCode)} />
              <Metric label="Close qty" value={fmt2(detail.summary.closeQty, countryCode)} />
              <Metric label="ME Debit (+)" value={fmt2(detail.summary.meDebitQty, countryCode)} />
              <Metric label="ME Credit (−)" value={fmt2(detail.summary.meCreditQty, countryCode)} />
              <Metric label="Shortage qty" value={fmt2(detail.summary.shortageQty, countryCode)} />
              <Metric label="Shortage value" value={fmt2(detail.summary.shortageVal, countryCode)} />
            </div>

            <TableScrollContainer ref={scrollRootRef} className="max-h-[min(70vh,640px)]">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Seq</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">LineType</th>
                    <th className="px-2 py-2 font-medium">Ref</th>
                    <th className="px-2 py-2 font-medium">Remark</th>
                    <th className="px-2 py-2 font-medium text-right">Debit (+)</th>
                    <th className="px-2 py-2 font-medium text-right">Credit (−)</th>
                    <th className="px-2 py-2 font-medium text-right">UnitPrice</th>
                    <th className="px-2 py-2 font-medium text-right">FIFO value</th>
                    <th className="px-2 py-2 font-medium text-right">Running qty</th>
                    <th className="px-2 py-2 font-medium text-right">Running value</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map(line => (
                    <tr key={`${line.seq}-${line.occurredAt}`} className="border-b border-border/50">
                      <td className="px-2 py-1.5 tabular-nums">{line.seq}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {line.occurredAt.slice(0, 10)}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">{line.lineType}</td>
                      <td className="px-2 py-1.5 max-w-[8rem] truncate">{line.refId}</td>
                      <td className="px-2 py-1.5 max-w-[14rem] truncate" title={line.remark}>
                        {line.remark}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(line.debitQty, countryCode)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(line.creditQty, countryCode)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(line.unitPrice, countryCode)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(line.fifoValue, countryCode)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(line.runningQty, countryCode)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(line.runningValue, countryCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollContainer>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Month</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            disabled={isSystemHistoryView}
            className={`${filterSelectCls} min-w-[160px]`}
          >
            {periods.map(m => (
              <option key={m} value={m}>
                {formatStockCardMonthLabel(m, m === currentStockCardMonth())}
              </option>
            ))}
          </select>
        </div>
        {!isSystemHistoryView && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</label>
            <select
              value={uomMode}
              onChange={e => setUomMode(e.target.value as 'inventory' | 'recipe')}
              className={`${filterSelectCls} min-w-[120px]`}
            >
              <option value="inventory">Inventory</option>
              <option value="recipe">Recipe</option>
            </select>
          </div>
        )}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search code, id, name…"
            className={`${inputCls} w-full pl-8`}
          />
        </div>
        {isSystemHistoryView ? (
          <button
            type="button"
            onClick={exitSystemHistoryView}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
          >
            Exit history view
          </button>
        ) : null}
        {historyButton}
      </div>

      {isSystemHistoryView && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          System history · <span className="font-medium text-foreground">{systemViewLabel}</span>
          {' · '}Company / Location / Month / Year snapshot (read-only).
        </p>
      )}

      {!isSystemHistoryView && (
        <p className="text-xs text-muted-foreground">
          FIFO period audit for smart components (last 24 months). Debit = stock in (+), Credit = stock out (−). Click an
          Id to open the dated ledger. History keeps past system runs after inventory reconcile.
        </p>
      )}

      {historyPanel}

      {loading && <p className="text-xs text-muted-foreground">Loading summary…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Opening value" value={fmt2(summary.openingValue, countryCode)} />
            <Metric label="Before inventory value" value={fmt2(summary.beforeInventoryValue, countryCode)} />
            <Metric label="Credit COGS (−)" value={fmt2(summary.creditCogsBeforeInventory, countryCode)} />
            <Metric label="Closing value" value={fmt2(summary.closingValue, countryCode)} />
            <Metric label="Shortage qty" value={fmt2(summary.shortageQty, countryCode)} />
            <Metric label="Shortage value" value={fmt2(summary.shortageValue, countryCode)} />
            <Metric label="Ingredients" value={String(summary.ingredientCount)} />
            <Metric label="Month" value={summary.periodMonth} />
          </div>

          <p className="text-xs text-muted-foreground">
            Showing {visibleCount} of {totalCount} · signed summary (Debit +, Credit −)
          </p>

          <TableScrollContainer ref={scrollRootRef} className="max-h-[min(70vh,640px)]">
            <table className="w-full min-w-[1400px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Id</th>
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">UOM</th>
                  <th className="px-2 py-2 font-medium text-right">Open qty</th>
                  <th className="px-2 py-2 font-medium text-right">Open val</th>
                  <th className="px-2 py-2 font-medium text-right">Debit qty (+)</th>
                  <th className="px-2 py-2 font-medium text-right">Debit val (+)</th>
                  <th className="px-2 py-2 font-medium text-right">Credit qty (−)</th>
                  <th className="px-2 py-2 font-medium text-right">Credit COGS (−)</th>
                  <th className="px-2 py-2 font-medium text-right">Before inv qty</th>
                  <th className="px-2 py-2 font-medium text-right">ME Debit (+)</th>
                  <th className="px-2 py-2 font-medium text-right">ME Credit (−)</th>
                  <th className="px-2 py-2 font-medium text-right">Close qty</th>
                  <th className="px-2 py-2 font-medium text-right">Shortage qty</th>
                  <th className="px-2 py-2 font-medium text-right">Shortage val</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(row => (
                  <tr key={`${row.itemType}:${row.itemKey}`} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-2 py-1.5 font-mono text-[11px]">{row.code}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] font-medium hover:bg-primary hover:text-primary-foreground"
                        onClick={() => openDetail(row)}
                      >
                        {row.itemKey}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 max-w-[12rem] truncate" title={row.name}>
                      {row.name}
                    </td>
                    <td className="px-2 py-1.5">{row.uom}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.openQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.openVal, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.debitQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.debitVal, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.creditQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.creditCogs, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.beforeInvQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.meDebitQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.meCreditQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.closeQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.shortageQty, countryCode)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.shortageVal, countryCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <InfiniteScrollTableSentinel colSpan={16} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </TableScrollContainer>
        </>
      )}
    </div>
  );
}

function HistoryPanel({
  systemRows,
  loading,
  error,
  countryCode,
  onClose,
  onRefresh,
  onOpenSystem,
}: {
  systemRows: SystemCogsAuditHistoryEntry[];
  loading: boolean;
  error: string | null;
  countryCode: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenSystem: (row: SystemCogsAuditHistoryEntry) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">COGS Audit History</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            System runs are saved under Company / Location / Month / Year after inventory reconcile. Later adjustments
            create a Revised date folder.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading history…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && systemRows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No system COGS audits yet. They appear after a full inventory count is confirmed for a month.
        </p>
      )}

      {systemRows.length > 0 && (
        <TableScrollContainer className="max-h-[min(50vh,420px)]">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 font-medium">Company</th>
                <th className="px-2 py-2 font-medium">Location</th>
                <th className="px-2 py-2 font-medium">Month</th>
                <th className="px-2 py-2 font-medium">Year</th>
                <th className="px-2 py-2 font-medium">Version</th>
                <th className="px-2 py-2 font-medium text-right">Ingredients</th>
                <th className="px-2 py-2 font-medium text-right">Shortage val</th>
                <th className="px-2 py-2 font-medium">Path</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {systemRows.map(row => (
                <tr key={row.runId} className="border-b border-border/50">
                  <td className="px-2 py-1.5">{row.companyName}</td>
                  <td className="px-2 py-1.5">{row.locationName}</td>
                  <td className="px-2 py-1.5">{row.monthName}</td>
                  <td className="px-2 py-1.5">{row.year}</td>
                  <td className="px-2 py-1.5">
                    {row.isRevised
                      ? `Revised ${(row.revisedAtUtc ?? row.createdAtUtc).slice(0, 10)}`
                      : 'Initial'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{row.ingredientCount}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt2(row.shortageValue, countryCode)}</td>
                  <td className="px-2 py-1.5 max-w-[16rem] truncate font-mono text-[11px]" title={row.relativePath}>
                    {row.relativePath}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenSystem(row)}
                      className="rounded border border-border px-2 py-0.5 text-[11px] font-medium hover:bg-primary hover:text-primary-foreground"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollContainer>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
