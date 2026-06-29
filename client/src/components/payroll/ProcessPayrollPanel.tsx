import { useCallback, useEffect, useState } from 'react';
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

const thCls = 'text-left px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal whitespace-nowrap';
const amountCls = 'px-3 py-2.5 text-right font-mono whitespace-nowrap text-xs';
const textCls = 'px-3 py-2.5 text-xs';

const TABLE_COLUMNS = [
  { key: 'id', label: 'Employee ID', align: 'left' },
  { key: 'name', label: 'Employee', align: 'left' },
  { key: 'position', label: 'Position', align: 'left' },
  { key: 'attendance', label: 'Attendance', align: 'left' },
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
] as const;

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
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="payroll-process-month" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Month
              </label>
              <select
                id="payroll-process-month"
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className={`${selectCls} mt-1 min-w-[160px]`}
              >
                {PAYROLL_MONTHS.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payroll-process-year" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Year
              </label>
              <select
                id="payroll-process-year"
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className={`${selectCls} mt-1 min-w-[120px]`}
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

        {!selectedCompanyId && (
          <p className="text-sm text-muted-foreground">Select a company from the menu bar above to preview payroll.</p>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {selectedCompanyId && loading && (
          <p className="text-sm text-muted-foreground">Loading payroll preview…</p>
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
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
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

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[1280px]">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {TABLE_COLUMNS.map(column => (
                      <th
                        key={column.key}
                        className={`${thCls} ${column.align === 'right' ? 'text-right' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                        No active employees found for this company.
                      </td>
                    </tr>
                  ) : (
                    preview.lines.map(line => (
                      <PayrollLineRow key={line.employeeId} line={line} preview={preview} countryCode={displayCountry} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
      <td className={`${textCls} font-mono`}>{line.employeeCode}</td>
      <td className={`${textCls} font-medium whitespace-nowrap`}>{line.employeeName}</td>
      <td className={textCls}>
        <div className="font-medium">{line.position || '—'}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{line.department || '—'}</div>
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
      <div className="text-[10px] text-muted-foreground mt-0.5">Co. {fmt(employerAmount)}</div>
    </td>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
