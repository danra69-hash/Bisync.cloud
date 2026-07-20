import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, Pencil, RefreshCw, X } from 'lucide-react';
import {
  devConsoleApi,
  type CompanySubscriptionLocation,
  type CompanySubscriptionPanel,
  type DevUsageResponse,
} from '../../data/devConsoleApi';
import { MillstoneLoader } from '../shared/MillstoneLoader';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function statusTone(status?: string, locked?: boolean): string {
  if (locked || status === 'locked') return 'text-destructive';
  if (status === 'subscribed' || status === 'renewed') return 'text-emerald-700 dark:text-emerald-400';
  return 'text-amber-800 dark:text-amber-300';
}

type LocActionMode = 'idle' | 'extend' | 'activate';

type LocDraft = {
  mode: LocActionMode;
  months: number;
  commencementDate: string;
  paymentMethod: 'check' | 'bank-transfer';
  paymentReference: string;
  bankName: string;
};

function emptyDraft(): LocDraft {
  return {
    mode: 'idle',
    months: 1,
    commencementDate: toDateInputValue(new Date().toISOString()),
    paymentMethod: 'check',
    paymentReference: '',
    bankName: '',
  };
}

function EditStatusPanel({
  companyId,
  onClose,
  onChanged,
}: {
  companyId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<CompanySubscriptionPanel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LocDraft>>({});

  async function loadPanel() {
    setLoading(true);
    setError(null);
    try {
      const data = await devConsoleApi.companySubscriptionPanel(companyId);
      setPanel(data);
      setDrafts(prev => {
        const next = { ...prev };
        for (const loc of data.locations) {
          if (!next[loc.locationExternalId]) next[loc.locationExternalId] = emptyDraft();
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription panel');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPanel();
  }, [companyId]);

  function setDraft(key: string, patch: Partial<LocDraft>) {
    setDrafts(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? emptyDraft()), ...patch },
    }));
  }

  async function extendTrial(loc: CompanySubscriptionLocation) {
    const draft = drafts[loc.locationExternalId] ?? emptyDraft();
    setBusyKey(loc.locationExternalId);
    setError(null);
    try {
      const res = await devConsoleApi.extendFreeTrial({
        companyId,
        locationExternalId: loc.locationExternalId,
        months: draft.months,
      });
      if (res.panel) setPanel(res.panel);
      else await loadPanel();
      setDraft(loc.locationExternalId, { mode: 'idle' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extend free trial');
    } finally {
      setBusyKey(null);
    }
  }

  async function activateYear(loc: CompanySubscriptionLocation) {
    const draft = drafts[loc.locationExternalId] ?? emptyDraft();
    if (!draft.commencementDate) {
      setError('Select the subscription commencement date.');
      return;
    }
    if (!draft.paymentReference.trim()) {
      setError(
        draft.paymentMethod === 'check'
          ? 'Check number is required.'
          : 'Bank transaction detail is required.',
      );
      return;
    }
    if (draft.paymentMethod === 'bank-transfer' && !draft.bankName.trim()) {
      setError('Bank name is required for bank transfer.');
      return;
    }

    setBusyKey(loc.locationExternalId);
    setError(null);
    try {
      const res = await devConsoleApi.activateYearSubscription({
        companyId,
        locationExternalId: loc.locationExternalId,
        commencementDate: draft.commencementDate,
        paymentMethod: draft.paymentMethod,
        paymentReference: draft.paymentReference.trim(),
        bankName: draft.paymentMethod === 'bank-transfer' ? draft.bankName.trim() : null,
      });
      if (res.panel) setPanel(res.panel);
      else await loadPanel();
      setDraft(loc.locationExternalId, { mode: 'idle', paymentReference: '', bankName: '' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate subscription');
    } finally {
      setBusyKey(null);
    }
  }

  const inputCls =
    'mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring';
  const labelCls = 'text-[10px] font-sans uppercase tracking-wider text-muted-foreground';

  return createPortal(
    <div className="fixed inset-0 z-[105] flex items-stretch justify-end">
      <div
        className="absolute inset-0 bg-foreground/10"
        onClick={() => !busyKey && onClose()}
        aria-hidden
      />
      <div
        className="relative z-[1] h-full w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">
              Edit status
            </p>
            <h3 className="text-sm font-semibold">{panel?.companyName ?? 'Company'}</h3>
            {panel?.registeredAt ? (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Registered {formatDate(panel.registeredAt)}
                {panel.companyLocked ? ' · Company locked' : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!busyKey}
            className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          {loading && !panel ? (
            <MillstoneLoader size="sm" layout="block" label="Loading locations…" />
          ) : (
            (panel?.locations ?? []).map(loc => {
              const draft = drafts[loc.locationExternalId] ?? emptyDraft();
              const busy = busyKey === loc.locationExternalId;
              const canExtend =
                loc.status === 'free-trial' || loc.status === 'locked' || loc.locked;
              const canActivate = true;

              return (
                <div
                  key={loc.locationExternalId}
                  className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">{loc.locationName}</p>
                      <p className={`text-[11px] mt-0.5 ${statusTone(loc.status, loc.locked)}`}>
                        {loc.statusLabel}
                        {loc.locked ? ' · Locked' : ''}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Status {formatDate(loc.statusDate)} · Expires {formatDate(loc.expiryDate)}
                      </p>
                    </div>
                  </div>

                  {draft.mode === 'idle' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {canExtend && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDraft(loc.locationExternalId, { mode: 'extend' })}
                          className="text-[11px] border border-border rounded-md px-2.5 py-1 hover:bg-muted disabled:opacity-50"
                        >
                          Extend free trial
                        </button>
                      )}
                      {canActivate && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDraft(loc.locationExternalId, { mode: 'activate' })}
                          className="text-[11px] border border-border rounded-md px-2.5 py-1 hover:bg-muted disabled:opacity-50"
                        >
                          Activate year subscription
                        </button>
                      )}
                    </div>
                  )}

                  {draft.mode === 'extend' && (
                    <form
                      className="space-y-2 pt-1 border-t border-border/60"
                      onSubmit={e => {
                        e.preventDefault();
                        void extendTrial(loc);
                      }}
                    >
                      <div>
                        <label className={labelCls}>Extend by (months)</label>
                        <input
                          type="number"
                          min={1}
                          max={36}
                          className={inputCls}
                          value={draft.months}
                          onChange={e =>
                            setDraft(loc.locationExternalId, {
                              months: Math.min(36, Math.max(1, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy}
                          className="text-[11px] rounded-md px-2.5 py-1.5 bg-primary text-primary-foreground disabled:opacity-50"
                        >
                          {busy ? 'Saving…' : 'Apply extension'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDraft(loc.locationExternalId, { mode: 'idle' })}
                          className="text-[11px] border border-border rounded-md px-2.5 py-1.5 hover:bg-muted disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {draft.mode === 'activate' && (
                    <form
                      className="space-y-2 pt-1 border-t border-border/60"
                      onSubmit={e => {
                        e.preventDefault();
                        void activateYear(loc);
                      }}
                    >
                      <div>
                        <label className={labelCls}>Commencement date *</label>
                        <input
                          type="date"
                          required
                          className={inputCls}
                          value={draft.commencementDate}
                          onChange={e =>
                            setDraft(loc.locationExternalId, { commencementDate: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Payment method *</label>
                        <select
                          className={inputCls}
                          value={draft.paymentMethod}
                          onChange={e =>
                            setDraft(loc.locationExternalId, {
                              paymentMethod: e.target.value as 'check' | 'bank-transfer',
                              paymentReference: '',
                              bankName: '',
                            })
                          }
                        >
                          <option value="check">Check</option>
                          <option value="bank-transfer">Bank transfer</option>
                        </select>
                      </div>
                      {draft.paymentMethod === 'check' ? (
                        <div>
                          <label className={labelCls}>Check number *</label>
                          <input
                            className={inputCls}
                            value={draft.paymentReference}
                            onChange={e =>
                              setDraft(loc.locationExternalId, {
                                paymentReference: e.target.value,
                              })
                            }
                            placeholder="Check #"
                            required
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className={labelCls}>Bank name *</label>
                            <input
                              className={inputCls}
                              value={draft.bankName}
                              onChange={e =>
                                setDraft(loc.locationExternalId, { bankName: e.target.value })
                              }
                              placeholder="Bank name"
                              required
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Bank transaction detail *</label>
                            <input
                              className={inputCls}
                              value={draft.paymentReference}
                              onChange={e =>
                                setDraft(loc.locationExternalId, {
                                  paymentReference: e.target.value,
                                })
                              }
                              placeholder="Transaction / reference #"
                              required
                            />
                          </div>
                        </>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy}
                          className="text-[11px] rounded-md px-2.5 py-1.5 bg-primary text-primary-foreground disabled:opacity-50"
                        >
                          {busy ? 'Saving…' : 'Activate 1-year plan'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDraft(loc.locationExternalId, { mode: 'idle' })}
                          className="text-[11px] border border-border rounded-md px-2.5 py-1.5 hover:bg-muted disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })
          )}

          {!loading && (panel?.locations.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">No locations for this company.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TenantRollupsPanel() {
  const [data, setData] = useState<DevUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await devConsoleApi.rollups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rollups');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setData(await devConsoleApi.refreshRollups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh rollups');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = data?.byLocation ?? [];
  const busy = loading || refreshing;
  const lockedCount = rows.filter(r => r.locked || r.status === 'locked').length;
  const trialCount = rows.filter(r => r.status === 'free-trial').length;
  const paidCount = rows.filter(r => r.status === 'subscribed' || r.status === 'renewed').length;

  // Merge consecutive same-company rows into one Company cell (rowSpan).
  const companyRowSpanByIndex = new Map<number, number>();
  for (let i = 0; i < rows.length; ) {
    const key = rows[i].companyId ?? `name:${rows[i].companyName ?? ''}`;
    let end = i + 1;
    while (
      end < rows.length
      && (rows[end].companyId ?? `name:${rows[end].companyName ?? ''}`) === key
    ) {
      end += 1;
    }
    companyRowSpanByIndex.set(i, end - i);
    i = end;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Database size={14} className="text-muted-foreground" />
            Tenant rollups
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trial and subscription status by company location.
            {data?.generatedAt ? (
              <> Last generated {new Date(data.generatedAt).toLocaleString()}.</>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={12} />
          Refresh rollup
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}

      {data && (data.errors?.length ?? 0) > 0 && (
        <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-1">
          <p className="font-medium">Rollup status: {data.status ?? 'partial'}</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.errors!.slice(0, 8).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && !data ? (
        <MillstoneLoader size="sm" layout="block" label="Loading tenant rollups…" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Registered date</th>
                <th className="px-3 py-2 font-medium">Current status</th>
                <th className="px-3 py-2 font-medium">Status date</th>
                <th className="px-3 py-2 font-medium">Expiry date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No locations in rollup yet. Refresh to fan out tenant databases.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const companyRowSpan = companyRowSpanByIndex.get(idx);
                  const isCompanyGroupStart = companyRowSpan != null;
                  const endsGroup =
                    idx === rows.length - 1 || companyRowSpanByIndex.has(idx + 1);
                  return (
                    <tr
                      key={`${row.companyId ?? 'x'}:${row.locationExternalId}`}
                      className={endsGroup ? 'border-b border-border' : 'border-b border-border/40'}
                    >
                      {isCompanyGroupStart ? (
                        <td
                          className="px-3 py-2 align-middle border-r border-border/60 bg-muted/20"
                          rowSpan={companyRowSpan}
                        >
                          <div className="flex flex-col gap-1.5 items-start min-h-full justify-center">
                            <span className="font-medium">{row.companyName || '—'}</span>
                            {row.companyId != null ? (
                              <button
                                type="button"
                                onClick={() => setEditCompanyId(row.companyId)}
                                className="inline-flex items-center gap-1 text-[11px] border border-border rounded-md px-2 py-1 hover:bg-muted bg-card"
                              >
                                <Pencil size={11} />
                                Edit status
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 align-top">
                        {row.locationName || row.locationExternalId || '—'}
                      </td>
                      <td className="px-3 py-2 align-top font-sans tabular-nums">
                        {formatDate(row.registeredAt)}
                      </td>
                      <td className={`px-3 py-2 align-top ${statusTone(row.status, row.locked)}`}>
                        {row.statusLabel
                          ?? (row.yearsRenewed && row.yearsRenewed > 0
                            ? `Renewed (${row.yearsRenewed}y)`
                            : row.status ?? '—')}
                      </td>
                      <td className="px-3 py-2 align-top font-sans tabular-nums">
                        {formatDate(row.statusDate)}
                      </td>
                      <td className="px-3 py-2 align-top font-sans tabular-nums">
                        {formatDate(row.expiryDate ?? row.renewalDate)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {data && (
            <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>Locations: {rows.length}</span>
              <span>Free trial: {trialCount}</span>
              <span>Subscribed / renewed: {paidCount}</span>
              <span>Locked: {lockedCount}</span>
              <span>Tenants: {data.tenantCount ?? '—'}</span>
              <span>Status: {data.status ?? 'ok'}</span>
            </div>
          )}
        </div>
      )}

      {editCompanyId != null && (
        <EditStatusPanel
          companyId={editCompanyId}
          onClose={() => setEditCompanyId(null)}
          onChanged={() => {
            void refresh();
          }}
        />
      )}
    </section>
  );
}
