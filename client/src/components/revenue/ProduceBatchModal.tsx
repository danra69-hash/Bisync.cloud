import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import type { ProduceBatchShortage } from '../../api';
import { fromApiUom } from '../../data/componentForm';
import { formatCountryNumber } from '../../utils/numberFormat';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import { ColGroup } from '../shared/SortableTableHead';

export type ProduceSubProductOption = {
  id: number;
  name: string;
  productId: string;
  batchUnit: string;
};

export type ProduceConfirmPayload = {
  batchQty: number;
  productionDate: string;
  expiryDate?: string;
  overrideStock?: boolean;
  componentUsages: { componentId: string; usedQty: number }[];
  subProductOutputs: { productId: number; quantity: number }[];
};

type EditableComponent = ProduceBatchShortage & {
  usedQty: number;
  shortageQty: number;
};

type SubOutputLine = {
  key: string;
  productId: number;
  quantity: string;
};

type Props = {
  productName: string;
  batchUnit: string;
  defaultBatchQty: number;
  isSubProduct: boolean;
  /** True when the product being produced is a B2B (parent) product. */
  isB2bProduct?: boolean;
  expiryPeriodDays?: number;
  purpose: 'queue' | 'produce' | 'edit';
  batchNumber?: string | null;
  initialProductionDate?: string | null;
  initialExpiryDate?: string | null;
  saving: boolean;
  error: string | null;
  components?: ProduceBatchShortage[];
  subProductOptions?: ProduceSubProductOption[];
  previewLoading?: boolean;
  onClose: () => void;
  onQtyChange?: (batchQty: number) => void;
  onConfirm: (payload: ProduceConfirmPayload) => void;
};

function todayInputValue(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function addDaysToIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

function formatStockQty(value: number, countryCode: string): string {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  return Number.isInteger(value) && value !== 0 ? String(value) : formatCountryNumber(value, countryCode);
}

function toEditable(lines: ProduceBatchShortage[]): EditableComponent[] {
  const byKey = new Map<string, EditableComponent>();
  for (const line of lines) {
    const key = `${line.componentId}::${line.uom}`;
    const existing = byKey.get(key);
    const requiredQty = (existing?.requiredQty ?? 0) + line.requiredQty;
    const onHandQty = existing ? Math.min(existing.onHandQty, line.onHandQty) : line.onHandQty;
    const shortageQty = Math.max(0, requiredQty - onHandQty);
    byKey.set(key, {
      ...line,
      requiredQty,
      onHandQty,
      shortageQty,
      usedQty: requiredQty,
      isSufficient: onHandQty + 0.0001 >= requiredQty,
    });
  }
  return [...byKey.values()];
}

export function ProduceBatchModal({
  productName,
  batchUnit,
  defaultBatchQty,
  isSubProduct,
  isB2bProduct = !isSubProduct,
  expiryPeriodDays = 0,
  purpose,
  batchNumber = null,
  initialProductionDate = null,
  initialExpiryDate = null,
  saving,
  error,
  components = [],
  subProductOptions = [],
  previewLoading = false,
  onClose,
  onQtyChange,
  onConfirm,
}: Props) {
  const countryCode = useOrgCountryCode();
  const defaultExpiryDays = expiryPeriodDays > 0 ? expiryPeriodDays : 7;
  const [batchQty, setBatchQty] = useState(
    defaultBatchQty > 0 ? String(defaultBatchQty) : '1',
  );
  const [productionDate, setProductionDate] = useState(
    () => initialProductionDate || todayInputValue(),
  );
  const [expiryDate, setExpiryDate] = useState(
    () => initialExpiryDate || addDaysToIso(initialProductionDate || todayInputValue(), defaultExpiryDays),
  );
  const [expiryManuallyEdited, setExpiryManuallyEdited] = useState(purpose === 'edit');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editableComponents, setEditableComponents] = useState<EditableComponent[]>(() => toEditable(components));
  const [subFilter, setSubFilter] = useState('');
  const [subPickId, setSubPickId] = useState('');
  const [subPickQty, setSubPickQty] = useState('1');
  const [subOutputs, setSubOutputs] = useState<SubOutputLine[]>([]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  useEffect(() => {
    if (purpose !== 'produce' || expiryManuallyEdited) return;
    setExpiryDate(addDaysToIso(productionDate, defaultExpiryDays));
  }, [purpose, productionDate, defaultExpiryDays, expiryManuallyEdited]);

  useEffect(() => {
    if (purpose !== 'edit' || expiryManuallyEdited) return;
    setExpiryDate(addDaysToIso(productionDate, defaultExpiryDays));
  }, [purpose, productionDate, defaultExpiryDays, expiryManuallyEdited]);

  useEffect(() => {
    setEditableComponents(prev => {
      const next = toEditable(components);
      if (purpose !== 'produce' && purpose !== 'edit') return next;
      // Preserve user-edited usedQty when the same component returns from preview.
      return next.map(line => {
        const prior = prev.find(p => p.componentId === line.componentId && p.uom === line.uom);
        if (!prior) return line;
        const usedQty = prior.usedQty;
        const shortageQty = Math.max(0, usedQty - line.onHandQty);
        return {
          ...line,
          usedQty,
          shortageQty,
          isSufficient: line.onHandQty + 0.0001 >= usedQty,
        };
      });
    });
  }, [components, purpose]);

  useEffect(() => {
    const qty = Number.parseFloat(batchQty);
    if (!onQtyChange) return;
    if (!Number.isFinite(qty) || qty <= 0) return;
    const t = window.setTimeout(() => onQtyChange(qty), 280);
    return () => window.clearTimeout(t);
  }, [batchQty, onQtyChange]);

  const filteredSubOptions = useMemo(() => {
    const q = subFilter.trim().toLowerCase();
    return subProductOptions.filter(p => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q);
    });
  }, [subProductOptions, subFilter]);

  function handleSubmit(e?: React.FormEvent, overrideStock = false) {
    e?.preventDefault();
    setValidationError(null);

    const qty = Number.parseFloat(batchQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setValidationError('Enter a quantity greater than zero.');
      return;
    }

    if (!productionDate) {
      setValidationError('Select a production date.');
      return;
    }

    const componentUsages = editableComponents.map(line => ({
      componentId: line.componentId,
      usedQty: Number.isFinite(line.usedQty) ? Math.max(0, line.usedQty) : 0,
    }));

    const subProductOutputs = subOutputs
      .map(line => ({
        productId: line.productId,
        quantity: Number.parseFloat(line.quantity),
      }))
      .filter(line => line.productId > 0 && Number.isFinite(line.quantity) && line.quantity > 0);

    if (purpose === 'produce' || purpose === 'edit') {
      if (!expiryDate) {
        setValidationError('Select an expiry date.');
        return;
      }
      if (compareIsoDates(expiryDate, productionDate) < 0) {
        setValidationError('Expiry date must be on or after the production date.');
        return;
      }
      onConfirm({
        batchQty: qty,
        productionDate,
        expiryDate,
        overrideStock,
        componentUsages,
        subProductOutputs: purpose === 'produce' ? subProductOutputs : [],
      });
      return;
    }

    onConfirm({
      batchQty: qty,
      productionDate,
      overrideStock,
      componentUsages,
      subProductOutputs: [],
    });
  }

  function addSubOutput() {
    const id = Number.parseInt(subPickId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      setValidationError('Select a sub-product to add as output.');
      return;
    }
    const qty = Number.parseFloat(subPickQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setValidationError('Enter a sub-product quantity greater than zero.');
      return;
    }
    setValidationError(null);
    setSubOutputs(prev => {
      const existing = prev.find(p => p.productId === id);
      if (existing) {
        const nextQty = (Number.parseFloat(existing.quantity) || 0) + qty;
        return prev.map(p => (p.productId === id ? { ...p, quantity: String(nextQty) } : p));
      }
      return [...prev, { key: `${id}-${Date.now()}`, productId: id, quantity: String(qty) }];
    });
    setSubPickQty('1');
  }

  const displayError = validationError ?? error;
  const hasInsufficientComponents = editableComponents.some(
    line => {
      const need = purpose === 'produce' || purpose === 'edit' ? line.usedQty : line.requiredQty;
      return line.isSufficient === false || line.onHandQty + 0.0001 < need;
    },
  );
  const showComponentTable = editableComponents.length > 0
    && (purpose === 'queue' || purpose === 'produce' || purpose === 'edit');

  const modalTitle = purpose === 'queue'
    ? `To Produce — ${productName}`
    : purpose === 'edit'
      ? `Edit batch — ${productName}`
      : `Produced — ${productName}`;

  const parsedBatchQty = Number.parseFloat(batchQty);
  const b2bOutputQty = Number.isFinite(parsedBatchQty) && parsedBatchQty > 0 ? parsedBatchQty : 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-herme-ink/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="produce-batch-title"
        className="relative w-full max-w-3xl max-h-[var(--app-modal-max-h)] overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sticky top-0 bg-card z-10">
          <h2 id="produce-batch-title" className="text-sm font-semibold">
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded hover:bg-muted disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => handleSubmit(e, false)} noValidate className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {purpose === 'queue'
              ? (isSubProduct
                ? 'Enter how many batches to queue. Stock available and shortages are shown below — you can override if short.'
                : 'Enter how many units to queue. Stock available and shortages are shown below — you can override if short.')
              : purpose === 'edit'
                ? (batchNumber
                  ? `Correct the quantity or dates for batch ${batchNumber}. Inventory is adjusted by the difference.`
                  : 'Correct the quantity or dates for this batch. Inventory is adjusted by the difference.')
                : (isSubProduct
                  ? 'Record what was produced. Edit actual component qty used if it differs from the recipe. Add optional outputs below.'
                  : 'Record what was produced. Edit actual component qty used if needed. B2B output follows quantity; add sub-product output via the filter.')}
          </p>
          {purpose === 'edit' && batchNumber ? (
            <p className="text-[10px] font-mono text-muted-foreground">{batchNumber}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-qty">
                Quantity
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="produce-batch-qty"
                  type="number"
                  min={0.01}
                  step="any"
                  value={batchQty}
                  onChange={e => setBatchQty(e.target.value)}
                  className={`${inlineNumberCls} flex-1`}
                  disabled={saving}
                  autoFocus
                />
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  × {batchUnit}
                </span>
              </div>
            </div>

            {(purpose === 'produce' || purpose === 'edit') ? (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 min-w-[12rem]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Output</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">B2B product QTY</span>
                    <span className="font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                      {isB2bProduct ? formatStockQty(b2bOutputQty, countryCode) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Sub-product QTY</span>
                    <span className="font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                      {isSubProduct
                        ? formatStockQty(b2bOutputQty, countryCode)
                        : formatStockQty(
                          subOutputs.reduce((sum, line) => sum + (Number.parseFloat(line.quantity) || 0), 0),
                          countryCode,
                        )}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {purpose === 'produce' && !isSubProduct ? (
            <div className="space-y-2 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                Sub-product output
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1 min-w-[8rem] flex-1">
                  <label className="text-[10px] text-muted-foreground" htmlFor="sub-filter">Filter</label>
                  <input
                    id="sub-filter"
                    value={subFilter}
                    onChange={e => setSubFilter(e.target.value)}
                    placeholder="Search sub-products…"
                    className={`${filterSelectCls} w-full`}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1 min-w-[12rem] flex-[2]">
                  <label className="text-[10px] text-muted-foreground" htmlFor="sub-pick">Sub-product</label>
                  <select
                    id="sub-pick"
                    value={subPickId}
                    onChange={e => setSubPickId(e.target.value)}
                    className={`${filterSelectCls} w-full`}
                    disabled={saving}
                  >
                    <option value="">Select…</option>
                    {filteredSubOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} ({opt.productId}) · {opt.batchUnit}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 w-24">
                  <label className="text-[10px] text-muted-foreground" htmlFor="sub-qty">QTY</label>
                  <input
                    id="sub-qty"
                    type="number"
                    min={0.01}
                    step="any"
                    value={subPickQty}
                    onChange={e => setSubPickQty(e.target.value)}
                    className={`${inlineNumberCls} w-full`}
                    disabled={saving}
                  />
                </div>
                <button
                  type="button"
                  onClick={addSubOutput}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              {subOutputs.length > 0 ? (
                <ul className="space-y-1 pt-1">
                  {subOutputs.map(line => {
                    const meta = subProductOptions.find(p => p.id === line.productId);
                    return (
                      <li key={line.key} className="flex items-center gap-2 text-xs bg-card/80 rounded border border-border px-2 py-1.5">
                        <span className="flex-1 font-medium truncate">
                          {meta?.name ?? `Product #${line.productId}`}
                          <span className="text-muted-foreground font-mono text-[10px] ml-1">{meta?.productId}</span>
                        </span>
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          value={line.quantity}
                          onChange={e => setSubOutputs(prev => prev.map(p => (p.key === line.key ? { ...p, quantity: e.target.value } : p)))}
                          className={`${inlineNumberCls} w-20`}
                          disabled={saving}
                        />
                        <span className="text-muted-foreground shrink-0">{meta?.batchUnit ?? 'pcs'}</span>
                        <button
                          type="button"
                          className="text-destructive text-[10px] font-semibold hover:underline"
                          onClick={() => setSubOutputs(prev => prev.filter(p => p.key !== line.key))}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[10px] text-muted-foreground">No additional sub-product output yet.</p>
              )}
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-date">
              Production date
            </label>
            <input
              id="produce-batch-date"
              type="date"
              value={productionDate}
              onChange={e => setProductionDate(e.target.value)}
              className={`${filterSelectCls} w-full`}
              disabled={saving}
            />
          </div>

          {purpose === 'produce' || purpose === 'edit' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-expiry">
                Expiry date
              </label>
              <input
                id="produce-batch-expiry"
                type="date"
                value={expiryDate}
                onChange={e => {
                  setExpiryManuallyEdited(true);
                  setExpiryDate(e.target.value);
                }}
                className={`${filterSelectCls} w-full`}
                disabled={saving}
              />
              {expiryPeriodDays > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Defaults to production date + {expiryPeriodDays} day{expiryPeriodDays === 1 ? '' : 's'} from product settings.
                </p>
              ) : null}
            </div>
          ) : null}

          {displayError ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2 whitespace-pre-wrap">
              {displayError}
            </p>
          ) : null}

          {showComponentTable ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {purpose === 'queue' ? 'Stock available to produce' : 'Components used for this production'}
                </p>
                {previewLoading ? (
                  <span className="text-[10px] text-muted-foreground">Updating…</span>
                ) : null}
              </div>
              <div className="border border-border rounded-md overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-[11px] min-w-[32rem]">
                  <ColGroup
                    widths={
                      purpose === 'produce' || purpose === 'edit'
                        ? ['28%', '10%', '12%', '14%', '12%', '12%', '12%']
                        : ['30%', '12%', '14%', '14%', '14%', '16%']
                    }
                  />
                  <thead className="sticky top-0 bg-muted/40">
                    <tr className="text-left">
                      <TableHeaderCell compact>Component</TableHeaderCell>
                      <TableHeaderCell compact>UOM</TableHeaderCell>
                      <TableHeaderCell compact headerAlign="right">
                        {purpose === 'produce' || purpose === 'edit' ? 'Recipe' : 'Required'}
                      </TableHeaderCell>
                      {(purpose === 'produce' || purpose === 'edit') ? (
                        <TableHeaderCell compact headerAlign="right">Actual used</TableHeaderCell>
                      ) : null}
                      <TableHeaderCell compact headerAlign="right">On hand</TableHeaderCell>
                      <TableHeaderCell compact headerAlign="right">Shortage</TableHeaderCell>
                      <TableHeaderCell compact headerAlign="center">Status</TableHeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {editableComponents.map(line => {
                      const need = purpose === 'produce' || purpose === 'edit' ? line.usedQty : line.requiredQty;
                      const shortage = Math.max(0, need - line.onHandQty);
                      const insufficient = line.onHandQty + 0.0001 < need;
                      return (
                        <tr
                          key={`${line.locationExternalId}-${line.componentId}-${line.uom}`}
                          className={`border-t border-border ${insufficient ? 'bg-destructive/5' : 'bg-emerald-50/30 dark:bg-emerald-950/10'}`}
                        >
                          <td className="px-2 py-1.5">
                            <span className="font-medium">{line.componentName || line.componentId}</span>
                            <p className="text-[10px] text-muted-foreground font-mono">{line.componentId}</p>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{fromApiUom(line.uom)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                            {formatStockQty(line.requiredQty, countryCode)}
                          </td>
                          {(purpose === 'produce' || purpose === 'edit') ? (
                            <td className="px-2 py-1.5 text-right">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={Number.isFinite(line.usedQty) ? line.usedQty : 0}
                                onChange={e => {
                                  const next = Number.parseFloat(e.target.value);
                                  setEditableComponents(prev => prev.map(p => {
                                    if (p.componentId !== line.componentId || p.uom !== line.uom) return p;
                                    const usedQty = Number.isFinite(next) ? Math.max(0, next) : 0;
                                    return {
                                      ...p,
                                      usedQty,
                                      shortageQty: Math.max(0, usedQty - p.onHandQty),
                                      isSufficient: p.onHandQty + 0.0001 >= usedQty,
                                    };
                                  }));
                                }}
                                className={`${inlineNumberCls} w-20 ml-auto text-right`}
                                disabled={saving}
                              />
                            </td>
                          ) : null}
                          <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${insufficient ? 'text-destructive' : ''}`}>
                            {formatStockQty(line.onHandQty, countryCode)}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${shortage > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {shortage > 0 ? formatStockQty(shortage, countryCode) : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {insufficient ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200 font-semibold">Short</span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 font-semibold">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {hasInsufficientComponents ? (
                <p className="text-[10px] text-amber-800 dark:text-amber-200 px-1">
                  Some components are short. Use Override to continue anyway (stock may go negative).
                </p>
              ) : null}
            </div>
          ) : previewLoading ? (
            <p className="text-xs text-muted-foreground">Loading component stock…</p>
          ) : purpose === 'queue' || purpose === 'produce' ? (
            <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-2">
              No recipe components for this product — quantity only.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-md border border-border bg-muted/40 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            {hasInsufficientComponents ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit(undefined, true)}
                className="px-3 py-1.5 rounded-md border border-amber-500 bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 shadow-sm"
                title="Continue anyway; component stock may go negative"
              >
                {saving ? 'Saving…' : 'Override'}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50 shadow-sm ${
                purpose === 'queue'
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : purpose === 'edit'
                    ? 'bg-slate-700 text-white hover:bg-slate-800'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {saving
                ? 'Saving…'
                : purpose === 'queue'
                  ? 'Add to queue'
                  : purpose === 'edit'
                    ? 'Save changes'
                    : 'Record production'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
