import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, type StoreRequisition } from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
};

type Bucket = 'to_issue' | 'issued' | 'received';

const BOXES: { id: Bucket; label: string; empty: string; hint: string }[] = [
  {
    id: 'to_issue',
    label: 'To Issue',
    empty: 'No pending store requisitions.',
    hint: 'Store confirms issue — stock stays at store until receive.',
  },
  {
    id: 'issued',
    label: 'Issued',
    empty: 'No issued requisitions awaiting receive.',
    hint: 'Requester confirms receiving to move stock Store → location.',
  },
  {
    id: 'received',
    label: 'Received',
    empty: 'No received store requisitions.',
    hint: 'Completed — stock location updated on the Stock Card.',
  },
];

function bucketOf(row: StoreRequisition): Bucket | null {
  const s = (row.status || '').toLowerCase();
  if (s === 'pending') return 'to_issue';
  if (s === 'issued') return 'issued';
  if (s === 'received') return 'received';
  return null;
}

function statusLabel(row: StoreRequisition): string {
  const s = (row.status || '').toLowerCase();
  if (s === 'pending') return 'Pending issue';
  if (s === 'issued') return 'Issued · await receive';
  if (s === 'received') return 'Received';
  if (s === 'cancelled') return 'Cancelled';
  return row.status || '—';
}

export function ActiveRequisitionPage({
  selectedCompanyId,
  selectedLocationIds,
  embedded = false,
}: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  const actorName = currentUser?.fullName?.trim() || 'User';
  const [rows, setRows] = useState<StoreRequisition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>('to_issue');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locationNames, setLocationNames] = useState<Map<string, string>>(() => new Map());

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.storeRequisitions(selectedCompanyId, undefined, 'outlet');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load store requisitions.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLocationNames(new Map());
      return;
    }
    let cancelled = false;
    void api.locations().then(locs => {
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const loc of Array.isArray(locs) ? locs : []) {
        if (loc.companyId != null && loc.companyId !== selectedCompanyId) continue;
        map.set(loc.externalId, loc.name);
      }
      setLocationNames(map);
    }).catch(() => {
      if (!cancelled) setLocationNames(new Map());
    });
    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  const scoped = useMemo(() => {
    if (selectedLocationIds.length === 0) return rows;
    return rows.filter(r =>
      selectedLocationIds.includes(r.kitchenLocationExternalId)
      || selectedLocationIds.includes(r.storeLocationExternalId));
  }, [rows, selectedLocationIds]);

  const bucketed = useMemo(() => {
    const map: Record<Bucket, StoreRequisition[]> = {
      to_issue: [],
      issued: [],
      received: [],
    };
    for (const row of scoped) {
      const b = bucketOf(row);
      if (b) map[b].push(row);
    }
    return map;
  }, [scoped]);

  const list = selectedBucket ? bucketed[selectedBucket] : [];
  const selected = useMemo(
    () => scoped.find(r => r.id === selectedId) ?? null,
    [scoped, selectedId],
  );

  async function handleIssue(row: StoreRequisition) {
    if (!selectedCompanyId) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      const updated = await api.issueStoreRequisition(row.id, {
        companyId: selectedCompanyId,
        issuedBy: actorName,
      });
      setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setSelectedId(updated.id);
      setSelectedBucket('issued');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to confirm issue.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReceive(row: StoreRequisition) {
    if (!selectedCompanyId) return;
    setBusyId(row.id);
    setActionError(null);
    try {
      const updated = await api.receiveStoreRequisition(row.id, {
        companyId: selectedCompanyId,
        receivedBy: actorName,
      });
      setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setSelectedId(updated.id);
      setSelectedBucket('received');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to confirm receive.');
    } finally {
      setBusyId(null);
    }
  }

  const locName = (id: string) => locationNames.get(id) || id || '—';

  return (
    <div className={pageShellClass({ embedded })}>
      <PageStickyFilters opaque className="py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Outlet store requisitions — store issues components; requester confirms receive to move stock.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </PageStickyFilters>

      {!selectedCompanyId ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Select a company to view store requisitions.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {actionError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BOXES.map(box => {
          const count = bucketed[box.id].length;
          const selectedBox = selectedBucket === box.id;
          return (
            <button
              key={box.id}
              type="button"
              onClick={() => setSelectedBucket(prev => (prev === box.id ? null : box.id))}
              aria-pressed={selectedBox}
              className={`rounded-lg border bg-card p-4 text-left transition-colors ${
                selectedBox
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              }`}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{box.label}</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{loading ? '…' : count}</p>
            </button>
          );
        })}
      </div>

      {selectedBucket ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 min-h-0">
          <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold">{BOXES.find(b => b.id === selectedBucket)?.label}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {BOXES.find(b => b.id === selectedBucket)?.hint}
              </p>
            </div>
            <ul className="divide-y divide-border max-h-[min(50vh,28rem)] overflow-y-auto">
              {loading && list.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</li>
              ) : list.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground text-center">
                  {BOXES.find(b => b.id === selectedBucket)?.empty}
                </li>
              ) : (
                list.map(row => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/30 ${
                        selectedId === row.id ? 'bg-primary/5' : ''
                      }`}
                    >
                      <p className="text-sm font-semibold text-primary">{row.requisitionNumber}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {locName(row.storeLocationExternalId)}
                        {' → '}
                        {locName(row.kitchenLocationExternalId)}
                        {' · '}
                        {row.lines.length} line{row.lines.length === 1 ? '' : 's'}
                      </p>
                      <p className="text-[10px] mt-1">{statusLabel(row)}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4 space-y-3 min-h-[12rem]">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a requisition to view lines and actions.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{selected.requisitionNumber}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Store {locName(selected.storeLocationExternalId)}
                      {' → '}
                      {locName(selected.kitchenLocationExternalId)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Requested by {selected.requestedBy || '—'}
                      {selected.issuedBy ? ` · Issued by ${selected.issuedBy}` : ''}
                      {selected.receivedBy ? ` · Received by ${selected.receivedBy}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.canIssue ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void handleIssue(selected)}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                      >
                        {busyId === selected.id ? 'Issuing…' : 'Confirm issued'}
                      </button>
                    ) : null}
                    {selected.canReceive ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void handleReceive(selected)}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                      >
                        {busyId === selected.id ? 'Receiving…' : 'Confirm receive'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-muted-foreground uppercase text-[10px]">
                        <th className="text-left px-3 py-2 font-normal">Component</th>
                        <th className="text-left px-3 py-2 font-normal">PCU</th>
                        <th className="text-right px-3 py-2 font-normal">Qty</th>
                        <th className="text-right px-3 py-2 font-normal">UOM price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lines.map(line => (
                        <tr key={line.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{line.componentName}</p>
                            <p className="text-[10px] text-muted-foreground font-sans">{line.componentId}</p>
                          </td>
                          <td className="px-3 py-2">{line.uom || '—'}</td>
                          <td className="px-3 py-2 text-right font-sans tabular-nums">
                            {line.issuedQty > 0 ? line.issuedQty : line.requiredQty}
                          </td>
                          <td className="px-3 py-2 text-right font-sans tabular-nums">
                            {line.unitPrice > 0 ? rm(line.unitPrice) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          Select a box above to view store requisitions.
        </p>
      )}
    </div>
  );
}
