import { useEffect, useMemo, useState } from 'react';

import { createPortal } from 'react-dom';

import { X } from 'lucide-react';

import { api, type StockCardDetail, type StockCardLedgerEntry } from '../../api';

import { formatRm } from '../../data/createOrder';

import {

  SIDE_PANEL_OVERLAY_CLS,

  SIDE_PANEL_SHELL_DETAIL_CLS,

} from '../layout/sidePanelShared';



type Props = {

  itemType: string;

  itemKey: string;

  companyId: number | null;

  locationIds: string[];

  uomMode: 'inventory' | 'recipe';

  period: 'month' | 'week' | 'all';

  onClose: () => void;

  onUomModeChange: (mode: 'inventory' | 'recipe') => void;

  onPeriodChange: (period: 'month' | 'week' | 'all') => void;

};



function fmtQty(value: number) {

  if (!Number.isFinite(value)) return '0';

  const rounded = Math.round(value * 1000) / 1000;

  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, '');

}



function fmtDateTime(iso: string) {

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString(undefined, {

    day: 'numeric',

    month: 'short',

    year: 'numeric',

    hour: '2-digit',

    minute: '2-digit',

  });

}



function entryTypeLabel(entryType: StockCardLedgerEntry['entryType']) {

  switch (entryType) {

    case 'balance_forward':

      return 'B/F';

    case 'purchase':

      return 'Purchase';

    case 'cash_purchase':

      return 'Cash purchase';

    case 'transfer_in':

      return 'Transfer in';

    case 'transfer_out':

      return 'Transfer out';

    case 'pos_sale':

      return 'POS sales';

    case 'online_order':

      return 'Online order';

    case 'offline_order':

      return 'Offline order';

    case 'wastage':

      return 'Wastage';

    case 'production':

      return 'Production';

    case 'adjustment_in':

      return 'Adjustment in';

    case 'adjustment_out':

      return 'Adjustment out';

    case 'adjustment':

      return 'Adjustment';

    case 'inbound':

      return 'Inbound';

    case 'outbound':

      return 'Outbound';

    default:

      return entryType;

  }

}



function isOutboundType(entryType: StockCardLedgerEntry['entryType']) {

  return entryType === 'outbound'

    || entryType === 'production'

    || entryType === 'pos_sale'
    || entryType === 'online_order'
    || entryType === 'offline_order'

    || entryType === 'wastage'

    || entryType === 'transfer_out'

    || entryType === 'adjustment_out';

}



function entryQtyDisplay(entry: StockCardLedgerEntry) {

  if (entry.entryType === 'balance_forward') {

    return fmtQty(entry.signedQty);

  }

  const sign = isOutboundType(entry.entryType) ? '-' : entry.signedQty < 0 ? '' : '+';

  return `${sign}${fmtQty(entry.quantity)}`;

}



export function StockCardDetailPanel({

  itemType,

  itemKey,

  companyId,

  locationIds,

  uomMode,

  period,

  onClose,

  onUomModeChange,

  onPeriodChange,

}: Props) {

  const [detail, setDetail] = useState<StockCardDetail | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    if (!companyId || locationIds.length === 0) {

      setDetail(null);

      setLoading(false);

      return;

    }



    setLoading(true);

    setError(null);

    api.stockCardDetail(itemType, itemKey, companyId, locationIds, { uomMode, period })

      .then(setDetail)

      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load stock card detail.'))

      .finally(() => setLoading(false));

  }, [itemType, itemKey, companyId, locationIds, uomMode, period]);



  const canToggleUom = useMemo(() => {

    if (!detail) return false;

    return detail.recipeUom.trim().toLowerCase() !== detail.inventoryUom.trim().toLowerCase();

  }, [detail]);



  return createPortal(

    <>

      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />

      <aside className={SIDE_PANEL_SHELL_DETAIL_CLS}>

        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">

          <div className="min-w-0">

            <p className="text-xs uppercase tracking-wider text-muted-foreground font-sans">

              {detail?.itemType === 'component'

                ? 'Smart Component'

                : detail?.itemType === 'sub-product'

                  ? 'Sub-Product'

                  : 'Product'}

            </p>

            <h2 className="text-lg font-semibold text-foreground truncate">{detail?.name ?? 'Stock Card'}</h2>

            {detail?.group ? (

              <p className="text-sm text-muted-foreground font-sans truncate">{detail.group}</p>

            ) : null}

            {detail?.fifoPolicy ? (

              <p className="text-xs text-muted-foreground mt-1">Costing policy: {detail.fifoPolicy}</p>

            ) : null}

          </div>

          <button

            type="button"

            onClick={onClose}

            className="p-2 rounded-md hover:bg-muted text-muted-foreground"

            aria-label="Close"

          >

            <X className="w-5 h-5" />

          </button>

        </header>



        <div className="px-5 py-4 border-b border-border shrink-0 flex flex-wrap items-end gap-4">

          <div className="flex flex-col gap-1">

            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Period</label>

            <select

              value={period}

              onChange={e => onPeriodChange(e.target.value as 'month' | 'week' | 'all')}

              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-sans min-w-[140px]"

            >

              <option value="month">This month</option>

              <option value="week">This week</option>

              <option value="all">All history</option>

            </select>

          </div>

          {canToggleUom ? (

            <div className="flex flex-col gap-1">

              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</label>

              <select

                value={uomMode}

                onChange={e => onUomModeChange(e.target.value as 'inventory' | 'recipe')}

                className="h-9 rounded-md border border-border bg-background px-3 text-sm font-sans min-w-[160px]"

              >

                <option value="inventory">Inventory UOM</option>

                <option value="recipe">Component UOM</option>

              </select>

            </div>

          ) : detail ? (

            <div className="flex flex-col gap-1">

              <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</span>

              <span className="text-sm font-medium">{detail.uom}</span>

            </div>

          ) : null}

          {detail && detail.averageCogs > 0 ? (

            <div className="flex flex-col gap-1">

              <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Current avg COGS</span>

              <span className="text-sm font-semibold tabular-nums">{formatRm(detail.averageCogs)} / {detail.uom}</span>

            </div>

          ) : null}

        </div>



        {loading ? (

          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>

        ) : error ? (

          <div className="flex-1 flex items-center justify-center px-5 text-sm text-destructive">{error}</div>

        ) : detail ? (

          <>

            <div className="px-5 py-4 border-b border-border shrink-0 grid grid-cols-2 sm:grid-cols-5 gap-3">

              <SummaryCell label="B/F" value={fmtQty(detail.balanceForward)} uom={detail.uom} />

              <SummaryCell label="Inbound" value={fmtQty(detail.inboundQty)} uom={detail.uom} />

              <SummaryCell label="Outbound" value={fmtQty(detail.outboundQty)} uom={detail.uom} />

              <SummaryCell label="Adjustment" value={fmtQty(detail.adjustmentQty)} uom={detail.uom} />

              <SummaryCell label="On Hand" value={fmtQty(detail.onHandQty)} uom={detail.uom} highlight />

            </div>



            <div className="flex-1 overflow-auto">

              <table className="w-full text-sm font-sans">

                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">

                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">

                    <th className="px-5 py-2 font-medium">Date &amp; time</th>

                    <th className="px-3 py-2 font-medium">Type</th>

                    <th className="px-3 py-2 font-medium text-right">Qty</th>

                    <th className="px-3 py-2 font-medium">UOM</th>

                    <th className="px-3 py-2 font-medium text-right">UOM price</th>

                    <th className="px-3 py-2 font-medium">Reference / reason</th>

                    <th className="px-3 py-2 font-medium">FIFO detail</th>

                    <th className="px-3 py-2 font-medium text-right">Balance</th>

                    <th className="px-3 py-2 font-medium text-right">Avg COGS</th>

                  </tr>

                </thead>

                <tbody>

                  {detail.entries.map((entry, index) => (

                    <tr key={`${entry.id}-${index}`} className="border-t border-border/60 hover:bg-muted/30 align-top">

                      <td className="px-5 py-2.5 whitespace-nowrap">{fmtDateTime(entry.occurredAt)}</td>

                      <td className="px-3 py-2.5 whitespace-nowrap">{entryTypeLabel(entry.entryType)}</td>

                      <td className="px-3 py-2.5 text-right tabular-nums">{entryQtyDisplay(entry)}</td>

                      <td className="px-3 py-2.5">{entry.uom}</td>

                      <td className="px-3 py-2.5 text-right tabular-nums">

                        {entry.unitPrice > 0 ? formatRm(entry.unitPrice) : '—'}

                      </td>

                      <td className="px-5 py-2.5 text-muted-foreground">

                        <div>{entry.reason}</div>

                        {entry.referenceNumber ? (

                          <div className="text-xs text-foreground/70 mt-0.5">Ref: {entry.referenceNumber}</div>

                        ) : null}

                      </td>

                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[220px]">

                        {entry.fifoDetail || '—'}

                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">

                        {fmtQty(entry.runningBalance)}

                      </td>

                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">

                        {entry.averageCogsAfter > 0 ? formatRm(entry.averageCogsAfter) : '—'}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </>

        ) : null}

      </aside>

    </>,

    document.body,

  );

}



function SummaryCell({

  label,

  value,

  uom,

  highlight = false,

}: {

  label: string;

  value: string;

  uom: string;

  highlight?: boolean;

}) {

  return (

    <div className="rounded-lg border border-border px-3 py-2 bg-background">

      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>

      <p className={`text-base font-semibold tabular-nums ${highlight ? 'text-primary' : 'text-foreground'}`}>

        {value}

      </p>

      <p className="text-xs text-muted-foreground truncate">{uom}</p>

    </div>

  );

}


