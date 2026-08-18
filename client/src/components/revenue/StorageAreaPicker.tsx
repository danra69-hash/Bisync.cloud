import { useState } from 'react';
import { X } from 'lucide-react';
import { inputCls, selectCls } from '../../data/componentForm';

type AreaProps = {
  existingAreas: string[];
  onClose: () => void;
  onConfirm: (areaName: string) => void;
};

export function CreateStorageAreaDialog({ existingAreas, onClose, onConfirm }: AreaProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Storage area name is required.');
      return;
    }
    if (existingAreas.some(area => area.toLowerCase() === trimmed.toLowerCase())) {
      setError('This storage area already exists.');
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/10" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Storage assignment</p>
            <h3 className="text-sm font-semibold mt-0.5">Create Storage Area</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Storage area</span>
            <input
              className={inputCls}
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="e.g. Kitchen"
              autoFocus
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
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
            onClick={submit}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90"
          >
            Create area
          </button>
        </div>
      </div>
    </>
  );
}

type StorageProps = {
  areas: string[];
  storageTypes: string[];
  onClose: () => void;
  onConfirm: (payload: { area: string; name: string; type: string }) => void;
};

export function CreateStorageDialog({ areas, storageTypes, onClose, onConfirm }: StorageProps) {
  const [area, setArea] = useState(areas[0] ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState(storageTypes[0] ?? 'Dry Store');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmedName = name.trim();
    const trimmedArea = area.trim();
    if (!trimmedArea) {
      setError('Create a storage area first.');
      return;
    }
    if (!trimmedName) {
      setError('Storage name is required.');
      return;
    }
    onConfirm({
      area: trimmedArea,
      name: trimmedName,
      type: type.trim() || trimmedName,
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/10" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Storage assignment</p>
            <h3 className="text-sm font-semibold mt-0.5">Create Storage</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Storage area</span>
            <select
              className={selectCls}
              value={area}
              onChange={e => {
                setArea(e.target.value);
                setError(null);
              }}
              disabled={areas.length === 0}
            >
              {areas.length === 0 ? (
                <option value="">No areas yet</option>
              ) : (
                areas.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))
              )}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Storage</span>
            <input
              className={inputCls}
              value={name}
              onChange={e => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="e.g. Walk-in Freezer"
              autoFocus
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Storage type</span>
            <select
              className={selectCls}
              value={type}
              onChange={e => setType(e.target.value)}
            >
              {storageTypes.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}
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
            onClick={submit}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90"
          >
            Create storage
          </button>
        </div>
      </div>
    </>
  );
}
