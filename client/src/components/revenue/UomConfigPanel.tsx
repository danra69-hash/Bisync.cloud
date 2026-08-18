import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../api';
import { fromApiUom, inputCls } from '../../data/componentForm';
import {
  ensureRecipeUnitsExist,
  getKnownRecipeUnits,
  getMyRecipeUnits,
  isBuiltinRecipeUnit,
  isManageableRecipeUnit,
  loadComponentCatalogForCompany,
  normalizeRecipeUnitInput,
  removeRecipeUnit,
  renameRecipeUnit,
  sanitizeRecipeUnitsCatalog,
  saveMyRecipeUnits,
} from '../../data/componentCatalogConfig';
import {
  METRIC_FB_CHART,
  METRIC_IMPERIAL_PAIRS,
  exampleText,
  formatFactor,
  type ConversionRow,
} from '../../data/uomConfig';
import { tableHeaderCls } from '../shared/tableHeaderStyles';
import { ColGroup } from '../shared/SortableTableHead';

function buildAllUomCodes(): string[] {
  return getKnownRecipeUnits();
}

function summarizeUomRemap(total: number, counts: Record<string, number>): string {
  if (total <= 0) return '';
  const parts: string[] = [];
  const push = (key: string, label: string) => {
    const n = counts[key] ?? 0;
    if (n > 0) parts.push(`${n} ${label}`);
  };
  push('ingredients', 'component(s)');
  push('products', 'product(s)');
  push('vendorProducts', 'vendor product(s)');
  push('orderTemplateItems', 'order template line(s)');
  push('purchaseOrderItems', 'PO line(s)');
  push('inventoryPurchases', 'stock lot(s)');
  push('inventoryMovements', 'stock movement(s)');
  const named = new Set([
    'ingredients', 'products', 'vendorProducts', 'orderTemplateItems',
    'purchaseOrderItems', 'inventoryPurchases', 'inventoryMovements',
  ]);
  const otherTotal = Object.entries(counts)
    .filter(([key]) => !named.has(key))
    .reduce((sum, [, n]) => sum + (n || 0), 0);
  if (otherTotal > 0) parts.push(`${otherTotal} other`);
  return parts.length > 0 ? parts.join(', ') : `${total} record(s)`;
}

function ConversionTable({ title, description, rows, showCategory = false }: {
  title: string;
  description: string;
  rows: ConversionRow[];
  showCategory?: boolean;
}) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const colSpan = showCategory ? 5 : 4;
  const {
    visibleItems: pagedRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(rows, { scrollRootRef });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full text-xs">
          <ColGroup
            widths={
              showCategory
                ? ['14%', '18%', '18%', '20%', '30%']
                : ['22%', '22%', '22%', '34%']
            }
          />
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {(showCategory ? ['Scale', 'From', 'To', 'Multiply by', 'Example'] : ['From', 'To', 'Multiply by', 'Example']).map(h => (
                <th key={h} className={tableHeaderCls('left')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, i) => (
              <tr key={`${row.from}-${row.to}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/20">
                {showCategory && (
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-sans">{row.category}</span>
                  </td>
                )}
                <td className="px-3 py-2.5 font-medium">{row.fromLabel}</td>
                <td className="px-3 py-2.5 font-medium">{row.toLabel}</td>
                <td className="px-3 py-2.5 font-sans text-foreground">{formatFactor(row.factor)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{exampleText(row)}</td>
              </tr>
            ))}
            <InfiniteScrollTableSentinel colSpan={colSpan} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}

export function UomConfigPanel({ selectedCompanyId }: { selectedCompanyId?: number | null }) {
  const [allUomCodes, setAllUomCodes] = useState<string[]>(buildAllUomCodes);
  const [myUomCodes, setMyUomCodes] = useState<string[]>(() => getMyRecipeUnits());
  const [newUomCode, setNewUomCode] = useState('');
  const [addUomError, setAddUomError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busyCode, setBusyCode] = useState<string | null>(null);

  function reloadLists() {
    setAllUomCodes(buildAllUomCodes());
    setMyUomCodes(getMyRecipeUnits());
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (selectedCompanyId) {
        try {
          await loadComponentCatalogForCompany(selectedCompanyId);
        } catch {
          // Fall through with cached/empty catalog.
        }
      }
      sanitizeRecipeUnitsCatalog(selectedCompanyId);
      if (selectedCompanyId) {
        try {
          const ingredients = await api.ingredients(selectedCompanyId);
          const used = ingredients.flatMap(i => [
            fromApiUom(i.recipeUom),
            fromApiUom(i.inventoryUom),
            fromApiUom(i.parStockUom ?? ''),
          ]);
          ensureRecipeUnitsExist(used, selectedCompanyId);
        } catch {
          // Catalog-only mode if ingredients fail to load.
        }
      }
      if (!cancelled) reloadLists();
    }
    void boot();
    const onChange = () => reloadLists();
    window.addEventListener('bisync:componentCatalogChanged', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener('bisync:componentCatalogChanged', onChange);
    };
  }, [selectedCompanyId]);

  const myUoms = useMemo(() => {
    const selected = new Set(myUomCodes.map(code => code.toLowerCase()));
    const ordered = allUomCodes.filter(code => selected.has(code.toLowerCase()));
    const orphans = myUomCodes.filter(
      code => !allUomCodes.some(all => all.toLowerCase() === code.toLowerCase()),
    );
    return [...ordered, ...orphans];
  }, [allUomCodes, myUomCodes]);

  const metricWeight = METRIC_IMPERIAL_PAIRS.filter(r =>
    ['Gr', 'Kg', 'Tonne', 'Oz', 'Lb'].includes(r.from),
  );
  const metricVolume = METRIC_IMPERIAL_PAIRS.filter(r =>
    ['Ml', 'Ltr', 'FlOz', 'Gal'].includes(r.from),
  );

  const allUomsScrollRef = useRef<HTMLDivElement>(null);
  const myUomsScrollRef = useRef<HTMLDivElement>(null);
  const allUomsScroll = useInfiniteScrollSlice(allUomCodes, { scrollRootRef: allUomsScrollRef });
  const myUomsScroll = useInfiniteScrollSlice(myUoms, { scrollRootRef: myUomsScrollRef });

  function persistMyUoms(next: string[]) {
    const normalized = [...new Set(next.map(normalizeRecipeUnitInput).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    setMyUomCodes(normalized);
    saveMyRecipeUnits(normalized, selectedCompanyId);
  }

  function addToMyUom(code: string) {
    const normalized = normalizeRecipeUnitInput(code);
    if (!normalized) return;
    if (myUomCodes.some(c => c.toLowerCase() === normalized.toLowerCase())) return;
    persistMyUoms([...myUomCodes, normalized]);
  }

  function removeFromMyUom(code: string) {
    persistMyUoms(myUomCodes.filter(c => c.toLowerCase() !== code.toLowerCase()));
  }

  function addUom() {
    const trimmed = normalizeRecipeUnitInput(newUomCode);
    if (!trimmed) {
      setAddUomError('Enter a UOM code.');
      return;
    }
    const existing = allUomCodes.find(u => u.toLowerCase() === trimmed.toLowerCase());
    const code = existing ?? trimmed;
    if (myUomCodes.some(c => c.toLowerCase() === code.toLowerCase())) {
      setAddUomError(
        existing && existing !== trimmed
          ? `“${trimmed}” matches “${existing}”, which is already in My UOM.`
          : `“${code}” is already in My UOM.`,
      );
      return;
    }
    if (!existing) {
      ensureRecipeUnitsExist([trimmed], selectedCompanyId);
      reloadLists();
    }
    persistMyUoms([...myUomCodes, code]);
    setNewUomCode('');
    setAddUomError(null);
    setActionInfo(
      existing
        ? `“${code}” is already in All UOM — added to My UOM.`
        : `Added “${trimmed}”.`,
    );
  }

  function startEdit(code: string) {
    if (!isManageableRecipeUnit(code)) {
      setActionError('This UOM cannot be edited.');
      return;
    }
    setEditingCode(code);
    setEditDraft(code);
    setActionError(null);
    setActionInfo(null);
  }

  async function saveEdit(original: string) {
    setBusyCode(original);
    setActionError(null);
    setActionInfo(null);
    try {
      const result = await renameRecipeUnit(original, editDraft, selectedCompanyId);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      let remapSummary = '';
      if (selectedCompanyId) {
        const remapped = await api.renameCompanyUom(selectedCompanyId, result.from, result.to);
        remapSummary = summarizeUomRemap(remapped.total, remapped.counts);
      }
      reloadLists();
      setEditingCode(null);
      setEditDraft('');
      setActionInfo(
        remapSummary
          ? `Renamed “${result.from}” → “${result.to}” and updated ${remapSummary}.`
          : `Renamed “${result.from}” → “${result.to}”.`,
      );
    } catch (e) {
      reloadLists();
      setActionError(e instanceof Error ? e.message : 'Could not rename UOM.');
    } finally {
      setBusyCode(null);
    }
  }

  async function deleteUom(code: string) {
    if (!isManageableRecipeUnit(code)) {
      setActionError('This UOM cannot be removed.');
      return;
    }
    const builtin = isBuiltinRecipeUnit(code);
    const confirmed = window.confirm(
      builtin
        ? `Hide built-in UOM “${code}” from All UOM for this company?\n\nConversion charts still keep it for reference. You can add it again later if needed.`
        : `Delete UOM “${code}” from All UOM?\n\nComponents still using this UOM will keep the old value until you edit them (or rename first).`,
    );
    if (!confirmed) return;
    setBusyCode(code);
    setActionError(null);
    try {
      const result = removeRecipeUnit(code, selectedCompanyId);
      reloadLists();
      setActionInfo(
        result.mode === 'hidden'
          ? `Hidden “${code}” from All UOM.`
          : `Deleted “${code}” from All UOM.`,
      );
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Click a UOM name in All UOM to add it to My UOM. Use Edit to rename any UOM, or Delete to
            remove a custom UOM / hide a built-in UOM for this company.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">New UOM</label>
              <input
                className={`${inputCls} w-32`}
                value={newUomCode}
                onChange={e => {
                  setNewUomCode(e.target.value);
                  setAddUomError(null);
                }}
                onKeyDown={e => e.key === 'Enter' && addUom()}
                placeholder="e.g. Punnet"
              />
            </div>
            <button
              type="button"
              onClick={addUom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus size={11} /> Add UOM
            </button>
          </div>
        </div>
        {addUomError && <p className="text-xs text-red-500">{addUomError}</p>}
        {actionError && <p className="text-xs text-red-500">{actionError}</p>}
        {actionInfo && <p className="text-xs text-emerald-700">{actionInfo}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold">All UOM</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click name to add to My UOM · Edit / Delete available for every row
              </p>
            </div>
            <TableScrollContainer ref={allUomsScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <ColGroup widths={['70%', '30%']} />
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeaderCls('left')}>UOM</th>
                  <th className={tableHeaderCls('right')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUomsScroll.visibleItems.map(code => {
                  const inMyUom = myUomCodes.some(c => c.toLowerCase() === code.toLowerCase());
                  const manageable = isManageableRecipeUnit(code);
                  const editing = editingCode === code;
                  return (
                    <tr
                      key={code}
                      className={`border-b border-border last:border-0 ${
                        inMyUom ? 'bg-muted/10' : 'hover:bg-muted/20'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        {editing ? (
                          <input
                            className={`${inputCls} w-full max-w-[12rem]`}
                            value={editDraft}
                            autoFocus
                            onChange={e => setEditDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') void saveEdit(code);
                              if (e.key === 'Escape') {
                                setEditingCode(null);
                                setEditDraft('');
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToMyUom(code)}
                            disabled={inMyUom}
                            className={`font-sans font-medium text-left hover:underline ${
                              inMyUom ? 'text-muted-foreground cursor-default' : 'text-primary'
                            }`}
                          >
                            {code}
                            {inMyUom ? ' · added' : ''}
                            {isBuiltinRecipeUnit(code) ? '' : ' · custom'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {editing ? (
                            <>
                              <button
                                type="button"
                                title="Save"
                                disabled={busyCode === code}
                                onClick={() => void saveEdit(code)}
                                className="p-1 rounded text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                title="Cancel"
                                onClick={() => {
                                  setEditingCode(null);
                                  setEditDraft('');
                                }}
                                className="p-1 rounded text-muted-foreground hover:bg-muted"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="Edit UOM name"
                                disabled={!manageable || busyCode === code}
                                onClick={() => startEdit(code)}
                                className="p-1 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title={isBuiltinRecipeUnit(code) ? 'Hide built-in UOM' : 'Delete UOM'}
                                disabled={!manageable || busyCode === code}
                                onClick={() => void deleteUom(code)}
                                className="p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <InfiniteScrollTableSentinel colSpan={2} hasMore={allUomsScroll.hasMore} onLoadMore={allUomsScroll.loadMore} nextPageSize={allUomsScroll.nextPageSize} sentinelRef={allUomsScroll.sentinelRef} totalCount={allUomsScroll.totalCount} visibleCount={allUomsScroll.visibleCount} />
              </tbody>
            </table>
            </TableScrollContainer>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold">My UOM ({myUoms.length})</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click a UOM to remove it from My UOM</p>
            </div>
            <TableScrollContainer ref={myUomsScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <ColGroup widths={['100%']} />
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeaderCls('left')}>UOM</th>
                </tr>
              </thead>
              <tbody>
                {myUomsScroll.visibleItems.map(code => (
                  <tr
                    key={code}
                    className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                    onClick={() => removeFromMyUom(code)}
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          removeFromMyUom(code);
                        }}
                        className="font-sans font-medium text-left text-primary hover:underline"
                      >
                        {code}
                      </button>
                    </td>
                  </tr>
                ))}
                {myUoms.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground">
                      No UOM selected. Click a UOM on the left to add it here.
                    </td>
                  </tr>
                )}
                <InfiniteScrollTableSentinel colSpan={1} hasMore={myUomsScroll.hasMore} onLoadMore={myUomsScroll.loadMore} nextPageSize={myUomsScroll.nextPageSize} sentinelRef={myUomsScroll.sentinelRef} totalCount={myUomsScroll.totalCount} visibleCount={myUomsScroll.visibleCount} />
              </tbody>
            </table>
            </TableScrollContainer>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Reference conversion charts used for auto-fill in Smart Component alternate UOM fields.
      </p>

      <ConversionTable
        title="Metric Scale — Food & Beverage"
        description="Mass (mg → g → kg → tonne) and volume (ml → cl → L) conversions"
        rows={METRIC_FB_CHART}
        showCategory
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ConversionTable
          title="Metric ↔ Imperial — Weight"
          description="Mass conversions between metric and imperial units"
          rows={metricWeight}
        />
        <ConversionTable
          title="Metric ↔ Imperial — Volume"
          description="Liquid volume conversions between metric and imperial units"
          rows={metricVolume}
        />
      </div>
    </div>
  );
}
