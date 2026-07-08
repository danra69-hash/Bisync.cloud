import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Plus, Trash2, X } from 'lucide-react';
import { api, type Company } from '../../api';
import { getCountry, inputCls, selectCls } from '../../data/countries';
import { hrApi } from '../../modules/hr/api';
import type { PayStructure } from '../../modules/hr/types';
import { MalaysiaProvidentFundSection } from './MalaysiaProvidentFundSection';
import { MalaysiaSocsoSection } from './MalaysiaSocsoSection';
import {
  PAY_CYCLES,
  PAY_TYPES,
  OVERTIME_CALCULATION_MODES,
  bracketsForCountry,
  emptyPayStructureForm,
  foreignPfForCountry,
  foreignSocsoForCountry,
  formToPayStructureRequest,
  formatProvidentFundSummary,
  formatSocsoSummary,
  isMalaysiaCountryCode,
  payStructureToForm,
  socsoBracketsForCountry,
  validatePayStructureForm,
  type PayStructureForm,
} from './payStructureShared';
import { ToggleSwitch } from './ToggleSwitch';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_WIDE_CLS } from '../layout/sidePanelShared';

type PayStructureSortColumn = 'company' | 'country' | 'payType' | 'payCycle' | 'pf' | 'socso' | 'otherContributions' | 'active';

const PAY_STRUCTURE_TABLE_COLUMNS: SortableColumnDef<PayStructureSortColumn>[] = [
  { key: 'company', label: 'Company' },
  { key: 'country', label: 'Country' },
  { key: 'payType', label: 'Pay Type' },
  { key: 'payCycle', label: 'Pay Cycle' },
  { key: 'pf', label: 'PF (Co/Emp)' },
  { key: 'socso', label: 'SOCSO' },
  { key: 'otherContributions', label: 'Other Contributions' },
  { key: 'active', label: 'Active', align: 'center' },
];

function PayStructurePanel({
  structure,
  companies,
  configuredCompanyIds,
  isNew,
  onClose,
  onSave,
}: {
  structure: PayStructure | null;
  companies: Company[];
  configuredCompanyIds: Set<number>;
  isNew: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<PayStructureForm>(() => structure ? payStructureToForm(structure) : emptyPayStructureForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCompany = companies.find(c => c.id === form.companyId);
  const countryCode = selectedCompany?.countryCode ?? structure?.countryCode ?? 'MY';
  const country = getCountry(countryCode);
  const isMalaysia = isMalaysiaCountryCode(countryCode);
  const availableCompanies = isNew
    ? companies.filter(c => !configuredCompanyIds.has(c.id))
    : companies;

  function set<K extends keyof PayStructureForm>(key: K, value: PayStructureForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError(null);
  }

  function addContribution() {
    setForm(prev => ({
      ...prev,
      mandatoryContributions: [...prev.mandatoryContributions, { name: '', employerPct: 0, employeePct: 0 }],
    }));
  }

  function updateContribution(index: number, patch: Partial<PayStructureForm['mandatoryContributions'][number]>) {
    setForm(prev => ({
      ...prev,
      mandatoryContributions: prev.mandatoryContributions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeContribution(index: number) {
    setForm(prev => ({
      ...prev,
      mandatoryContributions: prev.mandatoryContributions.filter((_, i) => i !== index),
    }));
  }

  async function save() {
    const validationError = validatePayStructureForm(form, countryCode);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayStructureRequest(form, countryCode);
      if (isNew) await hrApi.payStructures.create(payload);
      else if (structure) await hrApi.payStructures.update(structure.id, payload);
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
      <div className={SIDE_PANEL_SHELL_WIDE_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Pay Structure</p>
            <h3 className="text-sm font-semibold">{isNew ? 'New Pay Structure' : selectedCompany?.name ?? structure?.companyName}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company *</label>
              <select
                className={`${selectCls} mt-1`}
                value={form.companyId ?? ''}
                disabled={!isNew}
                onChange={e => {
                  const companyId = e.target.value ? Number(e.target.value) : null;
                  const company = companies.find(c => c.id === companyId);
                  setForm(prev => {
                    const foreignPf = foreignPfForCountry(company?.countryCode, {
                      employerPct: prev.foreignProvidentFundEmployerPct,
                      employeePct: prev.foreignProvidentFundEmployeePct,
                    });
                    return {
                      ...prev,
                      companyId,
                      providentFundBrackets: bracketsForCountry(company?.countryCode, prev.providentFundBrackets),
                      socsoBrackets: socsoBracketsForCountry(company?.countryCode, prev.socsoBrackets),
                      foreignProvidentFundEmployerPct: foreignPf.employerPct,
                      foreignProvidentFundEmployeePct: foreignPf.employeePct,
                      foreignSocsoEmployerPct: foreignSocsoForCountry(company?.countryCode, prev.foreignSocsoEmployerPct),
                    };
                  });
                  setError(null);
                }}
              >
                <option value="">— Select company —</option>
                {availableCompanies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Country</label>
              <input className={`${inputCls} mt-1`} value={country.name} readOnly />
            </div>

            <div className="flex items-end">
              <label className="flex items-center justify-between w-full text-xs gap-3">
                <span>Active</span>
                <ToggleSwitch checked={form.active} onChange={active => set('active', active)} label="Active pay structure" />
              </label>
            </div>

            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Pay Type *</label>
              <select className={`${selectCls} mt-1`} value={form.payType} onChange={e => set('payType', e.target.value)}>
                {PAY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Pay Cycle *</label>
              <select className={`${selectCls} mt-1`} value={form.payCycle} onChange={e => set('payCycle', e.target.value)}>
                {PAY_CYCLES.map(cycle => <option key={cycle} value={cycle}>{cycle}</option>)}
              </select>
            </div>

            <div className="col-span-2 space-y-3 border border-border rounded-lg p-3 bg-muted/20">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Overtime Calculation</label>
              <div className="flex flex-wrap gap-4">
                {OVERTIME_CALCULATION_MODES.map(mode => (
                  <label key={mode} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="overtimeCalculationMode"
                      checked={form.overtimeCalculationMode === mode}
                      onChange={() => setForm(prev => ({
                        ...prev,
                        overtimeCalculationMode: mode,
                        overtimeFixedHourlyRate: mode === 'Fixed' ? prev.overtimeFixedHourlyRate : null,
                      }))}
                      className="rounded-full border-border"
                    />
                    {mode === 'Calculated' ? 'Calculated from salary' : 'Fixed amount per hour'}
                  </label>
                ))}
              </div>

              {form.overtimeCalculationMode === 'Calculated' ? (
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Overtime Multiplier</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step="0.01"
                    className={`${inputCls} mt-1`}
                    value={form.overtimeRateMultiplier}
                    onChange={e => set('overtimeRateMultiplier', parseFloat(e.target.value) || 1.5)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Hourly rate = salary ({form.payCycle === 'Weekly' ? 'weekly' : 'monthly'}) ÷ (work days × working hours), then × multiplier (e.g. 1.5 = time-and-a-half).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Fixed Hourly Rate</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${inputCls} mt-1`}
                    value={form.overtimeFixedHourlyRate ?? ''}
                    onChange={e => set('overtimeFixedHourlyRate', e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Flat amount paid per overtime hour (multiplier not applied).</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            {isMalaysia ? (
              <MalaysiaProvidentFundSection
                brackets={form.providentFundBrackets}
                onChange={providentFundBrackets => setForm(prev => ({ ...prev, providentFundBrackets }))}
                foreignEmployerPct={form.foreignProvidentFundEmployerPct}
                foreignEmployeePct={form.foreignProvidentFundEmployeePct}
                onForeignChange={patch => setForm(prev => ({
                  ...prev,
                  foreignProvidentFundEmployerPct: patch.employerPct ?? prev.foreignProvidentFundEmployerPct,
                  foreignProvidentFundEmployeePct: patch.employeePct ?? prev.foreignProvidentFundEmployeePct,
                }))}
              />
            ) : (
              <>
                <h4 className="text-sm font-semibold">Provident Fund (%)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company Contribution</label>
                    <input type="number" min="0" max="100" step="0.01" className={`${inputCls} mt-1`} value={form.providentFundEmployerPct} onChange={e => set('providentFundEmployerPct', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Employee Contribution</label>
                    <input type="number" min="0" max="100" step="0.01" className={`${inputCls} mt-1`} value={form.providentFundEmployeePct} onChange={e => set('providentFundEmployeePct', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </>
            )}
          </div>

          {isMalaysia && (
            <div className="space-y-3 pt-2 border-t border-border">
              <MalaysiaSocsoSection
                brackets={form.socsoBrackets}
                onChange={socsoBrackets => setForm(prev => ({ ...prev, socsoBrackets }))}
                foreignEmployerPct={form.foreignSocsoEmployerPct}
                onForeignChange={foreignSocsoEmployerPct => setForm(prev => ({ ...prev, foreignSocsoEmployerPct }))}
              />
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Other Mandatory Contributions</h4>
              <button type="button" onClick={addContribution} className="flex items-center gap-1 text-xs font-sans text-primary hover:underline">
                <Plus size={12} /> Add
              </button>
            </div>
            {form.mandatoryContributions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No additional mandatory contributions configured.</p>
            ) : (
              <div className="space-y-2">
                {form.mandatoryContributions.map((contribution, index) => (
                  <div key={index} className="grid grid-cols-[1fr_90px_90px_32px] gap-2 items-end">
                    <div>
                      {index === 0 && <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Name</label>}
                      <input className={`${inputCls} mt-1`} value={contribution.name} onChange={e => updateContribution(index, { name: e.target.value })} placeholder="e.g. SOCSO" />
                    </div>
                    <div>
                      {index === 0 && <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company %</label>}
                      <input type="number" min="0" max="100" step="0.01" className={`${inputCls} mt-1`} value={contribution.employerPct} onChange={e => updateContribution(index, { employerPct: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      {index === 0 && <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Employee %</label>}
                      <input type="number" min="0" max="100" step="0.01" className={`${inputCls} mt-1`} value={contribution.employeePct} onChange={e => updateContribution(index, { employeePct: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <button type="button" onClick={() => removeContribution(index)} className="p-2 rounded hover:bg-muted text-destructive">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving || !form.companyId} className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50">
            {isNew ? 'Add Pay Structure' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export function PayStructureTab() {
  const [structures, setStructures] = useState<PayStructure[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [panelStructure, setPanelStructure] = useState<PayStructure | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const configuredCompanyIds = new Set(structures.map(s => s.companyId));

  const load = useCallback(async () => {
    const companyList = await api.companies().catch(() => [] as Company[]);
    setCompanies(companyList);

    try {
      setStructures(await hrApi.payStructures.list());
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('404')) {
        setError('Pay Structure API is unavailable. Restart the API: dotnet run --project src/Bisync.Api');
      } else {
        setError(message);
      }
      setStructures([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [load]);

  function openAdd() {
    setPanelStructure(null);
    setIsNew(true);
    setError(null);
  }

  function openEdit(structure: PayStructure) {
    setPanelStructure(structure);
    setIsNew(false);
  }

  function closePanel() {
    setPanelStructure(null);
    setIsNew(false);
  }

  async function toggleActive(structure: PayStructure, active: boolean) {
    const payload = formToPayStructureRequest(
      payStructureToForm({ ...structure, active }),
      structure.countryCode,
    );
    const updated = await hrApi.payStructures.update(structure.id, payload);
    setStructures(prev => prev.map(s => (s.id === structure.id ? updated : s)));
  }

  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<PayStructureSortColumn>();

  useEffect(() => { resetSort(); }, [structures, resetSort]);

  const sortedStructures = useMemo(
    () =>
      sortTableRows(
        structures,
        sortColumn,
        sortDirection,
        {
          company: s => s.companyName,
          country: s => getCountry(s.countryCode).name,
          payType: s => s.payType,
          payCycle: s => s.payCycle,
          pf: s => formatProvidentFundSummary(s),
          socso: s => formatSocsoSummary(s),
          otherContributions: s => s.mandatoryContributions.length,
          active: s => s.active !== false,
        },
        { tieBreaker: (a, b) => compareSortValues(a.companyName, b.companyName) },
      ),
    [structures, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedStructures,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedStructures, { scrollRootRef });

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">{error}</div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Configure pay types and statutory contributions by company</p>
        <button
          type="button"
          onClick={openAdd}
          disabled={configuredCompanyIds.size >= companies.length}
          className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-2 rounded-md hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={14} /> Add Pay Structure
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading pay structures…</p>
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <SortableTableHeaderRow
                columns={PAY_STRUCTURE_TABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className=""
              />
            </thead>
            <tbody className="divide-y divide-border">
              {pagedStructures.map(structure => (
                  <tr
                    key={structure.id}
                    className={`hover:bg-muted/20 cursor-pointer ${structure.active === false ? 'opacity-60' : ''}`}
                    onClick={() => openEdit(structure)}
                  >
                    <td className="px-4 py-3 font-medium text-primary hover:underline">{structure.companyName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getCountry(structure.countryCode).name}</td>
                    <td className="px-4 py-3">{structure.payType}</td>
                    <td className="px-4 py-3 text-muted-foreground">{structure.payCycle}</td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">
                      {formatProvidentFundSummary(structure)}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">
                      {formatSocsoSummary(structure)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {structure.mandatoryContributions.length > 0
                        ? `${structure.mandatoryContributions.length} configured`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <ToggleSwitch
                        checked={structure.active !== false}
                        onChange={v => void toggleActive(structure, v)}
                        label={structure.active === false ? 'Activate pay structure' : 'Deactivate pay structure'}
                      />
                    </td>
                  </tr>
              ))}
              {structures.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No pay structures yet. Add a pay structure for a company to get started.
                  </td>
                </tr>
              )}
              <InfiniteScrollTableSentinel colSpan={8} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
          </TableScrollContainer>
        )}
      </div>

      {(isNew || panelStructure) && (
        <PayStructurePanel
          structure={panelStructure}
          companies={companies}
          configuredCompanyIds={configuredCompanyIds}
          isNew={isNew}
          onClose={closePanel}
          onSave={() => void load()}
        />
      )}
    </div>
  );
}
