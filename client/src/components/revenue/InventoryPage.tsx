import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  type InventoryCountHistoryLine,
  type InventoryCountSession,
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
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { InventoryConfirmModal } from './InventoryConfirmModal';
import { StorageFilter } from './StorageFilter';
import {
  listStoragesForFilter,
  loadStorageAssignment,
  parseComponentStorageJson,
  resolveComponentAreaStorage,
  rowMatchesStorageFilter,
  selectedStorageTypes,
} from '../../data/storageAssignment';
import { formatCountryNumber } from '../../utils/numberFormat';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
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
import { TableLoadingRow } from '../shared/MillstoneLoader';

const TABLE_COL_COUNT = 12;
const HISTORY_TABLE_COL_COUNT = 13;
const INVENTORY_TABS = [
  { id: 'count', label: 'Count' },
  { id: 'history', label: 'History' },
] as const;
const CATEGORY_OPTIONS = ['All', 'Food', 'Beverage'] as const;

type InventoryPageTab = (typeof INVENTORY_TABS)[number]['id'];

type InventoryDisplayRow = StockCardListRow & {
  areaLabel: string;
  storageLabel: string;
  sortArea: string;
  sortStorage: string;
};

type CountSortColumn =
  | 'type'
  | 'group'
  | 'name'
  | 'uom'
  | 'onHand'
  | 'principalUom'
  | 'inventoryUom'
  | 'totalQty'
  | 'area'
  | 'storage';

type HistorySortColumn =
  | 'itemName'
  | 'location'
  | 'savedAt'
  | 'confirmedAt'
  | 'effectiveDate'
  | 'uom'
  | 'systemQty'
  | 'countedQty'
  | 'varianceQty'
  | 'systemValue'
  | 'actualValue'
  | 'varianceValue';

const COUNT_TABLE_COLUMNS: SortableColumnDef<string>[] = [
  { key: 'type', label: 'Type' },
  { key: 'group', label: 'Group' },
  { key: 'name', label: 'Name' },
  { key: 'uom', label: 'UOM' },
  { key: 'onHand', label: 'Quantity on Hand', align: 'right' as const },
  { key: 'principalUom', label: 'Principal Component UOM', align: 'right' as const },
  { key: 'principalQty', label: 'QTY', align: 'right' as const, sortable: false },
  { key: 'inventoryUom', label: 'Inventory UOM', align: 'right' as const },
  { key: 'inventoryQty', label: 'QTY', align: 'right' as const, sortable: false },
  { key: 'totalQty', label: 'Total QTY', align: 'right' as const, className: 'w-28' },
  { key: 'area', label: 'Area' },
  { key: 'storage', label: 'Storage' },
] ;

const HISTORY_TABLE_COLUMNS: SortableColumnDef<string>[] = [
  { key: 'itemName', label: 'Item' },
  { key: 'location', label: 'Location' },
  { key: 'savedAt', label: 'Date Created' },
  { key: 'confirmedAt', label: 'Date Confirmed' },
  { key: 'effectiveDate', label: 'Effective Date' },
  { key: 'uom', label: 'UOM' },
  { key: 'systemQty', label: 'System Qty', align: 'right' as const },
  { key: 'countedQty', label: 'Actual Inventory', align: 'right' as const },
  { key: 'varianceQty', label: 'Variance', align: 'right' as const },
  { key: 'systemValue', label: 'System Value', align: 'right' as const },
  { key: 'actualValue', label: 'Actual Value', align: 'right' as const },
  { key: 'varianceValue', label: 'Variance', align: 'right' as const },
  { key: 'actions', label: 'Actions', align: 'right', sortable: false },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const ITEM_TYPES = ['All', 'Product', 'Sub-Product', 'Smart Component'] as const;
const INVENTORY_MODES = [
  { value: 'spot' as const, label: 'Spot' },
  { value: 'full' as const, label: 'Full' },
];

function rowKey(row: StockCardListRow) {
  return `${row.itemType}-${row.itemKey}`;
}

function fmtQty(value: number, countryCode: string) {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  return Number.isInteger(value) && value !== 0 ? String(value) : formatCountryNumber(value, countryCode);
}

function fmtVarianceQty(value: number | null | undefined, countryCode: string) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return formatCountryNumber(0, countryCode);
  const sign = value > 0 ? '+' : '';
  return `${sign}${fmtQty(value, countryCode)}`;
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

function fmtMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  required = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[] | string[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const normalized = options.map(option =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );

  return (
    <div className="flex flex-col gap-1 shrink-0">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
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

export function InventoryPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const countryCode = useOrgCountryCode();
  const { currentUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );
  const canSave = access ? canSaveInventoryCount(access) : false;
  const canConfirm = access ? canConfirmInventoryCount(access) : false;

  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_OPTIONS)[number]>('All');
  const [historyMonth, setHistoryMonth] = useState('');

  const [rows, setRows] = useState<StockCardListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemTypeFilter, setItemTypeFilter] = useState<(typeof ITEM_TYPES)[number]>('All');
  const [uomMode, setUomMode] = useState<'inventory' | 'recipe'>('inventory');
  const [selectedMonth, setSelectedMonth] = useState(currentStockCardMonth);
  const [countDate, setCountDate] = useState(todayIsoDate);
  const [inventoryMode, setInventoryMode] = useState<InventoryCountSessionType>('spot');
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<CountSortColumn>();
  const {
    sortColumn: historySortColumn,
    sortDirection: historySortDirection,
    toggleSort: toggleHistorySort,
    resetSort: resetHistorySort,
  } = useTableSort<HistorySortColumn>();
  const [pageTab, setPageTab] = useState<InventoryPageTab>('count');
  const [historyLineRows, setHistoryLineRows] = useState<InventoryCountHistoryLine[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [confirmingHistoryId, setConfirmingHistoryId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; periodMonth: string } | null>(null);
  const [recipeQtyByKey, setRecipeQtyByKey] = useState<Record<string, string>>({});
  const [inventoryQtyByKey, setInventoryQtyByKey] = useState<Record<string, string>>({});
  const [componentDetails, setComponentDetails] = useState<Record<string, string>>({});
  const [componentStorageByKey, setComponentStorageByKey] = useState<Record<string, string[]>>({});
  const [itemCategoryByKey, setItemCategoryByKey] = useState<Record<string, string>>({});
  const [areaFilter, setAreaFilter] = useState('All');
  const [selectedStorageKeys, setSelectedStorageKeys] = useState<string[]>([]);
  const [storageAssignmentVersion, setStorageAssignmentVersion] = useState(0);
  const [activeSession, setActiveSession] = useState<InventoryCountSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [listLoaded, setListLoaded] = useState(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const countLocationIds = useMemo(
    () => (selectedLocationIds.length > 0 ? [selectedLocationIds[0]] : []),
    [selectedLocationIds],
  );

  const isReadOnly = inventoryMode === 'full' && !!activeSession?.isReadOnly;

  useEffect(() => {
    setListLoaded(false);
    setRows([]);
    setRecipeQtyByKey({});
    setInventoryQtyByKey({});
    setComponentDetails({});
    setComponentStorageByKey({});
    setItemCategoryByKey({});
    setActiveSession(null);
    setError(null);
    setActionMessage(null);
  }, [selectedCompanyId, selectedLocationIds, itemTypeFilter, uomMode, selectedMonth, countDate, inventoryMode, categoryFilter]);

  useEffect(() => {
    resetSort();
    resetHistorySort();
  }, [selectedCompanyId, selectedLocationIds, itemTypeFilter, uomMode, selectedMonth, countDate, inventoryMode, categoryFilter, areaFilter, selectedStorageKeys, resetSort, resetHistorySort]);

  useEffect(() => {
    setAreaFilter('All');
    setSelectedStorageKeys([]);
  }, [selectedLocationIds]);

  useEffect(() => {
    const reload = () => setStorageAssignmentVersion(version => version + 1);
    window.addEventListener('bisync:storageAssignmentChanged', reload);
    return () => window.removeEventListener('bisync:storageAssignmentChanged', reload);
  }, []);

  const activeStorageTypes = useMemo(() => {
    const assignment = loadStorageAssignment();
    const storages = listStoragesForFilter(assignment, countLocationIds, areaFilter);
    return selectedStorageTypes(storages, selectedStorageKeys);
  }, [countLocationIds, areaFilter, selectedStorageKeys, storageAssignmentVersion]);

  const loadHistory = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) return;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await api.inventoryCountHistoryLines(
        inventoryMode,
        selectedCompanyId,
        selectedLocationIds,
        historyMonth || undefined,
        categoryFilter,
      );
      setHistoryLineRows(rows);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load inventory history.');
      setHistoryLineRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, inventoryMode, historyMonth, categoryFilter]);

  useEffect(() => {
    if (pageTab !== 'history') return;
    void loadHistory();
  }, [pageTab, loadHistory]);

  const loadInventoryList = useCallback(async () => {
    if (!selectedCompanyId || countLocationIds.length === 0) return;

    const ready =
      !!inventoryMode &&
      !!selectedMonth &&
      (inventoryMode === 'full' || !!countDate);
    if (!ready) {
      setError(
        inventoryMode === 'spot'
          ? 'Select inventory type, month, and count date before creating.'
          : 'Select inventory type and month before creating.',
      );
      return;
    }

    setLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const [stockRows, session, ingredients, products] = await Promise.all([
        api.stockCards(selectedCompanyId, countLocationIds, {
          itemType: itemTypeFilterParam(itemTypeFilter),
          uomMode: 'inventory',
          period: selectedMonth,
        }),
        api.activeInventoryCount(inventoryMode, selectedCompanyId, countLocationIds, selectedMonth, uomMode),
        api.ingredients(),
        api.products(selectedCompanyId),
      ]);

      const detailMap: Record<string, string> = {};
      const storageMap: Record<string, string[]> = {};
      const categoryMap: Record<string, string> = {};
      for (const ingredient of ingredients) {
        if (ingredient.detailConfigJson) {
          detailMap[ingredient.componentId] = ingredient.detailConfigJson;
        }
        storageMap[ingredient.componentId] = parseComponentStorageJson(ingredient.storageJson);
        categoryMap[`component-${ingredient.componentId}`] = ingredient.category;
      }
      for (const product of products) {
        const type = product.isSubProduct ? 'sub-product' : 'product';
        categoryMap[`${type}-${product.id}`] = product.category;
      }

      setRows(stockRows);
      setComponentDetails(detailMap);
      setComponentStorageByKey(storageMap);
      setItemCategoryByKey(categoryMap);
      setActiveSession(session);

      const nextRecipe: Record<string, string> = {};
      const nextInventory: Record<string, string> = {};
      if (session) {
        for (const line of session.lines) {
          if (line.countedQty == null) continue;
          const key = `${line.itemType}-${line.itemKey}`;
          const qty = fmtQty(line.countedQty, countryCode);
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
  }, [selectedCompanyId, countLocationIds, itemTypeFilter, uomMode, selectedMonth, countDate, inventoryMode]);

  const filteredRows = useMemo(() => {
    let next = rows;
    if (categoryFilter !== 'All') {
      next = next.filter(row => {
        const category = itemCategoryByKey[`${row.itemType}-${row.itemKey}`];
        return category === categoryFilter;
      });
    }
    if (activeStorageTypes.length > 0) {
      next = next.filter(row =>
        rowMatchesStorageFilter(row.itemType, row.itemKey, componentStorageByKey, activeStorageTypes),
      );
    }
    return next;
  }, [rows, categoryFilter, itemCategoryByKey, activeStorageTypes, componentStorageByKey]);

  const requiredFiltersReady =
    !!inventoryMode &&
    !!selectedMonth &&
    (inventoryMode === 'full' || !!countDate);

  const sortedHistoryLineRows = useMemo(
    () =>
      sortTableRows(
        historyLineRows,
        historySortColumn,
        historySortDirection,
        {
          itemName: row => row.itemName,
          location: row => row.locationLabel,
          savedAt: row => row.savedAt,
          confirmedAt: row => row.confirmedAt ?? '',
          effectiveDate: row => row.effectiveDate,
          uom: row => row.uom,
          systemQty: row => row.systemQty,
          countedQty: row => row.countedQty ?? -1,
          varianceQty: row => row.varianceQty ?? 0,
          systemValue: row => row.systemValue,
          actualValue: row => row.actualValue ?? -1,
          varianceValue: row => row.varianceValue ?? 0,
        },
        { tieBreaker: (a, b) => compareSortValues(a.itemName, b.itemName) },
      ),
    [historyLineRows, historySortColumn, historySortDirection],
  );

  const firstHistoryRowBySession = useMemo(() => {
    const map = new Map<number, number>();
    sortedHistoryLineRows.forEach((row, index) => {
      if (!map.has(row.sessionId)) map.set(row.sessionId, index);
    });
    return map;
  }, [sortedHistoryLineRows]);

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

  const displayRows = useMemo(() => {
    const assignment = loadStorageAssignment();
    const enriched: InventoryDisplayRow[] = filteredRows.map(row => {
      if (row.itemType !== 'component') {
        return {
          ...row,
          areaLabel: '—',
          storageLabel: '—',
          sortArea: '',
          sortStorage: '',
        };
      }
      const storageTypes = componentStorageByKey[row.itemKey] ?? [];
      const labels = resolveComponentAreaStorage(storageTypes, countLocationIds, assignment);
      return {
        ...row,
        areaLabel: labels.areas,
        storageLabel: labels.storages,
        sortArea: labels.sortArea,
        sortStorage: labels.sortStorage,
      };
    });
    return sortTableRows(
      enriched,
      sortColumn,
      sortDirection,
      {
        type: row => itemTypeLabel(row.itemType),
        group: row => row.group || '',
        name: row => row.name,
        uom: row => displayUomForRow(row, uomMode),
        onHand: row => row.onHandQty,
        principalUom: row => row.recipeUom || row.uom || '',
        inventoryUom: row => row.inventoryUom || row.uom || '',
        totalQty: row => rowTotalQty(row) ?? -1,
        area: row => row.sortArea,
        storage: row => row.sortStorage,
      },
      {
        compare: {
          area: (a, b) =>
            compareSortValues(a.sortArea, b.sortArea) || compareSortValues(a.sortStorage, b.sortStorage),
          storage: (a, b) =>
            compareSortValues(a.sortArea, b.sortArea) || compareSortValues(a.sortStorage, b.sortStorage),
        },
        tieBreaker: (a, b) => compareSortValues(a.name, b.name),
      },
    );
  }, [
    filteredRows,
    countLocationIds,
    componentStorageByKey,
    sortColumn,
    sortDirection,
    uomMode,
    recipeQtyByKey,
    inventoryQtyByKey,
    componentDetails,
    storageAssignmentVersion,
  ]);

  const { visibleItems, hasMore, sentinelRef } = useInfiniteScrollSlice(displayRows, { scrollRootRef });

  function handleSort(column: CountSortColumn) {
    toggleSort(column);
  }

  function handleHistorySort(column: HistorySortColumn) {
    toggleHistorySort(column);
  }

  async function handleSave() {
    if (!selectedCompanyId || countLocationIds.length === 0 || !canSave || isReadOnly || !listLoaded) return;

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
        locationIds: countLocationIds.join(','),
        periodMonth: selectedMonth,
        uomMode,
        itemTypeFilter: itemTypeFilterParam(itemTypeFilter),
        groupFilter: 'All',
        countDate: inventoryMode === 'spot' ? countDate : new Date().toISOString().slice(0, 10),
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

  function openHistoryConfirm(row: InventoryCountHistoryLine) {
    if (!canConfirm || !row.canConfirm) return;
    setConfirmTarget({ id: row.sessionId, periodMonth: row.periodMonth });
  }

  if (!selectedCompanyId || selectedLocationIds.length === 0) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company and location in the header to view inventory.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <HrConfigTabBar tabs={INVENTORY_TABS} active={pageTab} onChange={setPageTab} />

      {pageTab === 'count' ? (
        <>
      <div className="mb-4 mt-4 space-y-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Required</p>
          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
            <FilterSelect
              label="Inventory"
              value={inventoryMode}
              options={INVENTORY_MODES}
              onChange={value => setInventoryMode(value as InventoryCountSessionType)}
              required
            />
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Month<span className="text-destructive"> *</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                min={earliestStockCardMonth()}
                max={currentStockCardMonth()}
                onChange={e => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className={`${filterSelectCls} min-w-[140px]`}
              />
            </div>
            {inventoryMode === 'spot' ? (
              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                  Count Date<span className="text-destructive"> *</span>
                </label>
                <input
                  type="date"
                  value={countDate}
                  max={todayIsoDate()}
                  onChange={e => {
                    if (e.target.value) setCountDate(e.target.value);
                  }}
                  className={`${filterSelectCls} min-w-[140px]`}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Filters</p>
          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={[...CATEGORY_OPTIONS]}
              onChange={value => setCategoryFilter(value as (typeof CATEGORY_OPTIONS)[number])}
            />
            <FilterSelect
              label="Type"
              value={itemTypeFilter}
              options={[...ITEM_TYPES]}
              onChange={v => setItemTypeFilter(v as (typeof ITEM_TYPES)[number])}
            />
            <StorageFilter
              locationIds={countLocationIds}
              areaFilter={areaFilter}
              selectedStorageKeys={selectedStorageKeys}
              onAreaChange={area => {
                setAreaFilter(area);
                setSelectedStorageKeys([]);
              }}
              onStorageKeysChange={setSelectedStorageKeys}
            />
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</label>
              <select
                value={uomMode}
                onChange={e => setUomMode(e.target.value as 'inventory' | 'recipe')}
                className={`${filterSelectCls} min-w-[130px]`}
              >
                <option value="inventory">Inventory UOM</option>
                <option value="recipe">Component UOM</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-xs font-sans text-transparent uppercase tracking-wider select-none" aria-hidden="true">
                Create
              </span>
              <button
                type="button"
                onClick={() => void loadInventoryList()}
                disabled={loading || !requiredFiltersReady}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 min-w-[100px]"
              >
                Create
              </button>
            </div>
          </div>
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
            {activeStorageTypes.length > 0 ? ' · Showing components for selected storage only.' : ''}
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
            <SortableTableHeaderRow
              columns={COUNT_TABLE_COLUMNS}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={column => handleSort(column as CountSortColumn)}
            />
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={TABLE_COL_COUNT} label="Loading inventory…" />
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
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtQty(onHand, countryCode)}</td>
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
                      {totalQty != null ? fmtQty(totalQty, countryCode) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.areaLabel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.storageLabel}</td>
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
          <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
            <FilterSelect
              label="Inventory"
              value={inventoryMode}
              options={INVENTORY_MODES}
              onChange={value => setInventoryMode(value as InventoryCountSessionType)}
            />
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={[...CATEGORY_OPTIONS]}
              onChange={value => setCategoryFilter(value as (typeof CATEGORY_OPTIONS)[number])}
            />
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Month</label>
              <input
                type="month"
                value={historyMonth}
                min={earliestStockCardMonth()}
                max={currentStockCardMonth()}
                onChange={e => setHistoryMonth(e.target.value)}
                className={`${filterSelectCls} min-w-[140px]`}
              />
            </div>
            <button
              type="button"
              onClick={() => setHistoryMonth('')}
              className="h-9 px-3 shrink-0 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted"
            >
              All months
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {inventoryMode === 'full'
              ? 'Unconfirmed full inventories can be confirmed from the Actions column before the 72-hour deadline.'
              : 'Spot inventory history with quantity and value variance by line.'}
          </p>

          {historyError ? <p className="text-sm text-destructive">{historyError}</p> : null}

          <TableScrollContainer>
            <table className="w-full text-sm font-sans">
              <thead>
                <SortableTableHeaderRow
                  columns={HISTORY_TABLE_COLUMNS}
                  sortColumn={historySortColumn}
                  sortDirection={historySortDirection}
                  onSort={column => handleHistorySort(column as HistorySortColumn)}
                />
              </thead>
              <tbody>
                {historyLoading ? (
                  <TableLoadingRow colSpan={HISTORY_TABLE_COL_COUNT} label="Loading history…" />
                ) : sortedHistoryLineRows.length === 0 ? (
                  <tr>
                    <td colSpan={HISTORY_TABLE_COL_COUNT} className="px-3 py-8 text-center text-muted-foreground">
                      No {inventoryMode === 'full' ? 'full' : 'spot'} inventory history for the selected filters.
                    </td>
                  </tr>
                ) : (
                  sortedHistoryLineRows.map((row, index) => {
                    const showConfirm =
                      row.canConfirm &&
                      canConfirm &&
                      firstHistoryRowBySession.get(row.sessionId) === index;

                    return (
                      <tr key={`${row.sessionId}-${row.lineId}`} className="border-b border-border/60 hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">{row.itemName}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.category || '—'} · {formatStockCardMonthLabel(row.periodMonth, false)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">{row.locationLabel || '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{formatDateTime(row.savedAt)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row.confirmedAt ? formatDateTime(row.confirmedAt) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.effectiveDate || '—'}</td>
                        <td className="px-3 py-2.5">{row.uom}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(row.systemQty, countryCode)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.countedQty != null ? fmtQty(row.countedQty, countryCode) : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${varianceTone(row.varianceQty)}`}>
                          {fmtVarianceQty(row.varianceQty, countryCode)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(row.systemValue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(row.actualValue)}</td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${varianceTone(row.varianceValue)}`}>
                          {fmtVarianceQty(row.varianceValue, countryCode)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {showConfirm ? (
                            <button
                              type="button"
                              onClick={() => openHistoryConfirm(row)}
                              disabled={confirmingHistoryId === row.sessionId || confirming}
                              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                              {confirmingHistoryId === row.sessionId ? 'Confirming…' : 'Confirm'}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
