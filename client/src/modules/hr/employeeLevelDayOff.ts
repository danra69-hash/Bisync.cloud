import type { EmployeeLevel } from './types';

/** JS getDay(): 0 = Sunday … 6 = Saturday */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Unless the level is shift work, DayOff/week = 2 means Saturday + Sunday are the days off.
 * Shift levels (and other day-off counts) do not imply fixed weekend days.
 */
export function deemedWeeklyDayOffs(level: Pick<EmployeeLevel, 'isShift' | 'dayOffPerWeek'>): WeekdayIndex[] {
  if (level.isShift) return [];
  const days = Math.max(0, Math.min(7, Number(level.dayOffPerWeek) || 0));
  if (days === 2) return [6, 0]; // Saturday, Sunday
  return [];
}

export function formatDeemedDayOffLabel(level: Pick<EmployeeLevel, 'isShift' | 'dayOffPerWeek'>): string | null {
  const offs = deemedWeeklyDayOffs(level);
  if (offs.length === 0) return null;
  return 'Saturday & Sunday';
}
