import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  api,
  setApiTenantCompanyId,
  type AppUser,
  type Company,
  type LocationConfig,
  type PosPrinterSdk,
} from '../../../api'
import { parseCompanyModules } from '../../../data/companyModules'
import { defaultPortForDeviceType } from '../../../data/posDevices'
import { configLocationToDropdown } from '../../../utils/orgFilters'
import {
  canActivatePosStation,
  makeLanRoomId,
  saveStationActivation,
  type StationActivation,
} from '../../core/station/stationActivation'
import { downloadStationPackage } from '../../core/offline/posCatalogStore'
import { useTouchClickSound } from '../../core/session/useTouchClickSound'
import { isAndroidDevice } from '../../../data/posKiosk'
import './StationActivationPage.css'

type Props = {
  onActivated: (activation: StationActivation) => void
  /** Prefill from deep-link ?c=&l= */
  preferredCompanyId?: number | null
  preferredLocationId?: string
}

type Phase = 'login' | 'location' | 'peripherals' | 'download'

function companyHasPos(company: Company) {
  return parseCompanyModules(company.modulesJson).includes('POS')
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * First-time POS station activation: Administrator login → confirm location →
 * optional printer driver install + test print → download catalog onto the device.
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
  const [phase, setPhase] = useState<Phase>('login')
  const [progress, setProgress] = useState('')

  const [sdks, setSdks] = useState<PosPrinterSdk[]>([])
  const [sdksLoading, setSdksLoading] = useState(false)
  const [selectedSdkCode, setSelectedSdkCode] = useState('')
  const [printerName, setPrinterName] = useState('Kitchen Printer')
  const [printerHost, setPrinterHost] = useState('')
  const [printerPort, setPrinterPort] = useState(String(defaultPortForDeviceType('printer')))
  const [printerStatus, setPrinterStatus] = useState<string | null>(null)
  const [printerBusy, setPrinterBusy] = useState(false)

  const locationOptions = useMemo(() => {
    if (companyId == null) return []
    return locations
      .filter(l => l.companyId === companyId && l.active !== false)
      .map(configLocationToDropdown)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [locations, companyId])

  const selectedSdk = useMemo(
    () => sdks.find(s => s.sdkCode === selectedSdkCode) ?? null,
    [sdks, selectedSdkCode],
  )

  useEffect(() => {
    if (phase !== 'peripherals' || companyId == null) return
    let cancelled = false
    setSdksLoading(true)
    setError(null)
    void api.posPrinterSdks()
      .then(rows => {
        if (cancelled) return
        const active = rows.filter(s => s.active !== false)
        setSdks(active)
        setSelectedSdkCode(prev => {
          if (prev) return prev
          if (isAndroidDevice()) {
            const android = active.find(s => (s.platform || '').toLowerCase() === 'android')
            if (android) return android.sdkCode
          }
          return active[0]?.sdkCode || ''
        })
        const preferred =
          (isAndroidDevice()
            ? active.find(s => (s.platform || '').toLowerCase() === 'android')
            : null) ?? active[0]
        if (preferred?.defaultPort) {
          setPrinterPort(String(preferred.defaultPort))
        }
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load printer drivers from the server.')
      })
      .finally(() => {
        if (!cancelled) setSdksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [phase, companyId])

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

  function goToPeripherals() {
    if (!locationId) {
      setError('Select a company location to activate this station.')
      return
    }
    setError(null)
    setPrinterStatus(null)
    setPhase('peripherals')
  }

  async function installPrinterDriverAndTest() {
    if (companyId == null || !locationId) {
      setError('Select a company location first.')
      return
    }
    if (!selectedSdkCode) {
      setError('Select a printer driver from the list.')
      return
    }
    if (!printerName.trim()) {
      setError('Enter a printer name (e.g. Kitchen Printer).')
      return
    }

    setPrinterBusy(true)
    setError(null)
    setPrinterStatus(null)
    try {
      setApiTenantCompanyId(companyId)
      const pack = await api.downloadPosPrinterSdkPackage(selectedSdkCode)
      downloadBlob(pack.blob, pack.fileName)
      const androidNote =
        (selectedSdk?.platform || '').toLowerCase() === 'android'
          ? isAndroidDevice()
            ? ' Unzip from Files/Downloads and follow INSTALL.md to load the AAR on this device.'
            : ' Copy the Android zip onto the tablet and follow INSTALL.md.'
          : ''
      setPrinterStatus(`Downloaded ${pack.fileName}.${androidNote} Registering printer…`)

      const created = await api.createPosDevice({
        companyId,
        locationExternalId: locationId,
        name: printerName.trim(),
        deviceType: 'printer',
        connectionType: printerHost.trim() ? 'ethernet' : 'usb',
        hostAddress: printerHost.trim(),
        port: printerPort.trim() ? Number(printerPort) : defaultPortForDeviceType('printer'),
        printerSdkCode: selectedSdkCode,
        printerBrand: selectedSdk?.brand,
        active: true,
      })

      const deployed = await api.deployPosPrinterSdk(created.id)
      setPrinterStatus(`${deployed.message} Sending test print…`)
      const test = await api.testPosPrinterPrint(created.id)
      setPrinterStatus(
        test.sent
          ? `Driver installed on “${created.name}”. ${test.message}`
          : `Driver installed on “${created.name}”. ${test.message}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Printer driver install failed.')
    } finally {
      setPrinterBusy(false)
    }
  }

  async function finishActivation() {
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
      setPhase('peripherals')
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
      <div className={`pos-activate__card${phase === 'peripherals' ? ' pos-activate__card--wide' : ''}`}>
        <img src="/pwa-192x192.png" alt="" width={56} height={56} />
        <h1>Activate Bisync POS</h1>
        <p className="pos-activate__lead">
          First-time setup requires an Administrator login. Confirm the outlet, install any
          printer drivers from the server, then download products, modifiers, promotions, and
          the floor plan for offline use on your LAN.
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

        {phase === 'location' ? (
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
            <button
              type="button"
              disabled={busy || !locationId}
              onClick={goToPeripherals}
            >
              Continue to printer drivers
            </button>
          </div>
        ) : null}

        {phase === 'peripherals' ? (
          <div className="pos-activate__form">
            <p className="pos-activate__who">
              Outlet: <strong>{locationOptions.find(l => l.externalId === locationId)?.name || locationId}</strong>
            </p>
            <p className="pos-activate__section-title">Printer driver (from server)</p>
            <p className="pos-activate__hint">
              Select a driver packaged on Bisync, install it on this station’s printer, then a
              test print runs automatically. On Android, choose <strong>ESCPOS ThermalPrinter Android (DantSu)</strong> to
              download the installable SDK package. You can skip and add printers later in POS Setup.
            </p>

            {sdksLoading ? (
              <p className="pos-activate__progress">Loading drivers…</p>
            ) : sdks.length === 0 ? (
              <p className="pos-activate__hint">No printer drivers seeded on the server yet.</p>
            ) : (
              <ul className="pos-activate__sdk-list" role="listbox" aria-label="Printer drivers">
                {sdks.map(sdk => (
                  <li key={sdk.sdkCode}>
                    <button
                      type="button"
                      className={`pos-activate__sdk${selectedSdkCode === sdk.sdkCode ? ' is-selected' : ''}`}
                      disabled={printerBusy || busy}
                      onClick={() => {
                        setSelectedSdkCode(sdk.sdkCode)
                        setPrinterPort(String(sdk.defaultPort || defaultPortForDeviceType('printer')))
                      }}
                    >
                      <strong>
                        {sdk.displayName}
                        {(sdk.platform || '').toLowerCase() === 'android' ? ' · Android' : ''}
                      </strong>
                      <span>{sdk.brand} · {sdk.protocol} · v{sdk.version}</span>
                      <em>{sdk.description}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label>
              <span>Printer name</span>
              <input
                value={printerName}
                onChange={e => setPrinterName(e.target.value)}
                disabled={printerBusy || busy}
                placeholder="Kitchen Printer"
              />
            </label>
            <div className="pos-activate__row">
              <label>
                <span>Printer IP (LAN)</span>
                <input
                  value={printerHost}
                  onChange={e => setPrinterHost(e.target.value)}
                  disabled={printerBusy || busy}
                  placeholder="192.168.1.50"
                />
              </label>
              <label>
                <span>Port</span>
                <input
                  value={printerPort}
                  onChange={e => setPrinterPort(e.target.value)}
                  disabled={printerBusy || busy}
                  placeholder="9100"
                />
              </label>
            </div>

            {printerStatus ? (
              <p className="pos-activate__progress" role="status">{printerStatus}</p>
            ) : null}

            <button
              type="button"
              className="pos-activate__secondary"
              disabled={printerBusy || busy || !selectedSdkCode || sdksLoading}
              onClick={() => void installPrinterDriverAndTest()}
            >
              {printerBusy ? 'Installing & test printing…' : 'Install selected driver & test print'}
            </button>

            <button
              type="button"
              disabled={busy || printerBusy}
              onClick={() => void finishActivation()}
            >
              {printerStatus?.includes('Driver installed')
                ? 'Finish — download catalog'
                : 'Skip printer — download catalog'}
            </button>
            <button
              type="button"
              className="pos-activate__linkish"
              disabled={busy || printerBusy}
              onClick={() => {
                setError(null)
                setPhase('location')
              }}
            >
              Back to location
            </button>
          </div>
        ) : null}

        {phase === 'download' ? (
          <div className="pos-activate__form">
            <p className="pos-activate__progress">{progress}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
