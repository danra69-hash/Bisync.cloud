import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Plus } from 'lucide-react';
import { api, type Company } from '../../api';
import { getCountry, inputCls } from '../../data/countries';
import { hrApi } from '../../modules/hr/api';
import type { CompanySetting, CompanySettingUpdate, PublicHoliday } from '../../modules/hr/types';
import { ToggleSwitch } from './ToggleSwitch';

type HolidaySortColumn = 'holiday' | 'date' | 'gazetted' | 'recognized';

const HOLIDAY_TABLE_COLUMNS: SortableColumnDef<HolidaySortColumn>[] = [
  { key: 'holiday', label: 'Holiday' },
  { key: 'date', label: 'Date' },
  { key: 'gazetted', label: 'Gazetted', align: 'center', className: 'px-2 py-2 font-sans font-normal' },
  { key: 'recognized', label: 'Recognized', align: 'center', className: 'px-2 py-2 font-sans font-normal' },
];

type Props = {
  selectedCompanyId: number | null;
};

const emptyForm = () => ({
  name: '',
  date: '',
  isRecurringAnnually: false,
  isRecognized: true,
});

function formatHolidayDate(holiday: PublicHoliday) {
  const formatted = new Date(holiday.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  if (holiday.isRecurringAnnually) {
    const annual = new Date(holiday.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return `${annual} · Annual`;
  }
  return formatted;
}

export function PhSettingTab({ selectedCompanyId }: Props) {
  const [setting, setSetting] = useState<CompanySetting | null>(null);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const companyCountryCode = selectedCompany?.countryCode ?? null;
  const countryName = companyCountryCode ? getCountry(companyCountryCode).name : null;

  const load = useCallback(async (countryCode: string) => {
    const [set, hols] = await Promise.all([
      hrApi.settings.get(),
      hrApi.holidays.list(countryCode),
    ]);
    setSetting(set);
    setHolidays(hols);
  }, []);

  useEffect(() => {
    void api.companies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!companyCountryCode) {
      setHolidays([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!cancelled) await load(companyCountryCode);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [companyCountryCode, load]);

  async function toggleRecognized(id: number) {
    const updated = await hrApi.holidays.toggleRecognized(id);
    setHolidays(prev => prev.map(h => (h.id === id ? updated : h)));
  }

  async function toggleGazetted(id: number) {
    const updated = await hrApi.holidays.toggleGazetted(id);
    setHolidays(prev => prev.map(h => (h.id === id ? updated : h)));
  }

  async function patchSettings(patch: CompanySettingUpdate) {
    setSetting(await hrApi.settings.update(patch));
  }

  async function saveRate(field: 'gazettedPhNormalHoursRate' | 'gazettedPhOvertimeHoursRate', value: number) {
    if (!Number.isFinite(value) || value < 0.1) return;
    await patchSettings({ [field]: value });
  }

  function openAddForm() {
    setForm(emptyForm());
    setShowAddForm(true);
    setError(null);
  }

  async function submitAddHoliday() {
    if (!companyCountryCode) return;
    const name = form.name.trim();
    if (!name) {
      setError('Holiday name is required.');
      return;
    }
    if (!form.date) {
      setError('Date is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await hrApi.holidays.create({
        name,
        date: form.date,
        isRecognized: form.isRecognized,
        isRecurringAnnually: form.isRecurringAnnually,
        countryCode: companyCountryCode,
      });
      setHolidays(prev => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setShowAddForm(false);
      setForm(emptyForm());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<HolidaySortColumn>();

  useEffect(() => { resetSort(); }, [holidays, companyCountryCode, resetSort]);

  const sortedHolidays = useMemo(
    () =>
      sortTableRows(
        holidays,
        sortColumn,
        sortDirection,
        {
          holiday: h => h.name,
          date: h => h.date,
          gazetted: h => !!h.isGazetted,
          recognized: h => h.isRecognized,
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [holidays, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedHolidays,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedHolidays, { scrollRootRef });

  if (!selectedCompanyId) {
    return null;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="hover:opacity-70 shrink-0">×</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/20">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">PH Setting</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {countryName
                ? `${selectedCompany?.name} · ${countryName}`
                : selectedCompany?.name}
              {loading && ' · Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            disabled={showAddForm}
            className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md shrink-0 disabled:opacity-50"
          >
            <Plus size={12} /> Add PH
          </button>
        </div>

        {showAddForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/10 space-y-4">
            <p className="text-xs font-semibold">Add Public Holiday</p>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_auto] gap-3 items-end">
              <div>
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Holiday</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className={`${inputCls} mt-1`}
                  placeholder="e.g. Company Foundation Day"
                />
              </div>
              <div>
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className={`${inputCls} mt-1`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <ToggleSwitch
                    checked={form.isRecurringAnnually}
                    onChange={v => setForm(prev => ({ ...prev, isRecurringAnnually: v }))}
                    label="Recurring annually"
                  />
                  Annual
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <ToggleSwitch
                    checked={form.isRecognized}
                    onChange={v => setForm(prev => ({ ...prev, isRecognized: v }))}
                    label="Recognized"
                  />
                  Recognized
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setForm(emptyForm()); }}
                className="text-xs font-sans border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAddHoliday()}
                disabled={saving}
                className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add Holiday'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch">
          <section className="min-w-0 p-5">
            <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-3">Public Holidays</p>
            <TableScrollContainer ref={scrollRootRef} className="border border-border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed text-xs">
                <thead className="bg-muted/40 border-b border-border">
                  <SortableTableHeaderRow
                    columns={HOLIDAY_TABLE_COLUMNS}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    className=""
                  />
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedHolidays.map(h => (
                    <tr key={h.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium">{h.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatHolidayDate(h)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <ToggleSwitch checked={!!h.isGazetted} onChange={() => void toggleGazetted(h.id)} label={`Gazetted ${h.name}`} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <ToggleSwitch checked={h.isRecognized} onChange={() => void toggleRecognized(h.id)} label={`Recognize ${h.name}`} />
                      </td>
                    </tr>
                  ))}
                  {!loading && holidays.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No public holidays loaded for {countryName ?? 'this country'}.
                      </td>
                    </tr>
                  )}
                  <InfiniteScrollTableSentinel colSpan={4} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                </tbody>
              </table>
            </TableScrollContainer>
          </section>

          <section className="p-5 border-t lg:border-t-0 lg:border-l border-border bg-muted/10 space-y-4">
            <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">PH Rule</p>

            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold">Gazetted PH</p>
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Replacement day</span>
                <ToggleSwitch
                  checked={!!setting?.gazettedPhReplacementDayEnabled}
                  onChange={checked => void patchSettings({ gazettedPhReplacementDayEnabled: checked })}
                  label="Gazetted PH replacement day"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Normal rate ×</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className={`${inputCls} w-20 text-right`}
                  defaultValue={setting?.gazettedPhNormalHoursRate ?? 1.5}
                  key={`normal-${setting?.gazettedPhNormalHoursRate ?? 1.5}`}
                  onBlur={(e) => void saveRate('gazettedPhNormalHoursRate', parseFloat(e.target.value))}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Overtime rate ×</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className={`${inputCls} w-20 text-right`}
                  defaultValue={setting?.gazettedPhOvertimeHoursRate ?? 2}
                  key={`ot-${setting?.gazettedPhOvertimeHoursRate ?? 2}`}
                  onBlur={(e) => void saveRate('gazettedPhOvertimeHoursRate', parseFloat(e.target.value))}
                />
              </label>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold">Non-gazetted PH</p>
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Replacement day</span>
                <ToggleSwitch
                  checked={!!setting?.nonGazettedPhReplacementDayEnabled}
                  onChange={checked => void patchSettings({ nonGazettedPhReplacementDayEnabled: checked })}
                  label="Non-gazetted PH replacement day"
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
