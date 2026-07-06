import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api, type StockCardListRow } from '../../api';
import { formatRm } from '../../data/createOrder';
import { AvgCogsWithTrend } from './stockCardCogsTrend';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { StockCardDetailPanel } from './StockCardDetailPanel';
import {
  currentStockCardMonth,
  earliestStockCardMonth,
  formatStockCardMonthLabel,
  STOCK_CARD_HISTORY_YEARS,
} from './stockCardPeriod';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const ITEM_TYPES = ['All', 'Product', 'Sub-Product', 'Smart Component'] as const;

function fmtQty(value: number) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, '');
}

function itemTypeLabel(itemType: StockCardListRow['itemType']) {
  switch (itemType) {
    case 'component':
      return 'Smart Component';
    case 'sub-product':
      return 'Sub-Product';
    default:
      return 'Product';
  }
}

function itemTypeFilterParam(filter: string) {
  switch (filter) {
    case 'Product':
      return 'product';
    case 'Sub-Product':
      return 'sub-product';
    case 'Smart Component':
      return 'component';
    default:
      return 'all';
  }
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${filterSelectCls} min-w-[140px]`}>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StockCardPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [rows, setRows] = useState<StockCardListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [itemTypeFilter, setItemTypeFilter] = useState<(typeof ITEM_TYPES)[number]>('All');
  const [uomMode, setUomMode] = useState<'inventory' | 'recipe'>('inventory');
  const [selectedMonth, setSelectedMonth] = useState(currentStockCardMonth);
  const [selectedRow, setSelectedRow] = useState<StockCardListRow | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setRows([]);
      setSelectedRow(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .stockCards(selectedCompanyId, selectedLocationIds, {
        itemType: itemTypeFilterParam(itemTypeFilter),
        uomMode,
        period: selectedMonth,
      })
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load stock cards.'))
      .finally(() => setLoading(false));
  }, [selectedCompanyId, selectedLocationIds, itemTypeFilter, uomMode, selectedMonth, listVersion]);

  const groups = useMemo(() => {
    const unique = new Set(rows.map(row => row.group).filter(Boolean));
    return ['All', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(row => {
      if (groupFilter !== 'All' && row.group !== groupFilter) return false;
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query)
        || row.group.toLowerCase().includes(query)
        || row.itemKey.toLowerCase().includes(query)
      );
    });
  }, [rows, search, groupFilter]);

  const { visibleItems, hasMore, sentinelRef } = useInfiniteScrollSlice(filteredRows, { scrollRootRef });

  if (!selectedCompanyId || selectedLocationIds.length === 0) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company and at least one location to view stock cards.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <FilterSelect label="Type" value={itemTypeFilter} options={[...ITEM_TYPES]} onChange={v => setItemTypeFilter(v as (typeof ITEM_TYPES)[number])} />
        <FilterSelect label="Group" value={groupFilter} options={groups} onChange={setGroupFilter} />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</label>
          <select
            value={uomMode}
            onChange={e => setUomMode(e.target.value as 'inventory' | 'recipe')}
            className={`${filterSelectCls} min-w-[160px]`}
          >
            <option value="inventory">Inventory UOM</option>
            <option value="recipe">Component UOM</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Month</label>
          <input
            type="month"
            value={selectedMonth}
            min={earliestStockCardMonth()}
            max={currentStockCardMonth()}
            onChange={e => {
              if (e.target.value) setSelectedMonth(e.target.value);
            }}
            className={`${filterSelectCls} min-w-[160px]`}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-sm">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name or group…"
              className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm font-sans"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {formatStockCardMonthLabel(selectedMonth, selectedMonth === currentStockCardMonth())}
        {' · '}
        History older than {STOCK_CARD_HISTORY_YEARS} years is moved to the Stock Card archive (
        <code className="text-xs">data-archives/stock-card/archive.db</code>
        ).
      </p>

      {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}

      <TableScrollContainer ref={scrollRootRef}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">UOM</th>
              <th className="px-3 py-2 font-medium text-right">Inbound QTY</th>
              <th className="px-3 py-2 font-medium text-right">Outbound QTY</th>
              <th className="px-3 py-2 font-medium text-right">Avg outbound COGS</th>
              <th className="px-3 py-2 font-medium text-right">Qty on hand</th>
              <th className="px-3 py-2 font-medium text-right">Avg COGS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Loading stock cards…
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No stock card items found.
                </td>
              </tr>
            ) : (
              visibleItems.map(row => (
                <tr
                  key={`${row.itemType}-${row.itemKey}`}
                  className="border-b border-border/60 hover:bg-muted/40 cursor-pointer"
                  onClick={() => setSelectedRow(row)}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">{itemTypeLabel(row.itemType)}</td>
                  <td className="px-3 py-2.5">{row.group || '—'}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.name}</td>
                  <td className="px-3 py-2.5">{row.uom}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(row.inboundQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(row.outboundQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.averageCogs > 0 ? formatRm(row.averageCogs) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtQty(row.onHandQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <AvgCogsWithTrend onHand={row.onHandAverageCogs} outbound={row.averageCogs} />
                  </td>
                </tr>
              ))
            )}
            <InfiniteScrollTableSentinel colSpan={9} hasMore={hasMore} sentinelRef={sentinelRef} />
          </tbody>
        </table>
      </TableScrollContainer>

      {selectedRow ? (
        <StockCardDetailPanel
          itemType={selectedRow.itemType}
          itemKey={selectedRow.itemKey}
          companyId={selectedCompanyId}
          locationIds={selectedLocationIds}
          uomMode={uomMode}
          selectedMonth={selectedMonth}
          onClose={() => setSelectedRow(null)}
          onUomModeChange={setUomMode}
          onAdjusted={() => setListVersion(v => v + 1)}
        />
      ) : null}
    </div>
  );
}
