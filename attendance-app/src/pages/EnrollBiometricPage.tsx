import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import {
  isBiometricEnrolled,
  isWebAuthnPlatformAvailable,
} from '../auth/biometric'
import { MillstoneLoader } from '../components/MillstoneLoader'

const OFFER_BIOMETRIC_KEY = 'bisync_offer_biometric'

/** Post-login offer to enroll Face ID / fingerprint (Flutter parity). */
export function EnrollBiometricPage() {
  const { session, loading, isVendor, enrollBiometrics } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const home = isVendor ? '/vendor' : '/operator'

  function clearOffer() {
    sessionStorage.removeItem(OFFER_BIOMETRIC_KEY)
  }

  if (!loading && !session?.access_token) {
    clearOffer()
    return <Navigate to="/login" replace />
  }

  if (
    !loading &&
    session?.access_token &&
    (!isWebAuthnPlatformAvailable() || isBiometricEnrolled(session.username))
  ) {
    clearOffer()
    return <Navigate to={home} replace />
  }

  async function onEnroll() {
    setError(null)
    setBusy(true)
    try {
      await enrollBiometrics()
      clearOffer()
      navigate(home, { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not enroll biometrics',
      )
    } finally {
      setBusy(false)
    }
  }

  function onSkip() {
    clearOffer()
    navigate(home, { replace: true })
  }

  return (
    <div className="page-center">
      {busy ? <MillstoneLoader overlay label="Enrolling…" /> : null}
      <div className="card login-card stack">
        <h1 style={{ margin: 0 }}>Biometric login</h1>
        <p className="muted" style={{ margin: 0 }}>
          Enroll biometric login now for seamless access with Face ID,
          fingerprint, or Windows Hello on this device.
        </p>

        {error && <p className="error-text">{error}</p>}

        <div className="actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onSkip}
          >
            Skip
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void onEnroll()}
          >
            {busy ? 'Enrolling…' : 'Enroll biometric'}
          </button>
        </div>
      </div>
    </div>
  )
}
