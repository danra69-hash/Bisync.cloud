import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Product } from '../../api';
import {
  collectProductPosUnitRows,
  isPosDeliveryUnitSelected,
  parsePosDeliveryUnits,
  togglePosDeliveryUnit,
  type PosDeliveryUnitSelection,
} from '../../data/productPosUnits';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  product: Product;
  catalogProducts: Product[];
  saving?: boolean;
  onSave: (units: PosDeliveryUnitSelection[]) => void;
  onClose: () => void;
};

export function ProductPosUnitsModal({
  product,
  catalogProducts,
  saving = false,
  onSave,
  onClose,
}: Props) {
  const { number, cogsPercent } = useCountryFormatters();
  const rows = useMemo(
    () => collectProductPosUnitRows(product, catalogProducts),
    [product, catalogProducts],
  );
  const [selected, setSelected] = useState<PosDeliveryUnitSelection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = parsePosDeliveryUnits(product);
    if (existing.length > 0) {
      setSelected(existing);
      return;
    }
    if (rows.length === 1) {
      setSelected([{ unitKey: rows[0].unitKey }]);
      return;
    }
    setSelected([]);
  }, [product, rows]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  function handleSave() {
    if (selected.length === 0) {
      setError('Select at least one packaging variation for POS.');
      return;
    }
    setError(null);
    onSave(selected);
  }

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={saving ? undefined : onClose} role="presentation" aria-hidden />
      <div
        className={`${MODAL_SHELL_CLS} w-[min(96vw,760px)] max-h-[92vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">POS Packaging</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose which packaging variations are sold at POS. Sorted smallest to largest.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sellable packaging variations found for this product.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <TableHeaderCell>Use</TableHeaderCell>
                  <TableHeaderCell>Delivery Unit</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">COGS</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">COGS %</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="checkbox"
                        checked={isPosDeliveryUnitSelected(selected, row.unitKey)}
                        disabled={saving}
                        onChange={() => setSelected(prev => togglePosDeliveryUnit(prev, row.unitKey))}
                        aria-label={`POS ${row.unitTitle}`}
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <p className="font-medium">{row.unitTitle}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{row.deliveryPath}</p>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums align-top">
                      {row.rrp > 0 ? number(row.rrp) : '—'}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums align-top">
                      {number(row.unitCogs)}
                    </td>
                    <td className="py-2 text-right tabular-nums align-top">
                      {row.rrp > 0 ? cogsPercent(row.unitCogs, row.rrp) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {error ? <p className="text-xs text-destructive mt-3">{error}</p> : null}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="px-3 py-1.5 text-xs rounded-md border border-border disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || rows.length === 0}
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : product.posEnabled ? 'Save POS' : 'Enable POS'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
