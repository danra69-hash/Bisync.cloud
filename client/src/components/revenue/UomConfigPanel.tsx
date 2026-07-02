import { useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { Plus } from 'lucide-react';
import { inputCls } from '../../data/componentForm';
import {
  METRIC_FB_CHART,
  METRIC_IMPERIAL_PAIRS,
  exampleText,
  formatFactor,
  type ConversionRow,
} from '../../data/uomConfig';

const thCls = 'text-left px-3 py-2 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal';

const INITIAL_ALL_UOMS = ['GR', 'KG', 'ML', 'LT', 'Each', 'Slice', 'Can', 'BTL'] as const;

type UomRow = { id: number; code: string };

function buildInitialUoms(): UomRow[] {
  return INITIAL_ALL_UOMS.map((code, index) => ({ id: index + 1, code }));
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
    visibleCount,
  } = useInfiniteScrollSlice(rows, { scrollRootRef });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {(showCategory ? ['Scale', 'From', 'To', 'Multiply by', 'Example'] : ['From', 'To', 'Multiply by', 'Example']).map(h => (
                <th key={h} className={thCls}>{h}</th>
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
            <InfiniteScrollTableSentinel colSpan={colSpan} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}

export function UomConfigPanel() {
  const [allUoms, setAllUoms] = useState<UomRow[]>(buildInitialUoms);
  const [myUomIds, setMyUomIds] = useState<number[]>([]);
  const [nextUomId, setNextUomId] = useState(INITIAL_ALL_UOMS.length + 1);
  const [newUomCode, setNewUomCode] = useState('');
  const [addUomError, setAddUomError] = useState<string | null>(null);

  const myUoms = useMemo(
    () => allUoms.filter(u => myUomIds.includes(u.id)),
    [allUoms, myUomIds],
  );

  const metricWeight = METRIC_IMPERIAL_PAIRS.filter(r =>
    ['Gr', 'Kg', 'Tonne', 'Oz', 'Lb'].includes(r.from),
  );
  const metricVolume = METRIC_IMPERIAL_PAIRS.filter(r =>
    ['Ml', 'Ltr', 'FlOz', 'Gal'].includes(r.from),
  );

  const allUomsScrollRef = useRef<HTMLDivElement>(null);
  const myUomsScrollRef = useRef<HTMLDivElement>(null);
  const allUomsScroll = useInfiniteScrollSlice(allUoms, { scrollRootRef: allUomsScrollRef });
  const myUomsScroll = useInfiniteScrollSlice(myUoms, { scrollRootRef: myUomsScrollRef });

  function addToMyUom(id: number) {
    setMyUomIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeFromMyUom(id: number) {
    setMyUomIds(prev => prev.filter(x => x !== id));
  }

  function addUom() {
    const trimmed = newUomCode.trim();
    if (!trimmed) {
      setAddUomError('Enter a UOM code.');
      return;
    }
    if (allUoms.some(u => u.code.toLowerCase() === trimmed.toLowerCase())) {
      setAddUomError('This UOM already exists.');
      return;
    }
    setAllUoms(prev => [...prev, { id: nextUomId, code: trimmed }]);
    setNextUomId(id => id + 1);
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
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={thCls}>UOM</th>
                </tr>
              </thead>
              <tbody>
                {allUomsScroll.visibleItems.map(u => {
                  const inMyUom = myUomIds.includes(u.id);
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => addToMyUom(u.id)}
                          disabled={inMyUom}
                          className={`font-sans font-medium text-left hover:underline ${
                            inMyUom ? 'text-muted-foreground cursor-default' : 'text-primary'
                          }`}
                        >
                          {u.code}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <InfiniteScrollTableSentinel colSpan={1} hasMore={allUomsScroll.hasMore} sentinelRef={allUomsScroll.sentinelRef} totalCount={allUomsScroll.totalCount} visibleCount={allUomsScroll.visibleCount} />
              </tbody>
            </table>
            </TableScrollContainer>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold">My UOM</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click a UOM to remove it from My UOM</p>
            </div>
            <TableScrollContainer ref={myUomsScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={thCls}>UOM</th>
                </tr>
              </thead>
              <tbody>
                {myUomsScroll.visibleItems.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => removeFromMyUom(u.id)}
                        className="font-sans font-medium text-left text-primary hover:underline"
                      >
                        {u.code}
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
                <InfiniteScrollTableSentinel colSpan={1} hasMore={myUomsScroll.hasMore} sentinelRef={myUomsScroll.sentinelRef} totalCount={myUomsScroll.totalCount} visibleCount={myUomsScroll.visibleCount} />
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
