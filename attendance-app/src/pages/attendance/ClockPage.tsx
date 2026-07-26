import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  calibrateOutletGeofence,
  getAttendanceStatus,
  isAttendanceMock,
  punchAttendance,
  resetAttendanceDemo,
  type AttendanceStaff,
} from '../../api/attendance'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { useLocationFilter } from '../../auth/LocationProvider'
import { checkGeofence, formatDistance, formatDuration } from '../../attendance/geofence'
import type { GeoPoint, PunchMethod } from '../../attendance/types'
import { MonthScheduleCard } from '../../components/attendance/MonthScheduleCard'
import {
  createSimulatedPosition,
  getCurrentPosition,
  isGeolocationSupported,
  LocationError,
} from '../../platform/location'

const METHOD_LABEL: Record<PunchMethod, string> = {
  gps: 'GPS',
  qr: 'QR',
  beacon: 'Beacon',
  nfc: 'NFC',
  pos: 'POS',
}

function staffFromSession(
  token: string,
  session: {
    username?: string
    fullName?: string
    deviceId?: string | number
    employeeId?: number
  } | null,
): AttendanceStaff {
  return {
    staffKey: session?.username || 'unknown',
    staffName: session?.fullName,
    token,
    deviceId:
      session?.deviceId != null ? String(session.deviceId) : null,
    employeeId: session?.employeeId ?? null,
  }
}

export function ClockPage() {
  const { token, session } = useAuth()
  const {
    selectedLocationId,
    selectedLocation,
    loading: locationsLoading,
  } = useLocationFilter()
  const qc = useQueryClient()

  const [geo, setGeo] = useState<GeoPoint | null>(null)
  const [geoSimulated, setGeoSimulated] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [method, setMethod] = useState<PunchMethod>('gps')
  const [qrToken, setQrToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const staff = useMemo(
    () => (token ? staffFromSession(token, session) : null),
    [token, session],
  )

  const statusQuery = useQuery({
    queryKey: [
      'attendance-status',
      staff?.staffKey,
      selectedLocationId,
      selectedLocation?.name,
    ],
    enabled: !!staff && selectedLocationId != null,
    queryFn: () =>
      getAttendanceStatus(
        staff!,
        selectedLocationId!,
        selectedLocation?.name,
      ),
    refetchInterval: 30_000,
  })

  const policy = statusQuery.data?.policy ?? null
  const openShift = statusQuery.data?.openShift ?? null
  const allowed = policy?.allowedMethods ?? ['gps']

  useEffect(() => {
    if (!allowed.includes(method)) {
      setMethod(allowed[0] || 'gps')
    }
  }, [allowed, method])

  useEffect(() => {
    if (!openShift) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [openShift])

  async function refreshGeo() {
    setGeoError(null)
    setGeoLoading(true)
    setGeoSimulated(false)
    try {
      const point = await getCurrentPosition({ timeoutMs: 8_000 })
      setGeo(point)
    } catch (err) {
      setGeo(null)
      setGeoError(
        err instanceof LocationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not read GPS',
      )
    } finally {
      setGeoLoading(false)
    }
  }

  useEffect(() => {
    setGeo(null)
    setGeoSimulated(false)
    setGeoError(null)
    if (!isGeolocationSupported()) {
      setGeoError(
        'Location is not supported in this browser. Use “Simulate at site” for local testing.',
      )
      return
    }
    void refreshGeo()
  }, [selectedLocationId])

  const fenceCheck = useMemo(
    () => checkGeofence(geo, policy?.geofence ?? null),
    [geo, policy?.geofence],
  )

  const elapsed = openShift
    ? formatDuration(now - new Date(openShift.clockInAt).getTime())
    : null

  async function onPunch(action: 'clockIn' | 'clockOut') {
    if (!staff || selectedLocationId == null) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      let point = geo
      if (method === 'gps' && !geoSimulated) {
        point = await getCurrentPosition({ timeoutMs: 8_000 })
        setGeo(point)
      }
      if (method === 'gps' && !point) {
        throw new Error('GPS location is required. Use “Simulate at site” if GPS is unavailable.')
      }
      const result = await punchAttendance(staff, selectedLocation?.name, {
        outletId: selectedLocationId,
        action,
        method,
        geo: point,
        qrToken: method === 'qr' ? qrToken : null,
        deviceId: staff.deviceId,
      })
      setMessage(result.message)
      if (method === 'qr') setQrToken('')
      await qc.invalidateQueries({ queryKey: ['attendance-status'] })
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Punch failed',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onSimulateAtSite() {
    if (!staff || selectedLocationId == null) return
    setBusy(true)
    setError(null)
    setMessage(null)
    setGeoLoading(false)
    try {
      const point = createSimulatedPosition(policy?.geofence)
      setGeo(point)
      setGeoSimulated(true)
      setGeoError(null)
      await calibrateOutletGeofence(
        staff,
        selectedLocationId,
        selectedLocation?.name,
        point.latitude,
        point.longitude,
      )
      await qc.invalidateQueries({ queryKey: ['attendance-status'] })
      await qc.refetchQueries({ queryKey: ['attendance-status'] })
      setMessage('Simulated GPS inside site geofence. You can clock in.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not simulate location',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onCalibrate() {
    if (!staff || selectedLocationId == null) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const point = geoSimulated && geo
        ? geo
        : await getCurrentPosition({ timeoutMs: 8_000 })
      setGeo(point)
      await calibrateOutletGeofence(
        staff,
        selectedLocationId,
        selectedLocation?.name,
        point.latitude,
        point.longitude,
      )
      setMessage('Geofence set to your current location (120 m radius).')
      await qc.invalidateQueries({ queryKey: ['attendance-status'] })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not set geofence',
      )
    } finally {
      setBusy(false)
    }
  }

  function onResetDemo() {
    resetAttendanceDemo()
    setMessage('Demo attendance data cleared.')
    setError(null)
    setGeo(null)
    setGeoSimulated(false)
    void qc.invalidateQueries({ queryKey: ['attendance-status'] })
  }

  if (!token) {
    return (
      <div className="stack">
        <p className="muted">Sign in to use Clock.</p>
      </div>
    )
  }

  if (locationsLoading) {
    return (
      <div className="stack">
        <p className="muted">Loading locations…</p>
      </div>
    )
  }

  if (selectedLocationId == null) {
    return (
      <div className="stack">
        <h2 style={{ margin: 0 }}>Clock</h2>
        <p className="muted">
          Select a location in the top bar to clock in or out.
        </p>
      </div>
    )
  }

  const clockedIn = !!openShift
  const canPunchGps =
    method !== 'gps' ||
    (!policy?.requireGeofence
      ? !!geo
      : fenceCheck.configured && fenceCheck.inside)

  return (
    <div className="stack clock-page">
      <div className="clock-header">
        <div>
          <h2 style={{ margin: 0 }}>Clock</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {selectedLocation?.name || `Location ${selectedLocationId}`}
            {isAttendanceMock() ? ' · Demo mode' : ''}
          </p>
        </div>
        <span
          className={`clock-status-pill ${clockedIn ? 'is-in' : 'is-out'}`}
        >
          {clockedIn ? 'Clocked in' : 'Clocked out'}
        </span>
      </div>

      <div className="card clock-hero">
        <p className="clock-hero-label">
          {clockedIn ? 'On shift' : 'Ready to clock in'}
        </p>
        <p className="clock-hero-time">
          {clockedIn
            ? elapsed
            : new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
        </p>
        {clockedIn && openShift && (
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Since{' '}
            {new Date(openShift.clockInAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {openShift.outletName
              ? ` · ${openShift.outletName}`
              : ''}{' '}
            · {METHOD_LABEL[openShift.clockInMethod]}
          </p>
        )}

        <div className="clock-actions">
          {!clockedIn ? (
            <button
              type="button"
              className="btn btn-primary clock-punch-btn"
              disabled={busy || (method === 'gps' && !canPunchGps)}
              onClick={() => void onPunch('clockIn')}
            >
              {busy ? 'Working…' : 'Clock in'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger clock-punch-btn"
              disabled={busy || (method === 'gps' && !canPunchGps)}
              onClick={() => void onPunch('clockOut')}
            >
              {busy ? 'Working…' : 'Clock out'}
            </button>
          )}
        </div>
      </div>

      <MonthScheduleCard
        outletId={selectedLocationId}
        outletName={selectedLocation?.name}
      />

      {(message || error) && (
        <p
          className={error ? 'clock-feedback is-error' : 'clock-feedback is-ok'}
          role="status"
        >
          {error || message}
        </p>
      )}

      <div className="card clock-panel">
        <h3 style={{ margin: '0 0 8px' }}>Presence</h3>

        <div className="clock-method-row" role="group" aria-label="Punch method">
          {allowed.map((m) => (
            <button
              key={m}
              type="button"
              className={`btn clock-method-btn ${method === m ? 'is-active' : ''}`}
              onClick={() => setMethod(m)}
              disabled={m === 'beacon' || m === 'nfc' || m === 'pos'}
              title={
                m === 'beacon' || m === 'nfc' || m === 'pos'
                  ? 'Coming soon'
                  : undefined
              }
            >
              {METHOD_LABEL[m]}
              {(m === 'beacon' || m === 'nfc' || m === 'pos') && ' · soon'}
            </button>
          ))}
        </div>

        {method === 'qr' && (
          <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <label htmlFor="clock-qr">Site QR code</label>
            <input
              id="clock-qr"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Scan or paste rotating QR token"
              autoComplete="off"
            />
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Camera scan comes next; paste works for demo.
            </p>
          </div>
        )}

        {method === 'gps' && (
          <div className="clock-geo-block">
            {!fenceCheck.configured && (
              <p className="muted" style={{ margin: '0 0 8px' }}>
                No geofence for this location yet. Set one at your site entrance
                (demo), then staff must be inside the radius to punch.
              </p>
            )}
            <dl className="clock-geo-grid">
              <div>
                <dt>GPS</dt>
                <dd>
                  {geoLoading
                    ? 'Reading…'
                    : geo
                      ? `${geoSimulated ? 'Simulated · ' : ''}±${Math.round(geo.accuracyMeters ?? 0)} m`
                      : 'Unavailable'}
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  {fenceCheck.configured
                    ? formatDistance(fenceCheck.distanceMeters)
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Radius</dt>
                <dd>
                  {fenceCheck.radiusMeters != null
                    ? `${fenceCheck.radiusMeters} m`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {!fenceCheck.configured
                    ? 'Not set'
                    : fenceCheck.inside
                      ? 'Inside'
                      : 'Outside'}
                </dd>
              </div>
            </dl>
            {geoError && (
              <p className="clock-feedback is-error" style={{ marginTop: 8 }}>
                {geoError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={geoLoading || busy}
                onClick={() => void refreshGeo()}
              >
                Refresh GPS
              </button>
              {isAttendanceMock() && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void onSimulateAtSite()}
                >
                  Simulate at site
                </button>
              )}
              {isAttendanceMock() && geo && !geoSimulated && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void onCalibrate()}
                >
                  Set geofence here
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {(statusQuery.data?.todayPunches?.length ?? 0) > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 8px' }}>Today</h3>
          <ul className="clock-history">
            {statusQuery.data!.todayPunches.map((s) => (
              <li key={s.id}>
                <span>
                  {new Date(s.clockInAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {s.clockOutAt
                    ? ` → ${new Date(s.clockOutAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ' → …'}
                </span>
                <span className="muted">
                  {METHOD_LABEL[s.clockInMethod]}
                  {s.status === 'open' ? ' · open' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAttendanceMock() && (
        <p className="muted clock-demo-note">
          Demo punches stay on this device until the Attendance API is live.{' '}
          <button type="button" className="btn btn-ghost" onClick={onResetDemo}>
            Clear demo data
          </button>
        </p>
      )}
    </div>
  )
}
