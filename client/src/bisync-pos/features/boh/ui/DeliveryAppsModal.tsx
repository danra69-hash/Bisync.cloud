import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePosOverlayHost } from '../../../core/ui/posOverlayHost'
import './DeliveryAppsModal.css'

type Props = {
  onClose: () => void
}

/** Fullscreen sheet for POS Setup → Delivery apps. */
export function DeliveryAppsModal({ onClose }: Props) {
  const overlayHost = usePosOverlayHost()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!overlayHost) return null

  return createPortal(
    <div
      className="delivery-apps-modal pos-setup-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-apps-title"
    >
      <div className="delivery-apps-modal__card">
        <header className="delivery-apps-modal__header">
          <div>
            <h2 id="delivery-apps-title">Delivery apps</h2>
            <p>Connect Grab, foodpanda, Shopee Food, and other delivery channels to this outlet.</p>
          </div>
          <button
            type="button"
            className="delivery-apps-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="delivery-apps-modal__scroll">
          <section className="delivery-apps-block">
            <h3>Coming soon</h3>
            <p>
              Delivery app credentials, menu sync, and order intake will be configured here.
            </p>
            <ul>
              <li>GrabFood</li>
              <li>foodpanda</li>
              <li>Shopee Food</li>
              <li>Other marketplace channels</li>
            </ul>
          </section>
        </div>
        <footer className="delivery-apps-modal__footer">
          <button type="button" className="delivery-apps-btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>,
    overlayHost,
  )
}
