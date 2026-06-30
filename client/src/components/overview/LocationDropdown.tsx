import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, X } from 'lucide-react';
import type { DropdownLocation } from '../../utils/orgFilters';

type Props = {
  locations: DropdownLocation[];
  selected: string[];
  onChange: (externalIds: string[]) => void;
  variant?: 'default' | 'header';
  disabled?: boolean;
  loading?: boolean;
};

export function LocationDropdown({ locations, selected, onChange, variant = 'default', disabled = false, loading = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const allIds = locations.map(l => l.externalId);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));

  function toggleAll() {
    if (disabled) return;
    onChange(allSelected ? [] : allIds);
  }

  function toggleLocation(externalId: string) {
    if (disabled) return;
    if (selected.includes(externalId)) {
      onChange(selected.filter(id => id !== externalId));
    } else {
      onChange([...selected, externalId]);
    }
  }

  function isChecked(externalId: string) {
    return selected.includes(externalId);
  }

  const label = disabled
    ? 'Select Company First'
    : loading
      ? 'Loading locations…'
      : selected.length === 0
        ? 'Select locations'
        : allSelected
          ? 'All Locations'
          : selected.length === 1
            ? locations.find(l => l.externalId === selected[0])?.name ?? '1 location'
            : `${selected.length} locations`;

  const isHeader = variant === 'header';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={`flex items-center gap-2 text-xs font-mono rounded-md px-3 py-1.5 transition-colors whitespace-nowrap ${
          isHeader
            ? 'text-white hover:bg-white/10'
            : 'border border-border bg-card hover:border-primary/40 text-foreground py-2'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={isHeader ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' } : undefined}
      >
        <MapPin size={12} className="shrink-0 text-primary" />
        <span className={isHeader ? 'hidden lg:inline' : ''}>{label}</span>
        <span className={isHeader ? 'lg:hidden' : 'hidden'}>{disabled ? '—' : selected.length === 0 ? '0' : selected.length}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''} ${isHeader ? 'text-white/40' : 'text-muted-foreground'}`} />
      </button>

      {open && !disabled && (
        <div className={`absolute top-full mt-1.5 w-60 bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden ${isHeader ? 'right-0' : 'left-0'}`}>
          <button
            onClick={toggleAll}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted transition-colors text-left"
          >
            <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${allSelected ? 'bg-primary border-primary' : 'border-border'}`}>
              {allSelected && <Check size={10} className="text-primary-foreground" />}
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">All Locations</p>
              <p className="text-[10px] text-muted-foreground font-mono">{locations.length} outlets</p>
            </div>
          </button>

          <div className="py-1 max-h-64 overflow-y-auto">
            {locations.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No locations for this company.</p>
            ) : locations.map(loc => {
              const checked = isChecked(loc.externalId);
              return (
                <button
                  key={loc.externalId}
                  onClick={() => toggleLocation(loc.externalId)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border-border'}`}>
                    {checked && <Check size={10} className="text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{loc.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{loc.address}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {selected.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <button
                onClick={() => onChange([])}
                className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={10} /> Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
