export const STOCK_CARD_HISTORY_YEARS = 2;

export function currentStockCardMonth(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function earliestStockCardMonth(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - STOCK_CARD_HISTORY_YEARS);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function formatStockCardMonthLabel(monthKey: string, isCurrentMonth = false): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  const label = new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  return isCurrentMonth ? `${label} · month to date` : label;
}
