import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { api, type PosTestTapStatus } from '../../api'
import { configLocationToDropdown } from '../../utils/orgFilters'
import { MillstoneLoader } from '../shared/MillstoneLoader'
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
          {[
            { href: '/POS', label: 'POS' },
            { href: '/KDS', label: 'KDS' },
            { href: '/BDS', label: 'BDS' },
            { href: '/CDS', label: 'CDS' },
            {
              href: `/QR?c=${selectedCompanyId}&l=${encodeURIComponent(activeLocationId)}`,
              label: 'QR Order',
            },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              title={`Open ${link.label} in a new tab`}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="pos-test-tap__frame">
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
      </div>
    </div>
  )
}
