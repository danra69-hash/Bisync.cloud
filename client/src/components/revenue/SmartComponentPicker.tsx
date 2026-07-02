import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { ComponentRow } from '../../data/componentForm';
import { filterComponentsForPicker } from '../../data/productForm';

type Props = {
  components: ComponentRow[];
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (component: ComponentRow | null) => void;
};

export function SmartComponentPicker({
  components,
  value,
  placeholder = 'Search component…',
  disabled = false,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => components.find(c => c.componentId === value) ?? null,
    [components, value],
  );

  const filtered = useMemo(
    () => filterComponentsForPicker(components, query),
    [components, query],
  );

  useEffect(() => {
    if (!open) {
      setQuery(selected ? `${selected.name} (${selected.componentId})` : '');
    }
  }, [open, selected]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative min-w-[12rem]">
      <div className="relative">
        <input
          type="text"
          value={open ? query : (selected ? `${selected.name} (${selected.componentId})` : '')}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery('');
          }}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange(null);
          }}
          className="w-full rounded-md border border-border bg-background pl-2.5 pr-7 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        {selected && !disabled ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery('');
              setOpen(false);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground"
            aria-label="Clear component"
          >
            <X size={12} />
          </button>
        ) : null}
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      {open && !disabled ? (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">No matching components.</p>
          ) : (
            filtered.map(component => (
              <button
                key={component.componentId}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(component);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 ${
                  component.componentId === value ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                <p className="font-medium truncate">{component.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{component.componentId}</p>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
