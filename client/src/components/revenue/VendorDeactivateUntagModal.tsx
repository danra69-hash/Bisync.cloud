import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { api, type Vendor, type VendorTaggedComponent } from '../../api';

type Props = {
  vendor: Vendor;
  companyId: number | null;
  initialTagged: VendorTaggedComponent[];
  onClose: () => void;
  onDeactivated: (vendor: Vendor) => void;
};

export function VendorDeactivateUntagModal({
  vendor,
  companyId,
  initialTagged,
  onClose,
  onDeactivated,
}: Props) {
  const [tagged, setTagged] = useState(initialTagged);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialTagged.map(t => t.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTagged(initialTagged);
    setSelected(new Set(initialTagged.map(t => t.id)));
    setError(null);
  }, [initialTagged, vendor.externalId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  function toggleRow(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function untagSelected() {
    if (selected.size === 0) {
      setError('Select at least one component to untag.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.untagVendorComponents(vendor.externalId, {
        companyId,
        componentIds: [...selected],
      });
      setTagged(result.remaining);
      setSelected(new Set(result.remaining.map(t => t.id)));
      if (result.remaining.length === 0) {
        const updated = await api.setVendorActive(vendor.externalId, false, companyId);
        onDeactivated(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to untag components.');
    } finally {
      setBusy(false);
    }
  }

  async function untagAllAndDeactivate() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.untagVendorComponents(vendor.externalId, { companyId });
      setTagged(result.remaining);
      if (result.remaining.length > 0) {
        setSelected(new Set(result.remaining.map(t => t.id)));
        setError('Some components could not be untagged. Review the list and try again.');
        return;
      }
      const updated = await api.setVendorActive(vendor.externalId, false, companyId);
      onDeactivated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to untag and deactivate vendor.');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-xl bg-background border border-border shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Untag before deactivating</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {vendor.name} still has vendor products tagged on {tagged.length} component{tagged.length === 1 ? '' : 's'}.
              Untag them first, then deactivate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {tagged.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No tagged components remaining.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tagged.map(row => (
                <li key={row.id} className="py-2.5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    disabled={busy}
                    aria-label={`Select ${row.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground font-sans">{row.componentId}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tagged: {row.taggedVendorProductNames.join(', ') || row.taggedVendorProductIds.join(', ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="mx-5 mb-2 text-xs text-red-600 border border-red-300/50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void untagSelected()}
            disabled={busy || selected.size === 0}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted disabled:opacity-40"
          >
            Untag selected
          </button>
          <button
            type="button"
            onClick={() => void untagAllAndDeactivate()}
            disabled={busy || tagged.length === 0}
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Untag all & deactivate'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
