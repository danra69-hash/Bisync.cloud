import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { PosCustomer, PosCustomerActivity, PosReceiptLine } from '../../api';
import {
  filterActivitiesByYear,
  LOYALTY_UNIT_LABEL,
  parsePosActivityHistory,
} from '../../data/customerListData';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { filterSelectCls } from '../layout/formControls';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS, SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_STANDARD_CLS } from '../layout/sidePanelShared';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  customer: PosCustomer;
  onClose: () => void;
};

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2, current - 3];
}

function ReceiptDetailModal({
  activity,
  onClose,
}: {
  activity: PosCustomerActivity;
  onClose: () => void;
}) {
  const { number } = useCountryFormatters();
  const lines: PosReceiptLine[] = activity.receiptLines ?? [];

  return (
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div className={`${MODAL_SHELL_CLS} w-[min(92vw,480px)]`}>
        <div className="bg-card border border-border rounded-lg shadow-xl p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Receipt Detail</p>
              <h4 className="text-sm font-semibold">{activity.checkNo}</h4>
              <p className="text-xs text-muted-foreground">{activity.activityDate} · {activity.activityLocation}</p>
            </div>
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X size={14} />
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Receipt details will be loaded from Point-of-Sales membership history when integrated.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <TableHeaderCell>Item</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Qty</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Unit</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Total</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.itemName}-${index}`} className="border-b border-border/50">
                    <td className="py-1.5 pr-2">{line.itemName}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{line.qty}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{number(line.unitPrice)}</td>
                    <td className="py-1.5 text-right tabular-nums">{number(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-2 text-right font-semibold">Total</td>
                  <td className="pt-2 text-right font-semibold tabular-nums">{number(activity.totalSpending)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          <p className="text-[10px] text-muted-foreground mt-3">
            Connected to POS membership history (coming soon).
          </p>
        </div>
      </div>
    </>
  );
}

export function PosCustomerHistoryPanel({ customer, onClose }: Props) {
  const { number } = useCountryFormatters();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [receiptActivity, setReceiptActivity] = useState<PosCustomerActivity | null>(null);

  const allActivities = useMemo(() => parsePosActivityHistory(customer), [customer]);
  const years = useMemo(() => yearOptions(), []);

  const activities = useMemo(() => {
    if (year === currentYear) {
      const ytdStart = `${currentYear}-01-01`;
      return allActivities.filter(a => a.activityDate >= ytdStart);
    }
    return filterActivitiesByYear(allActivities, year);
  }, [allActivities, year, currentYear]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (receiptActivity) setReceiptActivity(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, receiptActivity]);

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_STANDARD_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">History</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{customer.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                Year
                <select className={filterSelectCls} value={year} onChange={e => setYear(Number(e.target.value))}>
                  <option value={currentYear}>YTD {currentYear}</option>
                  {years.filter(y => y !== currentYear).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {activities.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No activity history for {year === currentYear ? `YTD ${currentYear}` : year}.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <TableHeaderCell>Activity Date</TableHeaderCell>
                  <TableHeaderCell>Location</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Check No.</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Spending</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">{LOYALTY_UNIT_LABEL} +</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">{LOYALTY_UNIT_LABEL} −</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Balance</TableHeaderCell>
                  <TableHeaderCell>Coupon</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity, index) => (
                  <tr key={`${activity.checkNo}-${index}`} className="border-b border-border/50">
                    <td className="py-2 pr-2 whitespace-nowrap">{activity.activityDate}</td>
                    <td className="py-2 pr-2">{activity.activityLocation}</td>
                    <td className="py-2 pr-2">{activity.activityType}</td>
                    <td className="py-2 pr-2">
                      <button
                        type="button"
                        onClick={() => setReceiptActivity(activity)}
                        className="text-primary font-semibold hover:underline"
                      >
                        {activity.checkNo || '—'}
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{number(activity.totalSpending)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{activity.pointsEarned.toFixed(0)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{activity.pointsUsed.toFixed(0)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{activity.pointsBalance.toFixed(0)}</td>
                    <td className="py-2 text-muted-foreground">{activity.couponUsed || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">
            Close
          </button>
        </div>
      </div>

      {receiptActivity ? (
        <ReceiptDetailModal activity={receiptActivity} onClose={() => setReceiptActivity(null)} />
      ) : null}
    </>
  );
}
