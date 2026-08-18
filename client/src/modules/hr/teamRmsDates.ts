/** Date helpers for Team RMS purchase-order windows. */

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Inclusive window: last 7 days of the previous month through today (covers
 * MTD plus the last week of the previous month).
 */
export function rmsListDateWindow(now = new Date()): { from: string; to: string } {
  const to = toDateKey(now);
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrev = new Date(firstOfMonth);
  lastOfPrev.setDate(0);
  const startOfLastWeekPrev = new Date(lastOfPrev);
  startOfLastWeekPrev.setDate(lastOfPrev.getDate() - 6);
  return { from: toDateKey(startOfLastWeekPrev), to };
}

export function dateKeyInRange(dateKey: string | null | undefined, from: string, to: string): boolean {
  if (!dateKey) return false;
  const key = dateKey.slice(0, 10);
  return key >= from && key <= to;
}

export function formatTeamDate(dateKey: string | null | undefined): string {
  if (!dateKey) return '—';
  const d = new Date(`${dateKey.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey.slice(0, 10);
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
