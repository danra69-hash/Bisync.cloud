import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { Plus } from 'lucide-react';
import { inputCls } from '../../data/componentForm';
import {
  ensureRecipeUnitsExist,
  getKnownRecipeUnits,
  getMyRecipeUnits,
  normalizeRecipeUnitInput,
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

const INITIAL_ALL_UOMS = ['GR', 'KG', 'ML', 'LT', 'Each', 'Slice', 'Can', 'BTL'] as const;

function buildAllUomCodes(): string[] {
  return [...new Set([
    ...INITIAL_ALL_UOMS.map(normalizeRecipeUnitInput),
    ...getKnownRecipeUnits(),
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b));
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

  useEffect(() => {
    const reload = () => {
      setAllUomCodes(buildAllUomCodes());
      setMyUomCodes(getMyRecipeUnits());
    };
    reload();
    window.addEventListener('bisync:componentCatalogChanged', reload);
    return () => window.removeEventListener('bisync:componentCatalogChanged', reload);
  }, [selectedCompanyId]);

  const myUoms = useMemo(() => {
    const selected = new Set(myUomCodes.map(code => code.toLowerCase()));
    // Keep My UOM order stable by All-list order, then any orphans.
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
    if (allUomCodes.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      setAddUomError('This UOM already exists.');
      return;
    }
    ensureRecipeUnitsExist([trimmed], selectedCompanyId);
    setAllUomCodes(prev => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
    // Newly created UOMs are selected into My UOM immediately.
    persistMyUoms([...myUomCodes, trimmed]);
    setNewUomCode('');
    setAddUomError(null);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Click a UOM in All UOM to add it to My UOM. Click a UOM in My UOM to remove it.
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

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold">All UOM</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click a UOM to add it to My UOM</p>
            </div>
            <TableScrollContainer ref={allUomsScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <ColGroup widths={['100%']} />
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={tableHeaderCls('left')}>UOM</th>
                </tr>
              </thead>
              <tbody>
                {allUomsScroll.visibleItems.map(code => {
                  const inMyUom = myUomCodes.some(c => c.toLowerCase() === code.toLowerCase());
                  return (
                    <tr
                      key={code}
                      className={`border-b border-border last:border-0 ${
                        inMyUom ? 'bg-muted/10' : 'hover:bg-muted/20 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (!inMyUom) addToMyUom(code);
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            addToMyUom(code);
                          }}
                          disabled={inMyUom}
                          className={`font-sans font-medium text-left hover:underline ${
                            inMyUom ? 'text-muted-foreground cursor-default' : 'text-primary'
                          }`}
                        >
                          {code}
                          {inMyUom ? ' · added' : ''}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <InfiniteScrollTableSentinel colSpan={1} hasMore={allUomsScroll.hasMore} onLoadMore={allUomsScroll.loadMore} nextPageSize={allUomsScroll.nextPageSize} sentinelRef={allUomsScroll.sentinelRef} totalCount={allUomsScroll.totalCount} visibleCount={allUomsScroll.visibleCount} />
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
