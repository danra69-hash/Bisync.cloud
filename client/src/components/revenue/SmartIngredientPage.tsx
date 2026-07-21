import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { FilePlus2, Search, Upload, X } from 'lucide-react';
import { api } from '../../api';
import { getSiCategoryFilterOptions, getSiGroupFilterOptions } from '../../data/revenueManagement';
import { blankComponentRow, fromApiUom, type ComponentRow } from '../../data/componentForm';
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
import { countComponentTaggedVendors } from '../../data/vendorProductTagging';
import { formatParStock, resolveComponentParStock } from '../../data/componentParStock';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useShouldHidePrices } from '../../hooks/useShouldHidePrices';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type IngredientSortColumn =
  | 'componentId'
  | 'name'
  | 'uom'
  | 'lastPrice'
  | 'dailyUsage'
  | 'orderFreq'
  | 'parStock'
  | 'storage'
  | 'products'
  | 'vendors'
  | 'active';

const INGREDIENT_TABLE_COLUMNS: SortableColumnDef<IngredientSortColumn>[] = [
  { key: 'componentId', label: 'Component ID' },
  { key: 'name', label: 'Component Name' },
  { key: 'uom', label: 'UOM' },
  { key: 'lastPrice', label: 'Last UOM Price', align: 'right' },
  { key: 'dailyUsage', label: 'Daily Usage', align: 'right' },
  { key: 'orderFreq', label: 'Order Freq (days)', align: 'right' },
  { key: 'parStock', label: 'Par Stock', align: 'right' },
  { key: 'storage', label: 'Storage' },
  { key: 'products', label: 'Products', align: 'center' },
  { key: 'vendors', label: 'Vendors', align: 'center' },
  { key: 'active', label: 'Active', align: 'center', sortable: false },
];

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

export function SmartIngredientPage({
  selectedCompanyId,
  selectedLocationIds,
}: {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
}) {
  const { number } = useCountryFormatters();
  const hidePrices = useShouldHidePrices();
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
  const [uomType, setUomType] = useState<'recipe' | 'inventory'>('recipe');
  const [editRow, setEditRow] = useState<ComponentRow | null>(null);
  const [isNewRow, setIsNewRow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importPlan, setImportPlan] = useState<SmartComponentImportPlan | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const templateRef = useRef<HTMLInputElement | null>(null);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<IngredientSortColumn>();

  useEffect(() => {
    setLoading(true);
    api.ingredients(selectedCompanyId ?? undefined)
      .then(data => setRows(data.map(ingredientToRow)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyLocations([]);
      return;
    }
    api.locationsConfig()
      .then(locations => {
        setCompanyLocations(
          locations
            .filter(location => location.companyId === selectedCompanyId)
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
  }, [catFilter, grpFilter, search, uomType, resetSort]);

  const filtered = useMemo(() => {
    return rows.filter(row => {
      const matchCat = catFilter === 'All' || row.category === catFilter;
      const matchGrp = grpFilter === 'All' || row.group === grpFilter;
      const q = search.toLowerCase();
      const matchQ = !q
        || (row.name ?? '').toLowerCase().includes(q)
        || (row.componentId ?? '').toLowerCase().includes(q)
        || (row.category ?? '').toLowerCase().includes(q)
        || (row.group ?? '').toLowerCase().includes(q);
      return matchCat && matchGrp && matchQ;
    });
  }, [rows, catFilter, grpFilter, search]);

  const uom = (r: ComponentRow) => uomType === 'recipe' ? fromApiUom(r.recipeUOM) : fromApiUom(r.inventoryUOM);
  const price = (r: ComponentRow) => uomType === 'recipe' ? r.lastPriceRecipe : r.lastPriceInventory;
  const vendorCount = (r: ComponentRow) => countComponentTaggedVendors(r, selectedLocationIds);
  const parStock = (r: ComponentRow) => resolveComponentParStock(r, uomType);

  const sortedFiltered = useMemo(
    () =>
      sortTableRows(
        filtered,
        sortColumn,
        sortDirection,
        {
          componentId: row => row.componentId || '',
          name: row => row.name,
          uom: row => uom(row),
          lastPrice: row => price(row),
          dailyUsage: row => row.dailyUsage,
          orderFreq: row => row.orderFreqDays,
          parStock: row => parStock(row).value,
          storage: row => (Array.isArray(row.storage) ? row.storage : []).join(', '),
          products: row => row.attachedProducts,
          vendors: row => vendorCount(row),
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [filtered, sortColumn, sortDirection, uomType, selectedLocationIds],
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
        setImportError('Template file parsed no valid rows. Use the downloaded Smart Component template format.');
        return;
      }
      const plan = buildSmartComponentImportPlan(drafts, rows, locationScope);
      setImportPlan(plan);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read smart component template.');
    } finally {
      if (templateRef.current) templateRef.current.value = '';
    }
  }

  return (
    <div className={pageShellClass({ spacing: 'loose' })}>
      {!selectedCompanyId && (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3">
          Select a company in the header to add components or assign locations. The list below shows all smart components.
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
        </p>
      )}

      <div className="bg-card border border-border rounded-lg p-2">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect label="Category" value={catFilter} options={getSiCategoryFilterOptions()} onChange={setCatFilter} />
          <FilterSelect label="Group" value={grpFilter} options={getSiGroupFilterOptions()} onChange={setGrpFilter} />
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
        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
            {catFilter !== 'All' && (
              <span className="flex items-center gap-1 text-xs font-sans bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Category: {catFilter} <button onClick={() => setCatFilter('All')}><X size={8} /></button>
              </span>
            )}
            {grpFilter !== 'All' && (
              <span className="flex items-center gap-1 text-xs font-sans bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Group: {grpFilter} <button onClick={() => setGrpFilter('All')}><X size={8} /></button>
              </span>
            )}
            {search && (
              <span className="flex items-center gap-1 text-xs font-sans bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                "{search}" <button onClick={() => setSearch('')}><X size={8} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-sans text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans text-muted-foreground">UOM:</span>
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs font-sans">
            <button onClick={() => setUomType('recipe')}
              className={`px-3 py-1.5 transition-colors ${uomType === 'recipe' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              Component UOM
            </button>
            <button onClick={() => setUomType('inventory')}
              className={`px-3 py-1.5 border-l border-border transition-colors ${uomType === 'inventory' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              Inventory UOM
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <MillstoneLoader size="sm" layout="block" label="Loading ingredients…" />
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
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
                  const par = parStock(row);
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
                    <td className="px-4 py-3 font-sans text-foreground">{uom(row)}</td>
                    {!hidePrices && (
                      <td className="px-4 py-3 font-sans text-foreground">${number(price(row))}</td>
                    )}
                    <td className="px-4 py-3 font-sans text-muted-foreground">
                      {row.dailyUsage > 0 ? `${row.dailyUsage} ${uom(row)}/day` : '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">
                      {row.orderFreqDays >= 90 ? `${row.orderFreqDays}d` : `Every ${row.orderFreqDays}d`}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground text-right">
                      {formatParStock(par.value, par.uom)}
                    </td>
                    <td className="px-4 py-3 ">
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
