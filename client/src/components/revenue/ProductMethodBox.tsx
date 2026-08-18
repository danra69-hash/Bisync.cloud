import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { fieldCls } from '../../data/componentForm';
import {
  loadProductionMethod,
  PRODUCTION_METHOD_IMAGE_COUNT,
  saveProductionMethod,
  type ProductProductionMethod,
} from '../../data/productProductionMethod';

type Props = {
  productKey: string;
  disabled?: boolean;
  /** Called after local save so parents can react (e.g. refresh print data). */
  onSaved?: (data: ProductProductionMethod) => void;
};

export function ProductMethodBox({ productKey, disabled = false, onSaved }: Props) {
  const [draft, setDraft] = useState<ProductProductionMethod>(() => loadProductionMethod(productKey));
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const stepFileRefs = useRef<Array<HTMLInputElement | null>>([]);
  const presentationFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(loadProductionMethod(productKey));
    setDirty(false);
  }, [productKey]);

  function patchDraft(updater: (prev: ProductProductionMethod) => ProductProductionMethod) {
    setDraft(prev => updater(prev));
    setDirty(true);
  }

  function updateImage(index: number, patch: Partial<ProductProductionMethod['images'][number]>) {
    patchDraft(prev => ({
      ...prev,
      images: prev.images.map((image, i) => (i === index ? { ...image, ...patch } : image)),
    }));
  }

  function readFileAsDataUrl(file: File, apply: (dataUrl: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') apply(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    saveProductionMethod(productKey, draft);
    setDirty(false);
    setSavedFlash(true);
    onSaved?.(draft);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Method</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Preparation steps, presentation photo, and up to seven production step photos.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || !dirty || !productKey}
          onClick={handleSave}
          className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted/40 disabled:opacity-50"
        >
          {savedFlash ? 'Saved' : 'Save method'}
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Product presentation photo
          </p>
          <div className="h-28 rounded-md border border-dashed border-border bg-muted/10 flex items-center justify-center overflow-hidden relative">
            {draft.presentationDataUrl ? (
              <img
                src={draft.presentationDataUrl}
                alt="Product presentation"
                className="w-full h-full object-cover"
              />
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => presentationFileRef.current?.click()}
                className="inline-flex flex-col items-center gap-1 text-[11px] text-muted-foreground hover:text-primary disabled:opacity-50"
              >
                <Plus size={16} />
                Add presentation photo
              </button>
            )}
            <input
              ref={presentationFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={e => {
                const file = e.target.files?.[0] ?? null;
                if (!file) return;
                readFileAsDataUrl(file, dataUrl => {
                  patchDraft(prev => ({ ...prev, presentationDataUrl: dataUrl }));
                });
                e.target.value = '';
              }}
            />
          </div>
          {draft.presentationDataUrl ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => presentationFileRef.current?.click()}
                className="text-[10px] text-primary hover:underline disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => patchDraft(prev => ({ ...prev, presentationDataUrl: null }))}
                className="text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Method
          </label>
          <textarea
            className={`${fieldCls} min-h-[120px] resize-y`}
            value={draft.methodText}
            disabled={disabled}
            onChange={e => patchDraft(prev => ({ ...prev, methodText: e.target.value }))}
            placeholder="e.g. 1. Marinate protein for 2 hours. 2. Sear on grill. 3. Rest 5 minutes before plating."
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Production step photos (up to 7)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {draft.images.slice(0, PRODUCTION_METHOD_IMAGE_COUNT).map((image, index) => (
              <div key={index} className="min-w-0 rounded-md border border-border p-1.5 space-y-1 bg-muted/10">
                <input
                  className={`${fieldCls} text-[10px] px-1.5 py-1`}
                  value={image.label}
                  disabled={disabled}
                  onChange={e => updateImage(index, { label: e.target.value })}
                  placeholder={`Step ${index + 1}`}
                />
                <div className="h-14 rounded-md border border-dashed border-border bg-background flex items-center justify-center overflow-hidden relative">
                  {image.dataUrl ? (
                    <img
                      src={image.dataUrl}
                      alt={image.label || `Process image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => stepFileRefs.current[index]?.click()}
                      className="inline-flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  )}
                  <input
                    ref={el => { stepFileRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={disabled}
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) return;
                      readFileAsDataUrl(file, dataUrl => updateImage(index, { dataUrl }));
                      e.target.value = '';
                    }}
                  />
                </div>
                {image.dataUrl ? (
                  <div className="flex gap-1 justify-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => stepFileRefs.current[index]?.click()}
                      className="text-[10px] text-primary hover:underline disabled:opacity-50"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => updateImage(index, { dataUrl: null })}
                      className="text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
