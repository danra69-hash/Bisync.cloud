import type { SocsoBracketItem } from '../../modules/hr/types';

/** PERKESO / PayrollPanda SOCSO table — effective June 2026. */
const SOCSO_SALARY_UPPER_BOUNDS = [
  30, 50, 70, 100, 140, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
  1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200,
  3300, 3400, 3500, 3600, 3700, 3800, 3900, 4000, 4100, 4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900,
  5000, 5100, 5200, 5300, 5400, 5500, 5600, 5700, 5800, 5900, 6000,
] as const;

/** [category-1 employer, category-1 employee, category-2 employer, category-2 employee] in RM. */
const SOCSO_AMOUNTS: readonly (readonly [number, number, number, number])[] = [
  [0.40, 0.30, 0.30, 0.20],
  [0.70, 0.50, 0.50, 0.30],
  [1.10, 0.80, 0.80, 0.50],
  [1.50, 1.05, 1.10, 0.65],
  [2.10, 1.50, 1.50, 0.90],
  [2.95, 2.10, 2.10, 1.25],
  [4.35, 3.10, 3.10, 1.85],
  [6.15, 4.40, 4.40, 2.65],
  [7.85, 5.60, 5.60, 3.35],
  [9.65, 6.90, 6.90, 4.15],
  [11.35, 8.10, 8.10, 4.85],
  [13.15, 9.40, 9.40, 5.65],
  [14.85, 10.60, 10.60, 6.35],
  [16.65, 11.90, 11.90, 7.15],
  [18.35, 13.10, 13.10, 7.85],
  [20.15, 14.40, 14.40, 8.65],
  [21.85, 15.60, 15.60, 9.35],
  [23.65, 16.90, 16.90, 10.15],
  [25.35, 18.10, 18.10, 10.85],
  [27.15, 19.40, 19.40, 11.65],
  [28.85, 20.60, 20.60, 12.35],
  [30.65, 21.90, 21.90, 13.15],
  [32.35, 23.10, 23.10, 13.85],
  [34.15, 24.40, 24.40, 14.65],
  [35.85, 25.60, 25.60, 15.35],
  [37.65, 26.90, 26.90, 16.15],
  [39.35, 28.10, 28.10, 16.85],
  [41.15, 29.40, 29.40, 17.65],
  [42.85, 30.60, 30.60, 18.35],
  [44.65, 31.90, 31.90, 19.15],
  [46.35, 33.10, 33.10, 19.85],
  [48.15, 34.40, 34.40, 20.65],
  [49.85, 35.60, 35.60, 21.35],
  [51.65, 36.90, 36.90, 22.15],
  [53.35, 38.10, 38.10, 22.85],
  [55.15, 39.40, 39.40, 23.65],
  [56.85, 40.60, 40.60, 24.35],
  [58.65, 41.90, 41.90, 25.15],
  [60.35, 43.10, 43.10, 25.85],
  [62.15, 44.40, 44.40, 26.65],
  [63.85, 45.60, 45.60, 27.35],
  [65.65, 46.90, 46.90, 28.15],
  [67.35, 48.10, 48.10, 28.85],
  [69.15, 49.40, 49.40, 29.65],
  [70.85, 50.60, 50.60, 30.35],
  [72.65, 51.90, 51.90, 31.15],
  [74.35, 53.10, 53.10, 31.85],
  [76.15, 54.40, 54.40, 32.65],
  [77.85, 55.60, 55.60, 33.35],
  [79.65, 56.90, 56.90, 34.15],
  [81.35, 58.10, 58.10, 34.85],
  [83.15, 59.40, 59.40, 35.65],
  [84.85, 60.60, 60.60, 36.35],
  [86.65, 61.90, 61.90, 37.15],
  [88.35, 63.10, 63.10, 37.85],
  [90.15, 64.40, 64.40, 38.65],
  [91.85, 65.60, 65.60, 39.35],
  [93.65, 66.90, 66.90, 40.15],
  [95.35, 68.10, 68.10, 40.85],
  [97.15, 69.40, 69.40, 41.65],
  [98.85, 70.60, 70.60, 42.35],
  [100.65, 71.90, 71.90, 43.15],
  [102.35, 73.10, 73.10, 43.85],
  [104.15, 74.40, 74.40, 44.65],
  [104.15, 74.40, 74.40, 44.65],
];

export const MALAYSIA_DEFAULT_FOREIGN_SOCSO_EMPLOYER = 1.25;

function salaryRangeForTier(tierIndex: number): Pick<SocsoBracketItem, 'minMonthlySalary' | 'maxMonthlySalary'> {
  if (tierIndex === 0) {
    return { minMonthlySalary: null, maxMonthlySalary: SOCSO_SALARY_UPPER_BOUNDS[0] };
  }
  if (tierIndex === SOCSO_AMOUNTS.length - 1) {
    return {
      minMonthlySalary: SOCSO_SALARY_UPPER_BOUNDS[tierIndex - 1] + 0.01,
      maxMonthlySalary: null,
    };
  }
  return {
    minMonthlySalary: SOCSO_SALARY_UPPER_BOUNDS[tierIndex - 1] + 0.01,
    maxMonthlySalary: SOCSO_SALARY_UPPER_BOUNDS[tierIndex],
  };
}

export function MALAYSIA_DEFAULT_SOCSO_BRACKETS(): SocsoBracketItem[] {
  const brackets: SocsoBracketItem[] = [];
  for (let i = 0; i < SOCSO_AMOUNTS.length; i++) {
    const [employerUnder60, employeeUnder60, employer60Plus, employee60Plus] = SOCSO_AMOUNTS[i];
    const salary = salaryRangeForTier(i);
    brackets.push({
      ...salary,
      maxAge: 59,
      employerAmount: employerUnder60,
      employeeAmount: employeeUnder60,
    });
    brackets.push({
      ...salary,
      minAge: 60,
      employerAmount: employer60Plus,
      employeeAmount: employee60Plus,
    });
  }
  return brackets;
}

export function formatSocsoSalaryRange(bracket: Pick<SocsoBracketItem, 'minMonthlySalary' | 'maxMonthlySalary'>): string {
  if (bracket.maxMonthlySalary != null && bracket.minMonthlySalary == null) {
    return `Up to RM ${bracket.maxMonthlySalary.toLocaleString()}`;
  }
  if (bracket.minMonthlySalary != null && bracket.maxMonthlySalary == null) {
    return `Above RM ${bracket.minMonthlySalary.toLocaleString()}`;
  }
  if (bracket.minMonthlySalary != null && bracket.maxMonthlySalary != null) {
    return `RM ${bracket.minMonthlySalary.toLocaleString()} – ${bracket.maxMonthlySalary.toLocaleString()}`;
  }
  return 'Any salary';
}
