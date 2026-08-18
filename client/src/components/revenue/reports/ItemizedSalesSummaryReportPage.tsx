import { useCallback } from 'react';
import { useCountryFormatters } from '../../../hooks/useCountryFormatters';
import { ReportPageShell, type ReportColumn } from './ReportPageShell';
import { reportApi, reportMoney, useReportData } from './useReportData';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const COLUMNS: ReportColumn[] = [
  { key: 'productName', label: 'Product', width: '22%' },
  { key: 'category', label: 'Category', width: '12%' },
  { key: 'group', label: 'Group', width: '12%' },
  { key: 'productType', label: 'Type', width: '10%' },
  { key: 'uom', label: 'UOM', width: '8%' },
  { key: 'qtySold', label: 'Qty sold', align: 'right', width: '10%' },
  { key: 'avgUnitPrice', label: 'Avg price', align: 'right', width: '10%' },
  { key: 'totalValue', label: 'Total value', align: 'right', width: '10%' },
  { key: 'channels', label: 'Channels', width: '12%' },
];

export function ItemizedSalesSummaryReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters();
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.itemizedSales(companyId, locationIds, period),
    [],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const columns: ReportColumn[] = COLUMNS.map(col =>
    col.key === 'avgUnitPrice' || col.key === 'totalValue'
      ? { ...col, format: value => reportMoney(value, rm) }
      : col,
  );

  return (
    <ReportPageShell
      title="Itemized Sales Summary"
      description="Product-level sales totals for the selected month across POS, B2B, and fulfilled channels."
      tableId="reports.itemized-sales-summary"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="itemized-sales-summary"
      metrics={[
        { label: 'Products', value: String(report.summary.productCount ?? 0) },
        { label: 'Lines', value: String(report.summary.lineCount ?? 0) },
        { label: 'Qty sold', value: reportMoney(report.summary.totalQuantity, n => String(n)) },
        { label: 'Total value', value: reportMoney(report.summary.totalValue, rm) },
      ]}
    />
  );
}
