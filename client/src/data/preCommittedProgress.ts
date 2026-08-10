import type { PurchaseOrder } from '../api';

export type CommitmentExpiryTone = 'ok' | 'soon' | 'expired' | 'none';

export type CommitmentProgress = {
  committed: number;
  issued: number;
  received: number;
  remainingToIssue: number;
  commitmentStartDate: string | null;
  commitmentEndDate: string | null;
  expiryLabel: string;
  expiryTone: CommitmentExpiryTone;
  daysRemaining: number | null;
};

function parseDateOnly(raw: string | null | undefined): Date | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  // Treat as local calendar date (yyyy-MM-dd).
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatCommitmentDate(raw: string | null | undefined): string {
  const date = parseDateOnly(raw);
  if (!date) return '—';
  return date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function resolveCommitmentExpiry(
  endDateRaw: string | null | undefined,
  now: Date = new Date(),
): Pick<CommitmentProgress, 'expiryLabel' | 'expiryTone' | 'daysRemaining'> {
  const end = parseDateOnly(endDateRaw);
  if (!end) {
    return { expiryLabel: 'No expiry set', expiryTone: 'none', daysRemaining: null };
  }

  const today = startOfLocalDay(now);
  const endDay = startOfLocalDay(end);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round((endDay.getTime() - today.getTime()) / msPerDay);
  const formatted = formatCommitmentDate(endDateRaw);

  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return {
      expiryLabel: `Expired ${formatted} (${overdue} day${overdue === 1 ? '' : 's'} ago)`,
      expiryTone: 'expired',
      daysRemaining,
    };
  }
  if (daysRemaining === 0) {
    return { expiryLabel: `Expires today (${formatted})`, expiryTone: 'soon', daysRemaining: 0 };
  }
  if (daysRemaining <= 14) {
    return {
      expiryLabel: `Expires ${formatted} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left)`,
      expiryTone: 'soon',
      daysRemaining,
    };
  }
  return {
    expiryLabel: `Expires ${formatted}`,
    expiryTone: 'ok',
    daysRemaining,
  };
}

/** Order-level issued / received / committed totals for a Pre-committed master. */
export function resolveCommitmentProgress(order: PurchaseOrder, now: Date = new Date()): CommitmentProgress {
  const committedFromItems = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const issuedFromItems = order.items.reduce((sum, item) => sum + (item.drawnQuantity || 0), 0);
  const receivedFromItems = order.items.reduce((sum, item) => sum + (item.consolidatedQuantity || 0), 0);

  const committed = order.committedQuantity ?? committedFromItems;
  const issued = order.drawnQuantityTotal ?? issuedFromItems;
  const received = order.consolidatedQuantity ?? receivedFromItems;
  const expiry = resolveCommitmentExpiry(order.commitmentEndDate, now);

  return {
    committed,
    issued,
    received,
    remainingToIssue: Math.max(0, committed - issued),
    commitmentStartDate: order.commitmentStartDate ?? null,
    commitmentEndDate: order.commitmentEndDate ?? null,
    ...expiry,
  };
}
