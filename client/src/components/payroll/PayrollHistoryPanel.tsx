import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollDivSentinel } from '../shared/infiniteScroll';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { hrApi } from '../../modules/hr/api';
import type { PayrollRunDetail, PayrollRunSummary } from '../../modules/hr/types';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_ROOT_CLS, SIDE_PANEL_SHELL_WIDE_CLS } from '../layout/sidePanelShared';
import { formatPayrollAmount } from './payrollDisplay';
import {
  formatAttendanceSummary,
  formatPositionDept,
  formatProcessedAt,
  groupRunsByYear,
} from './payrollProcess';
import { MillstoneLoader } from '../shared/MillstoneLoader';

import { tableHeaderCls } from '../shared/tableHeaderStyles';

type Props = {
  companyId: number;
  countryCode: string;
  refreshKey: number;
  onClose: () => void;
};

export function PayrollHistoryPanel({ companyId, countryCode, refreshKey, onClose }: Props) {
  const [runs, setRuns] = useState<PayrollRunSummary[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [runDetails, setRunDetails] = useState<Record<number, PayrollRunDetail>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await hrApi.payrollRuns.list(companyId);
      setRuns(result);
      setExpandedRunId(null);
      setRunDetails({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns, refreshKey]);

  const years = useMemo(() => groupRunsByYear(runs), [runs]);

  type RunListRow =
    | { kind: 'year'; id: string; year: number }
    | { kind: 'run'; run: PayrollRunSummary };

  const runListRows = useMemo((): RunListRow[] => {
    return years.flatMap(year => [
      { kind: 'year' as const, id: `year-${year}`, year },
      ...runs.filter(r => r.year === year).map(run => ({ kind: 'run' as const, run })),
    ]);
  }, [years, runs]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedRunRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(runListRows, { scrollRootRef });

  const toggleRun = async (runId: number) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (runDetails[runId]) return;

    setDetailLoadingId(runId);
    setError(null);
    try {
      const detail = await hrApi.payrollRuns.get(runId);
      setRunDetails(prev => ({ ...prev, [runId]: detail }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <div className={SIDE_PANEL_ROOT_CLS}>
      <button type="button" className={SIDE_PANEL_OVERLAY_CLS} aria-label="Close history" onClick={onClose} />
      <aside className={SIDE_PANEL_SHELL_WIDE_CLS}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Payroll History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Processed payrolls by period and pay cycle</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollRootRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading && <MillstoneLoader size="sm" layout="block" label="Loading history…" />}

          {!loading && runs.length === 0 && (
            <p className="text-sm text-muted-foreground">No processed payrolls yet for this company.</p>
          )}

          {!loading && pagedRunRows.map(row => {
            if (row.kind === 'year') {
              return (
                <section key={row.id} className="space-y-3">
                  <h3 className="text-xs font-sans uppercase tracking-wider text-muted-foreground">{row.year}</h3>
                </section>
              );
            }

            const run = row.run;
            const expanded = expandedRunId === run.id;
            const detail = runDetails[run.id];
            return (
              <div key={run.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => void toggleRun(run.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{run.periodLabel}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {run.payCycle} · {run.payType} · {formatProcessedAt(run.processedAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">{formatPayrollAmount(run.totalPayout ?? run.totalGross, run.countryCode || countryCode)}</div>
                    <div className="text-xs text-muted-foreground">{run.employeeCount} employees · payout</div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    {detailLoadingId === run.id && (
                      <MillstoneLoader size="sm" layout="block" label="Loading payment details…" />
                    )}
                    {detail && (
                      <div className="overflow-x-hidden" data-table-scroll>
                        <table className="w-full table-fixed text-xs">
                          <thead>
                            <tr className="border-b border-border/60">
                              <th className={tableHeaderCls('left')}>Employee ID</th>
                              <th className={tableHeaderCls('left')}>Employee</th>
                              <th className={tableHeaderCls('left')}>Position (Dept)</th>
                              <th className={tableHeaderCls('left')}>Attendance</th>
                              <th className={tableHeaderCls('right')}>Gross</th>
                              <th className={tableHeaderCls('right')}>Total Payout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.lines.map(line => (
                              <tr key={line.employeeId} className="border-b border-border/40 last:border-0">
                                <td className="px-3 py-2 font-sans">{line.employeeCode}</td>
                                <td className="px-3 py-2 font-medium">{line.employeeName}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {formatPositionDept(line.position, line.department)}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {formatAttendanceSummary(
                                    line.presentDays,
                                    line.workingDays,
                                    detail.payType,
                                    line.totalHours,
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatPayrollAmount(line.grossPay, detail.countryCode || countryCode)}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {formatPayrollAmount(line.totalPayout ?? line.grossPay, detail.countryCode || countryCode)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <InfiniteScrollDivSentinel hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
        </div>
      </aside>
    </div>
  );
}
