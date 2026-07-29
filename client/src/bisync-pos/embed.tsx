import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BisyncPosApp } from './app/App'
import {
  PosSessionProvider,
  type PosLocationOption,
  type PosSessionValue,
} from './core/session/PosSessionContext'
import { usePosViewportScale } from './core/session/usePosViewportScale'
import { mapApiProductsToPosCatalog } from './core/session/mapPosCatalog'
import { api, type Product as ApiProduct } from '../api'
import { productMatchesPosMenu } from '../data/posCatalog'
import './core/styles/tokens.css'
import './index.css'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
const FONT_LINK_ID = 'bisync-pos-fonts'

function ensurePosFonts() {
  if (document.getElementById(FONT_LINK_ID)) return
  const preconnectG = document.createElement('link')
  preconnectG.rel = 'preconnect'
  preconnectG.href = 'https://fonts.googleapis.com'
  document.head.appendChild(preconnectG)

  const preconnectS = document.createElement('link')
  preconnectS.rel = 'preconnect'
  preconnectS.href = 'https://fonts.gstatic.com'
  preconnectS.crossOrigin = 'anonymous'
  document.head.appendChild(preconnectS)

  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = FONT_HREF
  document.head.appendChild(link)
}

type Props = {
  companyId: number
  locationId: string
  locations?: PosLocationOption[]
  onLocationChange?: (locationId: string) => void
}

/** Mountable Bisync POS UI for POS Test Tap — live company catalog + demo POS shell. */
export function BisyncPosEmbed({
  companyId,
  locationId,
  locations = [],
  onLocationChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  usePosViewportScale(rootRef)

  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    ensurePosFonts()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setCatalogLoading(true)
      setCatalogError(null)
      try {
        const rows = await api.products(companyId)
        if (cancelled) return
        setApiProducts(
          rows.filter(p => productMatchesPosMenu(p, companyId, [locationId])),
        )
      } catch (e) {
        if (!cancelled) {
          setApiProducts([])
          setCatalogError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [companyId, locationId, refreshKey])

  const catalog = useMemo(
    () => mapApiProductsToPosCatalog(apiProducts, apiProducts),
    [apiProducts],
  )

  const refreshCatalog = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const setLocationId = useCallback(
    (next: string) => {
      if (!next || next === locationId) return
      onLocationChange?.(next)
    },
    [locationId, onLocationChange],
  )

  const session = useMemo<PosSessionValue>(
    () => ({
      companyId,
      locationId,
      locations,
      setLocationId,
      catalog,
      catalogLoading,
      catalogError,
      refreshCatalog,
    }),
    [
      companyId,
      locationId,
      locations,
      setLocationId,
      catalog,
      catalogLoading,
      catalogError,
      refreshCatalog,
    ],
  )

  return (
    <div ref={rootRef} className="bisync-pos-root" data-bisync-pos-embed>
      <PosSessionProvider value={session}>
        <BisyncPosApp />
      </PosSessionProvider>
    </div>
  )
}
