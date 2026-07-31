import { useCallback, useState } from 'react';
import { filterSelectCls } from '../../layout/formControls';
import { useCountryFormatters } from '../../../hooks/useCountryFormatters';
import { ReportPageShell, type ReportColumn } from './ReportPageShell';
import { reportApi, reportMoney, useReportData } from './useReportData';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const COLUMNS: ReportColumn[] = [
  { key: 'group', label: 'Group', width: '12%' },
  { key: 'name', label: 'Item', width: '22%' },
  { key: 'itemKey', label: 'ID', width: '12%' },
  { key: 'itemType', label: 'Type', width: '10%' },
  { key: 'uom', label: 'UOM', width: '8%' },
  { key: 'inboundQty', label: 'Inbound', align: 'right', width: '9%' },
  { key: 'outboundQty', label: 'Outbound', align: 'right', width: '9%' },
  { key: 'onHandQty', label: 'On hand', align: 'right', width: '9%' },
  { key: 'averageCogs', label: 'Avg COGS', align: 'right', width: '9%' },
  { key: 'onHandValue', label: 'On-hand value', align: 'right', width: '10%' },
];

export function InventorySummaryReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters();
  const [itemType, setItemType] = useState('component');
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.inventory(companyId, locationIds, period, itemType),
    [itemType],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const columns: ReportColumn[] = COLUMNS.map(col =>
    col.key === 'averageCogs' || col.key === 'onHandValue'
      ? { ...col, format: value => reportMoney(value, rm) }
      : col,
  );

  return (
    <ReportPageShell
      title="Inventory Summary"
      description="Period stock movement and on-hand valuation by item."
      tableId="reports.inventory-summary"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="inventory-summary"
      extraFilters={
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Item type
          <select
            className={filterSelectCls}
            value={itemType}
            onChange={e => setItemType(e.target.value)}
          >
            <option value="component">Components</option>
            <option value="product">Products</option>
            <option value="sub-product">Sub-products</option>
            <option value="all">All</option>
          </select>
        </label>
      }
      metrics={[
        { label: 'Items', value: String(report.summary.itemCount ?? 0) },
        { label: 'On hand qty', value: reportMoney(report.summary.onHandQty, n => n.toLocaleString()) },
        { label: 'Inbound', value: reportMoney(report.summary.inboundQty, n => n.toLocaleString()) },
        { label: 'On-hand value', value: reportMoney(report.summary.onHandValue, rm) },
      ]}
    />
  );
}
