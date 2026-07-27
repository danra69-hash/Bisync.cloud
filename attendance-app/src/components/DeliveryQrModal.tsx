import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Payload scanned by delivery apps (matches Flutter / vendor QR scanner). */
export function deliveryOrderQrPayload(orderId: number) {
  return `ORDER_${orderId}`
}

export function DeliveryQrModal({
  orderId,
  poNumber,
  onBypass,
  bypassLabel = 'Bypass',
}: {
  orderId: number
  poNumber?: string
  onBypass: () => void
  bypassLabel?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const payload = deliveryOrderQrPayload(orderId)

  useEffect(() => {
    let cancelled = false
    setError(null)
    void QRCode.toDataURL(payload, {
      width: 260,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error).message || 'Failed to generate QR code')
        }
      })
    return () => {
      cancelled = true
    }
  }, [payload])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onBypass}
    >
      <div
        className="modal-panel stack delivery-qr-modal"
        role="dialog"
        aria-modal="true"
        aria-label="QR code for delivery order"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0 }}>QR Code for Delivery Order</h3>
        <p className="muted" style={{ margin: 0 }}>
          Delivery person can scan this code
          {poNumber ? ` for ${poNumber}` : ''}.
        </p>

        <div className="delivery-qr-frame">
          {dataUrl ? (
            <img
              className="delivery-qr-image"
              src={dataUrl}
              alt={`Delivery QR ${payload}`}
              width={260}
              height={260}
            />
          ) : error ? (
            <p className="error-text" style={{ margin: 0 }}>
              {error}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Generating QR…
            </p>
          )}
        </div>

        <p className="delivery-qr-payload muted">{payload}</p>

        <button type="button" className="btn btn-primary" onClick={onBypass}>
          {bypassLabel}
        </button>
      </div>
    </div>
  )
}
