import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Plus, X } from 'lucide-react';
import { hrApi } from '../../modules/hr/api';
import type { EmployeeLevel } from '../../modules/hr/types';
import { inputCls } from '../../data/countries';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CLS } from '../layout/sidePanelShared';
import { ToggleSwitch } from './ToggleSwitch';

type LevelSortColumn = 'level' | 'annual' | 'sick' | 'hrsPerDay' | 'break' | 'shift' | 'ot' | 'ph' | 'active';

const LEVEL_TABLE_COLUMNS: SortableColumnDef<LevelSortColumn>[] = [
  { key: 'level', label: 'Level' },
  { key: 'annual', label: 'Annual' },
  { key: 'sick', label: 'Sick' },
  { key: 'hrsPerDay', label: 'Hrs/Day' },
  { key: 'break', label: 'Break' },
  { key: 'shift', label: 'Shift' },
  { key: 'ot', label: 'OT' },
  { key: 'ph', label: 'PH' },
  { key: 'active', label: 'Active', align: 'center' },
];

const emptyForm = {
  levelName: '',
  annualLeaveDays: 0,
  sickLeaveDays: 0,
  overtimeEligible: false,
  workingHoursPerDay: 8,
  breakHoursPerShift: 1,
  publicHolidayEligible: false,
  isShift: false,
  active: true,
};

type LevelForm = typeof emptyForm;

function LevelPanel({
  level,
  isNew,
  onClose,
  onSave,
}: {
  level: EmployeeLevel | null;
  isNew: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<LevelForm>(() => level ? {
    levelName: level.levelName,
    annualLeaveDays: level.annualLeaveDays,
    sickLeaveDays: level.sickLeaveDays,
    overtimeEligible: level.overtimeEligible,
    workingHoursPerDay: level.workingHoursPerDay,
    breakHoursPerShift: level.breakHoursPerShift,
    publicHolidayEligible: level.publicHolidayEligible,
    isShift: level.isShift,
    active: level.active !== false,
  } : { ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.levelName.trim()) {
      setError('Level name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, shiftType: null };
      if (isNew) await hrApi.levels.create(payload);
      else if (level) await hrApi.levels.update(level.id, payload);
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Employee Level</p>
            <h3 className="text-sm font-semibold">{isNew ? 'New Level' : form.levelName}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Level Name *</label>
              <input
                className={`${inputCls} mt-1`}
                value={form.levelName}
                onChange={e => setForm({ ...form, levelName: e.target.value })}
                placeholder="e.g. Management"
              />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Annual Leave</label>
              <input type="number" min="0" className={`${inputCls} mt-1`} value={form.annualLeaveDays} onChange={e => setForm({ ...form, annualLeaveDays: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Sick Leave</label>
              <input type="number" min="0" className={`${inputCls} mt-1`} value={form.sickLeaveDays} onChange={e => setForm({ ...form, sickLeaveDays: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Hours/Day</label>
              <input type="number" min="0" step="0.5" className={`${inputCls} mt-1`} value={form.workingHoursPerDay} onChange={e => setForm({ ...form, workingHoursPerDay: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Break/Shift</label>
              <input type="number" min="0" step="0.5" className={`${inputCls} mt-1`} value={form.breakHoursPerShift} onChange={e => setForm({ ...form, breakHoursPerShift: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <label className="flex items-center justify-between gap-3 text-xs">
              <span>Active</span>
              <ToggleSwitch checked={form.active} onChange={active => setForm({ ...form, active })} label="Active level" />
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.overtimeEligible} onChange={e => setForm({ ...form, overtimeEligible: e.target.checked })} className="rounded border-border" />
              Overtime eligible
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.publicHolidayEligible} onChange={e => setForm({ ...form, publicHolidayEligible: e.target.checked })} className="rounded border-border" />
              Public holiday eligible
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form.isShift} onChange={e => setForm({ ...form, isShift: e.target.checked })} className="rounded border-border" />
              Shift employee
            </label>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !form.levelName.trim()}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
          >
            {isNew ? 'Add Level' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export function LevelEntitlementTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const [levels, setLevels] = useState<EmployeeLevel[]>([]);
  const [panelLevel, setPanelLevel] = useState<EmployeeLevel | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLevels(await hrApi.levels.list());
  }, []);

  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : String(e))); }, [load]);

  function openAdd() {
    setPanelLevel(null);
    setIsNew(true);
  }

  function openEdit(level: EmployeeLevel) {
    setPanelLevel(level);
    setIsNew(false);
  }

  function closePanel() {
    setPanelLevel(null);
    setIsNew(false);
  }

  async function afterSave() {
    await load();
    onDataChanged?.();
  }

  async function toggleActive(level: EmployeeLevel, active: boolean) {
    const updated = { ...level, active, shiftType: null };
    await hrApi.levels.update(level.id, updated);
    setLevels(prev => prev.map(l => (l.id === level.id ? updated : l)));
    onDataChanged?.();
  }

  async function toggleFlag(level: EmployeeLevel, patch: Partial<EmployeeLevel>) {
    const updated = { ...level, ...patch, shiftType: null };
    await hrApi.levels.update(level.id, updated);
    setLevels(prev => prev.map(l => (l.id === level.id ? updated : l)));
    onDataChanged?.();
  }

  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<LevelSortColumn>();

  useEffect(() => { resetSort(); }, [levels, resetSort]);

  const sortedLevels = useMemo(
    () =>
      sortTableRows(
        levels,
        sortColumn,
        sortDirection,
        {
          level: l => l.levelName,
          annual: l => l.annualLeaveDays,
          sick: l => l.sickLeaveDays,
          hrsPerDay: l => l.workingHoursPerDay,
          break: l => l.breakHoursPerShift,
          shift: l => l.isShift,
          ot: l => l.overtimeEligible,
          ph: l => l.publicHolidayEligible,
          active: l => l.active !== false,
        },
        { tieBreaker: (a, b) => compareSortValues(a.levelName, b.levelName) },
      ),
    [levels, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedLevels,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedLevels, { scrollRootRef });

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">{error}</div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Define leave and overtime entitlements by employee level</p>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90"
        >
          <Plus size={14} /> Add Level
        </button>
      </div>

      <TableScrollContainer ref={scrollRootRef} className="bg-card border border-border rounded-lg overflow-hidden max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-muted/40 border-b border-border">
            <SortableTableHeaderRow
              columns={LEVEL_TABLE_COLUMNS}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
              className=""
            />
          </thead>
          <tbody className="divide-y divide-border">
            {pagedLevels.map(level => (
              <tr
                key={level.id}
                className={`hover:bg-muted/20 cursor-pointer ${level.active === false ? 'opacity-60' : ''}`}
                onClick={() => openEdit(level)}
              >
                <td className="px-4 py-3 font-medium text-primary hover:underline">{level.levelName}</td>
                <td className="px-4 py-3 text-muted-foreground">{level.annualLeaveDays}d</td>
                <td className="px-4 py-3 text-muted-foreground">{level.sickLeaveDays}d</td>
                <td className="px-4 py-3 text-muted-foreground">{level.workingHoursPerDay}h</td>
                <td className="px-4 py-3 text-muted-foreground">{level.breakHoursPerShift}h</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <ToggleSwitch checked={level.isShift} onChange={v => void toggleFlag(level, { isShift: v })} label="Shift" />
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <ToggleSwitch checked={level.overtimeEligible} onChange={v => void toggleFlag(level, { overtimeEligible: v })} label="Overtime" />
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <ToggleSwitch checked={level.publicHolidayEligible} onChange={v => void toggleFlag(level, { publicHolidayEligible: v })} label="PH" />
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <ToggleSwitch
                    checked={level.active !== false}
                    onChange={v => void toggleActive(level, v)}
                    label={level.active === false ? 'Activate level' : 'Deactivate level'}
                  />
                </td>
              </tr>
            ))}
            {levels.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No employee levels yet. Add a level to get started.
                </td>
              </tr>
            )}
            <InfiniteScrollTableSentinel colSpan={9} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>

      {(isNew || panelLevel) && (
        <LevelPanel
          level={panelLevel}
          isNew={isNew}
          onClose={closePanel}
          onSave={() => void afterSave()}
        />
      )}
    </div>
  );
}
