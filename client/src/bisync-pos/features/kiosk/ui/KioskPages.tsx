import { Link } from 'react-router-dom'
import { FeaturePage } from '../../common/FeaturePage'
import './KioskPages.css'

export function KioskHomePage() {
  return (
    <div className="kiosk-home">
      <img src="/bisync-logo.png" alt="Bisync" className="kiosk-home__logo" />
      <h1>Order here</h1>
      <p>Self-service kiosk — tap to start your order.</p>
      <div className="kiosk-home__actions">
        <Link to="/kiosk/menu" className="kiosk-home__cta">
          Start order
        </Link>
        <Link to="/kiosk/pay" className="kiosk-home__secondary">
          Pay existing order
        </Link>
      </div>
    </div>
  )
}

export function KioskMenuPage() {
  return (
    <FeaturePage
      crumb="Kiosk / Menu"
      title="Browse Menu"
      subtitle="Guest-facing catalog for self-order kiosks."
    >
      <div className="panel-grid">
        {['Burgers', 'Salads', 'Drinks', 'Desserts'].map((cat) => (
          <button key={cat} type="button" className="panel-card kiosk-cat">
            <h3>{cat}</h3>
            <p>Tap to browse</p>
          </button>
        ))}
      </div>
    </FeaturePage>
  )
}

export function KioskPayPage() {
  return (
    <FeaturePage
      crumb="Kiosk / Pay"
      title="Pay"
      subtitle="Complete payment on the kiosk — card, tap, or QR."
    >
      <div className="panel-grid">
        <div className="panel-card">
          <h3>Card / Tap</h3>
          <p>Present card on the terminal.</p>
        </div>
        <div className="panel-card">
          <h3>QR Pay</h3>
          <p>Scan with your banking app.</p>
        </div>
      </div>
    </FeaturePage>
  )
}
