import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Printer, X } from 'lucide-react';
import type { ProductComponentItem } from '../../api';
import { fieldCls } from '../../data/componentForm';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { downloadProductionMethodPdf } from '../../data/generateProductionMethodPdf';
import {
  estimateNutritionalFactors,
  formatNutritionValue,
  loadProductionMethod,
  PRODUCTION_METHOD_IMAGE_COUNT,
  saveProductionMethod,
  type ProductProductionMethod,
} from '../../data/productProductionMethod';
import { MODAL_OVERLAY_CLS } from '../layout/sidePanelShared';
import { tableHeaderCls } from '../shared/tableHeaderStyles';

type Props = {
  category?: string;
  group?: string;
  productName: string;
  productKey: string;
  components: ProductComponentItem[];
  yieldQuantity?: number;
  onClose: () => void;
};

export function ProductionMethodModal({
  category = '',
  group = '',
  productName,
  productKey,
  components,
  yieldQuantity = 1,
  onClose,
}: Props) {
  const { rm, countryCode } = useCountryFormatters();
  const [draft, setDraft] = useState<ProductProductionMethod>(() => loadProductionMethod(productKey));
  const [printing, setPrinting] = useState(false);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setDraft(loadProductionMethod(productKey));
  }, [productKey]);

  const sequencedComponents = useMemo(
    () => components
      .filter(item => item.componentId || item.componentName)
      .map((item, index) => ({ ...item, sequence: index + 1 })),
    [components],
  );

  const nutritionRows = useMemo(
    () => estimateNutritionalFactors(sequencedComponents, draft.methodText, yieldQuantity),
    [sequencedComponents, draft.methodText, yieldQuantity],
  );

  function updateImage(index: number, patch: Partial<ProductProductionMethod['images'][number]>) {
    setDraft(prev => ({
      ...prev,
      images: prev.images.map((image, i) => (i === index ? { ...image, ...patch } : image)),
    }));
  }

  function handleImagePick(index: number, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateImage(index, { dataUrl: typeof reader.result === 'string' ? reader.result : null });
    };
    reader.readAsDataURL(file);
  }

  function save() {
    saveProductionMethod(productKey, draft);
    onClose();
  }

  async function handlePrintPdf() {
    setPrinting(true);
    try {
      await downloadProductionMethodPdf({
        category,
        group,
        productName,
        methodText: draft.methodText,
        images: draft.images,
        components: sequencedComponents,
        nutritionRows,
        yieldQuantity,
        countryCode,
      });
    } finally {
      setPrinting(false);
    }
  }

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={onClose} />
      <div className="fixed inset-4 md:inset-8 z-[121] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Production Method</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Category:</span> {category || '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Group:</span> {group || '—'}
              </p>
              <h2 className="text-base font-semibold text-foreground pt-0.5">{productName}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handlePrintPdf()}
              disabled={printing}
              className="inline-flex items-center gap-1.5 text-xs font-sans border border-border rounded-md px-3 py-2 hover:bg-muted disabled:opacity-50"
            >
              <Printer size={14} />
              {printing ? 'Generating…' : 'Print PDF'}
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-muted text-muted-foreground" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold">Process images</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Add up to seven photos and label each step.</p>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {draft.images.slice(0, PRODUCTION_METHOD_IMAGE_COUNT).map((image, index) => (
                <div key={index} className="min-w-0 rounded-lg border border-border p-1.5 space-y-1 bg-muted/10">
                  <input
                    className={`${fieldCls} text-[10px] px-1.5 py-1`}
                    value={image.label}
                    onChange={e => updateImage(index, { label: e.target.value })}
                    placeholder={`Step ${index + 1}`}
                  />
                  <div className="h-16 rounded-md border border-dashed border-border bg-background flex items-center justify-center overflow-hidden relative">
                    {image.dataUrl ? (
                      <img src={image.dataUrl} alt={image.label || `Process image ${index + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className="inline-flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    )}
                    <input
                      ref={el => { fileInputRefs.current[index] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleImagePick(index, e.target.files?.[0] ?? null)}
                    />
                  </div>
                  {image.dataUrl ? (
                    <div className="flex gap-1 justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => updateImage(index, { dataUrl: null })}
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold">Product Component Detail</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Sequence follows the product BOM order.</p>
            </div>
            {sequencedComponents.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No product components added yet.</p>
            ) : (
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr>
                    {['Seq', 'Smart component', 'UOM', 'Qty', 'UOM price', 'Subtotal'].map(label => (
                      <th key={label} className={tableHeaderCls('left', 'border-b border-border bg-muted/20 px-3 py-2')}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sequencedComponents.map(item => (
                    <tr key={`${item.sequence}-${item.componentId}`} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-sans text-muted-foreground">{item.sequence}</td>
                      <td className="px-3 py-2 font-medium">{item.componentName || item.componentId}</td>
                      <td className="px-3 py-2">{item.componentUom || '—'}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{rm(item.componentUomPrice)}</td>
                      <td className="px-3 py-2 font-medium">{rm(item.subtotal ?? item.componentUomPrice * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="space-y-2">
            <label className="text-xs font-semibold">Production method</label>
            <p className="text-[11px] text-muted-foreground">
              Describe preparation steps, cooking method, timing, and plating instructions.
            </p>
            <textarea
              className={`${fieldCls} min-h-[140px] resize-y`}
              value={draft.methodText}
              onChange={e => setDraft(prev => ({ ...prev, methodText: e.target.value }))}
              placeholder="e.g. 1. Marinate protein for 2 hours. 2. Sear on grill. 3. Rest 5 minutes before plating."
            />
          </section>

          <section className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold">Nutritional factors</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Estimated per serving from components and cooking method{yieldQuantity > 0 ? ` (yield ${yieldQuantity})` : ''}.
              </p>
            </div>
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr>
                  {['Factor', 'Per serving', 'Unit'].map(label => (
                    <th key={label} className={tableHeaderCls('left', 'border-b border-border bg-muted/20 px-3 py-2')}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nutritionRows.map(row => (
                  <tr key={row.factor} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{row.factor}</td>
                    <td className="px-3 py-2">{formatNutritionValue(row.perRecipe, row.unit, countryCode)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90"
          >
            Save production method
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
