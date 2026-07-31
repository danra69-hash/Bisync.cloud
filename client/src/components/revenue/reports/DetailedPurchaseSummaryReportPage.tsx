import { useCallback } from 'react';
import { useCountryFormatters } from '../../../hooks/useCountryFormatters';
import { ReportPageShell, type ReportColumn } from './ReportPageShell';
import { reportApi, reportMoney, useReportData } from './useReportData';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const COLUMNS: ReportColumn[] = [
  { key: 'poNumber', label: 'PO #', width: '10%' },
  { key: 'orderDate', label: 'Order date', width: '9%' },
  { key: 'vendorName', label: 'Vendor', width: '14%' },
  { key: 'status', label: 'Status', width: '8%' },
  { key: 'itemName', label: 'Item', width: '16%' },
  { key: 'uom', label: 'UOM', width: '6%' },
  { key: 'orderedQty', label: 'Ordered', align: 'right', width: '8%' },
  { key: 'receivedQty', label: 'Received', align: 'right', width: '8%' },
  { key: 'unitPrice', label: 'Unit price', align: 'right', width: '9%' },
  { key: 'lineTotal', label: 'Line total', align: 'right', width: '10%' },
  { key: 'locations', label: 'Locations', width: '12%' },
];

export function DetailedPurchaseSummaryReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters();
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.purchase(companyId, locationIds, period),
    [],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const columns: ReportColumn[] = COLUMNS.map(col =>
    col.key === 'unitPrice' || col.key === 'lineTotal'
      ? { ...col, format: value => reportMoney(value, rm) }
      : col,
  );

  return (
    <ReportPageShell
      title="Detailed Purchase Summary"
      description="Purchase order lines for the selected month, including received quantities and values."
      tableId="reports.detailed-purchase-summary"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="detailed-purchase-summary"
      metrics={[
        { label: 'POs', value: String(report.summary.poCount ?? 0) },
        { label: 'Lines', value: String(report.summary.lineCount ?? 0) },
        { label: 'Vendors', value: String(report.summary.vendorCount ?? 0) },
        { label: 'Ordered value', value: reportMoney(report.summary.orderedValue, rm) },
      ]}
    />
  );
}
