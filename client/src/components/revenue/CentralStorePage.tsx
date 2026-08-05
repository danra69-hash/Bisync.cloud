import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { PackageCheck, Store, X } from 'lucide-react';
import {
  api,
  type CentralStoreConfig,
  type Location,
  type StoreRequisition,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls } from '../layout/formControls';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const labelCls = 'block text-[11px] font-sans uppercase tracking-wide text-muted-foreground mb-1';

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CentralStorePage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { number: formatNumber } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  const [config, setConfig] = useState<CentralStoreConfig | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [requisitions, setRequisitions] = useState<StoreRequisition[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'issued' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeLoc, setStoreLoc] = useState('');
  const [kitchenLoc, setKitchenLoc] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [issuingId, setIssuingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const companyLocations = useMemo(() => {
    if (!selectedCompanyId) return [];
    return locations.filter(l => {
      if (l.active === false) return false;
      return l.companyId == null || l.companyId === selectedCompanyId;
    });
  }, [locations, selectedCompanyId]);

  const locationName = useCallback(
    (externalId: string) => {
      const loc = locations.find(
        l => (l.externalId || '').toLowerCase() === externalId.toLowerCase(),
      );
      return loc?.name || externalId || '—';
    },
    [locations],
  );

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setConfig(null);
      setRequisitions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [cfg, locs, reqs] = await Promise.all([
        api.centralStoreConfig(selectedCompanyId),
        api.locations(),
        api.storeRequisitions(
          selectedCompanyId,
          statusFilter === 'all' ? undefined : statusFilter,
        ),
      ]);
      setConfig(cfg);
      setLocations(locs ?? []);
      setRequisitions(reqs ?? []);
      if (cfg?.storeLocationExternalId) setStoreLoc(cfg.storeLocationExternalId);
      if (cfg?.kitchenLocationExternalId) setKitchenLoc(cfg.kitchenLocationExternalId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Central Store.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function activate() {
    if (!selectedCompanyId) return;
    setSavingConfig(true);
    setError(null);
    try {
      const cfg = await api.activateCentralStore({
        companyId: selectedCompanyId,
        storeLocationExternalId: storeLoc,
        kitchenLocationExternalId: kitchenLoc,
      });
      setConfig(cfg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to activate Central Store.');
    } finally {
      setSavingConfig(false);
    }
  }

  async function deactivate() {
    if (!selectedCompanyId) return;
    setSavingConfig(true);
    setError(null);
    try {
      const cfg = await api.deactivateCentralStore(selectedCompanyId);
      setConfig(cfg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate Central Store.');
    } finally {
      setSavingConfig(false);
    }
  }

  async function issue(id: number) {
    if (!selectedCompanyId) return;
    setIssuingId(id);
    setError(null);
    try {
      await api.issueStoreRequisition(id, {
        companyId: selectedCompanyId,
        issuedBy: currentUser?.fullName || currentUser?.email || undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to issue requisition.');
    } finally {
      setIssuingId(null);
    }
  }

  void selectedLocationIds;

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters opaque className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Central Store</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Purchase and hold components for Production. When activated, To Produce creates a
              store requisition; issuing moves stock into the Production Kitchen hold.
            </p>
          </div>
          {config?.active ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              <Store size={12} />
              Active
            </span>
          ) : (
            <span className="rounded-md bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
              Inactive
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-md border border-border p-3">
          <div>
            <label className={labelCls}>Store location</label>
            <select
              className={filterSelectCls}
              value={storeLoc}
              onChange={e => setStoreLoc(e.target.value)}
              disabled={!selectedCompanyId}
            >
              <option value="">Select store…</option>
              {companyLocations.map(l => (
                <option key={l.externalId} value={l.externalId}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Production kitchen</label>
            <select
              className={filterSelectCls}
              value={kitchenLoc}
              onChange={e => setKitchenLoc(e.target.value)}
              disabled={!selectedCompanyId}
            >
              <option value="">Select kitchen…</option>
              {companyLocations.map(l => (
                <option key={l.externalId} value={l.externalId}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => void activate()}
              disabled={!selectedCompanyId || !storeLoc || !kitchenLoc || savingConfig}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {config?.active ? 'Update & keep active' : 'Activate Central Store'}
            </button>
            {config?.active ? (
              <button
                type="button"
                onClick={() => void deactivate()}
                disabled={savingConfig}
                className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Deactivate
              </button>
            ) : null}
          </div>
        </div>

        {config?.active ? (
          <p className="text-[11px] text-muted-foreground">
            Store inventory at <span className="font-medium text-foreground">{locationName(config.storeLocationExternalId)}</span>
            {' · '}
            Kitchen hold at{' '}
            <span className="font-medium text-foreground">{locationName(config.kitchenLocationExternalId)}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-muted-foreground">Requisitions</label>
          <select
            className={filterSelectCls}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="pending">Pending</option>
            <option value="issued">Issued</option>
            <option value="all">All</option>
          </select>
        </div>
      </PageStickyFilters>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <TableScrollContainer>
        <table className="w-full border-collapse text-xs">
          <ColGroup widths={['14%', '22%', '10%', '18%', '14%', '12%', '10%']} />
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-1.5">Requisition</th>
              <th className="px-2 py-1.5">Product</th>
              <th className="px-2 py-1.5 text-right">Batch qty</th>
              <th className="px-2 py-1.5">Requested</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Lines</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {!selectedCompanyId ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Select a company to manage Central Store.
                </td>
              </tr>
            ) : loading ? (
              <TableLoadingRow colSpan={7} label="Loading requisitions…" />
            ) : requisitions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {config?.active
                    ? 'No requisitions yet. Use To Produce under Production to create one.'
                    : 'Activate Central Store to receive production requisitions.'}
                </td>
              </tr>
            ) : (
              requisitions.map(req => (
                <Fragment key={req.id}>
                  <tr className="border-b border-border/70">
                    <td className="px-2 py-1.5 font-sans font-medium text-foreground">
                      {req.requisitionNumber || `#${req.id}`}
                    </td>
                    <td className="px-2 py-1.5">{req.productName}</td>
                    <td className="px-2 py-1.5 text-right font-sans">{formatNumber(req.batchQty)}</td>
                    <td className="px-2 py-1.5 font-sans">{formatWhen(req.requestedAt)}</td>
                    <td className="px-2 py-1.5 capitalize">{req.status}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                      >
                        {req.lines?.length ?? 0} components
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {req.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void issue(req.id)}
                          disabled={issuingId === req.id || !config?.active}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                        >
                          <PackageCheck size={12} />
                          {issuingId === req.id ? 'Issuing…' : 'Issue'}
                        </button>
                      ) : (
                        <span className="text-muted-foreground font-sans text-[11px]">
                          {formatWhen(req.issuedAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === req.id ? (
                    <tr className="border-b border-border/70 bg-muted/20">
                      <td colSpan={7} className="px-3 py-2">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground text-left">
                              <th className="py-1 pr-2">Component</th>
                              <th className="py-1 pr-2">UOM</th>
                              <th className="py-1 pr-2 text-right">Required</th>
                              <th className="py-1 text-right">Issued</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(req.lines ?? []).map(line => (
                              <tr key={line.id}>
                                <td className="py-0.5 pr-2">{line.componentName}</td>
                                <td className="py-0.5 pr-2">{line.uom}</td>
                                <td className="py-0.5 pr-2 text-right font-sans">
                                  {formatNumber(line.requiredQty)}
                                </td>
                                <td className="py-0.5 text-right font-sans">
                                  {formatNumber(line.issuedQty)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button
                          type="button"
                          className="mt-1 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setExpandedId(null)}
                        >
                          <X size={12} /> Close
                        </button>
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
  );
}
