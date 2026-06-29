import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { inputCls, selectCls } from '../../data/countries';import type { DivisionTreeNode, Employee, PayStructure, PayrollOtherAllowance } from '../../modules/hr/types';
import { SIDE_PANEL_ROOT_CLS, SIDE_PANEL_SHELL_WIDE_CLS } from '../layout/sidePanelShared';
import {
  employeeDepartmentName,
  employeeDivisionName,
  employeeLocationLabel,
} from './employeeOrgDisplay';
import { BankNameField } from './BankNameField';
import { MALAYSIA_MOBILE_OPERATORS, formatOvertimeConfigLabel } from './payrollAllowanceShared';
import { calcEmployeeContributions } from './payrollContributionShared';
import { formatJoinDate, formatPayrollAmount, parsePayrollAmount } from './payrollDisplay';import type { AppUser } from '../../api';

type Props = {
  employee: Employee;
  orgTree: DivisionTreeNode[];
  platformUsers: AppUser[];
  payStructure: PayStructure | null;
  companyCountryCode?: string | null;
  customBanks: string[];
  onAddCustomBank: (name: string) => void;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onUpdate: (patch: Partial<Employee>) => void;
  onClearError: () => void;
};

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function ProvidedCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-border"
      />
      {label}
    </label>
  );
}

function AmountField({
  label,
  value,
  countryCode,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  countryCode: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value ?? ''}
        onChange={e => onChange(parsePayrollAmount(e.target.value))}
        className={`${inputCls} mt-1`}
        placeholder="0.00"
      />
      {value != null && (
        <p className="text-[10px] text-muted-foreground mt-1">{formatPayrollAmount(value, countryCode)}</p>
      )}
    </div>
  );
}

function ContributionCard({
  title,
  employeeAmount,
  employerAmount,
  basisLabel,
  countryCode,
}: {
  title: string;
  employeeAmount: number;
  employerAmount: number;
  basisLabel: string;
  countryCode: string;
}) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <h5 className="text-xs font-semibold">{title}</h5>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Employee</div>
          <div className="mt-1 font-mono font-medium">{formatPayrollAmount(employeeAmount, countryCode)}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Employer</div>
          <div className="mt-1 font-mono font-medium">{formatPayrollAmount(employerAmount, countryCode)}</div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{basisLabel}</p>
    </div>
  );
}

export function PayrollEmployeeDetailPanel({
  employee,
  orgTree,
  platformUsers,
  payStructure,
  companyCountryCode,
  customBanks,
  onAddCustomBank,
  saving,
  error,
  onClose,
  onSave,
  onUpdate,
  onClearError,
}: Props) {
  const countryCode = payStructure?.countryCode ?? 'MY';
  const payCycle = payStructure?.payCycle ?? 'Not configured';
  const otherAllowances = employee.otherAllowances ?? [];
  const contributions = useMemo(
    () => calcEmployeeContributions(employee, payStructure),
    [employee, payStructure],
  );
  function setOtherAllowances(items: PayrollOtherAllowance[]) {
    onUpdate({ otherAllowances: items });
  }

  function updateOtherAllowance(index: number, patch: Partial<PayrollOtherAllowance>) {
    setOtherAllowances(otherAllowances.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function setTransportProvided(checked: boolean) {
    onUpdate({
      transportProvided: checked,
      ...(!checked ? { transportCarModel: null, transportPlateNumber: null } : {}),
    });
  }

  function setAccommodationProvided(checked: boolean) {
    onUpdate({
      accommodationProvided: checked,
      ...(!checked ? {
        accommodationAddress: null,
        accommodationLeaseStart: null,
        accommodationLeaseEnd: null,
      } : {}),
    });
  }

  function setBonusEnabled(checked: boolean) {
    onUpdate({
      bonusEnabled: checked,
      ...(!checked ? {
        bonusMonthly: false,
        bonusAnnually: false,
        bonusAmount: null,
        bonusByBasicSalary: false,
        bonusByService: false,
      } : {}),
    });
  }

  function setMobileProvided(checked: boolean) {
    onUpdate({
      mobileProvided: checked,
      ...(!checked ? { mobileAllowancePhone: null, mobileProvider: null } : {}),
    });
  }

  return (
    <div className={SIDE_PANEL_ROOT_CLS}>
      <div className="absolute inset-0 bg-foreground/10" onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_WIDE_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {initials(employee.name)}
            </div>
            <div>
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Payroll</p>
              <h3 className="text-sm font-semibold">{employee.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {employee.employeeCode} · {employee.position}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex justify-between">
              <span>{error}</span>
              <button type="button" onClick={onClearError} className="hover:opacity-70">×</button>
            </div>
          )}

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Location</div>
                <div className="mt-1">{employeeLocationLabel(employee, platformUsers)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Date Joined</div>
                <div className="mt-1">{formatJoinDate(employee.joinDate)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Division</div>
                <div className="mt-1">{employeeDivisionName(employee, orgTree)}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Department</div>
                <div className="mt-1">{employeeDepartmentName(employee, orgTree)}</div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Details</h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Salary crediting account for payroll disbursement
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Bank</label>
                <BankNameField
                  value={employee.bankName}
                  companyCountryCode={companyCountryCode}
                  payStructureCountryCode={payStructure?.countryCode}
                  customBanks={customBanks}
                  onAddCustomBank={onAddCustomBank}
                  onChange={bankName => onUpdate({ bankName })}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Bank Account Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={employee.bankAccountNumber ?? ''}
                  onChange={e => onUpdate({ bankAccountNumber: e.target.value.replace(/\s/g, '') || null })}
                  className={`${inputCls} mt-1 font-mono`}
                  placeholder="Account number"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Name of Account Holder</label>
                <input
                  type="text"
                  value={employee.bankAccountHolderName ?? employee.name}
                  onChange={e => onUpdate({ bankAccountHolderName: e.target.value || null })}
                  className={`${inputCls} mt-1`}
                  placeholder={employee.name}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Defaults to employee name; adjust if the account is registered under a different name.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compensation</h4>
              <p className="text-[10px] text-muted-foreground mt-1">
                Payment cycle follows Pay Structure: <span className="font-medium text-foreground">{payCycle}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AmountField label="Base Salary" value={employee.baseSalary} countryCode={countryCode} onChange={v => onUpdate({ baseSalary: v })} />
              <AmountField label="Service" value={employee.serviceAllowance} countryCode={countryCode} onChange={v => onUpdate({ serviceAllowance: v })} />
            </div>

            <div className="space-y-3">
              <div>
                <h5 className="text-xs font-semibold">Statutory Contributions</h5>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Estimated monthly amounts from Pay Structure (HR Config) on base salary + service
                  {contributions ? ` · Contributable wage ${formatPayrollAmount(contributions.contributableWage, countryCode)}` : ''}
                </p>
              </div>
              {!payStructure ? (
                <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
                  Configure Pay Structure for this company to preview EPF and SOCSO.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ContributionCard
                    title="EPF Contribution"
                    employeeAmount={contributions?.epf.employee ?? 0}
                    employerAmount={contributions?.epf.employer ?? 0}
                    basisLabel={contributions?.epf.basisLabel ?? '—'}
                    countryCode={countryCode}
                  />
                  <ContributionCard
                    title="SOCSO"
                    employeeAmount={contributions?.socso.employee ?? 0}
                    employerAmount={contributions?.socso.employer ?? 0}
                    basisLabel={contributions?.socso.basisLabel ?? '—'}
                    countryCode={countryCode}
                  />
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">              <div className="flex flex-wrap items-center justify-between gap-3">
                <h5 className="text-xs font-semibold">Transport Allowances</h5>
                <ProvidedCheckbox checked={!!employee.transportProvided} label="Provided" onChange={setTransportProvided} />
              </div>
              <AmountField label="Amount" value={employee.transportAllowance} countryCode={countryCode} onChange={v => onUpdate({ transportAllowance: v })} />
              {employee.transportProvided && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Car Model</label>
                    <input
                      type="text"
                      value={employee.transportCarModel ?? ''}
                      onChange={e => onUpdate({ transportCarModel: e.target.value })}
                      className={`${inputCls} mt-1`}
                      placeholder="e.g. Toyota Vios"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Plate Number</label>
                    <input
                      type="text"
                      value={employee.transportPlateNumber ?? ''}
                      onChange={e => onUpdate({ transportPlateNumber: e.target.value })}
                      className={`${inputCls} mt-1`}
                      placeholder="e.g. WXY 1234"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h5 className="text-xs font-semibold">Accommodation</h5>
                <ProvidedCheckbox checked={!!employee.accommodationProvided} label="Provided" onChange={setAccommodationProvided} />
              </div>
              <AmountField label="Amount" value={employee.accommodationAllowance} countryCode={countryCode} onChange={v => onUpdate({ accommodationAllowance: v })} />
              {employee.accommodationProvided && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Address</label>
                    <textarea
                      value={employee.accommodationAddress ?? ''}
                      onChange={e => onUpdate({ accommodationAddress: e.target.value })}
                      className={`${inputCls} mt-1 min-h-[72px]`}
                      placeholder="Accommodation address"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Leasing Period</label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Start</label>
                        <input
                          type="date"
                          value={employee.accommodationLeaseStart ?? ''}
                          onChange={e => onUpdate({ accommodationLeaseStart: e.target.value || null })}
                          className={`${inputCls} mt-1`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">End</label>
                        <input
                          type="date"
                          value={employee.accommodationLeaseEnd ?? ''}
                          min={employee.accommodationLeaseStart ?? undefined}
                          onChange={e => onUpdate({ accommodationLeaseEnd: e.target.value || null })}
                          className={`${inputCls} mt-1`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h5 className="text-xs font-semibold">Mobile Allowances</h5>
                <ProvidedCheckbox checked={!!employee.mobileProvided} label="Provided" onChange={setMobileProvided} />
              </div>
              <AmountField label="Amount" value={employee.mobileAllowance} countryCode={countryCode} onChange={v => onUpdate({ mobileAllowance: v })} />
              {employee.mobileProvided && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Mobile Number</label>
                    <input
                      type="text"
                      value={employee.mobileAllowancePhone ?? ''}
                      onChange={e => onUpdate({ mobileAllowancePhone: e.target.value })}
                      className={`${inputCls} mt-1`}
                      placeholder="e.g. +60 12-345 6789"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Provider</label>
                    <select
                      value={employee.mobileProvider ?? ''}
                      onChange={e => onUpdate({ mobileProvider: e.target.value || null })}
                      className={`${selectCls} mt-1`}
                    >
                      <option value="">— Select provider —</option>
                      {MALAYSIA_MOBILE_OPERATORS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h5 className="text-xs font-semibold">Overtime Allowance</h5>
                <ProvidedCheckbox
                  checked={!!employee.overtimeAllowanceEnabled}
                  label="Enabled"
                  onChange={checked => onUpdate({ overtimeAllowanceEnabled: checked })}
                />
              </div>
              {employee.overtimeAllowanceEnabled && (
                <div className="text-xs bg-muted/40 border border-border rounded-md px-3 py-2">
                  {payStructure ? (
                    <p>
                      Overtime: <span className="font-medium">{formatOvertimeConfigLabel(payStructure, countryCode)}</span>
                      {' '}from Pay Structure ({payStructure.payType}, {payStructure.payCycle})
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Configure Pay Structure for this company to set the overtime rate.</p>
                  )}
                </div>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h5 className="text-xs font-semibold">Bonus</h5>
                <ProvidedCheckbox checked={!!employee.bonusEnabled} label="Enabled" onChange={setBonusEnabled} />
              </div>
              {employee.bonusEnabled && (
                <div className="space-y-4 pt-1">
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Frequency</p>
                    <div className="flex flex-wrap gap-6 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!employee.bonusMonthly}
                          onChange={e => onUpdate({ bonusMonthly: e.target.checked })}
                          className="rounded border-border"
                        />
                        Monthly
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!employee.bonusAnnually}
                          onChange={e => onUpdate({ bonusAnnually: e.target.checked })}
                          className="rounded border-border"
                        />
                        Annually
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Basis</p>
                    <div className="space-y-3">
                      <AmountField
                        label="Amount"
                        value={employee.bonusAmount}
                        countryCode={countryCode}
                        onChange={v => onUpdate({ bonusAmount: v })}
                      />
                      <div className="flex flex-wrap gap-6 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!employee.bonusByBasicSalary}
                            onChange={e => onUpdate({ bonusByBasicSalary: e.target.checked })}
                            className="rounded border-border"
                          />
                          Basic Salary
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!employee.bonusByService}
                            onChange={e => onUpdate({ bonusByService: e.target.checked })}
                            className="rounded border-border"
                          />
                          Service
                        </label>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        You may enter a fixed amount and/or select Basic Salary and Service (both can be selected).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other Allowances</h4>
              <button
                type="button"
                onClick={() => setOtherAllowances([...otherAllowances, { name: '', amount: 0 }])}
                className="flex items-center gap-1 text-[10px] font-mono border border-border rounded-md px-2 py-1 hover:bg-muted"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {otherAllowances.length === 0 ? (
              <p className="text-xs text-muted-foreground">No other allowances defined.</p>
            ) : (
              <div className="space-y-2">
                {otherAllowances.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Name</label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => updateOtherAllowance(index, { name: e.target.value })}
                        className={`${inputCls} mt-1`}
                        placeholder="Allowance name"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Amount</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.amount || ''}
                        onChange={e => updateOtherAllowance(index, { amount: parsePayrollAmount(e.target.value) ?? 0 })}
                        className={`${inputCls} mt-1`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtherAllowances(otherAllowances.filter((_, i) => i !== index))}
                      className="p-2 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30"
                      title="Remove allowance"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Permit</h4>
            <div className="flex flex-wrap gap-6 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={employee.workPermitByCompany === true}
                  onChange={e => onUpdate({ workPermitByCompany: e.target.checked ? true : null })}
                  className="rounded border-border"
                />
                Company
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={employee.workPermitByCompany === false}
                  onChange={e => onUpdate({ workPermitByCompany: e.target.checked ? false : null })}
                  className="rounded border-border"
                />
                Self
              </label>
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="text-xs font-mono border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
