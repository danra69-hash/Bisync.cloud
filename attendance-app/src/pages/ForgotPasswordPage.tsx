import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestResetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import { MillstoneLoader } from '../components/MillstoneLoader'

export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(() => params.get('email')?.trim() || '')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await requestResetPassword(email.trim())
      setSent(true)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not send reset email'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-center">
      {submitting ? <MillstoneLoader overlay label="Sending…" /> : null}
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>Forgot password</h1>
        <p className="muted">
          Enter your account email. We’ll send a reset link if it matches a
          Bisync account.
        </p>

        {sent ? (
          <>
            <p style={{ margin: 0 }}>
              Reset password email has been sent to your registered email.
              Check your inbox and follow the link to set a new password.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: 8 }}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting || !email.trim()}
            >
              {submitting ? 'Sending…' : 'Send reset email'}
            </button>

            <Link
              to="/login"
              className="btn btn-secondary"
              style={{ marginTop: 8, textAlign: 'center' }}
            >
              Back to sign in
            </Link>
          </>
        )}
      </form>
    </div>
  )
}
