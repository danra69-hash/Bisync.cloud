import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, TableColGroup, tableColWidth, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls } from '../layout/formControls';
import { FilePlus2, Search, Upload, X } from 'lucide-react';
import { api } from '../../api';
import { getSiCategoryFilterOptions, getSiGroupFilterOptions } from '../../data/revenueManagement';
import { labelsEqual } from '../../utils/labelMatch';
import {
  blankComponentRow,
  fromApiUom,
  resolveDetailConfigForRow,
  type ComponentRow,
} from '../../data/componentForm';
import { getDefaultCategoryAndGroup, loadComponentHierarchy } from '../../data/componentHierarchy';
import {
  buildSmartComponentImportPlan,
  downloadSmartComponentTemplateCsv,
  parseSmartComponentTemplateCsv,
  type SmartComponentImportPlan,
  type SmartComponentLocationScope,
} from '../../data/smartComponentCatalog';
import { ComponentEditPanel } from './ComponentEditPanel';
import { SmartComponentImportReviewPanel } from './SmartComponentImportReviewPanel';
import { ingredientToRow, mergeSavedRow, rowToIngredient } from './smartIngredientShared';
import { countComponentTaggedVendors, resolveMyComponentLastUomPrice } from '../../data/vendorProductTagging';
import {
  applyVendorProductOverrides,
  refreshVendorProductCatalog,
} from '../../data/vendorProductCatalog';
import {
  convertComponentQtyBetweenUoms,
  formatParStock,
  type ComponentUomSource,
} from '../../data/componentParStock';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useShouldHidePrices } from '../../hooks/useShouldHidePrices';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { canEditComponentParStock, parseUserAccess } from '../../data/userAccess';
import { formatCountryNumber } from '../../utils/numberFormat';

type IngredientSortColumn =
  | 'componentId'
  | 'name'
  | 'uom'
  | 'lastPrice'
  | 'dailyUsage'
  | 'orderFreq'
  | 'parStock'
  | 'onHand'
  | 'storage'
  | 'products'
  | 'vendors'
  | 'active';

const INGREDIENT_TABLE_COLUMNS: SortableColumnDef<IngredientSortColumn>[] = [
  { key: 'componentId', label: 'Component ID', ...tableColWidth('10%') },
  { key: 'name', label: 'Component Name', ...tableColWidth('14%') },
  { key: 'uom', label: 'Principal Component UOM', ...tableColWidth('10%') },
  { key: 'lastPrice', label: 'Last UOM Price', align: 'right', ...tableColWidth('8%') },
  { key: 'dailyUsage', label: 'Daily Usage', align: 'right', ...tableColWidth('7%') },
  { key: 'orderFreq', label: 'Order Freq (days)', align: 'right', ...tableColWidth('7%') },
  { key: 'parStock', label: 'Par Stock', align: 'right', ...tableColWidth('10%') },
  { key: 'onHand', label: 'Qty on Hand', align: 'right', ...tableColWidth('7%') },
  { key: 'storage', label: 'Storage', ...tableColWidth('9%') },
  { key: 'products', label: 'Products', align: 'center', ...tableColWidth(72) },
  { key: 'vendors', label: 'Vendors', align: 'center', ...tableColWidth(72) },
  { key: 'active', label: 'Active', align: 'center', sortable: false, ...tableColWidth(72) },
];

type UomFilterMode = 'principal' | 'inventory' | string;

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${filterSelectCls} min-w-[130px]`}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function uomSourceForRow(row: ComponentRow): ComponentUomSource {
  const detail = resolveDetailConfigForRow(row);
  return {
    recipeUom: fromApiUom(row.recipeUOM),
    inventoryUom: fromApiUom(row.inventoryUOM),
    altRecipeUnits: detail.altRecipeUnits,
    altInventoryUnits: detail.altInventoryUnits,
  };
}

function displayUomForRow(row: ComponentRow, mode: UomFilterMode): string {
  const source = uomSourceForRow(row);
  if (mode === 'principal') return source.recipeUom;
  if (mode === 'inventory') return source.inventoryUom;
  return mode || source.recipeUom;
}

function convertFromRecipe(
  qty: number,
  row: ComponentRow,
  toUom: string,
): number | null {
  if (!Number.isFinite(qty)) return null;
  const detail = resolveDetailConfigForRow(row);
  const source = uomSourceForRow(row);
  return convertComponentQtyBetweenUoms(qty, source.recipeUom, toUom, {
    ...source,
    convertFromInventoryQty: detail.convertFromInventoryQty,
    convertToRecipeQty: detail.convertToRecipeQty,
  });
}

export function SmartIngredientPage({
  selectedCompanyId,
  selectedLocationIds,
}: {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
}) {
  const { rm, countryCode } = useCountryFormatters();
  const hidePrices = useShouldHidePrices();
  const { currentUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : parseUserAccess('{}')),
    [currentUser],
  );
  const canEditPar = canEditComponentParStock(access);

  const tableColumns = useMemo(
    () => (hidePrices
      ? INGREDIENT_TABLE_COLUMNS.filter(col => col.key !== 'lastPrice')
      : INGREDIENT_TABLE_COLUMNS),
    [hidePrices],
  );
  const columnCount = tableColumns.length;
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyLocations, setCompanyLocations] = useState<{ externalId: string; name: string }[]>([]);
  const [catFilter, setCatFilter] = useState('All');
  const [grpFilter, setGrpFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [uomFilter, setUomFilter] = useState<UomFilterMode>('principal');
  const [editRow, setEditRow] = useState<ComponentRow | null>(null);
  const [isNewRow, setIsNewRow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [parDrafts, setParDrafts] = useState<Record<number, string>>({});
  const [savingParId, setSavingParId] = useState<number | null>(null);
  const [importPlan, setImportPlan] = useState<SmartComponentImportPlan | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const templateRef = useRef<HTMLInputElement | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<IngredientSortColumn>();

  useEffect(() => {
    setLoading(true);
    api.ingredients(selectedCompanyId ?? undefined, selectedLocationIds)
      .then(data => setRows(data.map(ingredientToRow)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedCompanyId, selectedLocationIds]);

  useEffect(() => {
    let cancelled = false;
    void refreshVendorProductCatalog().then(() => {
      if (!cancelled) setCatalogRevision(value => value + 1);
    });
    const onCatalogChange = () => setCatalogRevision(value => value + 1);
    window.addEventListener('bisync:vendorProductCatalogChanged', onCatalogChange);
    return () => {
      cancelled = true;
      window.removeEventListener('bisync:vendorProductCatalogChanged', onCatalogChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyLocations([]);
      return;
    }
    api.locationsConfig()
      .then(locations => {
        setCompanyLocations(
          locations
            .filter(location =>
              location.companyId === selectedCompanyId && location.active !== false,
            )
            .map(location => ({ externalId: location.externalId, name: location.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => setCompanyLocations([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setEditRow(null);
      setIsNewRow(false);
      setSaveError(null);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    resetSort();
  }, [catFilter, grpFilter, search, uomFilter, resetSort]);

  const filtered = useMemo(() => {
    return rows.filter(row => {
      // Uploaded catalogs often use FOOD / BEVERAGE; filters use Food / Beverage.
      const matchCat = catFilter === 'All' || labelsEqual(row.category, catFilter);
      const matchGrp = grpFilter === 'All' || labelsEqual(row.group, grpFilter);
      const q = search.toLowerCase();
      const matchQ = !q
        || (row.name ?? '').toLowerCase().includes(q)
        || (row.componentId ?? '').toLowerCase().includes(q)
        || (row.category ?? '').toLowerCase().includes(q)
        || (row.group ?? '').toLowerCase().includes(q);
      return matchCat && matchGrp && matchQ;
    });
  }, [rows, catFilter, grpFilter, search]);

  const categoryFilterOptions = useMemo(
    () => getSiCategoryFilterOptions(rows.map(row => row.category)),
    [rows],
  );
  const groupFilterOptions = useMemo(
    () => getSiGroupFilterOptions(rows.map(row => row.group)),
    [rows],
  );

  const alternateUomOptions = useMemo(() => {
    const units = new Set<string>();
    for (const row of rows) {
      const source = uomSourceForRow(row);
      for (const alt of [...source.altRecipeUnits, ...source.altInventoryUnits]) {
        const unit = fromApiUom(alt.unit);
        if (unit) units.add(unit);
      }
    }
    return [...units].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const vendorCatalog = useMemo(
    () => applyVendorProductOverrides(),
    [catalogRevision],
  );

  const price = (r: ComponentRow) => resolveMyComponentLastUomPrice(r, uomFilter, vendorCatalog);
  const vendorCount = (r: ComponentRow) => countComponentTaggedVendors(r, selectedLocationIds);

  const qtyInDisplayUom = (r: ComponentRow, recipeQty: number) => {
    const toUom = displayUomForRow(r, uomFilter);
    const converted = convertFromRecipe(recipeQty, r, toUom);
    return { value: converted ?? recipeQty, uom: toUom };
  };

  const sortedFiltered = useMemo(
    () =>
      sortTableRows(
        filtered,
        sortColumn,
        sortDirection,
        {
          componentId: row => row.componentId || '',
          name: row => row.name,
          uom: row => displayUomForRow(row, uomFilter),
          lastPrice: row => price(row),
          dailyUsage: row => row.dailyUsage,
          orderFreq: row => row.orderFreqDays,
          parStock: row => row.parStock ?? 0,
          onHand: row => row.onHandQty ?? 0,
          storage: row => (Array.isArray(row.storage) ? row.storage : []).join(', '),
          products: row => row.attachedProducts,
          vendors: row => vendorCount(row),
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [filtered, sortColumn, sortDirection, uomFilter, selectedLocationIds, vendorCatalog],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedFiltered,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedFiltered, { scrollRootRef });

  const locationScope = useMemo<SmartComponentLocationScope | undefined>(() => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) return undefined;
    return {
      companyLocations,
      selectedLocationIds,
    };
  }, [companyLocations, selectedCompanyId, selectedLocationIds]);

  const scopedLocationNames = useMemo(
    () => companyLocations
      .filter(location => selectedLocationIds.includes(location.externalId))
      .map(location => location.name),
    [companyLocations, selectedLocationIds],
  );

  const templateLocationReady = !selectedCompanyId || selectedLocationIds.length > 0;

  function openAdd() {
    if (!selectedCompanyId) return;
    setSaveError(null);
    setIsNewRow(true);
    const defaults = getDefaultCategoryAndGroup(loadComponentHierarchy());
    setEditRow({ ...blankComponentRow, category: defaults.category, group: defaults.group });
  }

  async function handleSave(updated: Partial<ComponentRow>) {
    if (!editRow) return;
    setSaveError(null);
    if (isNewRow) {
      if (!selectedCompanyId) {
        setSaveError('Select a company before creating a component.');
        return;
      }
      const newRow = { ...blankComponentRow, ...updated, companyId: selectedCompanyId } as ComponentRow;
      try {
        const created = await api.createIngredient(rowToIngredient(newRow, { companyId: selectedCompanyId }));
        setRows(prev => [mergeSavedRow(created, newRow), ...prev]);
        setIsNewRow(false);
        setEditRow(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save component.');
      }
    } else if (editRow.id) {
      const merged = { ...editRow, ...updated, companyId: editRow.companyId ?? selectedCompanyId };
      try {
        const saved = await api.updateIngredient(editRow.id, rowToIngredient(merged, { companyId: merged.companyId ?? undefined }));
        setRows(prev => prev.map(r => r.id === editRow.id ? mergeSavedRow(saved, merged) : r));
        setIsNewRow(false);
        setEditRow(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save component.');
      }
    }
  }

  async function toggleActive(row: ComponentRow) {
    if (!row.id) return;
    setActionError(null);
    try {
      const saved = await api.updateIngredient(row.id, rowToIngredient({ ...row, active: !row.active }, {}));
      setRows(prev => prev.map(r => r.id === row.id ? mergeSavedRow(saved, row) : r));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update component status.');
    }
  }

  async function saveParStock(row: ComponentRow) {
    if (!row.id || !canEditPar) return;
    const draft = parDrafts[row.id];
    if (draft == null) return;
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setActionError('Par stock must be a non-negative number.');
      return;
    }

    const displayUom = displayUomForRow(row, uomFilter);
    const detail = resolveDetailConfigForRow(row);
    const source = uomSourceForRow(row);
    const recipeQty = convertComponentQtyBetweenUoms(parsed, displayUom, source.recipeUom, {
      ...source,
      convertFromInventoryQty: detail.convertFromInventoryQty,
      convertToRecipeQty: detail.convertToRecipeQty,
    });
    const parStock = recipeQty ?? parsed;
    const parStockUom = source.recipeUom;

    setSavingParId(row.id);
    setActionError(null);
    try {
      const payload = rowToIngredient({ ...row, parStock, parStockUom }, {});
      const saved = await api.updateIngredient(row.id, payload);
      setRows(prev => prev.map(r => (r.id === row.id
        ? { ...mergeSavedRow(saved, row), parStock, parStockUom, onHandQty: row.onHandQty }
        : r)));
      setParDrafts(prev => {
        const next = { ...prev };
        delete next[row.id!];
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save par stock.');
    } finally {
      setSavingParId(null);
    }
  }

  const hasFilters = catFilter !== 'All' || grpFilter !== 'All' || !!search;

  function handleDownloadTemplate() {
    if (!templateLocationReady) {
      setImportError('Select at least one location in the header filter before downloading the template.');
      return;
    }
    setImportError(null);
    downloadSmartComponentTemplateCsv(rows, locationScope);
  }

  async function handleTemplateUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!templateLocationReady) {
      setImportError('Select at least one location in the header filter before uploading the template.');
      return;
    }
    setImportError(null);
    try {
      const text = await files[0].text();
      const drafts = parseSmartComponentTemplateCsv(text, locationScope);
      if (drafts.length === 0) {
        setImportError('Template file parsed no valid rows. Use the downloaded My Component template format.');
        return;
      }
      const plan = buildSmartComponentImportPlan(drafts, rows, locationScope);
      setImportPlan(plan);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read component template.');
    } finally {
      if (templateRef.current) templateRef.current.value = '';
    }
  }

  return (
    <div className={pageShellClass({ spacing: 'loose' })}>
      {!selectedCompanyId && (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3">
          Select a company in the header to add components or assign locations. The list below shows all components.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground font-sans">{filtered.length} of {rows.length} items</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={!templateLocationReady}
            className="inline-flex items-center gap-1.5 text-xs font-sans border border-[#2563eb]/40 bg-[#2563eb]/10 text-[#1d4ed8] rounded-md px-3 py-2 hover:bg-[#2563eb]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FilePlus2 size={12} />
            Download Template CSV
          </button>
          <button
            type="button"
            onClick={() => templateRef.current?.click()}
            disabled={!templateLocationReady}
            className="inline-flex items-center gap-1.5 text-xs font-sans border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#6d28d9] rounded-md px-3 py-2 hover:bg-[#7c3aed]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={12} />
            Upload Template CSV
          </button>
          <input
            ref={templateRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => void handleTemplateUpload(e.target.files)}
          />
          <button
            onClick={openAdd}
            disabled={!selectedCompanyId}
            className="text-xs font-sans bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add Component
          </button>
        </div>
      </div>

      {importError && (
        <p className="text-xs text-red-500 border border-red-300/50 rounded-lg px-3 py-2">{importError}</p>
      )}
      {actionError && (
        <p className="text-xs text-red-500 border border-red-300/50 rounded-lg px-3 py-2">{actionError}</p>
      )}

      {selectedCompanyId && scopedLocationNames.length > 0 && (
        <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
          Template locations are scoped to the header filter: {scopedLocationNames.join(', ')}.
          Components assigned to <span className="font-medium">All</span> locations export as these location names only.
          Daily usage and order frequency use the last 3 months of sales / purchase orders.
        </p>
      )}

      <PageStickyFilters opaque className="space-y-2 pb-2">
      <div className="bg-card border border-border rounded-lg p-2">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect label="Category" value={catFilter} options={categoryFilterOptions} onChange={setCatFilter} />
          <FilterSelect label="Group" value={grpFilter} options={groupFilterOptions} onChange={setGrpFilter} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Principal Component UOM
            </label>
            <select
              value={uomFilter}
              onChange={e => setUomFilter(e.target.value)}
              className={`${filterSelectCls} min-w-[180px]`}
            >
              <option value="principal">Principal Component UOM</option>
              <option value="inventory">Principal Inventory UOM</option>
              {alternateUomOptions.map(unit => (
                <option key={unit} value={unit}>Alternate: {unit}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Keyword</label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search name, category, group…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-8 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setCatFilter('All'); setGrpFilter('All'); setSearch(''); }}
              className="flex items-center gap-1 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors pb-1.5"
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-sans text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
      </div>
      </PageStickyFilters>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <MillstoneLoader size="sm" layout="block" label="Loading components…" />
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <TableColGroup columns={tableColumns} />
              <thead className="bg-muted/30">
                <SortableTableHeaderRow
                  columns={tableColumns}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className="border-b border-border"
                />
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-10 text-center text-xs text-muted-foreground font-sans">
                      No items match the selected filters.
                    </td>
                  </tr>
                ) : pagedFiltered.map(row => {
                  const vendors = vendorCount(row);
                  const displayUom = displayUomForRow(row, uomFilter);
                  const daily = qtyInDisplayUom(row, row.dailyUsage);
                  const onHand = qtyInDisplayUom(row, row.onHandQty ?? 0);
                  const storedPar = row.parStock && row.parStock > 0
                    ? qtyInDisplayUom(row, row.parStock)
                    : qtyInDisplayUom(row, (row.dailyUsage > 0 && row.orderFreqDays > 0)
                      ? row.dailyUsage * row.orderFreqDays
                      : 0);
                  const parInputValue = row.id && parDrafts[row.id] != null
                    ? parDrafts[row.id]
                    : (storedPar.value > 0 ? String(Number(storedPar.value.toFixed(4))) : '');

                  return (
                  <tr key={row.id ?? row.name}
                    className={`border-b border-border last:border-0 transition-colors ${row.active ? 'hover:bg-muted/30' : 'opacity-50 hover:opacity-70'}`}>
                    <td className="px-4 py-3 font-sans text-muted-foreground">{row.componentId || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSaveError(null); setIsNewRow(false); setEditRow(row); }} className="text-left group">
                        <p className="font-medium text-foreground group-hover:text-primary group-hover:underline transition-colors">{row.name}</p>
                        <p className="text-xs text-muted-foreground font-sans">{row.category} · {row.group}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 font-sans text-foreground">
                      <span>{displayUom || '—'}</span>
                      {uomFilter !== 'principal' && fromApiUom(row.recipeUOM) !== displayUom ? (
                        <span className="block text-[10px] text-muted-foreground">Principal: {fromApiUom(row.recipeUOM)}</span>
                      ) : null}
                    </td>
                    {!hidePrices && (
                      <td className="px-4 py-3 font-sans text-foreground text-right">{rm(price(row))}</td>
                    )}
                    <td className="px-4 py-3 font-sans text-muted-foreground text-right">
                      {daily.value > 0
                        ? `${formatCountryNumber(daily.value, countryCode)} ${daily.uom}/day`
                        : '—'}
                      {row.dailyUsageAuto ? (
                        <span className="block text-[10px] text-muted-foreground">auto · 3 mo sales</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground text-right">
                      {row.orderFreqDays > 0
                        ? (row.orderFreqDays >= 90 ? `${row.orderFreqDays}d` : `Every ${row.orderFreqDays}d`)
                        : '—'}
                      {row.orderFreqAuto ? (
                        <span className="block text-[10px] text-muted-foreground">auto · 3 mo PO</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground text-right">
                      {canEditPar && row.id ? (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={parInputValue}
                            disabled={savingParId === row.id}
                            onChange={e => setParDrafts(prev => ({ ...prev, [row.id!]: e.target.value }))}
                            onBlur={() => {
                              if (row.id && parDrafts[row.id] != null) void saveParStock(row);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            className="min-w-[8.5rem] w-[8.5rem] max-w-[10rem] rounded border border-border bg-background px-1.5 py-1 text-right text-xs tabular-nums"
                            title="Adjust par stock qty (requires permission)"
                          />
                          <span className="text-[10px] text-muted-foreground">{displayUom}</span>
                        </div>
                      ) : (
                        formatParStock(storedPar.value, storedPar.uom, countryCode)
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground text-right">
                      {onHand.value !== 0
                        ? `${formatCountryNumber(onHand.value, countryCode)} ${onHand.uom}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {(Array.isArray(row.storage) ? row.storage : []).map((s, si) => (
                          <span key={si} className="text-xs px-1.5 py-0.5 rounded bg-muted font-sans inline-block w-fit">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.attachedProducts > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#6BA4C9]/15 text-[#6BA4C9] text-xs font-sans font-semibold">{row.attachedProducts}</span>
                      ) : <span className="text-muted-foreground font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {vendors > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-sans font-semibold">{vendors}</span>
                      ) : <span className="text-muted-foreground font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(row)}
                        className={`w-9 h-5 rounded-full relative transition-colors ${row.active ? 'bg-primary' : 'bg-border'}`}
                        title={row.active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${row.active ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
                <InfiniteScrollTableSentinel colSpan={columnCount} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>

      {editRow && (
        <ComponentEditPanel
          row={editRow}
          isNew={isNewRow}
          existingComponents={rows}
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          saveError={saveError}
          onClose={() => { setEditRow(null); setIsNewRow(false); setSaveError(null); }}
          onSave={handleSave}
        />
      )}

      {importPlan && (
        <SmartComponentImportReviewPanel
          plan={importPlan}
          existingRows={rows}
          selectedCompanyId={selectedCompanyId}
          locationScope={locationScope}
          onClose={() => setImportPlan(null)}
          onApplied={nextRows => {
            setRows(nextRows);
            setImportPlan(null);
            setImportError(null);
          }}
        />
      )}
    </div>
  );
}
