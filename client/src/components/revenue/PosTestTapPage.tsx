import { lazy, Suspense, useEffect, useState } from 'react'
import { api, type PosTestTapStatus } from '../../api'
import { pageShellClass } from '../layout/pageLayout'
import { MillstoneLoader } from '../shared/MillstoneLoader'

const BisyncPosEmbed = lazy(() =>
  import('../../bisync-pos/embed').then(m => ({ default: m.BisyncPosEmbed })),
)

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

export function PosTestTapPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [schemaStatus, setSchemaStatus] = useState<PosTestTapStatus | null>(null)
  const locationId = selectedLocationIds[0] ?? null

  useEffect(() => {
    let cancelled = false
    async function loadSchema() {
      if (!selectedCompanyId) {
        setSchemaStatus(null)
        return
      }
      try {
        const data = await api.posTestTapStatus(selectedCompanyId, locationId)
        if (!cancelled) setSchemaStatus(data)
      } catch {
        if (!cancelled) setSchemaStatus(null)
      }
    }
    void loadSchema()
    return () => {
      cancelled = true
    }
  }, [selectedCompanyId, locationId])

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to open POS Test Tap.</p>
      </div>
    )
  }

  if (!locationId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a location to open POS Test Tap.</p>
      </div>
    )
  }

  return (
    <div className={pageShellClass({ spacing: 'tight' })}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">POS Test Tap</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bisync POS UI (demo catalog). Live product/API wiring comes next.
          </p>
        </div>
        {schemaStatus?.ready ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Ops tables ready
            {schemaStatus.openBlocksEod ? ' · open checks block EOD' : ''}
            {' · '}
            {(schemaStatus.tables ?? [])
              .map(t => `${t.name.replace(/^Pos/, '')} ${t.count}`)
              .join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-border min-h-[24rem]">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <MillstoneLoader label="Loading Bisync POS…" />
            </div>
          }
        >
          <BisyncPosEmbed />
        </Suspense>
      </div>
    </div>
  )
}
