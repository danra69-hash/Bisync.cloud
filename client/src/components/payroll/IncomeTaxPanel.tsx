import { Plus, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { inputCls, selectCls } from '../../data/countries';
import { hrApi } from '../../modules/hr/api';
import type {
  IncomeTaxBracketItem,
  IncomeTaxRebateItem,
  IncomeTaxReliefItem,
  IncomeTaxYear,
  IncomeTaxYearPreview,
} from '../../modules/hr/types';
import { formatPayrollAmount } from './payrollDisplay';
import { payrollYearOptions } from './payrollProcess';

const thCls = 'text-left px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal whitespace-nowrap';
const amountCls = 'px-3 py-2.5 text-right font-mono whitespace-nowrap text-xs';
const textCls = 'px-3 py-2.5 text-xs';
const cellInputCls = `${inputCls} py-1.5 min-w-0`;

type Props = {
  selectedCompanyId: number | null;
  countryCode?: string;
};

function formatBracketRange(min: number, max: number | null) {
  if (min === 0 && max != null) return `First RM ${max.toLocaleString()}`;
  if (max == null) return `RM ${(min + 1).toLocaleString()}+`;
  return `RM ${(min + 1).toLocaleString()} to RM ${max.toLocaleString()}`;
}

export function IncomeTaxPanel({ selectedCompanyId, countryCode = 'MY' }: Props) {
  const [year, setYear] = useState(2026);
  const [schedule, setSchedule] = useState<IncomeTaxYear | null>(null);
  const [brackets, setBrackets] = useState<IncomeTaxBracketItem[]>([]);
  const [reliefs, setReliefs] = useState<IncomeTaxReliefItem[]>([]);
  const [rebates, setRebates] = useState<IncomeTaxRebateItem[]>([]);
  const [preview, setPreview] = useState<IncomeTaxYearPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedCompanyId) {
      setSchedule(null);
      setBrackets([]);
      setReliefs([]);
      setRebates([]);
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const [scheduleResult, previewResult] = await Promise.all([
        hrApi.incomeTax.get(selectedCompanyId, year),
        hrApi.incomeTax.preview(selectedCompanyId, year),
      ]);
      setSchedule(scheduleResult);
      setBrackets(scheduleResult.brackets);
      setReliefs(scheduleResult.reliefs);
      setRebates(scheduleResult.rebates);
      setPreview(previewResult);
    } catch (e) {
      setSchedule(null);
      setBrackets([]);
      setReliefs([]);
      setRebates([]);
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, year]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayCountry = preview?.countryCode ?? schedule?.countryCode ?? countryCode;
  const fmt = (amount: number) => formatPayrollAmount(amount, displayCountry);

  async function handleSave() {
    if (!selectedCompanyId) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const saved = await hrApi.incomeTax.save(selectedCompanyId, year, {
        active: schedule?.active ?? true,
        brackets,
        reliefs,
        rebates,
      });
      setSchedule(saved);
      setBrackets(saved.brackets);
      setReliefs(saved.reliefs);
      setRebates(saved.rebates);
      const previewResult = await hrApi.incomeTax.preview(selectedCompanyId, year);
      setPreview(previewResult);
      setSaveMessage(`Income tax conditions for ${year} saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function updateBracket(index: number, patch: Partial<IncomeTaxBracketItem>) {
    setBrackets(prev => prev.map((bracket, i) => (i === index ? { ...bracket, ...patch } : bracket)));
  }

  function addBracket() {
    const last = brackets[brackets.length - 1];
    const nextMin = last?.maxAnnualChargeableIncome ?? last?.minAnnualChargeableIncome ?? 0;
    setBrackets(prev => [
      ...prev,
      { minAnnualChargeableIncome: nextMin, maxAnnualChargeableIncome: null, ratePct: 0, baseMinTaxAmount: 0 },
    ]);
  }

  function updateRelief(index: number, patch: Partial<IncomeTaxReliefItem>) {
    setReliefs(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addRelief() {
    setReliefs(prev => [...prev, { name: '', amount: 0, isMaximum: false, applyCondition: null }]);
  }

  function updateRebate(index: number, patch: Partial<IncomeTaxRebateItem>) {
    setRebates(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addRebate() {
    setRebates(prev => [...prev, { name: '', amount: 0 }]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="income-tax-year" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Assessment year
          </label>
          <select
            id="income-tax-year"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className={`${selectCls} mt-1 min-w-[120px]`}
          >
            {payrollYearOptions(2026).map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        {selectedCompanyId && schedule && !loading && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save all conditions'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          {saveMessage}
        </div>
      )}

      {selectedCompanyId && loading && (
        <p className="text-sm text-muted-foreground">Loading income tax for {year}…</p>
      )}

      {selectedCompanyId && !loading && schedule && (
        <>
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Progressive tax rate — {year}</h3>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Gross income − EPF (employee) − Tax relief = Base tax amount → apply progressive rate → − Rebate = Annual tax
                </p>
              </div>
              <button
                type="button"
                onClick={addBracket}
                className="flex items-center gap-1 text-xs font-mono text-primary hover:underline shrink-0"
              >
                <Plus size={12} /> Add bracket
              </button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {['Chargeable income', 'From (RM)', 'To (RM)', 'Rate %', 'Base tax amount (min)'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {brackets.map((bracket, index) => (
                    <tr key={index} className="hover:bg-muted/20">
                      <td className={`${textCls} text-muted-foreground whitespace-nowrap`}>
                        {formatBracketRange(bracket.minAnnualChargeableIncome, bracket.maxAnnualChargeableIncome)}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cellInputCls}
                          value={bracket.minAnnualChargeableIncome}
                          onChange={e => updateBracket(index, { minAnnualChargeableIncome: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cellInputCls}
                          value={bracket.maxAnnualChargeableIncome ?? ''}
                          onChange={e => updateBracket(index, {
                            maxAnnualChargeableIncome: e.target.value ? Number(e.target.value) : null,
                          })}
                          placeholder="No limit"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className={cellInputCls}
                          value={bracket.ratePct}
                          onChange={e => updateBracket(index, { ratePct: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cellInputCls}
                          value={bracket.baseMinTaxAmount}
                          onChange={e => updateBracket(index, { baseMinTaxAmount: Number(e.target.value) || 0 })}
                        />
                      </td>
                    </tr>
                  ))}
                  {brackets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No brackets configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Tax relief</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Relief items deducted from gross income (after EPF) before applying the progressive rate.
                </p>
              </div>
              <button
                type="button"
                onClick={addRelief}
                className="flex items-center gap-1 text-xs font-mono text-primary hover:underline shrink-0"
              >
                <Plus size={12} /> Add relief
              </button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs min-w-[720px]">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {['Relief name', 'Amount (RM)', 'Limit', 'Applies when'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reliefs.map((relief, index) => (
                    <tr key={index} className="hover:bg-muted/20">
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          className={cellInputCls}
                          value={relief.name}
                          onChange={e => updateRelief(index, { name: e.target.value })}
                          placeholder="Relief description"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cellInputCls}
                          value={relief.amount}
                          onChange={e => updateRelief(index, { amount: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={cellInputCls}
                          value={relief.isMaximum ? 'maximum' : 'fixed'}
                          onChange={e => updateRelief(index, { isMaximum: e.target.value === 'maximum' })}
                        >
                          <option value="fixed">Fixed</option>
                          <option value="maximum">Up to</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={cellInputCls}
                          value={relief.applyCondition ?? ''}
                          onChange={e => updateRelief(index, { applyCondition: e.target.value || null })}
                        >
                          <option value="">All employees</option>
                          <option value="Married">Married employees only</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {reliefs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No tax relief items yet. Add relief types for {year}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Rebate</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Rebate amounts deducted after the progressive tax is calculated.
                </p>
              </div>
              <button
                type="button"
                onClick={addRebate}
                className="flex items-center gap-1 text-xs font-mono text-primary hover:underline shrink-0"
              >
                <Plus size={12} /> Add rebate
              </button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {['Rebate name', 'Amount (RM)'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rebates.map((rebate, index) => (
                    <tr key={index} className="hover:bg-muted/20">
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          className={cellInputCls}
                          value={rebate.name}
                          onChange={e => updateRebate(index, { name: e.target.value })}
                          placeholder="e.g. Tax rebate"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cellInputCls}
                          value={rebate.amount}
                          onChange={e => updateRebate(index, { amount: Number(e.target.value) || 0 })}
                        />
                      </td>
                    </tr>
                  ))}
                  {rebates.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                        No rebate items yet. Add rebate types for {year}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {preview && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Assessment year" value={String(preview.year)} />
                <SummaryCard label="Employees" value={String(preview.employeeCount)} />
                <SummaryCard label="Total annual gross" value={fmt(preview.totalAnnualGross)} />
                <SummaryCard label="Total annual tax" value={preview.totalAnnualTax > 0 ? fmt(preview.totalAnnualTax) : '—'} />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Employee projections use: annual gross − annual EPF − configured tax relief → progressive tax − configured rebate.
                Estimated total monthly PCB: {preview.totalMonthlyPcb > 0 ? fmt(preview.totalMonthlyPcb) : '—'}.
              </div>

              <div className="bg-card border border-border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className={thCls}>Employee ID</th>
                      <th className={thCls}>Employee</th>
                      <th className={thCls}>Position</th>
                      <th className={`${thCls} text-right`}>Annual Gross</th>
                      <th className={`${thCls} text-right`}>EPF</th>
                      <th className={`${thCls} text-right`}>Base Tax Amount</th>
                      <th className={`${thCls} text-right`}>Annual Tax</th>
                      <th className={`${thCls} text-right`}>Monthly PCB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map(line => (
                      <tr key={line.employeeId} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className={`${textCls} font-mono`}>{line.employeeCode}</td>
                        <td className={`${textCls} font-medium whitespace-nowrap`}>{line.employeeName}</td>
                        <td className={textCls}>{line.position || '—'}</td>
                        <td className={amountCls}>{fmt(line.annualGross)}</td>
                        <td className={amountCls}>{fmt(line.annualEpfEmployee)}</td>
                        <td className={amountCls}>{fmt(line.baseTaxAmount)}</td>
                        <td className={amountCls}>{line.annualTax > 0 ? fmt(line.annualTax) : '—'}</td>
                        <td className={`${amountCls} font-semibold`}>{line.monthlyPcb > 0 ? fmt(line.monthlyPcb) : '—'}</td>
                      </tr>
                    ))}
                    {preview.lines.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No employees for this company.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
