import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { api, type PosTestTapStatus } from '../../api'
import {
  buildPosStationUrl,
  copyTextToClipboard,
  POS_STATION_ENTRIES,
  posStationQrImageUrl,
  type PosStationEntry,
} from '../../data/posStationLinks'
import { configLocationToDropdown } from '../../utils/orgFilters'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { PosDesktopInstall } from '../shared/PosDesktopInstall'
import { PosEmbedErrorBoundary } from '../shared/PosEmbedErrorBoundary'
import './PosTestTapPage.css'

const BisyncPosEmbed = lazy(() =>
  import('../../bisync-pos/embed').then(m => ({ default: m.BisyncPosEmbed })),
)

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

export function PosTestTapPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [schemaStatus, setSchemaStatus] = useState<PosTestTapStatus | null>(null)
  const [locations, setLocations] = useState<{ externalId: string; name: string }[]>([])
  const [activeLocationId, setActiveLocationId] = useState(selectedLocationIds[0] ?? '')
  const [devicePanel, setDevicePanel] = useState(false)
  const [qrEntry, setQrEntry] = useState<PosStationEntry>('pos')
  const [copyFlash, setCopyFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCompanyId) {
      setLocations([])
      return
    }
    let cancelled = false
    api.locationsConfig()
      .then(rows => {
        if (cancelled) return
        const active = rows
          .filter(loc => loc.companyId === selectedCompanyId && loc.active !== false)
          .map(configLocationToDropdown)
          .sort((a, b) => a.name.localeCompare(b.name))
        setLocations(active.map(l => ({ externalId: l.externalId, name: l.name })))
      })
      .catch(() => {
        if (!cancelled) setLocations([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedCompanyId])

  useEffect(() => {
    const preferred = selectedLocationIds.find(id =>
      locations.some(loc => loc.externalId === id),
    )
    if (preferred) {
      setActiveLocationId(preferred)
      return
    }
    if (locations.length === 0) {
      setActiveLocationId('')
      return
    }
    setActiveLocationId(prev => (
      locations.some(loc => loc.externalId === prev)
        ? prev
        : locations[0]!.externalId
    ))
  }, [selectedLocationIds, locations])

  useEffect(() => {
    let cancelled = false
    async function loadSchema() {
      if (!selectedCompanyId) {
        setSchemaStatus(null)
        return
      }
      try {
        const data = await api.posTestTapStatus(selectedCompanyId, activeLocationId || null)
        if (!cancelled) setSchemaStatus(data)
      } catch {
        if (!cancelled) setSchemaStatus(null)
      }
    }
    void loadSchema()
    return () => {
      cancelled = true
    }
  }, [selectedCompanyId, activeLocationId])

  const locationOptions = useMemo(
    () => locations.map(l => ({ externalId: l.externalId, name: l.name })),
    [locations],
  )

  const stationLinks = useMemo(() => {
    if (!selectedCompanyId || !activeLocationId) return []
    return POS_STATION_ENTRIES.map(row => ({
      ...row,
      href: buildPosStationUrl(row.entry, selectedCompanyId, activeLocationId),
    }))
  }, [selectedCompanyId, activeLocationId])

  async function copyLink(entry: PosStationEntry, href: string) {
    const ok = await copyTextToClipboard(href)
    setCopyFlash(ok ? `${entry.toUpperCase()} link copied` : 'Could not copy link')
    window.setTimeout(() => setCopyFlash(null), 2200)
  }

  if (!selectedCompanyId) {
    return (
      <div className="pos-test-tap pos-test-tap--empty">
        <p>Select a company to open POS Test.</p>
      </div>
    )
  }

  if (!activeLocationId) {
    return (
      <div className="pos-test-tap pos-test-tap--empty">
        <p>Select an active location to open POS Test.</p>
      </div>
    )
  }

  const qrUrl = buildPosStationUrl(qrEntry, selectedCompanyId, activeLocationId)
  const qrImg = posStationQrImageUrl(qrEntry, selectedCompanyId, activeLocationId, 200)

  return (
    <div className="pos-test-tap">
      <div className="pos-test-tap__meta">
        <span className="pos-test-tap__title">POS Test</span>
        {schemaStatus?.ready ? (
          <span className="pos-test-tap__status">
            Ops ready
            {schemaStatus.openBlocksEod ? ' · open checks block EOD' : ''}
          </span>
        ) : null}
        <nav className="pos-test-tap__links" aria-label="External POS station links">
          {stationLinks.map(link => (
            <a
              key={link.entry}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              title={`Open ${link.label} on this or another device`}
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            className={`pos-test-tap__device-btn${devicePanel ? ' is-active' : ''}`}
            onClick={() => setDevicePanel(v => !v)}
            title="Show links and QR for phones / tablets"
          >
            External device
          </button>
        </nav>
      </div>

      {devicePanel ? (
        <div className="pos-test-tap__device-panel" aria-label="Open POS on external devices">
          <div className="pos-test-tap__device-copy">
            <p className="pos-test-tap__device-title">Test on phone / tablet / station</p>
            <p className="pos-test-tap__device-hint">
              Open a link on the other device, or scan the QR. No platform login — company and location are in the URL.
            </p>
            <ul className="pos-test-tap__device-list">
              {stationLinks.map(link => (
                <li key={link.entry}>
                  <span className="pos-test-tap__device-label">{link.label}</span>
                  <code className="pos-test-tap__device-url" title={link.href}>{link.href}</code>
                  <button
                    type="button"
                    onClick={() => void copyLink(link.entry, link.href)}
                  >
                    Copy
                  </button>
                  <a href={link.href} target="_blank" rel="noreferrer">Open</a>
                  <button
                    type="button"
                    onClick={() => setQrEntry(link.entry)}
                    className={qrEntry === link.entry ? 'is-active' : undefined}
                  >
                    QR
                  </button>
                </li>
              ))}
            </ul>
            {copyFlash ? <p className="pos-test-tap__device-flash">{copyFlash}</p> : null}
          </div>
          <figure className="pos-test-tap__device-qr">
            <img src={qrImg} alt={`QR for ${qrEntry.toUpperCase()}`} width={200} height={200} />
            <figcaption>
              Scan for <strong>{qrEntry.toUpperCase()}</strong>
              <br />
              <span className="pos-test-tap__device-qr-url">{qrUrl}</span>
            </figcaption>
          </figure>
        </div>
      ) : null}

      <div className="pos-test-tap__frame">
        <PosEmbedErrorBoundary title="POS Test crashed">
          <Suspense
            fallback={
              <div className="pos-test-tap__loading">
                <MillstoneLoader label="Loading Bisync POS…" />
              </div>
            }
          >
            <BisyncPosEmbed
              companyId={selectedCompanyId}
              locationId={activeLocationId}
              locations={locationOptions}
              onLocationChange={setActiveLocationId}
            />
          </Suspense>
        </PosEmbedErrorBoundary>
      </div>
    </div>
  )
}
