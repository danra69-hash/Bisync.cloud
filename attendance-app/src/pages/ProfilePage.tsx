import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import {
  disableWebPushLocally,
  enableWebPush,
  getStoredFcmToken,
  isPushEnabledLocally,
  isWebPushConfigured,
  webPushConfigHint,
} from '../push/webPush'

export function ProfilePage() {
  const {
    session,
    usageRole,
    accountRole,
    logout,
    token,
    biometricsAvailable,
    biometricsEnrolled,
    enrollBiometrics,
    resetBiometrics,
  } = useAuth()
  const [biometricMessage, setBiometricMessage] = useState<string | null>(null)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [pushOn, setPushOn] = useState(() => isPushEnabledLocally())

  const permissions = session?.permissionNames || []
  const pushConfigured = isWebPushConfigured()
  const permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'

  async function onToggleBiometrics() {
    setBiometricMessage(null)
    setBiometricBusy(true)
    try {
      if (biometricsEnrolled) {
        resetBiometrics()
        setBiometricMessage('Biometric login removed on this device')
      } else {
        await enrollBiometrics()
        setBiometricMessage('Biometric login enabled on this device')
      }
    } catch (err) {
      setBiometricMessage(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not update biometrics',
      )
    } finally {
      setBiometricBusy(false)
    }
  }

  async function onTogglePush() {
    setPushMessage(null)
    if (!token) {
      setPushMessage('Sign in first to enable push notifications')
      return
    }
    setPushBusy(true)
    try {
      if (pushOn) {
        disableWebPushLocally()
        setPushOn(false)
        setPushMessage(
          'Push disabled on this device. The server may still send until you re-enable from another session.',
        )
      } else {
        await enableWebPush(token)
        setPushOn(true)
        setPushMessage(
          'Push enabled. You will get approval alerts even when the app is closed or you are logged out.',
        )
      }
    } catch (err) {
      disableWebPushLocally()
      setPushOn(false)
      setPushMessage(
        err instanceof Error ? err.message : 'Could not update push settings',
      )
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="stack">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 4px' }}>My Profile</h2>
          <p className="muted" style={{ margin: 0 }}>
            Account details from Bisync Identity / Mobile API
          </p>
        </div>
        <button type="button" className="btn btn-danger" onClick={logout}>
          Log out
        </button>
      </div>

      <div className="card profile-card">
        <div className="profile-header">
          <img
            src={session?.profileImage || '/default-profile.png'}
            alt=""
            className="profile-avatar"
            onError={(e) => {
              e.currentTarget.src = '/default-profile.png'
            }}
          />
          <div>
            <h3 style={{ margin: 0 }}>{session?.fullName || '—'}</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {session?.username || '—'}
            </p>
          </div>
        </div>

        <dl className="detail-grid" style={{ marginTop: 16 }}>
          <div>
            <dt>Role name</dt>
            <dd>{session?.roleName || '—'}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{accountRole || session?.userType || '—'}</dd>
          </div>
          <div>
            <dt>Currently using as</dt>
            <dd>{usageRole === 'vendor' ? 'Vendor' : 'Operator'}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{session?.currency || '—'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{session?.active === false ? 'Inactive' : 'Active'}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Push notifications</h3>
        {!pushConfigured ? (
          <p className="muted" style={{ margin: 0 }}>
            {webPushConfigHint() ||
              'Push is not configured for this build.'}{' '}
            In Firebase Console (cubevalue-d7497): create a Web app, copy its
            appId, then Cloud Messaging → Web Push certificates → Key pair.
            Put both in <code>web/.env.production</code> and redeploy.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 12px' }}>
              Receive approval and order alerts on this phone even when the PWA
              is closed or you are logged out. (iOS: add to Home Screen first.)
            </p>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              Browser permission: {permission}
              {getStoredFcmToken()
                ? ' · token registered'
                : pushOn
                  ? ' · waiting for token'
                  : ''}
            </p>
            <button
              type="button"
              className={pushOn ? 'btn btn-secondary' : 'btn btn-primary'}
              disabled={pushBusy}
              onClick={() => void onTogglePush()}
            >
              {pushBusy
                ? 'Please wait…'
                : pushOn
                  ? 'Turn off push notifications'
                  : 'Enable push notifications'}
            </button>
            {pushMessage && (
              <p
                className={
                  /enabled|disabled on this device/i.test(pushMessage)
                    ? 'muted'
                    : 'error-text'
                }
                style={{ margin: '12px 0 0' }}
              >
                {pushMessage}
              </p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Biometric login</h3>
        {!biometricsAvailable ? (
          <p className="muted" style={{ margin: 0 }}>
            This browser or device does not support Face ID / fingerprint /
            Windows Hello for web.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 12px' }}>
              {biometricsEnrolled
                ? 'Enabled on this device. You can sign in from the login screen with biometrics.'
                : 'Use Face ID, fingerprint, or Windows Hello instead of your password on this device.'}
            </p>
            <button
              type="button"
              className={biometricsEnrolled ? 'btn btn-secondary' : 'btn btn-primary'}
              disabled={biometricBusy}
              onClick={() => void onToggleBiometrics()}
            >
              {biometricBusy
                ? 'Please wait…'
                : biometricsEnrolled
                  ? 'Turn off biometric login'
                  : 'Enable biometric login'}
            </button>
            {biometricMessage && (
              <p className="muted" style={{ margin: '12px 0 0' }}>
                {biometricMessage}
              </p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Permissions</h3>
        {permissions.length === 0 ? (
          <p className="muted">No permissions listed.</p>
        ) : (
          <ul className="permission-list">
            {permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="actions profile-actions">
        <Link
          className="btn btn-secondary"
          to={usageRole === 'vendor' ? '/vendor' : '/operator'}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
