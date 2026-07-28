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
    <div className={`${pageShellClass({ spacing: 'tight' })} !p-0 sm:!p-0`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">POS Test Tap</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live Bisync POS — menu from this company. Payment records a POS sale and depletes inventory.
          </p>
        </div>
        {schemaStatus?.ready ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            Ops tables ready
            {schemaStatus.openBlocksEod ? ' · open checks block EOD' : ''}
          </p>
        ) : null}
      </div>

      <div className="mt-2 overflow-hidden border-y border-border sm:border sm:rounded-lg sm:mx-2 sm:mb-2">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <MillstoneLoader label="Loading Bisync POS…" />
            </div>
          }
        >
          <BisyncPosEmbed companyId={selectedCompanyId} locationId={locationId} />
        </Suspense>
      </div>
    </div>
  )
}
