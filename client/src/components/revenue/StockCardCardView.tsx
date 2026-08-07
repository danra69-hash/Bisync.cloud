import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type StockCardDetail, type StockCardListRow } from '../../api'
import { formatCountryNumber } from '../../utils/numberFormat'
import { useOrgCountryCode } from '../../context/OrgCountryContext'
import { useCountryFormatters } from '../../hooks/useCountryFormatters'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import {
  formatInboundSequence,
  formatSourceInboundSequence,
  isInboundLedgerEntry,
  isOutboundLedgerEntry,
  stockCardEntryTypeLabel,
} from './stockCardLabels'

type Props = {
  rows: StockCardListRow[]
  companyId: number
  locationIds: string[]
  uomMode: 'inventory' | 'recipe'
  selectedMonth: string
  onOpenDetail: (row: StockCardListRow) => void
}

function fmtQty(value: number, countryCode: string) {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode)
  return Number.isInteger(value) && value !== 0 ? String(value) : formatCountryNumber(value, countryCode)
}

function fmtDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function itemTypeLabel(itemType: StockCardListRow['itemType']) {
  switch (itemType) {
    case 'component':
      return 'Smart Component'
    case 'sub-product':
      return 'Sub-Product'
    default:
      return 'Product'
  }
}

function StockCardItemCard({
  row,
  companyId,
  locationIds,
  uomMode,
  selectedMonth,
  onOpenDetail,
}: {
  row: StockCardListRow
  companyId: number
  locationIds: string[]
  uomMode: 'inventory' | 'recipe'
  selectedMonth: string
  onOpenDetail: (row: StockCardListRow) => void
}) {
  const countryCode = useOrgCountryCode()
  const { rm, uomPrice } = useCountryFormatters()
  const cardRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [detail, setDetail] = useState<StockCardDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const node = cardRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '120px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .stockCardDetail(row.itemType, row.itemKey, companyId, locationIds, {
        uomMode,
        period: selectedMonth,
      })
      .then(data => {
        if (!cancelled) setDetail(data)
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load card.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible, row.itemType, row.itemKey, companyId, locationIds, uomMode, selectedMonth])

  const inboundRows = useMemo(
    () => (detail?.entries ?? []).filter(isInboundLedgerEntry),
    [detail],
  )
  const outboundRows = useMemo(
    () => (detail?.entries ?? []).filter(isOutboundLedgerEntry),
    [detail],
  )

  const inboundTotal = detail?.inboundQty ?? row.inboundQty
  const outboundTotal = detail?.outboundQty ?? row.outboundQty
  const opening = detail?.balanceForward ?? 0

  return (
    <article
      ref={cardRef}
      className="rounded-lg border border-border bg-background shadow-sm overflow-hidden flex flex-col min-h-[280px]"
    >
      <header className="px-3 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {itemTypeLabel(row.itemType)} · {row.group || '—'}
            </p>
            <h3 className="text-sm font-semibold text-foreground truncate">{row.name}</h3>
            <p className="text-xs text-muted-foreground">{row.uom}</p>
          </div>
          <button
            type="button"
            className="text-xs underline shrink-0"
            onClick={() => onOpenDetail(row)}
          >
            Full ledger
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-emerald-200/80 bg-emerald-50/50 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Inbound</p>
            <p className="text-sm font-semibold tabular-nums text-emerald-900">
              {fmtQty(inboundTotal, countryCode)}
            </p>
            <p className="text-[10px] text-emerald-800/80 tabular-nums">
              Opening {fmtQty(opening, countryCode)}
            </p>
          </div>
          <div className="rounded-md border border-rose-200/80 bg-rose-50/50 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800">Outbound</p>
            <p className="text-sm font-semibold tabular-nums text-rose-900">
              {fmtQty(outboundTotal, countryCode)}
            </p>
          </div>
        </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
          On hand {fmtQty(detail?.onHandQty ?? row.onHandQty, countryCode)} · Avg COGS{' '}
          {(detail?.onHandAverageCogs ?? row.onHandAverageCogs) > 0
            ? uomPrice(detail?.onHandAverageCogs ?? row.onHandAverageCogs)
            : '—'}
        </p>
      </header>

      <div className="flex-1 px-3 py-2 space-y-3 overflow-auto max-h-[420px]">
        {!visible || loading ? (
          <MillstoneLoader size="sm" label="Loading detail…" />
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <>
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-1.5">
                Detail · Inbound
              </h4>
              {inboundRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No inbound in this month.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-border/70">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">Date</th>
                        <th className="px-2 py-1 text-right font-semibold">Stock QTY</th>
                        <th className="px-2 py-1 text-left font-semibold">UOM</th>
                        <th className="px-2 py-1 text-right font-semibold">UOM price</th>
                        <th className="px-2 py-1 text-right font-semibold">Value</th>
                        <th className="px-2 py-1 text-left font-semibold">Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inboundRows.map((entry, idx) => {
                        const original = entry.originalQuantity ?? entry.quantity
                        const depleted = entry.depletedQuantity ?? 0
                        const residual = entry.roundingResidual ?? 0
                        return (
                          <tr
                            key={`in-${entry.id}-${entry.splitIndex ?? 0}-${idx}`}
                            className="border-t border-border/50"
                          >
                            <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(entry.occurredAt)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                              {fmtQty(original, countryCode)}
                              {depleted > 0 ? (
                                <span className="block text-[10px] text-muted-foreground font-normal">
                                  Depleted {fmtQty(depleted, countryCode)}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1.5">{entry.uom || '—'}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {entry.unitPrice > 0 ? uomPrice(entry.unitPrice) : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {entry.subtotal > 0 ? rm(entry.subtotal) : '—'}
                              {Math.abs(residual) > 0.00005 ? (
                                <span
                                  className="block text-[10px] text-muted-foreground font-normal"
                                  title="UOM rounding residual — PO/cash document amount is authority"
                                >
                                  Res {(residual > 0 ? '+' : '') + rm(residual)}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              <span className="block">{formatInboundSequence(entry)}</span>
                              <span className="block text-[10px]">
                                {stockCardEntryTypeLabel(entry.entryType, entry.reason)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-800 mb-1.5">
                Detail · Outbound
              </h4>
              {outboundRows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No outbound in this month.</p>
              ) : (
                <ul className="space-y-1.5">
                  {outboundRows.map((entry, idx) => (
                    <li
                      key={`out-${entry.id}-${entry.splitIndex ?? 0}-${idx}`}
                      className="text-xs border border-border/70 rounded px-2 py-1.5 bg-muted/20"
                    >
                      <div className="flex justify-between gap-2 font-medium">
                        <span>{fmtDate(entry.occurredAt)}</span>
                        <span className="tabular-nums text-muted-foreground">
                          from {formatSourceInboundSequence(entry)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-foreground">
                        {stockCardEntryTypeLabel(entry.entryType, entry.reason)}{' '}
                        <span className="tabular-nums">
                          {fmtQty(entry.quantity, countryCode)}
                        </span>
                        {' · '}
                        {entry.uom}
                        {' · '}
                        {entry.unitPrice > 0 ? (
                          <>
                            {uomPrice(entry.unitPrice)}
                            {/prepaid/i.test(entry.reason ?? '') ? (
                              <span className="text-muted-foreground">
                                {' '}· val {rm(entry.unitPrice * entry.quantity)}
                              </span>
                            ) : null}
                          </>
                        ) : '—'}
                      </p>
                      {entry.entryType === 'credit_note' && entry.referenceNumber ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                          {entry.referenceNumber}
                          {entry.reason ? ` · ${entry.reason}` : ''}
                        </p>
                      ) : /prepaid/i.test(entry.reason ?? '') && entry.reason ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                          {entry.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </article>
  )
}

export function StockCardCardView({
  rows,
  companyId,
  locationIds,
  uomMode,
  selectedMonth,
  onOpenDetail,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">No stock card items found.</p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {rows.map(row => (
        <StockCardItemCard
          key={`${row.itemType}-${row.itemKey}`}
          row={row}
          companyId={companyId}
          locationIds={locationIds}
          uomMode={uomMode}
          selectedMonth={selectedMonth}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  )
}
