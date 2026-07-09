import type { MandatoryContributionItem, PayStructure, PayStructureRequest, ProvidentFundBracketItem, SocsoBracketItem } from '../../modules/hr/types';
import { formatCountryCurrency } from '../../utils/numberFormat';
import { MALAYSIA_DEFAULT_FOREIGN_SOCSO_EMPLOYER, MALAYSIA_DEFAULT_SOCSO_BRACKETS } from './malaysiaSocsoDefaults';

export const PAY_TYPES = ['Fixed Salary', 'Hourly', 'Daily', 'Contract'] as const;
export const PAY_CYCLES = ['Weekly', 'Bi-Weekly', 'Semi-Monthly', 'Monthly'] as const;
export const OVERTIME_CALCULATION_MODES = ['Calculated', 'Fixed'] as const;
export type OvertimeCalculationMode = typeof OVERTIME_CALCULATION_MODES[number];

export const MALAYSIA_DEFAULT_FOREIGN_PF_EMPLOYER = 2;
export const MALAYSIA_DEFAULT_FOREIGN_PF_EMPLOYEE = 2;

export const MALAYSIA_DEFAULT_PF_BRACKETS = (): ProvidentFundBracketItem[] => [
  {
    maxAge: 59,
    maxMonthlySalary: 5000,
    employerPct: 13,
    employeePct: 11,
    noContribution: false,
  },
  {
    maxAge: 59,
    minMonthlySalary: 5000.01,
    employerPct: 13,
    employeePct: 11,
    noContribution: false,
  },
  {
    minAge: 60,
    employerPct: 0,
    employeePct: 0,
    noContribution: false,
  },
];

export type PayStructureForm = {
  companyId: number | null;
  payType: string;
  payCycle: string;
  providentFundEmployerPct: number;
  providentFundEmployeePct: number;
  providentFundBrackets: ProvidentFundBracketItem[];
  foreignProvidentFundEmployerPct: number;
  foreignProvidentFundEmployeePct: number;
  foreignSocsoEmployerPct: number;
  active: boolean;
  mandatoryContributions: MandatoryContributionItem[];
  socsoBrackets: SocsoBracketItem[];
  overtimeRateMultiplier: number;
  overtimeCalculationMode: OvertimeCalculationMode;
  overtimeFixedHourlyRate: number | null;
};

export const emptyPayStructureForm = (): PayStructureForm => ({
  companyId: null,
  payType: 'Fixed Salary',
  payCycle: 'Monthly',
  providentFundEmployerPct: 0,
  providentFundEmployeePct: 0,
  providentFundBrackets: [],
  foreignProvidentFundEmployerPct: MALAYSIA_DEFAULT_FOREIGN_PF_EMPLOYER,
  foreignProvidentFundEmployeePct: MALAYSIA_DEFAULT_FOREIGN_PF_EMPLOYEE,
  foreignSocsoEmployerPct: MALAYSIA_DEFAULT_FOREIGN_SOCSO_EMPLOYER,
  overtimeRateMultiplier: 1.5,
  overtimeCalculationMode: 'Calculated',
  overtimeFixedHourlyRate: null,
  active: true,
  mandatoryContributions: [],
  socsoBrackets: [],
});

export function isMalaysiaCountryCode(countryCode?: string | null) {
  return countryCode === 'MY';
}

export function bracketsForCountry(countryCode?: string | null, existing: ProvidentFundBracketItem[] = []) {
  if (!isMalaysiaCountryCode(countryCode)) return [];
  if (existing.length > 0) return existing.map(b => ({
    ...b,
    employerPct: b.noContribution ? 0 : b.employerPct,
    employeePct: b.noContribution ? 0 : b.employeePct,
    noContribution: false,
  }));
  return MALAYSIA_DEFAULT_PF_BRACKETS();
}

export function socsoBracketsForCountry(countryCode?: string | null, existing: SocsoBracketItem[] = []) {
  if (!isMalaysiaCountryCode(countryCode)) return [];
  if (existing.length > 0) return existing.map(b => ({ ...b }));
  return MALAYSIA_DEFAULT_SOCSO_BRACKETS();
}

export function foreignSocsoForCountry(countryCode?: string | null, existing?: number) {
  if (!isMalaysiaCountryCode(countryCode)) return 0;
  return existing ?? MALAYSIA_DEFAULT_FOREIGN_SOCSO_EMPLOYER;
}

export function foreignPfForCountry(countryCode?: string | null, existing?: { employerPct: number; employeePct: number }) {
  if (!isMalaysiaCountryCode(countryCode)) {
    return { employerPct: 0, employeePct: 0 };
  }
  return {
    employerPct: existing?.employerPct ?? MALAYSIA_DEFAULT_FOREIGN_PF_EMPLOYER,
    employeePct: existing?.employeePct ?? MALAYSIA_DEFAULT_FOREIGN_PF_EMPLOYEE,
  };
}

export function payStructureToForm(structure: PayStructure): PayStructureForm {
  const foreignPf = foreignPfForCountry(structure.countryCode, {
    employerPct: structure.foreignProvidentFundEmployerPct,
    employeePct: structure.foreignProvidentFundEmployeePct,
  });
  return {
    companyId: structure.companyId,
    payType: structure.payType,
    payCycle: structure.payCycle,
    providentFundEmployerPct: structure.providentFundEmployerPct,
    providentFundEmployeePct: structure.providentFundEmployeePct,
    providentFundBrackets: bracketsForCountry(structure.countryCode, structure.providentFundBrackets ?? []),
    foreignProvidentFundEmployerPct: foreignPf.employerPct,
    foreignProvidentFundEmployeePct: foreignPf.employeePct,
    foreignSocsoEmployerPct: foreignSocsoForCountry(structure.countryCode, structure.foreignSocsoEmployerPct),
    overtimeRateMultiplier: structure.overtimeRateMultiplier ?? 1.5,
    overtimeCalculationMode: structure.overtimeCalculationMode === 'Fixed' ? 'Fixed' : 'Calculated',
    overtimeFixedHourlyRate: structure.overtimeFixedHourlyRate ?? null,
    active: structure.active !== false,
    mandatoryContributions: structure.mandatoryContributions.map(c => ({ ...c })),
    socsoBrackets: socsoBracketsForCountry(structure.countryCode, structure.socsoBrackets ?? []),
  };
}

export function formToPayStructureRequest(form: PayStructureForm, countryCode: string): PayStructureRequest {
  const malaysia = isMalaysiaCountryCode(countryCode);
  return {
    companyId: form.companyId!,
    payType: form.payType,
    payCycle: form.payCycle,
    providentFundEmployerPct: form.providentFundEmployerPct,
    providentFundEmployeePct: form.providentFundEmployeePct,
    foreignProvidentFundEmployerPct: malaysia ? form.foreignProvidentFundEmployerPct : 0,
    foreignProvidentFundEmployeePct: malaysia ? form.foreignProvidentFundEmployeePct : 0,
    foreignSocsoEmployerPct: malaysia ? form.foreignSocsoEmployerPct : 0,
    overtimeRateMultiplier: form.overtimeRateMultiplier > 0 ? form.overtimeRateMultiplier : 1.5,
    overtimeCalculationMode: form.overtimeCalculationMode,
    overtimeFixedHourlyRate: form.overtimeCalculationMode === 'Fixed' ? form.overtimeFixedHourlyRate : null,
    active: form.active,
    providentFundBrackets: malaysia
      ? form.providentFundBrackets.map(b => {
          const noContribution = b.employerPct === 0 && b.employeePct === 0;
          return {
            id: b.id,
            minAge: b.minAge ?? null,
            maxAge: b.maxAge ?? null,
            minMonthlySalary: b.minMonthlySalary ?? null,
            maxMonthlySalary: b.maxMonthlySalary ?? null,
            employerPct: b.employerPct,
            employeePct: b.employeePct,
            noContribution,
          };
        })
      : [],
    socsoBrackets: malaysia
      ? form.socsoBrackets.map(b => ({
          id: b.id,
          minAge: b.minAge ?? null,
          maxAge: b.maxAge ?? null,
          minMonthlySalary: b.minMonthlySalary ?? null,
          maxMonthlySalary: b.maxMonthlySalary ?? null,
          employerAmount: b.employerAmount,
          employeeAmount: b.employeeAmount,
        }))
      : [],
    mandatoryContributions: form.mandatoryContributions
      .filter(c => c.name.trim())
      .map(c => ({
        id: c.id,
        name: c.name.trim(),
        employerPct: c.employerPct,
        employeePct: c.employeePct,
      })),
  };
}

export function validatePayStructureForm(form: PayStructureForm, countryCode: string): string | null {
  if (!form.companyId) return 'Company is required.';
  if (!form.payType) return 'Pay type is required.';
  if (!form.payCycle) return 'Pay cycle is required.';
  if (isMalaysiaCountryCode(countryCode) && form.providentFundBrackets.length === 0) {
    return 'At least one Malaysia EPF bracket is required.';
  }
  if (isMalaysiaCountryCode(countryCode) && form.socsoBrackets.length === 0) {
    return 'Malaysia SOCSO contribution table is required.';
  }
  if (form.overtimeCalculationMode === 'Fixed' && (!form.overtimeFixedHourlyRate || form.overtimeFixedHourlyRate <= 0)) {
    return 'Enter a fixed overtime hourly rate greater than zero.';
  }
  return null;
}

export function formatSocsoSummary(structure: Pick<PayStructure, 'countryCode' | 'socsoBrackets' | 'foreignSocsoEmployerPct'>) {
  if (!isMalaysiaCountryCode(structure.countryCode)) return '—';
  const count = structure.socsoBrackets?.length ?? 0;
  const foreign = foreignSocsoForCountry(structure.countryCode, structure.foreignSocsoEmployerPct);
  if (count === 0) return `Foreign ${foreign}%`;
  const first = structure.socsoBrackets?.find(b => b.maxAge === 59);
  const malaysian = first
    ? `${formatCountryCurrency(first.employerAmount, structure.countryCode)} / ${formatCountryCurrency(first.employeeAmount, structure.countryCode)}`
    : 'tiered';
  return `MY ${malaysian} · Foreign ${foreign}%`;
}

export function formatProvidentFundSummary(structure: Pick<PayStructure, 'countryCode' | 'providentFundBrackets' | 'providentFundEmployerPct' | 'providentFundEmployeePct' | 'foreignProvidentFundEmployerPct' | 'foreignProvidentFundEmployeePct'>) {
  if (isMalaysiaCountryCode(structure.countryCode)) {
    const count = structure.providentFundBrackets?.length ?? 0;
    const foreign = foreignPfForCountry(structure.countryCode, {
      employerPct: structure.foreignProvidentFundEmployerPct,
      employeePct: structure.foreignProvidentFundEmployeePct,
    });
    if (count === 0) return `Foreign ${foreign.employerPct}% / ${foreign.employeePct}%`;
    const first = structure.providentFundBrackets?.find(b => b.employerPct > 0 || b.employeePct > 0);
    const malaysian = !first ? 'no contribution' : `${first.employerPct}% / ${first.employeePct}%`;
    return `MY ${malaysian} · Foreign ${foreign.employerPct}% / ${foreign.employeePct}%`;
  }
  return `${structure.providentFundEmployerPct}% / ${structure.providentFundEmployeePct}%`;
}

export function bracketLabel(bracket: ProvidentFundBracketItem): string {
  if (bracket.noContribution) {
    const from = bracket.minAge != null ? `Age ${bracket.minAge}+` : 'Above age limit';
    return `${from} · no contribution`;
  }
  const age = bracket.maxAge != null
    ? `Under ${bracket.maxAge + 1}`
    : bracket.minAge != null
      ? `Age ${bracket.minAge}+`
      : 'All ages';
  let salary = 'any salary';
  if (bracket.maxMonthlySalary != null && bracket.minMonthlySalary != null) {
    salary = `RM ${bracket.minMonthlySalary.toLocaleString()} – ${bracket.maxMonthlySalary.toLocaleString()}`;
  } else if (bracket.maxMonthlySalary != null) {
    salary = `RM ${bracket.maxMonthlySalary.toLocaleString()} and below`;
  } else if (bracket.minMonthlySalary != null) {
    salary = `above RM ${bracket.minMonthlySalary.toLocaleString()}`;
  }
  return `${age} · ${salary}`;
}
