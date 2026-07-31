import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import type { Product } from '../../api';
import type { ComponentRow } from '../../data/componentForm';
import { filterComponentsForPicker, filterSubProductsForPicker, formatSubProductBatchPackageUnit } from '../../data/productForm';
import { PICKER_MENU_Z_CLS } from '../layout/sidePanelShared';
import { eventTargetElement, isEventInsideSelector } from './pickerMenuEvents';

type Props = {
  components: ComponentRow[];
  subProducts?: Product[];
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onComponentSelect: (component: ComponentRow | null) => void;
  onSubProductSelect?: (product: Product | null) => void;
};

const MENU_SELECTOR = '[data-product-component-picker-menu]';

export function ProductComponentPicker({
  components,
  subProducts = [],
  value,
  placeholder = 'Search component or sub-product…',
  disabled = false,
  onComponentSelect,
  onSubProductSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedComponent = useMemo(
    () => components.find(component => component.componentId === value) ?? null,
    [components, value],
  );

  const selectedSubProduct = useMemo(
    () => subProducts.find(product => product.productId === value) ?? null,
    [subProducts, value],
  );

  const filteredComponents = useMemo(
    () => filterComponentsForPicker(components, query),
    [components, query],
  );

  const filteredSubProducts = useMemo(
    () => filterSubProductsForPicker(subProducts, query),
    [subProducts, query],
  );

  const selectedLabel = selectedSubProduct
    ? `${selectedSubProduct.name} (${selectedSubProduct.productId})`
    : selectedComponent
      ? `${selectedComponent.name} (${selectedComponent.componentId})`
      : '';

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [open, selectedLabel]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }

    function updateMenuPosition() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, query, filteredComponents.length, filteredSubProducts.length]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const el = eventTargetElement(event);
      if (!el) return;
      if (rootRef.current?.contains(el)) return;
      if (isEventInsideSelector(event, MENU_SELECTOR)) return;
      setOpen(false);
    }
    // Capture phase so outside-close does not race option selection.
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  function clearSelection(options?: { keepOpen?: boolean }) {
    if (selectedSubProduct) {
      onSubProductSelect?.(null);
    } else {
      onComponentSelect(null);
    }
    setQuery('');
    if (options?.keepOpen) {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setOpen(false);
  }

  function selectComponent(component: ComponentRow) {
    onComponentSelect(component);
    setOpen(false);
  }

  function selectSubProduct(product: Product) {
    onSubProductSelect?.(product);
    setOpen(false);
  }

  const hasResults = filteredComponents.length > 0 || filteredSubProducts.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-[12rem]">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery('');
          }}
          onChange={e => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            // Clear selection when emptied, but keep the filter menu open for typing.
            if (!next.trim()) clearSelection({ keepOpen: true });
          }}
          className="w-full rounded-md border border-border bg-background pl-2.5 pr-7 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        {value && !disabled ? (
          <button
            type="button"
            onClick={() => clearSelection({ keepOpen: true })}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground"
            aria-label="Clear selection"
          >
            <X size={12} />
          </button>
        ) : null}
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      {open && !disabled && menuStyle
        ? createPortal(
            <div
              data-product-component-picker-menu
              className={`fixed ${PICKER_MENU_Z_CLS} max-h-56 overflow-y-auto rounded-md border border-border bg-card shadow-lg`}
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            >
              {!hasResults ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">No matching components or sub-products.</p>
              ) : (
                <>
                  {filteredSubProducts.length > 0 ? (
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30 border-b border-border">
                        Sub-products
                      </p>
                      {filteredSubProducts.map(product => (
                        <button
                          key={product.productId}
                          type="button"
                          onMouseDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            selectSubProduct(product);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 ${
                            product.productId === value ? 'bg-primary/10 text-primary' : ''
                          }`}
                        >
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {product.productId} · {formatSubProductBatchPackageUnit(product)}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {filteredComponents.length > 0 ? (
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30 border-b border-border">
                        Smart components
                      </p>
                      {filteredComponents.map(component => (
                        <button
                          key={component.componentId}
                          type="button"
                          onMouseDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            selectComponent(component);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 ${
                            component.componentId === value ? 'bg-primary/10 text-primary' : ''
                          }`}
                        >
                          <p className="font-medium truncate">{component.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{component.componentId}</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
