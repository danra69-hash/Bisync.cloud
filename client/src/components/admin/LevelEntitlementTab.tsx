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
import { formatDeemedDayOffLabel } from '../../modules/hr/employeeLevelDayOff';
import {
  blankLeaveTenureRule,
  cloneLeaveTenureRules,
  DEFAULT_LEAVE_TENURE_RULES,
  parseLeaveTenureRules,
  summarizeLeaveTenureRules,
  type LeaveTenureRule,
} from '../../modules/hr/leaveTenureRules';
import { inputCls } from '../../data/countries';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CLS } from '../layout/sidePanelShared';
import { ToggleSwitch } from './ToggleSwitch';

type LevelSortColumn = 'level' | 'annual' | 'sick' | 'hrsPerDay' | 'dayOff' | 'break' | 'mealQty' | 'mealAmt' | 'shift' | 'ot' | 'ph' | 'active';

const LEVEL_TABLE_COLUMNS: SortableColumnDef<LevelSortColumn>[] = [
  { key: 'level', label: 'Level' },
  { key: 'annual', label: 'Annual' },
  { key: 'sick', label: 'Sick' },
  { key: 'hrsPerDay', label: 'Hrs/Day' },
  { key: 'dayOff', label: 'DayOff/week' },
  { key: 'break', label: 'Break' },
  { key: 'mealQty', label: 'Meal Qty' },
  { key: 'mealAmt', label: 'Meal Amt' },
  { key: 'shift', label: 'Shift' },
  { key: 'ot', label: 'OT' },
  { key: 'ph', label: 'PH' },
  { key: 'active', label: 'Active', align: 'center' },
];

const emptyForm = {
  levelName: '',
  annualLeaveDays: DEFAULT_LEAVE_TENURE_RULES[0].days,
  sickLeaveDays: DEFAULT_LEAVE_TENURE_RULES[0].days,
  annualLeaveEnabled: true,
  sickLeaveEnabled: true,
  annualLeaveRules: cloneLeaveTenureRules(DEFAULT_LEAVE_TENURE_RULES),
  sickLeaveRules: cloneLeaveTenureRules(DEFAULT_LEAVE_TENURE_RULES),
  overtimeEligible: false,
  workingHoursPerDay: 8,
  dayOffPerWeek: 2,
  breakHoursPerShift: 1,
  publicHolidayEligible: false,
  isShift: false,
  dutyMealQtyEnabled: false,
  dutyMealQtyPerWorkingDay: 0,
  dutyMealAmountEnabled: false,
  dutyMealAmount: 0,
  dutyMealAmountPeriod: 'Monthly' as 'Weekly' | 'Monthly',
  active: true,
};

type LevelForm = typeof emptyForm;

function LeaveTenureRulesEditor({
  label,
  rules,
  onChange,
}: {
  label: string;
  rules: LeaveTenureRule[];
  onChange: (rules: LeaveTenureRule[]) => void;
}) {
  function updateRule(index: number, patch: Partial<LeaveTenureRule>) {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  function removeRule(index: number) {
    if (rules.length <= 1) return;
    onChange(rules.filter((_, i) => i !== index));
  }

  function addRule() {
    onChange([...rules, blankLeaveTenureRule(rules[rules.length - 1])]);
  }

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:opacity-80"
        >
          <Plus size={12} />
          Add rule
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Years of service bands — leave empty “to” for and above.
      </p>
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div key={index} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2 py-2">
            <input
              type="number"
              min="0"
              step="0.5"
              className={`${inputCls} w-16`}
              value={rule.fromYears}
              onChange={e => updateRule(index, { fromYears: Math.max(0, parseFloat(e.target.value) || 0) })}
              aria-label={`${label} from years`}
            />
            <span className="text-[11px] text-muted-foreground">to</span>
            <input
              type="number"
              min="0"
              step="0.5"
              className={`${inputCls} w-16`}
              value={rule.toYears ?? ''}
              placeholder="∞"
              onChange={e => {
                const raw = e.target.value.trim();
                updateRule(index, {
                  toYears: raw === '' ? null : Math.max(0, parseFloat(raw) || 0),
                });
              }}
              aria-label={`${label} to years`}
            />
            <span className="text-[11px] text-muted-foreground">years</span>
            <input
              type="number"
              min="0"
              step="1"
              className={`${inputCls} w-16`}
              value={rule.days}
              onChange={e => updateRule(index, { days: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              aria-label={`${label} days`}
            />
            <span className="text-[11px] text-muted-foreground">days</span>
            <button
              type="button"
              disabled={rules.length <= 1}
              onClick={() => removeRule(index)}
              className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
              aria-label={`Remove ${label} rule`}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    annualLeaveEnabled: level.annualLeaveEnabled !== false,
    sickLeaveEnabled: level.sickLeaveEnabled !== false,
    annualLeaveRules: parseLeaveTenureRules(level.annualLeaveRulesJson, level.annualLeaveDays),
    sickLeaveRules: parseLeaveTenureRules(level.sickLeaveRulesJson, level.sickLeaveDays),
    overtimeEligible: level.overtimeEligible,
    workingHoursPerDay: level.workingHoursPerDay,
    dayOffPerWeek: level.dayOffPerWeek ?? 2,
    breakHoursPerShift: level.breakHoursPerShift,
    publicHolidayEligible: level.publicHolidayEligible,
    isShift: level.isShift,
    dutyMealQtyEnabled: !!level.dutyMealQtyEnabled,
    dutyMealQtyPerWorkingDay: level.dutyMealQtyPerWorkingDay ?? 0,
    dutyMealAmountEnabled: !!level.dutyMealAmountEnabled,
    dutyMealAmount: level.dutyMealAmount ?? 0,
    dutyMealAmountPeriod: level.dutyMealAmountPeriod === 'Weekly' ? 'Weekly' : 'Monthly',
    active: level.active !== false,
  } : { ...emptyForm, annualLeaveRules: cloneLeaveTenureRules(), sickLeaveRules: cloneLeaveTenureRules() });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const deemedLabel = formatDeemedDayOffLabel(form);

  function validateRules(label: string, rules: LeaveTenureRule[]): string | null {
    if (rules.length === 0) return `Add at least one ${label} rule.`;
    for (const rule of rules) {
      if (rule.days <= 0) return `${label}: days must be greater than 0.`;
      if (rule.toYears != null && rule.toYears <= rule.fromYears) {
        return `${label}: "to" years must be greater than "from" years (or leave empty for and above).`;
      }
    }
    return null;
  }

  async function save() {
    if (!form.levelName.trim()) {
      setError('Level name is required.');
      return;
    }
    if (form.annualLeaveEnabled) {
      const annualError = validateRules('Annual leave', form.annualLeaveRules);
      if (annualError) { setError(annualError); return; }
    }
    if (form.sickLeaveEnabled) {
      const sickError = validateRules('Sick leave', form.sickLeaveRules);
      if (sickError) { setError(sickError); return; }
    }
    if (form.dutyMealQtyEnabled && form.dutyMealQtyPerWorkingDay <= 0) {
      setError('Enter Duty Meal QTY per working day, or untick the box.');
      return;
    }
    if (form.dutyMealAmountEnabled && form.dutyMealAmount <= 0) {
      setError('Enter Duty Meal Amount, or untick the box.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const annualLeaveRules = form.annualLeaveEnabled
        ? cloneLeaveTenureRules(form.annualLeaveRules)
        : [];
      const sickLeaveRules = form.sickLeaveEnabled
        ? cloneLeaveTenureRules(form.sickLeaveRules)
        : [];
      const payload = {
        ...form,
        annualLeaveEnabled: form.annualLeaveEnabled,
        sickLeaveEnabled: form.sickLeaveEnabled,
        annualLeaveDays: form.annualLeaveEnabled ? (annualLeaveRules[0]?.days ?? 0) : 0,
        sickLeaveDays: form.sickLeaveEnabled ? (sickLeaveRules[0]?.days ?? 0) : 0,
        annualLeaveRulesJson: JSON.stringify(annualLeaveRules),
        sickLeaveRulesJson: JSON.stringify(sickLeaveRules),
        dayOffPerWeek: Math.max(0, Math.min(7, Number(form.dayOffPerWeek) || 0)),
        dutyMealQtyPerWorkingDay: form.dutyMealQtyEnabled ? Math.max(0, form.dutyMealQtyPerWorkingDay) : 0,
        dutyMealAmount: form.dutyMealAmountEnabled ? Math.max(0, form.dutyMealAmount) : 0,
        dutyMealAmountPeriod: form.dutyMealAmountEnabled ? form.dutyMealAmountPeriod : 'Monthly',
        shiftType: null,
      };
      const { annualLeaveRules: _a, sickLeaveRules: _s, ...apiPayload } = payload;
      if (isNew) await hrApi.levels.create(apiPayload);
      else if (level) await hrApi.levels.update(level.id, apiPayload);
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
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.annualLeaveEnabled}
                  onChange={e => setForm({
                    ...form,
                    annualLeaveEnabled: e.target.checked,
                    annualLeaveRules: e.target.checked && form.annualLeaveRules.length === 0
                      ? cloneLeaveTenureRules()
                      : form.annualLeaveRules,
                  })}
                  className="rounded border-border"
                />
                Include Annual Leave
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sickLeaveEnabled}
                  onChange={e => setForm({
                    ...form,
                    sickLeaveEnabled: e.target.checked,
                    sickLeaveRules: e.target.checked && form.sickLeaveRules.length === 0
                      ? cloneLeaveTenureRules()
                      : form.sickLeaveRules,
                  })}
                  className="rounded border-border"
                />
                Include Sick Leave
              </label>
            </div>
            {form.annualLeaveEnabled ? (
              <LeaveTenureRulesEditor
                label="Annual Leave"
                rules={form.annualLeaveRules}
                onChange={annualLeaveRules => setForm({ ...form, annualLeaveRules })}
              />
            ) : null}
            {form.sickLeaveEnabled ? (
              <LeaveTenureRulesEditor
                label="Sick Leave"
                rules={form.sickLeaveRules}
                onChange={sickLeaveRules => setForm({ ...form, sickLeaveRules })}
              />
            ) : null}
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Hours/Day</label>
              <input type="number" min="0" step="0.5" className={`${inputCls} mt-1`} value={form.workingHoursPerDay} onChange={e => setForm({ ...form, workingHoursPerDay: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">DayOff/week</label>
              <input
                type="number"
                min="0"
                max="7"
                step="1"
                className={`${inputCls} mt-1`}
                value={form.dayOffPerWeek}
                onChange={e => setForm({ ...form, dayOffPerWeek: Math.max(0, Math.min(7, parseInt(e.target.value, 10) || 0)) })}
              />
              {deemedLabel && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  Non-shift · {form.dayOffPerWeek} day(s) off → {deemedLabel}
                </p>
              )}
              {form.isShift && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  Shift work — weekly rest days follow the roster (not fixed weekend).
                </p>
              )}
              {!form.isShift && form.dayOffPerWeek !== 2 && form.dayOffPerWeek > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                  Set to 2 for the standard Saturday &amp; Sunday rest days.
                </p>
              )}
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

            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-[11px] font-sans text-muted-foreground uppercase tracking-wider">Duty meal</p>
              <div className="flex items-start gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer shrink-0 pt-2 min-w-[11rem]">
                  <input
                    type="checkbox"
                    checked={form.dutyMealQtyEnabled}
                    onChange={e => setForm({
                      ...form,
                      dutyMealQtyEnabled: e.target.checked,
                      dutyMealQtyPerWorkingDay: e.target.checked
                        ? (form.dutyMealQtyPerWorkingDay > 0 ? form.dutyMealQtyPerWorkingDay : 1)
                        : form.dutyMealQtyPerWorkingDay,
                    })}
                    className="rounded border-border"
                  />
                  Duty Meal QTY/Working Day
                </label>
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    disabled={!form.dutyMealQtyEnabled}
                    className={`${inputCls} ${!form.dutyMealQtyEnabled ? 'opacity-50' : ''}`}
                    value={form.dutyMealQtyPerWorkingDay}
                    onChange={e => setForm({ ...form, dutyMealQtyPerWorkingDay: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="QTY / working day"
                    aria-label="Duty Meal QTY per working day"
                  />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer shrink-0 pt-2 min-w-[11rem]">
                  <input
                    type="checkbox"
                    checked={form.dutyMealAmountEnabled}
                    onChange={e => setForm({
                      ...form,
                      dutyMealAmountEnabled: e.target.checked,
                    })}
                    className="rounded border-border"
                  />
                  Duty Meal Amount
                </label>
                <div className="flex-1 space-y-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!form.dutyMealAmountEnabled}
                    className={`${inputCls} ${!form.dutyMealAmountEnabled ? 'opacity-50' : ''}`}
                    value={form.dutyMealAmount}
                    onChange={e => setForm({ ...form, dutyMealAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                    placeholder="Amount"
                    aria-label="Duty Meal Amount"
                  />
                  <div className={`flex items-center gap-4 text-xs ${!form.dutyMealAmountEnabled ? 'opacity-50' : ''}`}>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dutyMealAmountPeriod"
                        disabled={!form.dutyMealAmountEnabled}
                        checked={form.dutyMealAmountPeriod === 'Weekly'}
                        onChange={() => setForm({ ...form, dutyMealAmountPeriod: 'Weekly' })}
                        className="border-border"
                      />
                      Weekly
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dutyMealAmountPeriod"
                        disabled={!form.dutyMealAmountEnabled}
                        checked={form.dutyMealAmountPeriod === 'Monthly'}
                        onChange={() => setForm({ ...form, dutyMealAmountPeriod: 'Monthly' })}
                        className="border-border"
                      />
                      Monthly
                    </label>
                  </div>
                </div>
              </div>
            </div>
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
          annual: l => {
            if (l.annualLeaveEnabled === false) return 0;
            const rules = parseLeaveTenureRules(l.annualLeaveRulesJson, l.annualLeaveDays);
            return Math.max(...rules.map(r => r.days), l.annualLeaveDays);
          },
          sick: l => {
            if (l.sickLeaveEnabled === false) return 0;
            const rules = parseLeaveTenureRules(l.sickLeaveRulesJson, l.sickLeaveDays);
            return Math.max(...rules.map(r => r.days), l.sickLeaveDays);
          },
          hrsPerDay: l => l.workingHoursPerDay,
          dayOff: l => l.dayOffPerWeek ?? 2,
          break: l => l.breakHoursPerShift,
          mealQty: l => (l.dutyMealQtyEnabled ? l.dutyMealQtyPerWorkingDay : -1),
          mealAmt: l => (l.dutyMealAmountEnabled ? l.dutyMealAmount : -1),
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
        <table className="w-full text-xs">
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
                <td className="px-4 py-3 text-muted-foreground">
                  {level.annualLeaveEnabled === false
                    ? '—'
                    : summarizeLeaveTenureRules(parseLeaveTenureRules(level.annualLeaveRulesJson, level.annualLeaveDays))}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {level.sickLeaveEnabled === false
                    ? '—'
                    : summarizeLeaveTenureRules(parseLeaveTenureRules(level.sickLeaveRulesJson, level.sickLeaveDays))}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{level.workingHoursPerDay}h</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {level.dayOffPerWeek ?? 2}
                  {!level.isShift && (level.dayOffPerWeek ?? 2) === 2 ? (
                    <span className="block text-[10px] text-muted-foreground/80">Sat–Sun</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{level.breakHoursPerShift}h</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {level.dutyMealQtyEnabled ? level.dutyMealQtyPerWorkingDay : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {level.dutyMealAmountEnabled
                    ? `${level.dutyMealAmount}/${level.dutyMealAmountPeriod === 'Weekly' ? 'wk' : 'mo'}`
                    : '—'}
                </td>
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
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  No employee levels yet. Add a level to get started.
                </td>
              </tr>
            )}
            <InfiniteScrollTableSentinel colSpan={12} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
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
