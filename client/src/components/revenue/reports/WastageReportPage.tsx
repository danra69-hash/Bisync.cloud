import { useCallback, useMemo } from 'react';
import { useCountryFormatters } from '../../../hooks/useCountryFormatters';
import { ReportPageShell, type ReportColumn } from './ReportPageShell';
import { reportApi, reportMoney, useReportData } from './useReportData';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const COLUMNS: ReportColumn[] = [
  { key: 'wastedDate', label: 'Date', width: '9%' },
  { key: 'itemName', label: 'Item', width: '18%' },
  { key: 'itemType', label: 'Type', width: '9%' },
  { key: 'source', label: 'Source', width: '8%' },
  { key: 'quantity', label: 'Qty', align: 'right', width: '8%' },
  { key: 'uom', label: 'UOM', width: '7%' },
  { key: 'reason', label: 'Reason', width: '14%' },
  { key: 'unitPrice', label: 'Unit', align: 'right', width: '8%' },
  { key: 'totalValue', label: 'Value', align: 'right', width: '9%' },
  { key: 'locationExternalId', label: 'Location', width: '10%' },
];

const REASON_COLUMNS: ReportColumn[] = [
  { key: 'reason', label: 'Reason', width: '40%' },
  { key: 'lineCount', label: 'Lines', align: 'right', width: '20%' },
  { key: 'quantity', label: 'Qty', align: 'right', width: '20%' },
  { key: 'totalValue', label: 'Value', align: 'right', width: '20%' },
];

export function WastageReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters();
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.wastage(companyId, locationIds, period),
    [],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const columns: ReportColumn[] = COLUMNS.map(col =>
    col.key === 'unitPrice' || col.key === 'totalValue'
      ? { ...col, format: value => reportMoney(value, rm) }
      : col,
  );

  const reasonColumns: ReportColumn[] = REASON_COLUMNS.map(col =>
    col.key === 'totalValue' ? { ...col, format: value => reportMoney(value, rm) } : col,
  );

  const byReason = useMemo(
    () => (report.extra.byReason ?? []) as Record<string, unknown>[],
    [report.extra],
  );

  return (
    <ReportPageShell
      title="Wastage Report"
      description="Wastage lines for the selected month with reason roll-up."
      tableId="reports.wastage"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="wastage-report"
      metrics={[
        { label: 'Lines', value: String(report.summary.lineCount ?? 0) },
        { label: 'Reasons', value: String(report.summary.reasonCount ?? 0) },
        { label: 'Qty', value: reportMoney(report.summary.totalQuantity, n => n.toLocaleString()) },
        { label: 'Total value', value: reportMoney(report.summary.totalValue, rm) },
      ]}
      secondaryTable={
        byReason.length > 0
          ? { title: 'By reason', columns: reasonColumns, rows: byReason }
          : undefined
      }
    />
  );
}
