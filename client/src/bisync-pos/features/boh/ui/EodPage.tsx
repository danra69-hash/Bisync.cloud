import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../../api'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import { formatMoney } from '../../../core/types/money'
import { FeaturePage } from '../../common/FeaturePage'
import {
  CASH_DENOMS_CENTS,
  cashCountTotalCents,
  denomLabel,
  parseCashCountQtys,
  type CashCountQtys,
  type PosEodBundle,
  type PosEodSession,
  type PosEodSummary,
} from '../domain/eod'
import './EodPage.css'
import './BohPages.css'

const EMPTY_SUMMARY: PosEodSummary = {
  businessDate: '',
  openChecks: 0,
  closedChecks: 0,
  grossSalesCents: 0,
  netSalesCents: 0,
  discountCents: 0,
  taxCents: 0,
  voidCents: 0,
  cashExpectedCents: 0,
  creditQrCents: 0,
  nonRevenueCents: 0,
  tipsOwedCents: 0,
}

export function EodPage() {
  const sessionCtx = usePosSessionOptional()
  const companyId = sessionCtx?.companyId ?? null
  const locationId = sessionCtx?.locationId ?? ''

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [eodSession, setEodSession] = useState<PosEodSession | null>(null)
  const [summary, setSummary] = useState<PosEodSummary>(EMPTY_SUMMARY)
  const [cashQtys, setCashQtys] = useState<CashCountQtys>({})

  const applyBundle = useCallback((bundle: PosEodBundle) => {
    setEodSession(bundle.session)
    setSummary(bundle.summary)
    setCashQtys(parseCashCountQtys(bundle.session.cashCountQtysJson))
  }, [])

  const load = useCallback(async () => {
    if (!companyId || !locationId) {
      setEodSession(null)
      setSummary(EMPTY_SUMMARY)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const bundle = await api.posEodSummary(companyId, locationId)
      applyBundle(bundle)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [companyId, locationId, applyBundle])

  useEffect(() => {
    void load()
  }, [load])

  const countedCents = useMemo(() => cashCountTotalCents(cashQtys), [cashQtys])
  const variance = countedCents - (eodSession?.cashExpectedCents ?? summary.cashExpectedCents)
  const dayClosed = Boolean(eodSession?.dayClosed)
  const canClose =
    Boolean(eodSession?.allConfirmed)
    && summary.openChecks === 0
    && !dayClosed

  async function persist(patch: {
    cashConfirmed?: boolean
    cashCountedCents?: number
    cashCountQtysJson?: string
    creditQrConfirmed?: boolean
    nonRevenueConfirmed?: boolean
    voidsConfirmed?: boolean
    discountConfirmed?: boolean
  }) {
    if (!companyId || !locationId || dayClosed) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const bundle = await api.posEodUpsertSession({
        companyId,
        locationExternalId: locationId,
        ...patch,
      })
      applyBundle(bundle)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function setDenomQty(denom: number, qty: number) {
    const next = {
      ...cashQtys,
      [String(denom)]: Math.max(0, Math.floor(qty) || 0),
    }
    setCashQtys(next)
  }

  async function saveCashCount() {
    await persist({
      cashCountedCents: countedCents,
      cashCountQtysJson: JSON.stringify(cashQtys),
    })
    setNotice('Cash count saved.')
  }

  async function confirmCash() {
    await persist({
      cashConfirmed: true,
      cashCountedCents: countedCents,
      cashCountQtysJson: JSON.stringify(cashQtys),
    })
  }

  async function closeDay(force = false) {
    if (!companyId || !locationId || dayClosed) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const bundle = await api.posEodCloseDay({
        companyId,
        locationExternalId: locationId,
        force,
      })
      applyBundle(bundle)
      setNotice(bundle.alreadyClosed ? 'Day was already closed.' : 'Business day closed.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!companyId || !locationId) {
    return (
      <FeaturePage
        crumb="EOD"
        title="End of Day"
        subtitle="Select a company and location to reconcile the business day."
      >
        <p className="eod-muted">No POS location selected.</p>
      </FeaturePage>
    )
  }

  return (
    <FeaturePage
      crumb="EOD"
      title="End of Day"
      subtitle={`Close ${summary.businessDate || 'today'} — reconcile sales, cash, and open checks.`}
      actions={
        <button
          type="button"
          className="chip-btn"
          onClick={() => void load()}
          disabled={loading || saving}
        >
          Refresh
        </button>
      }
    >
      {error ? <p className="eod-banner eod-banner--error">{error}</p> : null}
      {notice ? <p className="eod-banner eod-banner--ok">{notice}</p> : null}
      {dayClosed ? (
        <p className="eod-banner eod-banner--closed">
          Day closed{eodSession?.closedAt ? ` · ${new Date(eodSession.closedAt).toLocaleString()}` : ''}
        </p>
      ) : null}

      {loading && !eodSession ? (
        <p className="eod-muted">Loading EOD…</p>
      ) : (
        <>
          <div className="panel-grid eod-stats">
            {[
              ['Gross sales', formatMoney(summary.grossSalesCents)],
              ['Net sales', formatMoney(summary.netSalesCents)],
              ['Cash expected', formatMoney(summary.cashExpectedCents)],
              ['Open checks', String(summary.openChecks)],
              ['Voids / comps', formatMoney(summary.voidCents)],
              ['Credit / QR', formatMoney(summary.creditQrCents)],
              ['Non-revenue', formatMoney(summary.nonRevenueCents)],
              ['Discounts', formatMoney(summary.discountCents)],
              ['Closed checks', String(summary.closedChecks)],
              ['Tips owed', formatMoney(summary.tipsOwedCents)],
            ].map(([label, value]) => (
              <div key={label} className="panel-card">
                <p>{label}</p>
                <h3 className="eod-stat-value">{value}</h3>
              </div>
            ))}
          </div>

          {summary.openChecks > 0 ? (
            <p className="eod-banner eod-banner--warn">
              {summary.openChecks} open check{summary.openChecks === 1 ? '' : 's'} block closing the day.
              Settle or void them on the register first.
            </p>
          ) : null}

          <section className="eod-section panel-card">
            <header className="eod-section__head">
              <h3>Cash count</h3>
              <span className={variance === 0 ? 'eod-pill eod-pill--ok' : 'eod-pill eod-pill--warn'}>
                Variance {formatMoney(variance)}
              </span>
            </header>
            <div className="eod-cash-grid">
              {CASH_DENOMS_CENTS.map(denom => (
                <label key={denom} className="eod-cash-row">
                  <span>{denomLabel(denom)}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    disabled={dayClosed || saving}
                    value={cashQtys[String(denom)] ?? 0}
                    onChange={e => setDenomQty(denom, Number(e.target.value))}
                  />
                  <span className="eod-cash-line">
                    {formatMoney(denom * (cashQtys[String(denom)] ?? 0))}
                  </span>
                </label>
              ))}
            </div>
            <div className="eod-cash-footer">
              <div>
                <p className="eod-muted">Counted</p>
                <strong>{formatMoney(countedCents)}</strong>
              </div>
              <div>
                <p className="eod-muted">Expected</p>
                <strong>{formatMoney(eodSession?.cashExpectedCents ?? summary.cashExpectedCents)}</strong>
              </div>
              <div className="eod-actions">
                <button
                  type="button"
                  className="chip-btn"
                  disabled={dayClosed || saving}
                  onClick={() => void saveCashCount()}
                >
                  Save count
                </button>
                <button
                  type="button"
                  className="chip-btn chip-btn--primary"
                  disabled={dayClosed || saving || eodSession?.cashConfirmed}
                  onClick={() => void confirmCash()}
                >
                  {eodSession?.cashConfirmed ? 'Cash confirmed' : 'Confirm cash'}
                </button>
              </div>
            </div>
          </section>

          <section className="eod-section panel-card">
            <h3>Confirmation checklist</h3>
            <div className="eod-checks">
              <ConfirmRow
                label="Cash drawer"
                detail={`Expected ${formatMoney(summary.cashExpectedCents)} · Counted ${formatMoney(countedCents)}`}
                confirmed={Boolean(eodSession?.cashConfirmed)}
                disabled={dayClosed || saving}
                onConfirm={() => void confirmCash()}
              />
              <ConfirmRow
                label="Credit card & QR"
                detail={formatMoney(summary.creditQrCents)}
                confirmed={Boolean(eodSession?.creditQrConfirmed)}
                disabled={dayClosed || saving}
                onConfirm={() => void persist({ creditQrConfirmed: true })}
              />
              <ConfirmRow
                label="Non-revenue"
                detail={formatMoney(summary.nonRevenueCents)}
                confirmed={Boolean(eodSession?.nonRevenueConfirmed)}
                disabled={dayClosed || saving}
                onConfirm={() => void persist({ nonRevenueConfirmed: true })}
              />
              <ConfirmRow
                label="Voids"
                detail={formatMoney(summary.voidCents)}
                confirmed={Boolean(eodSession?.voidsConfirmed)}
                disabled={dayClosed || saving}
                onConfirm={() => void persist({ voidsConfirmed: true })}
              />
              <ConfirmRow
                label="Discounts"
                detail={formatMoney(summary.discountCents)}
                confirmed={Boolean(eodSession?.discountConfirmed)}
                disabled={dayClosed || saving}
                onConfirm={() => void persist({ discountConfirmed: true })}
              />
            </div>
          </section>

          <div className="eod-close-bar">
            <button
              type="button"
              className="chip-btn chip-btn--primary eod-close-btn"
              disabled={saving || dayClosed || !canClose}
              onClick={() => void closeDay(false)}
              title={
                dayClosed
                  ? 'Day already closed'
                  : !eodSession?.allConfirmed
                    ? 'Confirm all checklist items first'
                    : summary.openChecks > 0
                      ? 'Settle open checks first'
                      : 'Close business day'
              }
            >
              {dayClosed ? 'Day closed' : 'Close day'}
            </button>
            {!dayClosed && summary.openChecks > 0 && eodSession?.allConfirmed ? (
              <button
                type="button"
                className="chip-btn"
                disabled={saving}
                onClick={() => {
                  if (window.confirm('Force-close with open checks still outstanding?')) {
                    void closeDay(true)
                  }
                }}
              >
                Force close
              </button>
            ) : null}
          </div>
        </>
      )}
    </FeaturePage>
  )
}

function ConfirmRow({
  label,
  detail,
  confirmed,
  disabled,
  onConfirm,
}: {
  label: string
  detail: string
  confirmed: boolean
  disabled: boolean
  onConfirm: () => void
}) {
  return (
    <div className={`eod-check${confirmed ? ' is-confirmed' : ''}`}>
      <div>
        <strong>{label}</strong>
        <p className="eod-muted">{detail}</p>
      </div>
      <button
        type="button"
        className={`chip-btn${confirmed ? ' chip-btn--primary' : ''}`}
        disabled={disabled || confirmed}
        onClick={onConfirm}
      >
        {confirmed ? 'Confirmed' : 'Confirm'}
      </button>
    </div>
  )
}
