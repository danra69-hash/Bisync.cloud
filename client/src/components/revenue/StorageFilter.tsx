import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { filterSelectCls } from '../layout/formControls';
import {
  ensureLocationStorageEntries,
  listAreasForLocations,
  listStoragesForFilter,
  loadStorageAssignment,
  saveStorageAssignment,
  storageEntryKey,
  type MyStorageEntry,
} from '../../data/storageAssignment';

type Props = {
  locationIds: string[];
  areaFilter: string;
  selectedStorageKeys: string[];
  companyId?: number | null;
  onAreaChange: (area: string) => void;
  onStorageKeysChange: (keys: string[]) => void;
};

function storageButtonLabel(storages: MyStorageEntry[], selectedKeys: string[]) {
  if (selectedKeys.length === 0) return 'All';
  if (selectedKeys.length === 1) {
    const match = storages.find(entry => storageEntryKey(entry) === selectedKeys[0]);
    return match?.name ?? '1 selected';
  }
  return `${selectedKeys.length} selected`;
}

export function StorageFilter({
  locationIds,
  areaFilter,
  selectedStorageKeys,
  companyId,
  onAreaChange,
  onStorageKeysChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [assignmentVersion, setAssignmentVersion] = useState(0);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const assignment = useMemo(
    () => loadStorageAssignment(),
    [open, areaFilter, locationIds.join(','), assignmentVersion],
  );

  useEffect(() => {
    const reload = () => setAssignmentVersion(version => version + 1);
    window.addEventListener('bisync:storageAssignmentChanged', reload);
    return () => window.removeEventListener('bisync:storageAssignmentChanged', reload);
  }, []);

  // Persist default Kitchen storages for locations that have none (cloud companies
  // outside downtown/midtown/westend), so Area/Storage filters stay usable.
  useEffect(() => {
    if (!companyId || locationIds.length === 0) return;
    const { state, changed } = ensureLocationStorageEntries(loadStorageAssignment(), locationIds);
    if (!changed) return;
    saveStorageAssignment(state, companyId);
  }, [companyId, locationIds.join(',')]);

  const areas = useMemo(
    () => ['All', ...listAreasForLocations(assignment, locationIds)],
    [assignment, locationIds],
  );

  const storages = useMemo(
    () => listStoragesForFilter(assignment, locationIds, areaFilter),
    [assignment, locationIds, areaFilter],
  );

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(240, rect.width);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPanelPos({
        top: rect.bottom + 4,
        left: Math.max(8, left),
        width,
      });
    }
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function toggleStorage(key: string) {
    if (selectedStorageKeys.includes(key)) {
      onStorageKeysChange(selectedStorageKeys.filter(value => value !== key));
      return;
    }
    onStorageKeysChange([...selectedStorageKeys, key]);
  }

  const panel = open && panelPos
    ? createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, minWidth: panelPos.width }}
          className="z-[120] rounded-md border border-border bg-card shadow-lg p-2"
        >
          <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedStorageKeys.length === 0}
              onChange={() => onStorageKeysChange([])}
              className="accent-primary"
            />
            <span>All</span>
          </label>
          {storages.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No storage assigned for this area.</p>
          ) : (
            storages.map(entry => {
              const key = storageEntryKey(entry);
              return (
                <label
                  key={key}
                  className="flex items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStorageKeys.includes(key)}
                    onChange={() => toggleStorage(key)}
                    className="accent-primary mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">{entry.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.area} · {entry.type}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="flex flex-nowrap items-end gap-2 shrink-0">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Area</label>
        <select
          value={areaFilter}
          onChange={e => onAreaChange(e.target.value)}
          className={`${filterSelectCls} min-w-[140px]`}
        >
          {areas.map(area => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 relative">
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Storage</label>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(value => !value)}
          className={`${filterSelectCls} min-w-[180px] text-left flex items-center justify-between gap-2`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="truncate">{storageButtonLabel(storages, selectedStorageKeys)}</span>
          <span className="text-muted-foreground text-xs">{open ? '▴' : '▾'}</span>
        </button>
        {panel}
      </div>
    </div>
  );
}
