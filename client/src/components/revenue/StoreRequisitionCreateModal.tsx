import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Warehouse } from 'lucide-react';
import { api, type CentralStoreConfig, type Ingredient, type Location } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number;
  selectedLocationIds: string[];
  onClose: () => void;
  onCreated: () => void;
};

export function StoreRequisitionCreateModal({
  selectedCompanyId,
  selectedLocationIds,
  onClose,
  onCreated,
}: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  const [config, setConfig] = useState<CentralStoreConfig | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allCompanyLocations, setAllCompanyLocations] = useState<Location[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [qtyByComponent, setQtyByComponent] = useState<Record<string, string>>({});
  const [requesterLocationId, setRequesterLocationId] = useState(selectedLocationIds[0] ?? '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [cfg, locs] = await Promise.all([
          api.centralStoreConfig(selectedCompanyId),
          api.locations(),
        ]);
        if (cancelled) return;
        setConfig(cfg);
        const companyLocs = (Array.isArray(locs) ? locs : []).filter(
          l => l.companyId === selectedCompanyId && l.active !== false,
        );
        setAllCompanyLocations(companyLocs);
        const scoped = selectedLocationIds.length > 0
          ? companyLocs.filter(l => selectedLocationIds.includes(l.externalId))
          : companyLocs;
        const destOptions = scoped.length > 0 ? scoped : companyLocs;
        setLocations(destOptions);
        const dest = selectedLocationIds.find(id => destOptions.some(l => l.externalId === id))
          ?? destOptions[0]?.externalId
          ?? '';
        setRequesterLocationId(dest);

        if (!cfg?.active || !cfg.storeLocationExternalId) {
          setIngredients([]);
          return;
        }
        const rows = await api.ingredients(selectedCompanyId, [cfg.storeLocationExternalId]);
        if (!cancelled) setIngredients(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unable to load store catalog.');
          setIngredients([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCompanyId, selectedLocationIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter(i =>
      i.name.toLowerCase().includes(q)
      || i.componentId.toLowerCase().includes(q)
      || (i.group || '').toLowerCase().includes(q));
  }, [ingredients, search]);

  const lineCount = useMemo(
    () => Object.values(qtyByComponent).filter(v => (parseFloat(v) || 0) > 0).length,
    [qtyByComponent],
  );

  async function submit() {
    if (!config?.active || !config.storeLocationExternalId) {
      setError('Central Store is not active for this company.');
      return;
    }
    if (!requesterLocationId) {
      setError('Select the location receiving the stock.');
      return;
    }
    const lines = ingredients
      .map(ing => {
        const qty = parseFloat(qtyByComponent[ing.componentId] || '');
        if (!Number.isFinite(qty) || qty <= 0) return null;
        return {
          componentId: ing.componentId,
          componentName: ing.name,
          uom: ing.recipeUom || ing.inventoryUom || 'PCU',
          quantity: qty,
        };
      })
      .filter((l): l is NonNullable<typeof l> => Boolean(l));

    if (lines.length === 0) {
      setError('Enter quantity for at least one component.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createOutletStoreRequisition({
        companyId: selectedCompanyId,
        requesterLocationExternalId: requesterLocationId,
        requestedBy: currentUser?.fullName?.trim() || undefined,
        lines,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit store requisition.');
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === 'undefined') return null;

  const storeReady = Boolean(config?.active && config.storeLocationExternalId);
  const storeName = allCompanyLocations.find(l => l.externalId === config?.storeLocationExternalId)?.name
    || config?.storeLocationExternalId
    || '—';

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-xl max-h-[var(--app-modal-max-h)] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Store Requisition"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Warehouse size={18} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Store Requisition</p>
              <h3 className="text-sm font-semibold mt-0.5">Request components from store</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stock stays on the location account — this moves Store → your location after issue and receive.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? <MillstoneLoader label="Loading store catalog…" /> : null}

          {!loading && !storeReady ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              Activate Central Store under Operation → Production → Central Store before creating a store requisition.
            </div>
          ) : null}

          {storeReady ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Store location</p>
                  <p className="mt-1 font-medium">{storeName}</p>
                </div>
                <div>
                  <label htmlFor="sr-dest" className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Receive at location
                  </label>
                  <select
                    id="sr-dest"
                    value={requesterLocationId}
                    onChange={e => setRequesterLocationId(e.target.value)}
                    disabled={saving}
                    className="bisync-filter-select font-sans mt-1 w-full"
                  >
                    {locations.map(loc => (
                      <option key={loc.externalId} value={loc.externalId}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search component…"
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-background"
                  disabled={saving}
                />
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground uppercase text-[10px]">
                      <th className="text-left px-3 py-2 font-normal">Component</th>
                      <th className="text-left px-3 py-2 font-normal">Principal UOM</th>
                      <th className="text-right px-3 py-2 font-normal">UOM price</th>
                      <th className="text-right px-3 py-2 font-normal">Stock on hand</th>
                      <th className="text-right px-3 py-2 font-normal">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                          No components for this store.
                        </td>
                      </tr>
                    ) : (
                      filtered.map(ing => (
                        <tr key={ing.componentId} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium">{ing.name}</p>
                            <p className="text-[10px] font-sans text-muted-foreground">{ing.componentId}</p>
                          </td>
                          <td className="px-3 py-2">{ing.recipeUom || ing.inventoryUom || '—'}</td>
                          <td className="px-3 py-2 text-right font-sans tabular-nums">
                            {ing.lastPriceRecipe > 0 ? rm(ing.lastPriceRecipe) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-sans tabular-nums">
                            {ing.onHandQty != null ? ing.onHandQty : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={qtyByComponent[ing.componentId] ?? ''}
                              onChange={e => setQtyByComponent(prev => ({
                                ...prev,
                                [ing.componentId]: e.target.value,
                              }))}
                              disabled={saving}
                              className="w-20 rounded border border-border bg-background px-1.5 py-1 text-right font-sans"
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {lineCount} component{lineCount === 1 ? '' : 's'} with qty
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !storeReady || lineCount === 0}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit requisition'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
