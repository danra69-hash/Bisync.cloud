import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Product } from '../../api';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';

type Props = {
  groupName: string;
  affectedProducts: Product[];
  groupOptions: string[];
  draftUsesGroup: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reassignTo: string) => void;
};

export function DeleteProductGroupModal({
  groupName,
  affectedProducts,
  groupOptions,
  draftUsesGroup,
  saving,
  error,
  onClose,
  onConfirm,
}: Props) {
  const reassignmentOptions = useMemo(
    () => groupOptions.filter(option => option.toLowerCase() !== groupName.toLowerCase()),
    [groupName, groupOptions],
  );
  const [reassignTo, setReassignTo] = useState(reassignmentOptions[0] ?? '');
  const needsReassignment = affectedProducts.length > 0 || draftUsesGroup;
  const canConfirm = !needsReassignment || Boolean(reassignTo);

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={() => !saving && onClose()} />
      <div className={`${MODAL_SHELL_CLS} w-[min(92vw,32rem)] rounded-lg border border-border bg-card shadow-2xl`}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Delete group</p>
            <h3 className="text-sm font-semibold mt-1">{groupName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {needsReassignment ? (
            <>
              <p className="text-xs text-muted-foreground">
                The following products and sub-products use this group. Reassign them before deleting.
              </p>
              <ul className="rounded-md border border-border divide-y divide-border">
                {affectedProducts.map(product => (
                  <li key={product.id} className="px-3 py-2 text-xs">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {product.productId} · {product.isSubProduct ? 'Sub-Product' : 'Product'}
                    </p>
                  </li>
                ))}
                {draftUsesGroup ? (
                  <li className="px-3 py-2 text-xs">
                    <p className="font-medium">Current unsaved product</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      The product you are editing will be switched to the new group.
                    </p>
                  </li>
                ) : null}
              </ul>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor="reassign-group">
                  Reassign to group
                </label>
                <select
                  id="reassign-group"
                  value={reassignTo}
                  onChange={e => setReassignTo(e.target.value)}
                  disabled={saving || reassignmentOptions.length === 0}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  {reassignmentOptions.length === 0 ? (
                    <option value="">No other groups available</option>
                  ) : (
                    reassignmentOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))
                  )}
                </select>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              No products or sub-products are using this group. It will be removed from the list.
            </p>
          )}

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-xs border border-border rounded-md px-4 py-2 hover:bg-muted/40 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reassignTo)}
            disabled={saving || !canConfirm}
            className="text-xs bg-destructive text-destructive-foreground rounded-md px-4 py-2 hover:bg-destructive/90 disabled:opacity-50"
          >
            {saving ? 'Deleting…' : 'Delete group'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
