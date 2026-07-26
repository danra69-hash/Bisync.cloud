import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { isAttendanceMock } from '../api/attendance'
import { isClockProduct } from '../clockMode'
import { ApiError } from '../api/client'
import {
  canShowBiometricLogin,
  isBiometricEnrolled,
  isWebAuthnPlatformAvailable,
} from '../auth/biometric'
import { DEV_BYPASS_AUTH, DEV_BYPASS_USERNAME } from '../auth/devBypass'
import { MillstoneLoader } from '../components/MillstoneLoader'

const OFFER_BIOMETRIC_KEY = 'bisync_offer_biometric'

export function LoginPage() {
  const { login, loginWithBiometrics, session, loading, isVendor } = useAuth()
  const location = useLocation()
  const attendanceLocal = isAttendanceMock()
  const clockProduct = isClockProduct()
  const [username, setUsername] = useState(
    !attendanceLocal && DEV_BYPASS_AUTH ? DEV_BYPASS_USERNAME : '',
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)

  useEffect(() => {
    if (attendanceLocal) {
      setBiometricReady(false)
      return
    }
    setBiometricReady(canShowBiometricLogin())
  }, [attendanceLocal])

  if (!loading && session?.access_token) {
    const offer =
      !attendanceLocal &&
      sessionStorage.getItem(OFFER_BIOMETRIC_KEY) === '1' &&
      isWebAuthnPlatformAvailable() &&
      !isBiometricEnrolled(session.username)
    if (offer) {
      return <Navigate to="/enroll-biometric" replace />
    }
    // Clock product never returns to RMS order routes (stale /operator "from" state).
    if (clockProduct) {
      const fromPath = (
        location.state as { from?: { pathname?: string } } | null
      )?.from?.pathname
      if (fromPath === '/profile' || fromPath?.startsWith('/profile?')) {
        return <Navigate to="/profile" replace />
      }
      return <Navigate to="/clock" replace />
    }
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)
      ?.from
    if (from?.pathname) {
      return (
        <Navigate
          to={`${from.pathname}${from.search || ''}`}
          replace
        />
      )
    }
    const dest = isVendor ? '/vendor' : '/operator'
    return <Navigate to={dest} replace />
  }

  if (loading && DEV_BYPASS_AUTH && !attendanceLocal) {
    return (
      <div className="page-center">
        <MillstoneLoader label="Signing in…" />
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const user = username.trim()
    if (!user) {
      setError(clockProduct ? 'Email or mobile is required' : 'Username is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }

    setSubmitting(true)
    try {
      if (
        !attendanceLocal &&
        isWebAuthnPlatformAvailable() &&
        !isBiometricEnrolled(user)
      ) {
        sessionStorage.setItem(OFFER_BIOMETRIC_KEY, '1')
      } else {
        sessionStorage.removeItem(OFFER_BIOMETRIC_KEY)
      }
      await login(user, password)
    } catch (err) {
      sessionStorage.removeItem(OFFER_BIOMETRIC_KEY)
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Login failed'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onBiometricLogin() {
    setError(null)
    setSubmitting(true)
    try {
      sessionStorage.removeItem(OFFER_BIOMETRIC_KEY)
      await loginWithBiometrics()
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Biometric login failed'
      setError(message)
      setBiometricReady(canShowBiometricLogin())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      {submitting ? <MillstoneLoader overlay label="Signing in…" /> : null}

      <div className="login-page-ambient" aria-hidden>
        <span className="login-orb login-orb-a" />
        <span className="login-orb login-orb-b" />
        <span className="login-orb login-orb-c" />
        <span className="login-page-grain" />
      </div>

      <div className="login-page-inner">
        <header className="login-brand">
          <img
            src="/bisync-logo.png"
            alt="Bisync"
            className="login-brand-logo"
          />
          <p className="login-brand-tagline">
            {clockProduct
              ? 'Time clock & attendance'
              : 'Restaurant management, on the floor'}
          </p>
        </header>

        <form className="login-panel" onSubmit={onSubmit} noValidate>
          <div className="login-panel-head">
            <h1>Sign in</h1>
            <p className="muted">
              {clockProduct
                ? 'Sign in with your work email or mobile number from HR'
                : DEV_BYPASS_AUTH
                  ? 'Dev bypass is on — set VITE_DEV_BYPASS_AUTH=false to require login'
                  : 'Use your Bisync account'}
            </p>
          </div>

          <label className="field">
            <span>{clockProduct ? 'Email or mobile' : 'Username'}</span>
            <input
              name="username"
              type={clockProduct ? 'text' : 'text'}
              inputMode={clockProduct ? 'email' : undefined}
              autoComplete="username"
              placeholder={clockProduct ? 'email or 0123456789' : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              aria-required="true"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
            />
          </label>

          {!clockProduct && (
            <div className="login-forgot-row">
              <Link
                to={
                  username.trim()
                    ? `/forgot-password?email=${encodeURIComponent(username.trim())}`
                    : '/forgot-password'
                }
                className="login-forgot-link"
              >
                Forgot password?
              </Link>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn btn-primary login-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {biometricReady && (
            <button
              type="button"
              className="btn btn-secondary login-biometric-btn"
              disabled={submitting}
              onClick={() => void onBiometricLogin()}
            >
              <span className="login-biometric-icon" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3Z" />
                  <path d="M7 20v-1a5 5 0 0 1 10 0v1" />
                  <path d="M5.5 9.5a7.5 7.5 0 0 1 13 0" />
                  <path d="M3.5 8a10 10 0 0 1 17 0" />
                </svg>
              </span>
              Biometric login
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
