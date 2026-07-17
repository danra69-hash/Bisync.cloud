import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { sortTableRows } from '../../utils/tableSort';
import { History } from 'lucide-react';
import { selectCls } from '../../data/countries';
import { hrApi } from '../../modules/hr/api';
import type { PayrollPreview, PayrollRunLine } from '../../modules/hr/types';
import { PayrollHistoryPanel } from './PayrollHistoryPanel';
import {
  PAYROLL_MONTHS,
  formatAttendanceSummary,
  formatOvertimeSummary,
  payrollYearOptions,
} from './payrollProcess';
import { formatPayrollAmount } from './payrollDisplay';
import { MillstoneLoader } from '../shared/MillstoneLoader';

const amountCls = 'px-3 py-2.5 text-right font-sans whitespace-nowrap text-xs';
const textCls = 'px-3 py-2.5 text-xs';

type PayrollPreviewSortColumn =
  | 'id'
  | 'name'
  | 'position'
  | 'attendance'
  | 'overtime'
  | 'base'
  | 'service'
  | 'accommodation'
  | 'transport'
  | 'mobile'
  | 'epf'
  | 'socso'
  | 'tax'
  | 'payout';

const TABLE_COLUMNS: SortableColumnDef<PayrollPreviewSortColumn>[] = [
  { key: 'id', label: 'Employee ID' },
  { key: 'name', label: 'Employee' },
  { key: 'position', label: 'Position' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'overtime', label: 'Overtime', align: 'right' },
  { key: 'base', label: 'Base Salary', align: 'right' },
  { key: 'service', label: 'Service', align: 'right' },
  { key: 'accommodation', label: 'Accommodation', align: 'right' },
  { key: 'transport', label: 'Transportation', align: 'right' },
  { key: 'mobile', label: 'Mobile', align: 'right' },
  { key: 'epf', label: 'EPF', align: 'right' },
  { key: 'socso', label: 'SOCSO', align: 'right' },
  { key: 'tax', label: 'Income Tax', align: 'right' },
  { key: 'payout', label: 'Total Payout', align: 'right' },
];

type Props = {
  selectedCompanyId: number | null;
  countryCode?: string;
};

export function ProcessPayrollPanel({
  selectedCompanyId,
  countryCode = 'MY',
}: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<PayrollPreviewSortColumn>();

  useEffect(() => {
    resetSort();
  }, [selectedCompanyId, year, month, resetSort]);

  const loadPreview = useCallback(async () => {
    if (!selectedCompanyId) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await hrApi.payrollRuns.preview(selectedCompanyId, year, month);
      setPreview(result);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, year, month]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const previewLines = preview?.lines ?? [];
  const sortedPreviewLines = useMemo(
    () =>
      sortTableRows(
        previewLines,
        sortColumn,
        sortDirection,
        {
          id: line => line.employeeCode,
          name: line => line.employeeName,
          position: line => line.position || line.department || '',
          attendance: line => line.presentDays,
          overtime: line => line.overtimeAmount,
          base: line => line.baseSalary,
          service: line => line.serviceAllowance,
          accommodation: line => line.accommodationAllowance,
          transport: line => line.transportAllowance,
          mobile: line => line.mobileAllowance,
          epf: line => line.epfEmployeeAmount,
          socso: line => line.socsoEmployeeAmount,
          tax: line => line.incomeTaxAmount,
          payout: line => line.totalPayout,
        },
      ),
    [previewLines, sortColumn, sortDirection],
  );
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedPreviewLines,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedPreviewLines, { scrollRootRef });

  const handleProcess = async () => {
    if (!selectedCompanyId || !preview || preview.alreadyProcessed) return;
    setProcessing(true);
    setError(null);
    try {
      await hrApi.payrollRuns.process({ companyId: selectedCompanyId, year, month });
      setHistoryRefreshKey(key => key + 1);
      await loadPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const displayCountry = preview?.countryCode ?? countryCode;

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="payroll-process-month" className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                Month
              </label>
              <select
                id="payroll-process-month"
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className={`${selectCls} mt-1 `}
              >
                {PAYROLL_MONTHS.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payroll-process-year" className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                Year
              </label>
              <select
                id="payroll-process-year"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className={`${selectCls} mt-1 `}
              >
                {payrollYearOptions().map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            disabled={!selectedCompanyId}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {selectedCompanyId && loading && (
          <MillstoneLoader size="sm" layout="block" label="Loading payroll preview…" />
        )}

        {selectedCompanyId && !loading && preview && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Period" value={preview.periodLabel} />
              <SummaryCard label="Employees" value={String(preview.employeeCount)} />
              <SummaryCard label="Pay cycle" value={preview.payCycle} />
              <SummaryCard label="Total gross" value={formatPayrollAmount(preview.totalGross, displayCountry)} />
              <SummaryCard label="Total payout" value={formatPayrollAmount(preview.totalPayout, displayCountry)} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {preview.payType} · {preview.periodStart} to {preview.periodEnd}
                {preview.alreadyProcessed && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Already processed
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleProcess()}
                disabled={processing || preview.alreadyProcessed || preview.employeeCount === 0}
                className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {processing ? 'Processing…' : 'Process Payroll'}
              </button>
            </div>

            <TableScrollContainer ref={scrollRootRef} className="border border-border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <SortableTableHeaderRow
                    columns={TABLE_COLUMNS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                  />
                </thead>
                <tbody>
                  {preview.lines.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                        No active employees found for this company.
                      </td>
                    </tr>
                  ) : (
                    pagedPreviewLines.map(line => (
                      <PayrollLineRow key={line.employeeId} line={line} preview={preview} countryCode={displayCountry} />
                    ))
                  )}
                  <InfiniteScrollTableSentinel colSpan={TABLE_COLUMNS.length} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                </tbody>
              </table>
            </TableScrollContainer>
          </>
        )}
      </div>

      {historyOpen && selectedCompanyId && (
        <PayrollHistoryPanel
          companyId={selectedCompanyId}
          countryCode={displayCountry}
          refreshKey={historyRefreshKey}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

function PayrollLineRow({
  line,
  preview,
  countryCode,
}: {
  line: PayrollRunLine;
  preview: PayrollPreview;
  countryCode: string;
}) {
  const fmt = (amount: number) => formatPayrollAmount(amount, countryCode);

  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/20">
      <td className={`${textCls} font-sans`}>{line.employeeCode}</td>
      <td className={`${textCls} font-medium whitespace-nowrap`}>{line.employeeName}</td>
      <td className={textCls}>
        <div className="font-medium">{line.position || '—'}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{line.department || '—'}</div>
      </td>
      <td className={`${textCls} text-muted-foreground whitespace-nowrap`}>
        {formatAttendanceSummary(line.presentDays, line.workingDays, preview.payType, line.totalHours)}
      </td>
      <td className={amountCls}>
        {formatOvertimeSummary(line.overtimeAmount, line.overtimeHours, countryCode, formatPayrollAmount)}
      </td>
      <td className={amountCls}>{fmt(line.baseSalary)}</td>
      <td className={amountCls}>{fmt(line.serviceAllowance)}</td>
      <td className={amountCls}>{fmt(line.accommodationAllowance)}</td>
      <td className={amountCls}>{fmt(line.transportAllowance)}</td>
      <td className={amountCls}>{fmt(line.mobileAllowance)}</td>
      <StackedContributionCell employeeAmount={line.epfEmployeeAmount} employerAmount={line.epfEmployerAmount} countryCode={countryCode} />
      <StackedContributionCell employeeAmount={line.socsoEmployeeAmount} employerAmount={line.socsoEmployerAmount} countryCode={countryCode} />
      <td className={amountCls}>{line.incomeTaxAmount > 0 ? fmt(line.incomeTaxAmount) : '—'}</td>
      <td className={`${amountCls} font-semibold`}>{fmt(line.totalPayout)}</td>
    </tr>
  );
}

function StackedContributionCell({
  employeeAmount,
  employerAmount,
  countryCode,
}: {
  employeeAmount: number;
  employerAmount: number;
  countryCode: string;
}) {
  const fmt = (amount: number) => formatPayrollAmount(amount, countryCode);
  return (
    <td className={amountCls}>
      <div>{fmt(employeeAmount)}</div>
      <div className="text-xs text-muted-foreground mt-0.5">Co. {fmt(employerAmount)}</div>
    </td>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
