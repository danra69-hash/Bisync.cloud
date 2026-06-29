import type { Employee, PayStructure, ProvidentFundBracketItem, SocsoBracketItem } from '../../modules/hr/types';
import { bracketLabel } from '../admin/payStructureShared';
import { formatSocsoSalaryRange } from '../admin/malaysiaSocsoDefaults';

export type ContributionAmounts = {
  employer: number;
  employee: number;
  basisLabel: string;
};

export type EmployeeContributionPreview = {
  contributableWage: number;
  epf: ContributionAmounts;
  socso: ContributionAmounts;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function isMalaysianEmployee(employee: Pick<Employee, 'nationality'>) {
  const nationality = employee.nationality?.trim();
  if (!nationality) return true;
  const lower = nationality.toLowerCase();
  return lower === 'malaysia' || lower === 'malaysian' || lower === 'my';
}

export function getAgeAtMonthEnd(dateOfBirth: string | null | undefined, year: number, month: number) {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const monthEnd = new Date(year, month, 0);
  let age = monthEnd.getFullYear() - dob.getFullYear();
  const birthdayThisYear = new Date(monthEnd.getFullYear(), dob.getMonth(), dob.getDate());
  if (birthdayThisYear > monthEnd) age--;
  return age;
}

function matchesBracket(
  bracket: { minAge?: number | null; maxAge?: number | null; minMonthlySalary?: number | null; maxMonthlySalary?: number | null },
  age: number | null,
  salary: number,
) {
  if (age != null) {
    if (bracket.minAge != null && age < bracket.minAge) return false;
    if (bracket.maxAge != null && age > bracket.maxAge) return false;
  }
  if (bracket.minMonthlySalary != null && salary < bracket.minMonthlySalary) return false;
  if (bracket.maxMonthlySalary != null && salary > bracket.maxMonthlySalary) return false;
  return true;
}

function defaultMalaysiaPfBrackets(): ProvidentFundBracketItem[] {
  return [
    { maxAge: 59, maxMonthlySalary: 5000, employerPct: 13, employeePct: 11, noContribution: false },
    { maxAge: 59, minMonthlySalary: 5000.01, employerPct: 13, employeePct: 11, noContribution: false },
    { minAge: 60, employerPct: 0, employeePct: 0, noContribution: true },
  ];
}

function findPfBracket(brackets: ProvidentFundBracketItem[], age: number | null, salary: number) {
  return brackets.find(b => matchesBracket(b, age, salary)) ?? null;
}

function findSocsoBracket(brackets: SocsoBracketItem[], age: number | null, salary: number) {
  return brackets.find(b => matchesBracket(b, age, salary)) ?? null;
}

function calcEpf(
  payStructure: PayStructure,
  employee: Employee,
  contributableWage: number,
  year: number,
  month: number,
): ContributionAmounts {
  if (contributableWage <= 0) {
    return { employer: 0, employee: 0, basisLabel: 'No contributable wage' };
  }

  if (payStructure.countryCode !== 'MY') {
    const basisLabel = `${payStructure.providentFundEmployerPct}% / ${payStructure.providentFundEmployeePct}% of contributable wage`;
    return {
      employer: round2(contributableWage * payStructure.providentFundEmployerPct / 100),
      employee: round2(contributableWage * payStructure.providentFundEmployeePct / 100),
      basisLabel,
    };
  }

  if (!isMalaysianEmployee(employee)) {
    const basisLabel = `Foreign employee · ${payStructure.foreignProvidentFundEmployerPct}% / ${payStructure.foreignProvidentFundEmployeePct}%`;
    return {
      employer: round2(contributableWage * payStructure.foreignProvidentFundEmployerPct / 100),
      employee: round2(contributableWage * payStructure.foreignProvidentFundEmployeePct / 100),
      basisLabel,
    };
  }

  const brackets = payStructure.providentFundBrackets?.length
    ? payStructure.providentFundBrackets
    : defaultMalaysiaPfBrackets();
  const age = getAgeAtMonthEnd(employee.dateOfBirth, year, month);
  const bracket = findPfBracket(brackets, age, contributableWage);
  if (!bracket || bracket.noContribution) {
    return { employer: 0, employee: 0, basisLabel: 'No EPF contribution for this bracket' };
  }

  return {
    employer: round2(contributableWage * bracket.employerPct / 100),
    employee: round2(contributableWage * bracket.employeePct / 100),
    basisLabel: `${bracket.employerPct}% / ${bracket.employeePct}% · ${bracketLabel(bracket)}`,
  };
}

function calcSocso(
  payStructure: PayStructure,
  employee: Employee,
  contributableWage: number,
  year: number,
  month: number,
): ContributionAmounts {
  if (contributableWage <= 0) {
    return { employer: 0, employee: 0, basisLabel: 'No contributable wage' };
  }

  if (payStructure.countryCode !== 'MY') {
    return { employer: 0, employee: 0, basisLabel: 'SOCSO not applicable' };
  }

  if (!isMalaysianEmployee(employee)) {
    const basisLabel = `Foreign employee · ${payStructure.foreignSocsoEmployerPct}% employer`;
    return {
      employer: round2(contributableWage * payStructure.foreignSocsoEmployerPct / 100),
      employee: 0,
      basisLabel,
    };
  }

  const brackets = payStructure.socsoBrackets ?? [];
  if (brackets.length === 0) {
    return { employer: 0, employee: 0, basisLabel: 'SOCSO brackets not configured in Pay Structure' };
  }

  const age = getAgeAtMonthEnd(employee.dateOfBirth, year, month);
  const bracket = findSocsoBracket(brackets, age, contributableWage);
  if (!bracket) {
    return { employer: 0, employee: 0, basisLabel: 'No matching SOCSO bracket for wage/age' };
  }

  const ageLabel = age != null ? `Age ${age}` : 'Age not set';
  return {
    employer: bracket.employerAmount,
    employee: bracket.employeeAmount,
    basisLabel: `${ageLabel} · ${formatSocsoSalaryRange(bracket)}`,
  };
}

export function calcEmployeeContributions(
  employee: Employee,
  payStructure: PayStructure | null,
  referenceDate = new Date(),
): EmployeeContributionPreview | null {
  if (!payStructure) return null;

  const contributableWage = round2((employee.baseSalary ?? 0) + (employee.serviceAllowance ?? 0));
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  return {
    contributableWage,
    epf: calcEpf(payStructure, employee, contributableWage, year, month),
    socso: calcSocso(payStructure, employee, contributableWage, year, month),
  };
}
