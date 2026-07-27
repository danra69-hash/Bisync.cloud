import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  decodePoSharePayload,
  formatPoDate,
  type PoSharePayload,
} from '../utils/poShareLink'

function money(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return ''
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function blank(value?: string | null) {
  const t = value?.trim()
  return t || ''
}

function readEmbeddedPayload(
  searchD: string | null,
  hash: string,
): PoSharePayload | null {
  const fromQuery = searchD?.trim()
  if (fromQuery) {
    try {
      return decodePoSharePayload(decodeURIComponent(fromQuery))
    } catch {
      return decodePoSharePayload(fromQuery)
    }
  }
  const encoded = hash.replace(/^#/, '').trim()
  if (!encoded) return null
  return decodePoSharePayload(encoded)
}

async function fetchShareById(id: string): Promise<PoSharePayload | null> {
  try {
    const res = await fetch(`/share-api/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const data = (await res.json()) as PoSharePayload
    if (!data || data.v !== 1 || !Array.isArray(data.lines)) return null
    return data
  } catch {
    return null
  }
}

/** Public A4 purchase-order document (Create PDF / WhatsApp). */
export function SharePoPage() {
  const location = useLocation()
  const { id: pathId } = useParams()
  const [params] = useSearchParams()
  const shareId = (pathId || params.get('id') || '').trim()
  const embedded = useMemo(
    () => readEmbeddedPayload(params.get('d'), location.hash),
    [params, location.hash],
  )
  const [remote, setRemote] = useState<PoSharePayload | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(!!shareId && !embedded)

  useEffect(() => {
    if (!shareId || embedded) {
      setLoadingRemote(false)
      return
    }
    let cancelled = false
    setLoadingRemote(true)
    void fetchShareById(shareId).then((payload) => {
      if (cancelled) return
      setRemote(payload)
      setLoadingRemote(false)
    })
    return () => {
      cancelled = true
    }
  }, [shareId, embedded])

  const payload = embedded || remote

  if (loadingRemote) {
    return (
      <div className="page-center stack" style={{ padding: 24 }}>
        <p className="muted" style={{ margin: 0 }}>
          Loading document…
        </p>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="page-center stack" style={{ padding: 24 }}>
        <h1 style={{ margin: 0 }}>Document unavailable</h1>
        <p className="muted" style={{ margin: 0 }}>
          This purchase order link is missing or invalid. Ask the sender to
          create the PDF link again.
        </p>
        <Link to="/login" className="btn btn-secondary">
          Open app
        </Link>
      </div>
    )
  }

  const docTitle =
    payload.kind === 'sales' ? 'Sales Order' : 'Purchase Order'
  const poLabel =
    payload.poNumber ||
    (payload.orderId != null ? `#${payload.orderId}` : '')
  const poDate = formatPoDate(payload.poDate)
  const preferredDelivery = formatPoDate(
    payload.preferredDeliveryDate || payload.deliveryDate,
  )
  const computedSub =
    payload.subTotal ??
    payload.lines.reduce((sum, line) => sum + (line.subtotal ?? 0), 0)
  const hasTax =
    payload.tax != null &&
    Number.isFinite(Number(payload.tax)) &&
    Number(payload.tax) !== 0
  const invoiceName =
    blank(payload.companyName) || blank(payload.outletName) || ''

  return (
    <div className="po-share-page">
      <div className="po-share-toolbar no-print">
        <span className="muted">A4 purchase order</span>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <article className="po-a4" aria-label={docTitle}>
        <header className="po-a4-top">
          <h1 className="po-a4-title">{docTitle}</h1>
          <section className="po-a4-vendor">
            <h2 className="po-a4-section-title">Vendor</h2>
            <dl className="po-a4-vendor-grid">
              <div>
                <dt>Name</dt>
                <dd>{blank(payload.vendorName)}</dd>
              </div>
              <div>
                <dt>Tel</dt>
                <dd>{blank(payload.vendorTel)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{blank(payload.vendorEmail)}</dd>
              </div>
              <div>
                <dt>Fax</dt>
                <dd>{blank(payload.vendorFax)}</dd>
              </div>
            </dl>
          </section>
          <dl className="po-a4-id-list">
            <div>
              <dt>PO No</dt>
              <dd>{poLabel}</dd>
            </div>
            <div>
              <dt>PO Date</dt>
              <dd>{poDate}</dd>
            </div>
            <div>
              <dt>Preferred Delivery Date</dt>
              <dd>{preferredDelivery}</dd>
            </div>
          </dl>
        </header>

        <section className="po-a4-invoice">
          <h2 className="po-a4-section-title">Invoice to</h2>
          <dl className="po-a4-invoice-grid">
            <div>
              <dt>Name</dt>
              <dd>{invoiceName}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{blank(payload.billingAddress)}</dd>
            </div>
            <div>
              <dt>BRN</dt>
              <dd>{blank(payload.brn)}</dd>
            </div>
            <div>
              <dt>GST No.</dt>
              <dd>{blank(payload.gstNo)}</dd>
            </div>
            <div>
              <dt>Tel</dt>
              <dd>{blank(payload.tel)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{blank(payload.email)}</dd>
            </div>
          </dl>
        </section>

        <section className="po-a4-invoice">
          <h2 className="po-a4-section-title">Shipped to</h2>
          <dl className="po-a4-invoice-grid">
            <div>
              <dt>Name</dt>
              <dd>{blank(payload.outletName) || invoiceName}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{blank(payload.deliveryAddress)}</dd>
            </div>
            <div>
              <dt>Tel</dt>
              <dd>{blank(payload.tel)}</dd>
            </div>
          </dl>
        </section>

        <div className="po-a4-table-wrap">
          <table className="po-a4-table">
            <thead>
              <tr>
                <th className="col-no">#</th>
                <th className="col-code">Vendor Product ID</th>
                <th className="col-desc">Vendor Product Name</th>
                <th className="col-qty">Qty</th>
                <th className="col-unit">Unit</th>
                <th className="col-price">Unit price</th>
                <th className="col-tax">Tax</th>
                <th className="col-amt">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payload.lines.map((line, idx) => {
                const amount =
                  line.subtotal ??
                  (line.price != null ? line.price * line.qty : undefined)
                const hasLineTax =
                  line.tax != null &&
                  Number.isFinite(Number(line.tax)) &&
                  Number(line.tax) !== 0
                return (
                  <tr key={`${line.name}-${idx}`}>
                    <td className="col-no">{idx + 1}</td>
                    <td className="col-code">{line.code || ''}</td>
                    <td className="col-desc">{line.name}</td>
                    <td className="col-qty">
                      {line.qty != null ? line.qty : ''}
                    </td>
                    <td className="col-unit">{line.deliveryUnit || ''}</td>
                    <td className="col-price">{money(line.price)}</td>
                    <td className="col-tax">
                      {hasLineTax ? money(line.tax) : ''}
                    </td>
                    <td className="col-amt">{money(amount)}</td>
                  </tr>
                )
              })}
              {payload.lines.length === 0 && (
                <tr>
                  <td colSpan={8}>&nbsp;</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <section className="po-a4-remarks">
          <h2 className="po-a4-section-title">Remarks</h2>
          <p>{blank(payload.remarks)}</p>
        </section>

        <table className="po-a4-totals-table">
          <tbody>
            <tr>
              <th scope="row">Subtotal</th>
              <td>{money(computedSub)}</td>
            </tr>
            <tr>
              <th scope="row">Tax</th>
              <td>{hasTax ? money(payload.tax) : ''}</td>
            </tr>
            <tr className="po-a4-grand-row">
              <th scope="row">Grand Total</th>
              <td>{money(payload.grandTotal ?? computedSub)}</td>
            </tr>
          </tbody>
        </table>

        <footer className="po-a4-brand-foot">
          <div className="po-a4-logo-sm">
            bisync<span>.cloud</span>
          </div>
        </footer>
      </article>
    </div>
  )
}
