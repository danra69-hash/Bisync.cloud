import { useState } from 'react';
import { FileUp, X } from 'lucide-react';
import type { SmartComponentImportDraft } from '../../data/smartComponentCatalog';
import { prepareImportDraftForSave } from '../../data/smartComponentCatalog';
import { componentParStockUomOptions } from '../../data/componentParStock';
import { inputCls } from '../layout/formControls';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import {
  SIDE_PANEL_OVERLAY_CLS,
  SIDE_PANEL_SHELL_CREATE_VENDOR_CLS,
} from '../layout/sidePanelShared';

export type EditableImportCreate = SmartComponentImportDraft & {
  clientKey: string;
};

type Props = {
  creates: SmartComponentImportDraft[];
  updateCount: number;
  deactivationCount: number;
  onClose: () => void;
  onConfirm: (creates: SmartComponentImportDraft[]) => void | Promise<void>;
};

function toEditableCreates(creates: SmartComponentImportDraft[]): EditableImportCreate[] {
  return creates.map((draft, index) => ({
    ...draft,
    clientKey: `${draft.componentId || draft.name || 'row'}-${index}`,
    active: draft.active !== false,
  }));
}

function patchCreate(
  row: EditableImportCreate,
  patch: Partial<SmartComponentImportDraft> & {
    altRecipeUnit1?: string;
    altRecipeConversion1?: string;
    altInventoryUnit1?: string;
    altInventoryConversion1?: string;
    principalInventoryConversion?: string;
    templateParStock?: number;
    parStockUom?: string;
    storageText?: string;
  },
): EditableImportCreate {
  const next: EditableImportCreate = { ...row, ...patch };

  if (patch.altRecipeUnit1 !== undefined || patch.altRecipeConversion1 !== undefined) {
    const unit = patch.altRecipeUnit1 ?? row.altRecipeUnits[0]?.unit ?? '';
    const conversion = patch.altRecipeConversion1 ?? row.altRecipeUnits[0]?.qty ?? '';
    next.altRecipeUnits = unit.trim()
      ? [{ unit, fromQty: '1', qty: conversion }]
      : [];
  }

  if (patch.altInventoryUnit1 !== undefined || patch.altInventoryConversion1 !== undefined) {
    const unit = patch.altInventoryUnit1 ?? row.altInventoryUnits[0]?.unit ?? '';
    const conversion = patch.altInventoryConversion1 ?? row.altInventoryUnits[0]?.qty ?? '';
    next.altInventoryUnits = unit.trim()
      ? [{ unit, fromQty: '1', qty: conversion }]
      : [];
  }

  if (patch.storageText !== undefined) {
    next.storage = patch.storageText.split(/[;|]/).map(value => value.trim()).filter(Boolean);
  }

  if (patch.principalInventoryConversion !== undefined) {
    const conv = patch.principalInventoryConversion.trim();
    if (!conv) {
      next.convertFromInventoryQty = '1';
      next.convertToRecipeQty = '1';
    } else if (conv.includes('=')) {
      const [left, right] = conv.split('=').map(part => part.trim());
      next.convertFromInventoryQty = left || '1';
      next.convertToRecipeQty = right || '1';
    } else {
      next.convertFromInventoryQty = '1';
      next.convertToRecipeQty = conv;
    }
  }

  if (patch.templateParStock !== undefined || patch.parStockUom !== undefined) {
    next.templateParStock = patch.templateParStock ?? row.templateParStock;
    next.parStockUom = patch.parStockUom ?? row.parStockUom;
  }

  return next;
}

export function SmartComponentImportNewComponentsPanel({
  creates,
  updateCount,
  deactivationCount,
  onClose,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState(() => toEditableCreates(creates));
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateRow(clientKey: string, patch: Parameters<typeof patchCreate>[1]) {
    setRows(prev => prev.map(row => (row.clientKey === clientKey ? patchCreate(row, patch) : row)));
  }

  async function handleConfirm() {
    if (!confirmed) return;
    setSaving(true);
    try {
      await onConfirm(rows.map(({ clientKey: _clientKey, ...draft }) => prepareImportDraftForSave(draft)));
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
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Smart Component Import</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Review New Components</h3>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              Edit new component details before confirming import.
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
              <table className="w-full text-xs min-w-[1400px]">
                <thead className="bg-muted/40 sticky top-0 z-10">
                  <tr className="border-b border-border">
                    <TableHeaderCell>Active</TableHeaderCell>
                    <TableHeaderCell>Component ID</TableHeaderCell>
                    <TableHeaderCell>Category</TableHeaderCell>
                    <TableHeaderCell>Group</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Principal Component</TableHeaderCell>
                    <TableHeaderCell>Unit Alternate Component Unit 1</TableHeaderCell>
                    <TableHeaderCell>Conversion 1</TableHeaderCell>
                    <TableHeaderCell>Principal Inventory Unit</TableHeaderCell>
                    <TableHeaderCell>Principal inventory Conversion</TableHeaderCell>
                    <TableHeaderCell>Alt Inventory 1</TableHeaderCell>
                    <TableHeaderCell>Inv Conversion 1</TableHeaderCell>
                    <TableHeaderCell>Par Stock</TableHeaderCell>
                    <TableHeaderCell>Par Stock UOM</TableHeaderCell>
                    <TableHeaderCell>Area</TableHeaderCell>
                    <TableHeaderCell>Storage</TableHeaderCell>
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
                          value={row.componentId}
                          onChange={e => updateRow(row.clientKey, { componentId: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.category}
                          onChange={e => updateRow(row.clientKey, { category: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.group}
                          onChange={e => updateRow(row.clientKey, { group: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.name}
                          onChange={e => updateRow(row.clientKey, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.recipeUom}
                          onChange={e => updateRow(row.clientKey, { recipeUom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.altRecipeUnits[0]?.unit ?? ''}
                          onChange={e => updateRow(row.clientKey, { altRecipeUnit1: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.altRecipeUnits[0]?.qty ?? ''}
                          onChange={e => updateRow(row.clientKey, { altRecipeConversion1: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.inventoryUom}
                          onChange={e => updateRow(row.clientKey, { inventoryUom: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.convertToRecipeQty === '1' ? '' : (row.convertFromInventoryQty === '1' ? row.convertToRecipeQty : `${row.convertFromInventoryQty} = ${row.convertToRecipeQty}`)}
                          onChange={e => updateRow(row.clientKey, { principalInventoryConversion: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.altInventoryUnits[0]?.unit ?? ''}
                          onChange={e => updateRow(row.clientKey, { altInventoryUnit1: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.altInventoryUnits[0]?.qty ?? ''}
                          onChange={e => updateRow(row.clientKey, { altInventoryConversion1: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.templateParStock !== undefined ? String(row.templateParStock) : ''}
                          onChange={e => updateRow(row.clientKey, {
                            templateParStock: parseFloat(e.target.value) || 0,
                          })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.parStockUom ?? ''}
                          onChange={e => updateRow(row.clientKey, { parStockUom: e.target.value })}
                        >
                          <option value="">—</option>
                          {componentParStockUomOptions({
                            recipeUom: row.recipeUom,
                            inventoryUom: row.inventoryUom,
                            altRecipeUnits: row.altRecipeUnits,
                            altInventoryUnits: row.altInventoryUnits,
                          }, row.parStockUom).map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.area}
                          onChange={e => updateRow(row.clientKey, { area: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={`${inputCls} !text-xs !min-h-7`}
                          value={row.storage.join('; ')}
                          onChange={e => updateRow(row.clientKey, { storageText: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground border border-border rounded-lg px-3 py-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have reviewed {rows.length} new component{rows.length !== 1 ? 's' : ''} and confirm importing them to the database.
            </span>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <FileUp size={12} />
              Adjust values inline, then confirm to write to the database.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || !confirmed || rows.length === 0}
                className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
