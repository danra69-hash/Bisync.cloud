import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { B2bCustomer } from '../../api';
import { filterPurchaseHistoryLastTwoYears, parseB2bPurchaseHistory } from '../../data/customerListData';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_STANDARD_CLS } from '../layout/sidePanelShared';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  customer: B2bCustomer;
  onClose: () => void;
};

export function B2bCustomerPurchaseHistoryPanel({ customer, onClose }: Props) {
  const { number, percent } = useCountryFormatters();
  const lines = useMemo(
    () => filterPurchaseHistoryLastTwoYears(parseB2bPurchaseHistory(customer)),
    [customer],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const totals = useMemo(() => ({
    revenue: lines.reduce((sum, l) => sum + l.totalRevenue, 0),
    cogs: lines.reduce((sum, l) => sum + l.cogs * l.qtyOrdered, 0),
  }), [lines]);

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_STANDARD_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Purchase History</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{customer.companyName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 2 years only</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">No purchase history in the last 2 years.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 mb-4 text-xs">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-muted-foreground">Total Revenue</p>
                  <p className="font-semibold tabular-nums">{number(totals.revenue)}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-muted-foreground">Total COGS</p>
                  <p className="font-semibold tabular-nums">{number(totals.cogs)}</p>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <TableHeaderCell>Date Ordered</TableHeaderCell>
                    <TableHeaderCell>Date Delivered</TableHeaderCell>
                    <TableHeaderCell>Product</TableHeaderCell>
                    <TableHeaderCell>Delivery UOM</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">Qty</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">Actual RRP</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">Revenue</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">COGS</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">COGS %</TableHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${line.dateOrdered}-${line.productName}-${index}`} className="border-b border-border/50">
                      <td className="py-2 pr-2 whitespace-nowrap">{line.dateOrdered || '—'}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{line.dateDelivered || '—'}</td>
                      <td className="py-2 pr-2">{line.productName}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{line.deliveryUom || '—'}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{number(line.rrp)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{number(line.qtyOrdered)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{number(line.actualRrp)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{number(line.totalRevenue)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{number(line.cogs)}</td>
                      <td className="py-2 text-right tabular-nums">{percent(line.cogsPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
