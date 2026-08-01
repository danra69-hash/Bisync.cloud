import type { Employee, EmployeeLevel } from './types';

/** Distinct colors per employee level — shared by Type 1 and Type 2 schedule views. */
export type LevelColorSet = {
  bar: string;
  tag: string;
  dot: string;
  cell: string;
};

const DEFAULT_LEVEL_COLORS: LevelColorSet = {
  bar: 'bg-gray-600 border-gray-700',
  tag: 'border-gray-300 bg-gray-50 text-gray-900',
  dot: 'bg-gray-500',
  cell: 'bg-gray-100/90 ring-1 ring-inset ring-gray-300',
};

/**
 * Palette ordered so historical ids 1–3 keep blue / orange / indigo.
 * Additional levels cycle through further distinct hues.
 */
const LEVEL_PALETTE: LevelColorSet[] = [
  {
    bar: 'bg-blue-600 border-blue-700',
    tag: 'border-blue-300 bg-blue-50 text-blue-900',
    dot: 'bg-blue-600',
    cell: 'bg-blue-100/90 ring-1 ring-inset ring-blue-300',
  },
  {
    bar: 'bg-orange-600 border-orange-700',
    tag: 'border-orange-300 bg-orange-50 text-orange-900',
    dot: 'bg-orange-600',
    cell: 'bg-orange-100/90 ring-1 ring-inset ring-orange-300',
  },
  {
    bar: 'bg-indigo-600 border-indigo-700',
    tag: 'border-indigo-300 bg-indigo-50 text-indigo-900',
    dot: 'bg-indigo-600',
    cell: 'bg-indigo-100/90 ring-1 ring-inset ring-indigo-300',
  },
  {
    bar: 'bg-emerald-600 border-emerald-700',
    tag: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    dot: 'bg-emerald-600',
    cell: 'bg-emerald-100/90 ring-1 ring-inset ring-emerald-300',
  },
  {
    bar: 'bg-rose-600 border-rose-700',
    tag: 'border-rose-300 bg-rose-50 text-rose-900',
    dot: 'bg-rose-600',
    cell: 'bg-rose-100/90 ring-1 ring-inset ring-rose-300',
  },
  {
    bar: 'bg-cyan-600 border-cyan-700',
    tag: 'border-cyan-300 bg-cyan-50 text-cyan-900',
    dot: 'bg-cyan-600',
    cell: 'bg-cyan-100/90 ring-1 ring-inset ring-cyan-300',
  },
  {
    bar: 'bg-violet-600 border-violet-700',
    tag: 'border-violet-300 bg-violet-50 text-violet-900',
    dot: 'bg-violet-600',
    cell: 'bg-violet-100/90 ring-1 ring-inset ring-violet-300',
  },
  {
    bar: 'bg-amber-600 border-amber-700',
    tag: 'border-amber-300 bg-amber-50 text-amber-900',
    dot: 'bg-amber-600',
    cell: 'bg-amber-100/90 ring-1 ring-inset ring-amber-300',
  },
  {
    bar: 'bg-teal-600 border-teal-700',
    tag: 'border-teal-300 bg-teal-50 text-teal-900',
    dot: 'bg-teal-600',
    cell: 'bg-teal-100/90 ring-1 ring-inset ring-teal-300',
  },
  {
    bar: 'bg-fuchsia-600 border-fuchsia-700',
    tag: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900',
    dot: 'bg-fuchsia-600',
    cell: 'bg-fuchsia-100/90 ring-1 ring-inset ring-fuchsia-300',
  },
  {
    bar: 'bg-lime-700 border-lime-800',
    tag: 'border-lime-300 bg-lime-50 text-lime-900',
    dot: 'bg-lime-600',
    cell: 'bg-lime-100/90 ring-1 ring-inset ring-lime-300',
  },
  {
    bar: 'bg-sky-600 border-sky-700',
    tag: 'border-sky-300 bg-sky-50 text-sky-900',
    dot: 'bg-sky-600',
    cell: 'bg-sky-100/90 ring-1 ring-inset ring-sky-300',
  },
];

export function resolveEmployeeLevel(
  employee: Employee,
  levels: EmployeeLevel[],
): EmployeeLevel | undefined {
  return employee.employeeLevel ?? levels.find((l) => l.id === employee.employeeLevelId);
}

export function colorsForLevelId(levelId: number | null | undefined): LevelColorSet {
  if (levelId == null || levelId <= 0) return DEFAULT_LEVEL_COLORS;
  return LEVEL_PALETTE[(levelId - 1) % LEVEL_PALETTE.length] ?? DEFAULT_LEVEL_COLORS;
}

export function levelColors(employee: Employee, levels: EmployeeLevel[]): LevelColorSet {
  const level = resolveEmployeeLevel(employee, levels);
  return colorsForLevelId(level?.id);
}

export function colorsForLevel(level: EmployeeLevel | undefined | null): LevelColorSet {
  return colorsForLevelId(level?.id);
}

export { DEFAULT_LEVEL_COLORS };