import { useEffect, useMemo, useState } from 'react';
import { filterSelectCls } from '../layout/formControls';
import {
  ensureLocationStorageEntries,
  listAreasForLocations,
  listStoragesForFilter,
  loadStorageAssignment,
  loadStorageAssignmentForCompany,
  saveStorageAssignment,
  storageEntryKey,
} from '../../data/storageAssignment';

type Props = {
  locationIds: string[];
  areaFilter: string;
  selectedStorageKeys: string[];
  companyId?: number | null;
  onAreaChange: (area: string) => void;
  onStorageKeysChange: (keys: string[]) => void;
};

/** Area + Storage filters. Storage is a native select so it opens reliably on cloud. */
export function StorageFilter({
  locationIds,
  areaFilter,
  selectedStorageKeys,
  companyId,
  onAreaChange,
  onStorageKeysChange,
}: Props) {
  const [assignmentVersion, setAssignmentVersion] = useState(0);

  useEffect(() => {
    const reload = () => setAssignmentVersion(version => version + 1);
    window.addEventListener('bisync:storageAssignmentChanged', reload);
    return () => window.removeEventListener('bisync:storageAssignmentChanged', reload);
  }, []);

  // Always load company storage from API, then ensure this location has Kitchen defaults.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void loadStorageAssignmentForCompany(companyId)
      .then(loaded => {
        if (cancelled) return;
        const { state, changed } = ensureLocationStorageEntries(loaded, locationIds);
        if (changed) {
          saveStorageAssignment(state, companyId);
        } else {
          setAssignmentVersion(version => version + 1);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const { state, changed } = ensureLocationStorageEntries(loadStorageAssignment(), locationIds);
        if (changed && companyId) saveStorageAssignment(state, companyId);
        else setAssignmentVersion(version => version + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, locationIds.join(',')]);

  const assignment = useMemo(
    () => loadStorageAssignment(),
    [areaFilter, locationIds.join(','), assignmentVersion],
  );

  const areas = useMemo(
    () => ['All', ...listAreasForLocations(assignment, locationIds)],
    [assignment, locationIds],
  );

  const storages = useMemo(
    () => listStoragesForFilter(assignment, locationIds, areaFilter),
    [assignment, locationIds, areaFilter],
  );

  // Drop stale selection when Area/location changes and the key is no longer listed.
  useEffect(() => {
    if (selectedStorageKeys.length === 0) return;
    const allowed = new Set(storages.map(storageEntryKey));
    const next = selectedStorageKeys.filter(key => allowed.has(key));
    if (next.length !== selectedStorageKeys.length) {
      onStorageKeysChange(next);
    }
  }, [storages, selectedStorageKeys, onStorageKeysChange]);

  const selectedValue = selectedStorageKeys[0] ?? '';

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

      <div className="flex flex-col gap-1">
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Storage</label>
        <select
          value={selectedValue}
          onChange={e => {
            const value = e.target.value;
            onStorageKeysChange(value ? [value] : []);
          }}
          className={`${filterSelectCls} min-w-[180px]`}
          disabled={locationIds.length === 0}
        >
          <option value="">All</option>
          {storages.map(entry => {
            const key = storageEntryKey(entry);
            return (
              <option key={key} value={key}>
                {entry.name} ({entry.type})
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
