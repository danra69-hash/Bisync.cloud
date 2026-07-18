import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

type Props = {
  value: string;
  options: string[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  emptyLabel?: string;
  onChange: (value: string) => void;
};

export function SearchableSelect({
  value,
  options,
  disabled = false,
  className = '',
  placeholder = 'Select…',
  emptyLabel = 'No matches',
  onChange,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(option => option.toLowerCase().includes(q));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }

    function updateMenuPosition() {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
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
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((target as Element).closest?.(`[data-searchable-select-menu="${listId}"]`)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [listId]);

  function selectOption(option: string) {
    onChange(option);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>

      {open && menuStyle ? createPortal(
        <div
          data-searchable-select-menu={listId}
          className="fixed z-[130] rounded-md border border-border bg-card shadow-lg overflow-hidden"
          style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
        >
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                }
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  selectOption(filtered[0]);
                }
              }}
              placeholder="Type to search…"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-48 overflow-y-auto" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</p>
            ) : (
              filtered.map(option => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/40 ${
                    option === value ? 'bg-primary/10 font-medium' : ''
                  }`}
                  onClick={() => selectOption(option)}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
