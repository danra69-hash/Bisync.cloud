import { useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  storageName: string;
  areas: readonly string[];
  onClose: () => void;
  onConfirm: (area: string) => void;
};

export function StorageAreaPicker({
  storageName,
  areas,
  onClose,
  onConfirm,
}: Props) {
  const [selectedArea, setSelectedArea] = useState(areas[0] ?? '');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/10" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Select area</p>
            <h3 className="text-sm font-semibold mt-0.5">Add “{storageName}” to My Storage</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">Choose which area this storage belongs to.</p>
          <div className="space-y-1.5">
            {areas.map(area => (
              <label
                key={area}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  selectedArea === area ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="storage-area"
                  value={area}
                  checked={selectedArea === area}
                  onChange={() => setSelectedArea(area)}
                  className="accent-primary"
                />
                <span className="text-xs font-medium">{area}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedArea)}
            disabled={!selectedArea}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 disabled:opacity-50"
          >
            Add to My Storage
          </button>
        </div>
      </div>
    </>
  );
}
