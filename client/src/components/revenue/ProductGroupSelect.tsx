import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Trash2 } from 'lucide-react';
import { isDeletableProductGroup } from '../../data/componentCatalogConfig';
import { PICKER_MENU_Z_CLS } from '../layout/sidePanelShared';
import {
  bindPickerOptionActivate,
  eventTargetElement,
  isEventInsideSelector,
} from './pickerMenuEvents';

type Props = {
  value: string;
  options: string[];
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onDeleteRequest: (groupName: string) => void;
};

const MENU_SELECTOR = '[data-product-group-select-menu]';

export function ProductGroupSelect({
  value,
  options,
  disabled = false,
  className = '',
  onChange,
  onDeleteRequest,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }

    function updateMenuPosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
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
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const el = eventTargetElement(event);
      if (!el) return;
      if (rootRef.current?.contains(el)) return;
      if (isEventInsideSelector(event, MENU_SELECTOR)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Select group…'}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>

      {open && menuStyle ? createPortal(
        <div
          data-product-group-select-menu
          className={`fixed ${PICKER_MENU_Z_CLS} rounded-md border border-border bg-card shadow-lg max-h-56 overflow-y-auto`}
          style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No groups available.</p>
          ) : (
            options.map(option => {
              const deletable = isDeletableProductGroup(option);
              return (
                <div
                  key={option}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-muted/40 ${
                    option === value ? 'bg-primary/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left px-1 py-0.5"
                    onPointerDown={event => {
                      bindPickerOptionActivate(event, () => {
                        onChange(option);
                        setOpen(false);
                      });
                    }}
                  >
                    {option}
                  </button>
                  {deletable ? (
                    <button
                      type="button"
                      onPointerDown={e => {
                        bindPickerOptionActivate(e, () => {
                          setOpen(false);
                          onDeleteRequest(option);
                        });
                      }}
                      className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title={`Delete ${option}`}
                      aria-label={`Delete ${option}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
