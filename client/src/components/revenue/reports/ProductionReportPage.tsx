import { useCallback } from 'react';
import { useCountryFormatters } from '../../../hooks/useCountryFormatters';
import { ReportPageShell, type ReportColumn } from './ReportPageShell';
import { reportApi, reportMoney, useReportData } from './useReportData';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const COLUMNS: ReportColumn[] = [
  { key: 'productionDate', label: 'Produced', width: '10%' },
  { key: 'batchNumber', label: 'Batch', width: '12%' },
  { key: 'productCode', label: 'Product ID', width: '10%' },
  { key: 'productName', label: 'Product', width: '20%' },
  { key: 'entryType', label: 'Entry', width: '10%' },
  { key: 'quantity', label: 'Qty', align: 'right', width: '8%' },
  { key: 'unitPrice', label: 'Unit cost', align: 'right', width: '10%' },
  { key: 'totalValue', label: 'Total', align: 'right', width: '10%' },
  { key: 'expiryDate', label: 'Expiry', width: '10%' },
  { key: 'locations', label: 'Locations', width: '12%' },
];

export function ProductionReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters();
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.production(companyId, locationIds, period),
    [],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const columns: ReportColumn[] = COLUMNS.map(col =>
    col.key === 'unitPrice' || col.key === 'totalValue'
      ? { ...col, format: value => reportMoney(value, rm) }
      : col,
  );

  return (
    <ReportPageShell
      title="Production Report"
      description="Batches produced in the selected month with cost and location scope."
      tableId="reports.production"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="production-report"
      metrics={[
        { label: 'Batches', value: String(report.summary.batchCount ?? 0) },
        { label: 'Products', value: String(report.summary.productCount ?? 0) },
        { label: 'Total qty', value: reportMoney(report.summary.totalQuantity, n => n.toLocaleString()) },
        { label: 'Total value', value: reportMoney(report.summary.totalValue, rm) },
      ]}
    />
  );
}
