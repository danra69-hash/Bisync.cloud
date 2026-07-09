import { useState } from 'react';
import { FileUp, X } from 'lucide-react';
import type { VendorProductImportDraft } from '../../data/vendorProductCatalog';
import { inputCls } from '../layout/formControls';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CREATE_VENDOR_CLS,
} from '../layout/sidePanelShared';

export type EditableVendorProductCreate = VendorProductImportDraft & {
  clientKey: string;
};

type Props = {
  creates: VendorProductImportDraft[];
  updateCount: number;
  deactivationCount: number;
  groupOptions: string[];
  onClose: () => void;
  onConfirm: (creates: VendorProductImportDraft[]) => void | Promise<void>;
};

function toEditableCreates(creates: VendorProductImportDraft[]): EditableVendorProductCreate[] {
  return creates.map((draft, index) => ({
    ...draft,
    clientKey: `${draft.vendorProductId || draft.productName || 'row'}-${index}`,
    active: draft.active !== false,
  }));
}

function patchCreate(
  row: EditableVendorProductCreate,
  patch: Partial<VendorProductImportDraft>,
): EditableVendorProductCreate {
  return { ...row, ...patch };
}

export function VendorProductImportNewProductsPanel({
  creates,
  updateCount,
  deactivationCount,
  groupOptions,
  onClose,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState(() => toEditableCreates(creates));
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateRow(clientKey: string, patch: Partial<VendorProductImportDraft>) {
    setRows(prev => prev.map(row => (row.clientKey === clientKey ? patchCreate(row, patch) : row)));
  }

  async function handleConfirm() {
    if (!confirmed) return;
    setSaving(true);
    try {
      await onConfirm(rows.map(({ clientKey: _clientKey, ...draft }) => draft));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Vendor Product Import</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Review New Products</h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Edit new product details before confirming import.
              {updateCount > 0 && ` ${updateCount} update${updateCount !== 1 ? 's' : ''} will also be applied.`}
              {deactivationCount > 0 && ` ${deactivationCount} duplicate${deactivationCount !== 1 ? 's' : ''} will be deactivated.`}
            </p>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-4">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-auto max-h-[62vh]">
              <table className="w-full text-xs min-w-[1200px]">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <TableHeaderCell>Active</TableHeaderCell>
                    <TableHeaderCell>Vendor Product ID</TableHeaderCell>
                    <TableHeaderCell>Product Name</TableHeaderCell>
                    <TableHeaderCell>Group</TableHeaderCell>
                    <TableHeaderCell>Specification</TableHeaderCell>
                    <TableHeaderCell>Delivery Unit</TableHeaderCell>
                    <TableHeaderCell>Price</TableHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.clientKey} className="border-b border-border last:border-b-0 align-top">
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => updateRow(row.clientKey, { active: !row.active })}
                          className={`w-9 h-5 rounded-full relative transition-colors ${row.active ? 'bg-primary' : 'bg-border'}`}
                          title={row.active ? 'Active' : 'Inactive'}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${row.active ? 'left-4' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.vendorProductId ?? ''}
                          onChange={e => updateRow(row.clientKey, { vendorProductId: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.productName}
                          onChange={e => updateRow(row.clientKey, { productName: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          list="vendor-import-group-options"
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.group}
                          onChange={e => updateRow(row.clientKey, { group: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.specification}
                          onChange={e => updateRow(row.clientKey, { specification: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.deliveryUnitText}
                          onChange={e => updateRow(row.clientKey, { deliveryUnitText: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          type="number"
                          step={0.01}
                          value={row.deliveryPrice}
                          onChange={e => updateRow(row.clientKey, { deliveryPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <datalist id="vendor-import-group-options">
            {groupOptions.map(group => (
              <option key={group} value={group} />
            ))}
          </datalist>

          <label className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-lg px-3 py-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have reviewed {rows.length} new product{rows.length !== 1 ? 's' : ''} and confirm importing them to the database.
            </span>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <FileUp size={12} />
              Confirm to apply new products and any pending updates.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => !saving && onClose()}
                className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!confirmed || saving}
                onClick={() => void handleConfirm()}
                className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
