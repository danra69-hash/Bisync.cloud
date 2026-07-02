import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { Search, X } from 'lucide-react';
import { api, type Ingredient } from '../../api';
import { siCategories, siGroups } from '../../data/revenueManagement';
import { blankComponentRow, fromApiUom, resolveDetailConfigForRow, resolveDetailConfigJsonForSave, type ComponentRow } from '../../data/componentForm';
import { ComponentEditPanel } from './ComponentEditPanel';
import { ingredientToRow, mergeSavedRow } from './smartIngredientShared';

function rowToIngredient(row: ComponentRow, partial: Partial<ComponentRow>) {
  const merged = { ...row, ...partial };
  const detailConfig = resolveDetailConfigForRow(merged);
  const detailConfigJson = resolveDetailConfigJsonForSave(row, partial);
  return {
    id: merged.id ?? 0,
    componentId: merged.componentId,
    name: merged.name,
    category: merged.category,
    group: merged.group,
    recipeUom: merged.recipeUOM,
    inventoryUom: merged.inventoryUOM,
    lastPriceRecipe: merged.lastPriceRecipe,
    lastPriceInventory: merged.lastPriceInventory,
    dailyUsage: merged.dailyUsage,
    orderFreqDays: merged.orderFreqDays,
    storageJson: JSON.stringify(merged.storage),
    storageNote: merged.storageNote ?? '',
    detailConfigJson,
    attachedProducts: merged.attachedProducts,
    attachedVendors: detailConfig.taggedVendorProductIds.length || merged.attachedVendors,
    active: merged.active,
    locationsJson: JSON.stringify(merged.locations),
  } satisfies Ingredient;
}

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

export function SmartIngredientPage({ selectedCompanyId }: { selectedCompanyId: number | null }) {
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [catFilter, setCatFilter] = useState('All');
  const [grpFilter, setGrpFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [uomType, setUomType] = useState<'recipe' | 'inventory'>('recipe');
  const [editRow, setEditRow] = useState<ComponentRow | null>(null);
  const [isNewRow, setIsNewRow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompanyId) {
      setRows([]);
      setLoading(false);
      setEditRow(null);
      setIsNewRow(false);
      setSaveError(null);
      return;
    }

    setLoading(true);
    api.ingredients()
      .then(data => setRows(data.map(ingredientToRow)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  const filtered = useMemo(() => {
    return rows.filter(row => {
      const matchCat = catFilter === 'All' || row.category === catFilter;
      const matchGrp = grpFilter === 'All' || row.group === grpFilter;
      const q = search.toLowerCase();
      const matchQ = !q
        || row.name.toLowerCase().includes(q)
        || row.componentId.toLowerCase().includes(q)
        || row.category.toLowerCase().includes(q)
        || row.group.toLowerCase().includes(q);
      return matchCat && matchGrp && matchQ;
    });
  }, [rows, catFilter, grpFilter, search]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedFiltered,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(filtered, { scrollRootRef });

  const hasFilters = catFilter !== 'All' || grpFilter !== 'All' || !!search;

  function openAdd() {
    setSaveError(null);
    setIsNewRow(true);
    setEditRow({ ...blankComponentRow });
  }

  async function handleSave(updated: Partial<ComponentRow>) {
    if (!editRow) return;
    setSaveError(null);
    if (isNewRow) {
      const newRow = { ...blankComponentRow, ...updated } as ComponentRow;
      try {
        const created = await api.createIngredient(rowToIngredient(newRow, {}));
        setRows(prev => [mergeSavedRow(created, newRow), ...prev]);
        setIsNewRow(false);
        setEditRow(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save component.');
      }
    } else if (editRow.id) {
      const merged = { ...editRow, ...updated };
      try {
        const saved = await api.updateIngredient(editRow.id, rowToIngredient(merged, {}));
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
    const updated = { ...row, active: !row.active };
    try {
      const saved = await api.updateIngredient(row.id, rowToIngredient({ ...row, active: !row.active }, {}));
      setRows(prev => prev.map(r => r.id === row.id ? mergeSavedRow(saved, row) : r));
    } catch {
      setRows(prev => prev.map(r => r.id === row.id ? updated : r));
    }
  }

  const uom = (r: ComponentRow) => uomType === 'recipe' ? fromApiUom(r.recipeUOM) : fromApiUom(r.inventoryUOM);
  const price = (r: ComponentRow) => uomType === 'recipe' ? r.lastPriceRecipe : r.lastPriceInventory;

  return (
    <div className={pageShellClass({ spacing: 'loose' })}>
      {selectedCompanyId && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-sans">{filtered.length} of {rows.length} items</p>
          <button onClick={openAdd} className="text-xs font-sans bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            + Add Component
          </button>
        </div>
      )}

      {selectedCompanyId && (
        <>
      <div className="bg-card border border-border rounded-lg p-2">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect label="Category" value={catFilter} options={siCategories} onChange={setCatFilter} />
          <FilterSelect label="Group" value={grpFilter} options={siGroups} onChange={setGrpFilter} />
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
          <p className="p-8 text-center text-xs text-muted-foreground">Loading ingredients…</p>
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Component ID', 'Component Name', 'UOM', 'Last UOM Price', 'Daily Usage', 'Order Freq (days)', 'Storage', 'Products', 'Vendors', 'Active'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-sans text-muted-foreground uppercase tracking-wider font-normal truncate">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-xs text-muted-foreground font-sans">
                      No items match the selected filters.
                    </td>
                  </tr>
                ) : pagedFiltered.map(row => (
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
                    <td className="px-4 py-3 font-sans text-foreground">${price(row).toFixed(uomType === 'recipe' && price(row) < 1 ? 4 : 2)}</td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">
                      {row.dailyUsage > 0 ? `${row.dailyUsage} ${uom(row)}/day` : '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">
                      {row.orderFreqDays >= 90 ? `${row.orderFreqDays}d` : `Every ${row.orderFreqDays}d`}
                    </td>
                    <td className="px-4 py-3 ">
                      <div className="flex flex-col gap-1">
                        {row.storage.map((s, si) => (
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
                      {row.attachedVendors > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-sans font-semibold">{row.attachedVendors}</span>
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
                ))}
                <InfiniteScrollTableSentinel colSpan={10} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>

      {editRow && selectedCompanyId && (
        <ComponentEditPanel
          row={editRow}
          isNew={isNewRow}
          existingComponents={rows}
          selectedCompanyId={selectedCompanyId}
          saveError={saveError}
          onClose={() => { setEditRow(null); setIsNewRow(false); setSaveError(null); }}
          onSave={handleSave}
        />
      )}
        </>
      )}
    </div>
  );
}
