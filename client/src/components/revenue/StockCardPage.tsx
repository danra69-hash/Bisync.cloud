import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api, type DeliveryLocation, type Location, type StockCardListRow } from '../../api';
import { formatCountryNumber } from '../../utils/numberFormat';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { AvgCogsWithTrend } from './stockCardCogsTrend';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls } from '../layout/formControls';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, TableColGroup, tableColWidth, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { StockCardDetailPanel } from './StockCardDetailPanel';
import { StockCardCardView } from './StockCardCardView';
import {
  currentStockCardMonth,
  earliestStockCardMonth,
  formatStockCardMonthLabel,
  STOCK_CARD_HISTORY_YEARS,
} from './stockCardPeriod';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type StockCardViewMode = 'list' | 'card';

type StockLocationOption = {
  key: string;
  label: string;
  /** Location external IDs used for stock card queries. */
  locationIds: string[];
};

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const ITEM_TYPES = ['All', 'Product', 'Sub-Product', 'Smart Component'] as const;

type StockCardSortColumn =
  | 'lastChangedAt'
  | 'type'
  | 'group'
  | 'name'
  | 'uom'
  | 'inboundQty'
  | 'outboundQty'
  | 'avgOutboundCogs'
  | 'onHandQty'
  | 'avgCogs';

const STOCK_CARD_TABLE_COLUMNS: SortableColumnDef<StockCardSortColumn>[] = [
  { key: 'type', label: 'Type', ...tableColWidth('10%') },
  { key: 'group', label: 'Group', ...tableColWidth('12%') },
  { key: 'name', label: 'Name', ...tableColWidth('18%') },
  { key: 'uom', label: 'UOM', ...tableColWidth('7%') },
  { key: 'inboundQty', label: 'Inbound QTY', align: 'right', ...tableColWidth('10%') },
  { key: 'outboundQty', label: 'Outbound QTY', align: 'right', ...tableColWidth('10%') },
  { key: 'avgOutboundCogs', label: 'Avg outbound COGS', align: 'right', ...tableColWidth('12%') },
  { key: 'onHandQty', label: 'Qty on hand', align: 'right', ...tableColWidth('10%') },
  { key: 'avgCogs', label: 'Avg COGS', align: 'right', ...tableColWidth('11%') },
];

function lastChangedSortValue(row: StockCardListRow): number {
  if (!row.lastChangedAt) return 0;
  const ts = Date.parse(row.lastChangedAt);
  return Number.isFinite(ts) ? ts : 0;
}

function fmtQty(value: number, countryCode: string) {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  return Number.isInteger(value) && value !== 0 ? String(value) : formatCountryNumber(value, countryCode);
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
  const countryCode = useOrgCountryCode();
  const { uomPrice } = useCountryFormatters();
  const [rows, setRows] = useState<StockCardListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [itemTypeFilter, setItemTypeFilter] = useState<(typeof ITEM_TYPES)[number]>('All');
  const uomMode: 'recipe' = 'recipe';
  const [selectedMonth, setSelectedMonth] = useState(currentStockCardMonth);
  const [selectedRow, setSelectedRow] = useState<StockCardListRow | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [viewMode, setViewMode] = useState<StockCardViewMode>('list');
  const [stockLocationKey, setStockLocationKey] = useState('all');
  const [locations, setLocations] = useState<Location[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [centralStoreLocationId, setCentralStoreLocationId] = useState<string | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<StockCardSortColumn>(
    'lastChangedAt',
    'desc',
  );

  useEffect(() => {
    if (!selectedCompanyId) {
      setLocations([]);
      setDeliveryLocations([]);
      setCentralStoreLocationId(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      api.locations(),
      api.deliveryLocations({ companyId: selectedCompanyId, locationExternalIds: selectedLocationIds }),
      api.centralStoreConfig(selectedCompanyId).catch(() => null),
    ]).then(([locs, deliveries, storeCfg]) => {
      if (cancelled) return;
      setLocations(
        (Array.isArray(locs) ? locs : []).filter(
          l => l.companyId === selectedCompanyId && l.active !== false,
        ),
      );
      setDeliveryLocations(Array.isArray(deliveries) ? deliveries.filter(d => d.active !== false) : []);
      const storeId = storeCfg?.active && storeCfg.storeLocationExternalId
        ? storeCfg.storeLocationExternalId
        : null;
      setCentralStoreLocationId(storeId);
    }).catch(() => {
      if (!cancelled) {
        setLocations([]);
        setDeliveryLocations([]);
        setCentralStoreLocationId(null);
      }
    });
    return () => { cancelled = true; };
  }, [selectedCompanyId, selectedLocationIds]);

  const stockLocationOptions = useMemo((): StockLocationOption[] => {
    const nameOf = (id: string) => locations.find(l => l.externalId === id)?.name || id;
    const options: StockLocationOption[] = [
      {
        key: 'all',
        label: selectedLocationIds.length > 1 ? 'All selected locations' : (nameOf(selectedLocationIds[0] ?? '') || 'Selected location'),
        locationIds: [...selectedLocationIds],
      },
    ];
    const seen = new Set<string>(['all']);

    for (const id of selectedLocationIds) {
      const key = `loc:${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ key, label: nameOf(id), locationIds: [id] });
    }

    if (centralStoreLocationId) {
      const key = `store:${centralStoreLocationId}`;
      if (!seen.has(key) && !selectedLocationIds.includes(centralStoreLocationId)) {
        seen.add(key);
        options.push({
          key,
          label: `${nameOf(centralStoreLocationId)} (Central Store)`,
          locationIds: [centralStoreLocationId],
        });
      } else if (selectedLocationIds.includes(centralStoreLocationId)) {
        const existing = options.find(o => o.key === `loc:${centralStoreLocationId}`);
        if (existing && !existing.label.includes('Central Store')) {
          existing.label = `${existing.label} (Central Store)`;
        }
      }
    }

    for (const dl of deliveryLocations) {
      const parent = (dl.locationExternalId || '').trim();
      if (!parent) continue;
      const key = `dl:${dl.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        key,
        label: `${dl.name} (alternate · ${nameOf(parent)})`,
        locationIds: [parent],
      });
    }

    return options;
  }, [locations, deliveryLocations, centralStoreLocationId, selectedLocationIds]);

  useEffect(() => {
    if (!stockLocationOptions.some(o => o.key === stockLocationKey)) {
      setStockLocationKey('all');
    }
  }, [stockLocationOptions, stockLocationKey]);

  const effectiveLocationIds = useMemo(() => {
    const opt = stockLocationOptions.find(o => o.key === stockLocationKey);
    const ids = opt?.locationIds?.length ? opt.locationIds : selectedLocationIds;
    return ids.filter(Boolean);
  }, [stockLocationOptions, stockLocationKey, selectedLocationIds]);

  useEffect(() => {
    resetSort();
  }, [search, groupFilter, itemTypeFilter, uomMode, selectedMonth, selectedCompanyId, effectiveLocationIds, stockLocationKey, resetSort]);

  useEffect(() => {
    if (!selectedCompanyId || effectiveLocationIds.length === 0) {
      setRows([]);
      setSelectedRow(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .stockCards(selectedCompanyId, effectiveLocationIds, {
        itemType: itemTypeFilterParam(itemTypeFilter),
        uomMode,
        period: selectedMonth,
      })
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load stock cards.'))
      .finally(() => setLoading(false));
  }, [selectedCompanyId, effectiveLocationIds, itemTypeFilter, uomMode, selectedMonth, listVersion]);

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

  const sortedRows = useMemo(
    () =>
      sortTableRows(
        filteredRows,
        sortColumn ?? 'lastChangedAt',
        sortColumn ? sortDirection : 'desc',
        {
          lastChangedAt: row => lastChangedSortValue(row),
          type: row => itemTypeLabel(row.itemType),
          group: row => row.group || '',
          name: row => row.name,
          uom: row => row.uom,
          inboundQty: row => row.inboundQty,
          outboundQty: row => row.outboundQty,
          avgOutboundCogs: row => row.averageCogs,
          onHandQty: row => row.onHandQty,
          avgCogs: row => row.onHandAverageCogs,
        },
        {
          tieBreaker: (a, b) => {
            const byChange = compareSortValues(lastChangedSortValue(b), lastChangedSortValue(a));
            if (byChange !== 0) return byChange;
            return compareSortValues(a.name, b.name);
          },
        },
      ),
    [filteredRows, sortColumn, sortDirection],
  );

  const { visibleItems, hasMore, sentinelRef, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedRows, { scrollRootRef });

  if (!selectedCompanyId || selectedLocationIds.length === 0) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company and at least one location to view stock cards.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters opaque className="py-2 mb-3 space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Stock location
            </label>
            <select
              value={stockLocationKey}
              onChange={e => setStockLocationKey(e.target.value)}
              className={`${filterSelectCls} min-w-[220px]`}
              title="Location, Central Store, and alternate delivery locations from System Config"
            >
              {stockLocationOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <FilterSelect label="Type" value={itemTypeFilter} options={[...ITEM_TYPES]} onChange={v => setItemTypeFilter(v as (typeof ITEM_TYPES)[number])} />
          <FilterSelect label="Group" value={groupFilter} options={groups} onChange={setGroupFilter} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</label>
            <div className={`${filterSelectCls} min-w-[160px] flex items-center text-muted-foreground`}>
              Principal Component Unit
            </div>
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
          <div className="flex flex-col gap-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">View</span>
            <div className="flex items-center gap-3 h-9">
              <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={viewMode === 'list'}
                  onChange={() => setViewMode('list')}
                />
                List View
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={viewMode === 'card'}
                  onChange={() => setViewMode('card')}
                />
                Card View
              </label>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatStockCardMonthLabel(selectedMonth, selectedMonth === currentStockCardMonth())}
          {' · '}
          History older than {STOCK_CARD_HISTORY_YEARS} years is moved to the Stock Card archive (
          <code className="text-xs">data-archives/stock-card/archive.db</code>
          ).
        </p>
      </PageStickyFilters>

      {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}

      {viewMode === 'card' ? (
        loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading stock cards…</p>
        ) : (
          <StockCardCardView
            rows={sortedRows}
            companyId={selectedCompanyId}
            locationIds={effectiveLocationIds}
            uomMode={uomMode}
            selectedMonth={selectedMonth}
            onOpenDetail={setSelectedRow}
          />
        )
      ) : (
        <TableScrollContainer ref={scrollRootRef} tableId="revenue.stock-card">
          <table className="w-full text-sm font-sans">
            <TableColGroup columns={STOCK_CARD_TABLE_COLUMNS} />
            <thead>
              <SortableTableHeaderRow
                columns={STOCK_CARD_TABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
              />
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRow colSpan={9} label="Loading stock cards…" />
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
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(row.inboundQty, countryCode)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(row.outboundQty, countryCode)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.averageCogs > 0 ? uomPrice(row.averageCogs) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtQty(row.onHandQty, countryCode)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <AvgCogsWithTrend onHand={row.onHandAverageCogs} outbound={row.averageCogs} />
                    </td>
                  </tr>
                ))
              )}
              <InfiniteScrollTableSentinel colSpan={9} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} />
            </tbody>
          </table>
        </TableScrollContainer>
      )}

      {selectedRow ? (
        <StockCardDetailPanel
          itemType={selectedRow.itemType}
          itemKey={selectedRow.itemKey}
          companyId={selectedCompanyId}
          locationIds={effectiveLocationIds}
          uomMode={uomMode}
          selectedMonth={selectedMonth}
          onClose={() => setSelectedRow(null)}
          onUomModeChange={() => undefined}
          onAdjusted={() => setListVersion(v => v + 1)}
        />
      ) : null}
    </div>
  );
}
