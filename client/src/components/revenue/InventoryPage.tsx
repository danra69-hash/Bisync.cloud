import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type InventoryCountSession,
  type InventoryCountSessionSummary,
  type InventoryCountSessionType,
  type StockCardListRow,
} from '../../api';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  canConfirmInventoryCount,
  canSaveInventoryCount,
  parseUserAccess,
} from '../../data/userAccess';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { InventoryConfirmModal } from './InventoryConfirmModal';
import {
  buildComponentConversion,
  computeTotalQty,
  displayOnHandQty,
  displayUomForRow,
} from '../../utils/inventoryUomConversion';
import {
  currentStockCardMonth,
  earliestStockCardMonth,
  formatStockCardMonthLabel,
} from './stockCardPeriod';

const TABLE_COL_COUNT = 10;
const INVENTORY_TABS = [
  { id: 'count', label: 'Count' },
  { id: 'history', label: 'History' },
] as const;

type InventoryPageTab = (typeof INVENTORY_TABS)[number]['id'];

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const ITEM_TYPES = ['All', 'Product', 'Sub-Product', 'Smart Component'] as const;

function InventoryTypeToggle({
  value,
  onChange,
}: {
  value: InventoryCountSessionType;
  onChange: (value: InventoryCountSessionType) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Inventory</label>
      <div className="flex h-9 rounded-md border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => onChange('spot')}
          className={`px-4 text-sm font-medium transition-colors ${
            value === 'spot'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          }`}
        >
          Spot
        </button>
        <button
          type="button"
          onClick={() => onChange('full')}
          className={`px-4 text-sm font-medium border-l border-border transition-colors ${
            value === 'full'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted'
          }`}
        >
          Full
        </button>
      </div>
    </div>
  );
}

function rowKey(row: StockCardListRow) {
  return `${row.itemType}-${row.itemKey}`;
}

function fmtQty(value: number) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, '');
}

function fmtVarianceQty(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const sign = value > 0 ? '+' : '';
  return `${sign}${fmtQty(value)}`;
}

function fmtVariancePct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function varianceTone(value: number | null | undefined) {
  if (value == null || value === 0) return 'text-muted-foreground';
  return value > 0 ? 'text-blue-600' : 'text-red-600';
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

function parseQty(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[] | string[];
  onChange: (v: string) => void;
}) {
  const normalized = options.map(option =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${filterSelectCls} min-w-[140px]`}>
        {normalized.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function sessionStatusLabel(session: InventoryCountSession, inventoryMode: InventoryCountSessionType) {
  if (inventoryMode === 'spot') {
    return `Spot count saved on ${formatDateTime(session.savedAt)} by ${session.savedBy || '—'}`;
  }

  if (session.status === 'pending_confirmation') {
    const deadline = session.confirmDeadlineAt ? formatDateTime(session.confirmDeadlineAt) : '—';
    return `Full inventory saved on ${formatDateTime(session.savedAt)} — confirm by ${deadline}`;
  }

  if (session.status === 'auto_confirmed') {
    return `Full inventory auto-confirmed on ${formatDateTime(session.confirmedAt ?? session.savedAt)}`;
  }

  return `Full inventory confirmed on ${formatDateTime(session.confirmedAt ?? session.savedAt)} by ${session.confirmedBy || '—'}`;
}

function historyStatusLabel(summary: InventoryCountSessionSummary) {
  if (summary.status === 'pending_confirmation') {
    const deadline = summary.confirmDeadlineAt ? formatDateTime(summary.confirmDeadlineAt) : '—';
    return `Pending confirmation — confirm by ${deadline}`;
  }
  if (summary.status === 'auto_confirmed') {
    return `Auto-confirmed on ${formatDateTime(summary.confirmedAt ?? summary.savedAt)}`;
  }
  if (summary.status === 'confirmed') {
    return `Confirmed on ${formatDateTime(summary.confirmedAt ?? summary.savedAt)} by ${summary.confirmedBy || '—'}`;
  }
  return `Saved on ${formatDateTime(summary.savedAt)} by ${summary.savedBy || '—'}`;
}

function historyStatusBadgeClass(status: string) {
  switch (status) {
    case 'pending_confirmation':
      return 'bg-amber-100 text-amber-900';
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-900';
    case 'auto_confirmed':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

function historyStatusBadgeText(status: string) {
  switch (status) {
    case 'pending_confirmation':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'auto_confirmed':
      return 'Auto-confirmed';
    default:
      return 'Saved';
  }
}

function itemTypeFilterLabel(filter: string) {
  switch (filter) {
    case 'product':
      return 'Product';
    case 'sub-product':
      return 'Sub-Product';
    case 'component':
      return 'Smart Component';
    default:
      return 'All types';
  }
}

export function InventoryPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { currentUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );
  const canSave = access ? canSaveInventoryCount(access) : false;
  const canConfirm = access ? canConfirmInventoryCount(access) : false;

  const [rows, setRows] = useState<StockCardListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState('All');
  const [itemTypeFilter, setItemTypeFilter] = useState<(typeof ITEM_TYPES)[number]>('All');
  const [uomMode, setUomMode] = useState<'inventory' | 'recipe'>('inventory');
  const [selectedMonth, setSelectedMonth] = useState(currentStockCardMonth);
  const [inventoryMode, setInventoryMode] = useState<InventoryCountSessionType>('spot');
  const [pageTab, setPageTab] = useState<InventoryPageTab>('count');
  const [historyRows, setHistoryRows] = useState<InventoryCountSessionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [expandedSession, setExpandedSession] = useState<InventoryCountSession | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [confirmingHistoryId, setConfirmingHistoryId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; periodMonth: string } | null>(null);
  const [recipeQtyByKey, setRecipeQtyByKey] = useState<Record<string, string>>({});
  const [inventoryQtyByKey, setInventoryQtyByKey] = useState<Record<string, string>>({});
  const [componentDetails, setComponentDetails] = useState<Record<string, string>>({});
  const [activeSession, setActiveSession] = useState<InventoryCountSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [listLoaded, setListLoaded] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const isReadOnly = inventoryMode === 'full' && !!activeSession?.isReadOnly;

  useEffect(() => {
    setListLoaded(false);
    setRows([]);
    setRecipeQtyByKey({});
    setInventoryQtyByKey({});
    setComponentDetails({});
    setActiveSession(null);
    setError(null);
    setActionMessage(null);
  }, [selectedCompanyId, selectedLocationIds, itemTypeFilter, uomMode, selectedMonth, inventoryMode]);

  const loadHistory = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) return;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await api.inventoryCountHistory(inventoryMode, selectedCompanyId, selectedLocationIds);
      setHistoryRows(rows);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load inventory history.');
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, inventoryMode]);

  useEffect(() => {
    if (pageTab !== 'history') return;
    setExpandedHistoryId(null);
    setExpandedSession(null);
    void loadHistory();
  }, [pageTab, loadHistory]);

  const loadInventoryList = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) return;

    setLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const [stockRows, session, ingredients] = await Promise.all([
        api.stockCards(selectedCompanyId, selectedLocationIds, {
          itemType: itemTypeFilterParam(itemTypeFilter),
          uomMode: 'inventory',
          period: selectedMonth,
        }),
        api.activeInventoryCount(inventoryMode, selectedCompanyId, selectedLocationIds, selectedMonth, uomMode),
        api.ingredients(),
      ]);

      const detailMap: Record<string, string> = {};
      for (const ingredient of ingredients) {
        if (ingredient.detailConfigJson) {
          detailMap[ingredient.componentId] = ingredient.detailConfigJson;
        }
      }

      setRows(stockRows);
      setComponentDetails(detailMap);
      setActiveSession(session);

      const nextRecipe: Record<string, string> = {};
      const nextInventory: Record<string, string> = {};
      if (session) {
        for (const line of session.lines) {
          if (line.countedQty == null) continue;
          const key = `${line.itemType}-${line.itemKey}`;
          const qty = fmtQty(line.countedQty);
          if (uomMode === 'recipe') nextRecipe[key] = qty;
          else nextInventory[key] = qty;
        }
      }
      setRecipeQtyByKey(nextRecipe);
      setInventoryQtyByKey(nextInventory);
      setListLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory.');
      setListLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, itemTypeFilter, uomMode, selectedMonth, inventoryMode]);

  const groups = useMemo(() => {
    const unique = new Set(rows.map(row => row.group).filter(Boolean));
    return ['All', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (groupFilter === 'All') return rows;
    return rows.filter(row => row.group === groupFilter);
  }, [rows, groupFilter]);

  const { visibleItems, hasMore, sentinelRef } = useInfiniteScrollSlice(filteredRows, { scrollRootRef });

  function updateRecipeQty(key: string, value: string) {
    if (isReadOnly) return;
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setRecipeQtyByKey(prev => ({ ...prev, [key]: value }));
  }

  function updateInventoryQty(key: string, value: string) {
    if (isReadOnly) return;
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setInventoryQtyByKey(prev => ({ ...prev, [key]: value }));
  }

  function rowConversion(row: StockCardListRow) {
    return buildComponentConversion(row, componentDetails[row.itemKey]);
  }

  function rowTotalQty(row: StockCardListRow): number | null {
    const key = rowKey(row);
    const isComponent = row.itemType === 'component';
    return computeTotalQty(
      parseQty(recipeQtyByKey[key] ?? ''),
      parseQty(inventoryQtyByKey[key] ?? ''),
      uomMode,
      rowConversion(row),
      isComponent,
    );
  }

  async function handleSave() {
    if (!selectedCompanyId || !canSave || isReadOnly || !listLoaded) return;

    const lines = filteredRows
      .map(row => {
        const totalQty = rowTotalQty(row);
        const conv = rowConversion(row);
        return {
          itemType: row.itemType,
          itemKey: row.itemKey,
          itemName: row.name,
          groupName: row.group,
          uom: displayUomForRow(row, uomMode),
          systemQty: displayOnHandQty(row, uomMode, conv),
          countedQty: totalQty,
        };
      })
      .filter(line => line.countedQty != null);

    if (lines.length === 0) {
      setActionMessage('Enter at least one counted quantity before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setActionMessage(null);
    try {
      const result = await api.saveInventoryCount({
        sessionType: inventoryMode,
        companyId: selectedCompanyId,
        locationIds: selectedLocationIds.join(','),
        periodMonth: selectedMonth,
        uomMode,
        itemTypeFilter: itemTypeFilterParam(itemTypeFilter),
        groupFilter,
        countDate: new Date().toISOString().slice(0, 10),
        savedBy: currentUser?.fullName ?? 'Unknown user',
        lines,
      });
      setActiveSession(result.session);
      setActionMessage(
        inventoryMode === 'spot'
          ? 'Spot inventory saved.'
          : 'Full inventory saved. Open the History tab to confirm within 72 hours or it will auto-confirm.',
      );
      if (pageTab === 'history') {
        void loadHistory();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save inventory count.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!activeSession || !canConfirm || !activeSession.canConfirm) return;
    setConfirmTarget({ id: activeSession.id, periodMonth: activeSession.periodMonth });
  }

  async function submitConfirm(sessionId: number, periodMonth: string, effectiveDate: string) {
    setConfirming(true);
    setConfirmingHistoryId(sessionId);
    setError(null);
    setActionMessage(null);
    setHistoryError(null);
    try {
      const result = await api.confirmInventoryCount(
        sessionId,
        currentUser?.fullName ?? 'Unknown user',
        effectiveDate,
      );
      if (activeSession?.id === sessionId) {
        setActiveSession(result.session);
      }
      setConfirmTarget(null);
      setActionMessage(
        `Full inventory for ${formatStockCardMonthLabel(periodMonth, false)} confirmed. Stock adjusted as of ${effectiveDate}.`,
      );
      if (pageTab === 'history') {
        if (expandedHistoryId === sessionId) {
          setExpandedSession(result.session);
        }
        await loadHistory();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to confirm inventory count.';
      if (pageTab === 'history') setHistoryError(message);
      else setError(message);
    } finally {
      setConfirming(false);
      setConfirmingHistoryId(null);
    }
  }

  function openHistoryConfirm(row: InventoryCountSessionSummary) {
    if (!canConfirm || !row.canConfirm) return;
    setConfirmTarget({ id: row.id, periodMonth: row.periodMonth });
  }

  async function toggleHistoryExpand(sessionId: number) {
    if (expandedHistoryId === sessionId) {
      setExpandedHistoryId(null);
      setExpandedSession(null);
      return;
    }

    if (!selectedCompanyId) return;

    setExpandedHistoryId(sessionId);
    setExpandedSession(null);
    setExpandedLoading(true);
    try {
      const session = await api.getInventoryCountSession(sessionId, selectedCompanyId, selectedLocationIds);
      setExpandedSession(session);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load inventory session.');
      setExpandedHistoryId(null);
    } finally {
      setExpandedLoading(false);
    }
  }

  if (!selectedCompanyId || selectedLocationIds.length === 0) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company and at least one location to view inventory.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <InventoryTypeToggle value={inventoryMode} onChange={setInventoryMode} />
      </div>

      <HrConfigTabBar tabs={INVENTORY_TABS} active={pageTab} onChange={setPageTab} />

      {pageTab === 'count' ? (
        <>
      <div className="flex flex-wrap items-end gap-3 mb-4 mt-4">
        <FilterSelect
          label="Type"
          value={itemTypeFilter}
          options={[...ITEM_TYPES]}
          onChange={v => setItemTypeFilter(v as (typeof ITEM_TYPES)[number])}
        />
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
        <div className="flex flex-col gap-1">
          <span className="text-xs font-sans text-transparent uppercase tracking-wider select-none" aria-hidden="true">
            Create
          </span>
          <button
            type="button"
            onClick={() => void loadInventoryList()}
            disabled={loading}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 min-w-[100px]"
          >
            {loading ? 'Loading…' : 'Create'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {formatStockCardMonthLabel(selectedMonth, selectedMonth === currentStockCardMonth())}
            {' · '}
            {inventoryMode === 'spot'
              ? 'Spot counts can be saved any day and remain in history for comparison.'
              : 'Full inventory is saved first, then confirmed within 72 hours or auto-confirmed.'}
          </p>
          {activeSession ? (
            <p className="text-xs text-foreground">{sessionStatusLabel(activeSession, inventoryMode)}</p>
          ) : null}
          {actionMessage ? <p className="text-xs text-primary">{actionMessage}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {inventoryMode === 'full' && activeSession?.canConfirm && canConfirm ? (
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={confirming || saving}
              className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm'}
            </button>
          ) : null}
          {canSave && !isReadOnly && listLoaded ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || confirming || loading}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive mb-3">{error}</p> : null}

      <TableScrollContainer ref={scrollRootRef}>
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">UOM</th>
              <th className="px-3 py-2 font-medium text-right">Quantity on Hand</th>
              <th className="px-3 py-2 font-medium text-right">Principal Component UOM</th>
              <th className="px-3 py-2 font-medium text-right w-28">QTY</th>
              <th className="px-3 py-2 font-medium text-right">Inventory UOM</th>
              <th className="px-3 py-2 font-medium text-right w-28">QTY</th>
              <th className="px-3 py-2 font-medium text-right w-28">Total QTY</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={TABLE_COL_COUNT} className="px-3 py-8 text-center text-muted-foreground">
                  Loading inventory…
                </td>
              </tr>
            ) : !listLoaded ? (
              <tr>
                <td colSpan={TABLE_COL_COUNT} className="px-3 py-8 text-center text-muted-foreground">
                  Set your filters and click Create to load the inventory list.
                </td>
              </tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={TABLE_COL_COUNT} className="px-3 py-8 text-center text-muted-foreground">
                  No inventory items found.
                </td>
              </tr>
            ) : (
              visibleItems.map(row => {
                const key = rowKey(row);
                const isComponent = row.itemType === 'component';
                const conv = rowConversion(row);
                const principalUom = isComponent ? row.recipeUom || row.uom : '—';
                const inventoryUom = isComponent ? row.inventoryUom || row.uom : row.uom;
                const totalQty = rowTotalQty(row);
                const onHand = displayOnHandQty(row, uomMode, conv);

                return (
                  <tr key={key} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-3 py-2.5 text-muted-foreground">{itemTypeLabel(row.itemType)}</td>
                    <td className="px-3 py-2.5">{row.group || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="px-3 py-2.5">{displayUomForRow(row, uomMode)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtQty(onHand)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{principalUom}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={recipeQtyByKey[key] ?? ''}
                        onChange={e => updateRecipeQty(key, e.target.value)}
                        placeholder="0"
                        disabled={isReadOnly || !isComponent}
                        className={`${inlineNumberCls} w-full max-w-[6rem] ml-auto disabled:opacity-60`}
                        aria-label={`Principal component quantity for ${row.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{inventoryUom}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={inventoryQtyByKey[key] ?? ''}
                        onChange={e => updateInventoryQty(key, e.target.value)}
                        placeholder="0"
                        disabled={isReadOnly}
                        className={`${inlineNumberCls} w-full max-w-[6rem] ml-auto disabled:opacity-60`}
                        aria-label={`Inventory quantity for ${row.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {totalQty != null ? fmtQty(totalQty) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
            <InfiniteScrollTableSentinel colSpan={TABLE_COL_COUNT} hasMore={hasMore} sentinelRef={sentinelRef} />
          </tbody>
        </table>
      </TableScrollContainer>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {inventoryMode === 'full'
              ? 'Unconfirmed full inventories appear first. Confirm pending counts before the 72-hour deadline.'
              : 'Spot inventory history for comparison across saved counts.'}
          </p>

          {historyError ? <p className="text-sm text-destructive">{historyError}</p> : null}

          <TableScrollContainer>
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">Saved</th>
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Filters</th>
                  <th className="px-3 py-2 font-medium text-right">Lines</th>
                  <th className="px-3 py-2 font-medium text-right">Difference</th>
                  <th className="px-3 py-2 font-medium">Effective</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Loading history…
                    </td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No {inventoryMode === 'full' ? 'full' : 'spot'} inventory history yet.
                    </td>
                  </tr>
                ) : (
                  historyRows.map(row => (
                    <Fragment key={row.id}>
                      <tr className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">{formatDateTime(row.savedAt)}</div>
                          <div className="text-xs text-muted-foreground">{row.savedBy || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5">{formatStockCardMonthLabel(row.periodMonth, false)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <div>{itemTypeFilterLabel(row.itemTypeFilter)}</div>
                          <div className="text-xs">
                            {row.groupFilter} · {row.uomMode === 'recipe' ? 'Component UOM' : 'Inventory UOM'}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.lineCount}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${varianceTone(row.totalVarianceQty)}`}>
                          <div className="font-medium">{fmtVarianceQty(row.totalVarianceQty)}</div>
                          <div className="text-xs">{fmtVariancePct(row.variancePct)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row.effectiveDate || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${historyStatusBadgeClass(row.status)}`}
                          >
                            {historyStatusBadgeText(row.status)}
                          </span>
                          <div className="text-xs text-muted-foreground mt-1">{historyStatusLabel(row)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {row.canConfirm && canConfirm ? (
                              <button
                                type="button"
                                onClick={() => openHistoryConfirm(row)}
                                disabled={confirmingHistoryId === row.id || confirming}
                                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                              >
                                {confirmingHistoryId === row.id ? 'Confirming…' : 'Confirm'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void toggleHistoryExpand(row.id)}
                              className="h-8 px-3 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted"
                            >
                              {expandedHistoryId === row.id ? 'Hide' : 'View'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedHistoryId === row.id ? (
                        <tr className="border-b border-border/60 bg-muted/20">
                          <td colSpan={8} className="px-3 py-3">
                            {expandedLoading ? (
                              <p className="text-sm text-muted-foreground">Loading lines…</p>
                            ) : expandedSession ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs font-sans">
                                  <thead>
                                    <tr className="text-left uppercase tracking-wider text-muted-foreground border-b border-border">
                                      <th className="px-2 py-1.5 font-medium">Type</th>
                                      <th className="px-2 py-1.5 font-medium">Group</th>
                                      <th className="px-2 py-1.5 font-medium">Name</th>
                                      <th className="px-2 py-1.5 font-medium">UOM</th>
                                      <th className="px-2 py-1.5 font-medium text-right">System</th>
                                      <th className="px-2 py-1.5 font-medium text-right">Counted</th>
                                      <th className="px-2 py-1.5 font-medium text-right">Difference</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedSession.lines.map(line => (
                                      <tr key={`${line.itemType}-${line.itemKey}`} className="border-b border-border/40">
                                        <td className="px-2 py-1.5 text-muted-foreground">{line.itemType}</td>
                                        <td className="px-2 py-1.5">{line.groupName || '—'}</td>
                                        <td className="px-2 py-1.5 font-medium">{line.itemName}</td>
                                        <td className="px-2 py-1.5">{line.uom}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtQty(line.systemQty)}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                          {line.countedQty != null ? fmtQty(line.countedQty) : '—'}
                                        </td>
                                        <td className={`px-2 py-1.5 text-right tabular-nums ${varianceTone(line.varianceQty)}`}>
                                          <div>{fmtVarianceQty(line.varianceQty)}</div>
                                          <div className="text-[11px]">{fmtVariancePct(line.variancePct)}</div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No line details available.</p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      )}

      {confirmTarget ? (
        <InventoryConfirmModal
          periodMonth={confirmTarget.periodMonth}
          confirming={confirming}
          onClose={() => {
            if (!confirming) setConfirmTarget(null);
          }}
          onConfirm={effectiveDate => {
            void submitConfirm(confirmTarget.id, confirmTarget.periodMonth, effectiveDate);
          }}
        />
      ) : null}
    </div>
  );
}
