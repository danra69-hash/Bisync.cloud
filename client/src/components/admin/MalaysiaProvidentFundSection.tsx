import { Plus } from 'lucide-react';
import { inputCls } from '../../data/countries';
import type { ProvidentFundBracketItem } from '../../modules/hr/types';

const thCls = 'text-left px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal whitespace-nowrap';
const cellInputCls = `${inputCls} py-1.5 min-w-0`;

type Props = {
  brackets: ProvidentFundBracketItem[];
  onChange: (brackets: ProvidentFundBracketItem[]) => void;
  foreignEmployerPct: number;
  foreignEmployeePct: number;
  onForeignChange: (patch: { employerPct?: number; employeePct?: number }) => void;
};

export function MalaysiaProvidentFundSection({
  brackets,
  onChange,
  foreignEmployerPct,
  foreignEmployeePct,
  onForeignChange,
}: Props) {
  function update(index: number, patch: Partial<ProvidentFundBracketItem>) {
    onChange(brackets.map((bracket, i) => (i === index ? { ...bracket, ...patch } : bracket)));
  }

  function addBracket() {
    onChange([
      ...brackets,
      { employerPct: 0, employeePct: 0, noContribution: false },
    ]);
  }

  function updatePct(index: number, patch: Partial<Pick<ProvidentFundBracketItem, 'employerPct' | 'employeePct'>>) {
    const bracket = brackets[index];
    const employerPct = patch.employerPct ?? bracket.employerPct;
    const employeePct = patch.employeePct ?? bracket.employeePct;
    update(index, {
      employerPct,
      employeePct,
      noContribution: employerPct === 0 && employeePct === 0,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h4 className="text-sm font-semibold">Provident Fund (EPF) — Malaysian employees</h4>
            <p className="text-[10px] text-muted-foreground mt-1">
              Applies when the business is in Malaysia and the employee is Malaysian. Revise age, salary thresholds, or percentages when regulations change.
            </p>
          </div>
          <button type="button" onClick={addBracket} className="flex items-center gap-1 text-xs font-mono text-primary hover:underline shrink-0">
            <Plus size={12} /> Add tier
          </button>
        </div>

        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs min-w-[520px]">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {['Min Age', 'Max Age', 'Min Salary (RM)', 'Max Salary (RM)', 'Company %', 'Employee %'].map(h => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {brackets.map((bracket, index) => (
                <tr key={index} className="hover:bg-muted/20">
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      className={cellInputCls}
                      value={bracket.minAge ?? ''}
                      onChange={e => update(index, { minAge: e.target.value ? Number(e.target.value) : null })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      className={cellInputCls}
                      value={bracket.maxAge ?? ''}
                      onChange={e => update(index, { maxAge: e.target.value ? Number(e.target.value) : null })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cellInputCls}
                      value={bracket.minMonthlySalary ?? ''}
                      onChange={e => update(index, { minMonthlySalary: e.target.value ? Number(e.target.value) : null })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cellInputCls}
                      value={bracket.maxMonthlySalary ?? ''}
                      onChange={e => update(index, { maxMonthlySalary: e.target.value ? Number(e.target.value) : null })}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className={cellInputCls}
                      value={bracket.employerPct}
                      onChange={e => updatePct(index, { employerPct: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className={cellInputCls}
                      value={bracket.employeePct}
                      onChange={e => updatePct(index, { employeePct: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                </tr>
              ))}
              {brackets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground italic">
                    No EPF tiers configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3">
          <h4 className="text-sm font-semibold">Provident Fund (EPF) — Foreign employees</h4>
          <p className="text-[10px] text-muted-foreground mt-1">
            Applies when the business is in Malaysia but the employee is not Malaysian. No age or salary conditions.
          </p>
        </div>

        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={thCls}>Min Age</th>
                <th className={thCls}>Max Age</th>
                <th className={thCls}>Min Salary (RM)</th>
                <th className={thCls}>Max Salary (RM)</th>
                <th className={thCls}>Company %</th>
                <th className={thCls}>Employee %</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-muted/20">
                <td className="px-2 py-2 text-muted-foreground italic">—</td>
                <td className="px-2 py-2 text-muted-foreground italic">—</td>
                <td className="px-2 py-2 text-muted-foreground italic">—</td>
                <td className="px-2 py-2 text-muted-foreground italic">—</td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className={cellInputCls}
                    value={foreignEmployerPct}
                    onChange={e => onForeignChange({ employerPct: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className={cellInputCls}
                    value={foreignEmployeePct}
                    onChange={e => onForeignChange({ employeePct: parseFloat(e.target.value) || 0 })}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
