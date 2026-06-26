import { inputCls } from '../../data/countries';
import type { SocsoBracketItem } from '../../modules/hr/types';
import { formatSocsoSalaryRange } from './malaysiaSocsoDefaults';

const thCls = 'text-left px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal whitespace-nowrap';
const cellInputCls = `${inputCls} py-1.5 min-w-0`;

type Props = {
  brackets: SocsoBracketItem[];
  onChange: (brackets: SocsoBracketItem[]) => void;
  foreignEmployerPct: number;
  onForeignChange: (employerPct: number) => void;
};

function SocsoCategoryTable({
  title,
  description,
  brackets,
  allBrackets,
  onChange,
}: {
  title: string;
  description: string;
  brackets: SocsoBracketItem[];
  allBrackets: SocsoBracketItem[];
  onChange: (brackets: SocsoBracketItem[]) => void;
}) {
  function update(bracket: SocsoBracketItem, patch: Partial<SocsoBracketItem>) {
    onChange(allBrackets.map(b => (b === bracket ? { ...b, ...patch } : b)));
  }

  return (
    <div>
      <div className="mb-2">
        <h5 className="text-xs font-semibold">{title}</h5>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="max-h-56 overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs min-w-[420px]">
            <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
              <tr>
                {['Salary Range', 'Company (RM)', 'Employee (RM)'].map(h => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {brackets.map((bracket, index) => (
                <tr key={index} className="hover:bg-muted/20">
                  <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                    {formatSocsoSalaryRange(bracket)}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cellInputCls}
                      value={bracket.employerAmount}
                      onChange={e => update(bracket, { employerAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cellInputCls}
                      value={bracket.employeeAmount}
                      onChange={e => update(bracket, { employeeAmount: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MalaysiaSocsoSection({ brackets, onChange, foreignEmployerPct, onForeignChange }: Props) {
  const under60 = brackets.filter(b => b.maxAge === 59);
  const age60Plus = brackets.filter(b => b.minAge === 60);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">SOCSO — Malaysian employees</h4>
        <p className="text-[10px] text-muted-foreground mt-1">
          PERKESO contribution table (effective June 2026). Applies when the business and employee are Malaysian. Amounts are fixed monthly contributions by salary range.
        </p>
      </div>

      <SocsoCategoryTable
        title="Category 1 — Under 60"
        description="Employment Injury, Invalidity and Non-Employment Injury schemes."
        brackets={under60}
        allBrackets={brackets}
        onChange={onChange}
      />

      <SocsoCategoryTable
        title="Category 2 — Age 60 and above"
        description="Employment Injury and Non-Employment Injury schemes."
        brackets={age60Plus}
        allBrackets={brackets}
        onChange={onChange}
      />

      <div>
        <div className="mb-3">
          <h4 className="text-sm font-semibold">SOCSO — Foreign employees</h4>
          <p className="text-[10px] text-muted-foreground mt-1">
            Flat company contribution when the business is in Malaysia but the employee is not Malaysian. No employee contribution.
          </p>
        </div>

        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={thCls}>Salary Range</th>
                <th className={thCls}>Company %</th>
                <th className={thCls}>Employee %</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-muted/20">
                <td className="px-2 py-2 text-muted-foreground italic">Any salary</td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className={cellInputCls}
                    value={foreignEmployerPct}
                    onChange={e => onForeignChange(parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="px-2 py-2 text-muted-foreground">0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
