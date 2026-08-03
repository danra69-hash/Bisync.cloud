import { useMemo, useRef, useState, type FormEvent } from 'react'
import { api, setApiTenantCompanyId, type AppUser, type Company, type LocationConfig } from '../../../api'
import { parseCompanyModules } from '../../../data/companyModules'
import { configLocationToDropdown } from '../../../utils/orgFilters'
import {
  canActivatePosStation,
  makeLanRoomId,
  saveStationActivation,
  type StationActivation,
} from '../../core/station/stationActivation'
import { downloadStationPackage } from '../../core/offline/posCatalogStore'
import { useTouchClickSound } from '../../core/session/useTouchClickSound'
import './StationActivationPage.css'

type Props = {
  onActivated: (activation: StationActivation) => void
  /** Prefill from deep-link ?c=&l= */
  preferredCompanyId?: number | null
  preferredLocationId?: string
}

function companyHasPos(company: Company) {
  return parseCompanyModules(company.modulesJson).includes('POS')
}

/**
 * First-time POS station activation: Administrator login → confirm location →
 * download catalog / modifiers / promotions / floor plan onto the device.
 */
export function StationActivationPage({
  onActivated,
  preferredCompanyId = null,
  preferredLocationId = '',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  useTouchClickSound(rootRef)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<AppUser | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [locations, setLocations] = useState<LocationConfig[]>([])
  const [companyId, setCompanyId] = useState<number | null>(preferredCompanyId)
  const [locationId, setLocationId] = useState(preferredLocationId)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'login' | 'location' | 'download'>('login')
  const [progress, setProgress] = useState('')

  const locationOptions = useMemo(() => {
    if (companyId == null) return []
    return locations
      .filter(l => l.companyId === companyId && l.active !== false)
      .map(configLocationToDropdown)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, companyId])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const loggedIn = await api.login(email.trim(), password)
      if (!loggedIn.active) throw new Error('This account is inactive.')
      if (!canActivatePosStation(loggedIn)) {
        throw new Error(
          'Only Company Admin, System Admin, or Super User can activate a POS station.',
        )
      }
      setApiTenantCompanyId(loggedIn.companyId)
      const [companyRows, locationRows] = await Promise.all([
        api.companies(),
        api.locationsConfig(),
      ])
      const posCompanies = companyRows.filter(c => c.active !== false && companyHasPos(c))
      const pool = posCompanies.length > 0
        ? posCompanies
        : companyRows.filter(c => c.active !== false)
      const scoped = loggedIn.companyId
        ? pool.filter(c => c.id === loggedIn.companyId || canActivatePosStation(loggedIn))
        : pool
      // Super/System admin may see all POS companies; company admin sees theirs.
      const role = (loggedIn.role || '').toLowerCase()
      const visible =
        role.includes('system') || role.includes('super') || loggedIn.email?.toLowerCase() === 'dra@cubevalue.com'
          ? pool
          : pool.filter(c => c.id === loggedIn.companyId)

      setUser(loggedIn)
      setCompanies(visible.length > 0 ? visible : scoped.length > 0 ? scoped : pool)
      setLocations(locationRows)

      const preferred =
        (preferredCompanyId != null ? visible.find(c => c.id === preferredCompanyId) : null)
        ?? (loggedIn.companyId != null ? visible.find(c => c.id === loggedIn.companyId) : null)
        ?? visible[0]
        ?? null
      if (!preferred) throw new Error('No company with Point-of-Sales is available.')
      setCompanyId(preferred.id)
      setApiTenantCompanyId(preferred.id)

      const locs = locationRows
        .filter(l => l.companyId === preferred.id && l.active !== false)
        .map(configLocationToDropdown)
      const loc =
        (preferredLocationId
          ? locs.find(l => l.externalId === preferredLocationId)?.externalId
          : null)
        ?? locs[0]?.externalId
        ?? ''
      setLocationId(loc)
      setPhase('location')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleActivate() {
    if (!user || companyId == null || !locationId) {
      setError('Select a company location to activate this station.')
      return
    }
    const company = companies.find(c => c.id === companyId)
    const loc = locationOptions.find(l => l.externalId === locationId)
    if (!company || !loc) {
      setError('Selected company or location is not available.')
      return
    }

    setBusy(true)
    setError(null)
    setPhase('download')
    setProgress('Saving activation…')
    try {
      setApiTenantCompanyId(companyId)
      const activation: StationActivation = {
        companyId,
        companyName: company.name,
        locationExternalId: locationId,
        locationName: loc.name,
        activatedByUserId: user.id,
        activatedByEmail: user.email,
        activatedByName: user.fullName,
        activatedAt: new Date().toISOString(),
        lanRoomId: makeLanRoomId(companyId, locationId),
        catalogDownloadedAt: null,
      }
      await saveStationActivation(activation)

      setProgress('Downloading products, modifiers, promotions, and floor plan…')
      await downloadStationPackage(companyId, locationId)

      setProgress('Station ready')
      onActivated({
        ...activation,
        catalogDownloadedAt: new Date().toISOString(),
      })
    } catch (err) {
      setPhase('location')
      setError(
        err instanceof Error
          ? err.message
          : 'Activation download failed. Check internet and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={rootRef} className="pos-activate">
      <div className="pos-activate__card">
        <img src="/pwa-192x192.png" alt="" width={56} height={56} />
        <h1>Activate Bisync POS</h1>
        <p className="pos-activate__lead">
          First-time setup requires an Administrator login. Confirm the outlet location,
          then this device downloads products, modifiers, promotions, and the floor plan
          for offline use on your LAN.
        </p>

        {error ? <div className="pos-activate__error" role="alert">{error}</div> : null}

        {phase === 'login' ? (
          <form className="pos-activate__form" onSubmit={e => void handleLogin(e)}>
            <label>
              <span>Admin email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </label>
            <button type="submit" disabled={busy || !email.trim() || !password}>
              {busy ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        ) : null}

        {phase === 'location' || phase === 'download' ? (
          <div className="pos-activate__form">
            <p className="pos-activate__who">
              Signed in as <strong>{user?.fullName}</strong> ({user?.role})
            </p>
            <label>
              <span>Company</span>
              <select
                value={companyId ?? ''}
                disabled={busy || companies.length <= 1}
                onChange={e => {
                  const id = Number(e.target.value)
                  setCompanyId(id)
                  setApiTenantCompanyId(id)
                  const locs = locations
                    .filter(l => l.companyId === id && l.active !== false)
                    .map(configLocationToDropdown)
                  setLocationId(locs[0]?.externalId ?? '')
                }}
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Location (outlet)</span>
              <select
                value={locationId}
                disabled={busy}
                onChange={e => setLocationId(e.target.value)}
              >
                {locationOptions.map(l => (
                  <option key={l.externalId} value={l.externalId}>{l.name}</option>
                ))}
              </select>
            </label>
            {phase === 'download' ? (
              <p className="pos-activate__progress">{progress}</p>
            ) : (
              <button
                type="button"
                disabled={busy || !locationId}
                onClick={() => void handleActivate()}
              >
                Confirm &amp; download to this device
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
