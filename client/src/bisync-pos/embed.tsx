import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BisyncPosApp } from './app/App'
import {
  PosSessionProvider,
  type PosLocationOption,
  type PosSessionValue,
} from './core/session/PosSessionContext'
import { usePosViewportScale } from './core/session/usePosViewportScale'
import { mapApiProductsToPosCatalog } from './core/session/mapPosCatalog'
import { api, type PosPromotion, type Product as ApiProduct } from '../api'
import {
  productMatchesPosMenu,
  productMatchesPosOrgScope,
} from '../data/posCatalog'
import {
  hasConfiguredVariableComponentSlots,
  parseVariableComponentOptionsJson,
} from '../data/productVariableComponent'
import {
  downloadStationPackage,
  isOnline,
  loadCatalogSnapshot,
  type PosModifierGroupSnapshot,
} from './core/offline/posCatalogStore'

function includeInPosEmbedCatalog(
  product: ApiProduct,
  companyId: number,
  locationId: string,
): boolean {
  if (productMatchesPosMenu(product, companyId, [locationId])) return true
  if (!productMatchesPosOrgScope(product, companyId, [locationId])) return false
  if (product.active === false || product.isSubProduct) return false
  if (!product.isVariableComponent) return false
  const cfg = parseVariableComponentOptionsJson(product.variableComponentOptionsJson)
  return hasConfiguredVariableComponentSlots(cfg)
}
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
  /** Open a specific POS screen for standalone links (/POS, /KDS, /BDS, /CDS). */
  initialEntry?: string
  /** Prefer device IndexedDB snapshot; only hit network on Admin Reload. */
  offlineFirst?: boolean
}

/** Mountable Bisync POS UI — offline-first when activated as a station. */
export function BisyncPosEmbed({
  companyId,
  locationId,
  locations = [],
  onLocationChange,
  initialEntry = '/order/floor',
  offlineFirst = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  usePosViewportScale(rootRef)

  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([])
  const [promoRppByProductId, setPromoRppByProductId] = useState<Map<number, number>>(
    () => new Map(),
  )
  const [modifierGroups, setModifierGroups] = useState<PosModifierGroupSnapshot[]>([])
  const [promotions, setPromotions] = useState<PosPromotion[]>([])
  const [catalogDownloadedAt, setCatalogDownloadedAt] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    ensurePosFonts()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setCatalogLoading(true)
      setCatalogError(null)
      try {
        if (offlineFirst) {
          const snap = await loadCatalogSnapshot(companyId, locationId)
          if (snap && !cancelled) {
            const menu = snap.products.filter(p => includeInPosEmbedCatalog(p, companyId, locationId))
            setApiProducts(menu)
            const promoMap = new Map<number, number>()
            for (const [k, v] of Object.entries(snap.promoRppByProductId ?? {})) {
              const id = Number(k)
              if (id > 0 && Number.isFinite(v)) promoMap.set(id, v)
            }
            setPromoRppByProductId(promoMap)
            setModifierGroups(snap.modifierGroups ?? [])
            setPromotions(snap.promotions ?? [])
            setCatalogDownloadedAt(snap.downloadedAt)
            setCatalogLoading(false)
            return
          }
          // No snapshot yet — try network once (activation should have written it).
          if (!isOnline()) {
            throw new Error('No offline catalog on this device. Connect and use Admin → Reload.')
          }
        }

        const rows = await api.products(companyId)
        if (cancelled) return
        const menu = rows.filter(p => includeInPosEmbedCatalog(p, companyId, locationId))
        setApiProducts(menu)

        const productIds = menu.map(p => p.id)
        try {
          const active = await api.posPromotionActivePrices(companyId, {
            locationExternalId: locationId,
            productIds,
          })
          if (cancelled) return
          const next = new Map<number, number>()
          for (const row of active.prices ?? []) {
            if (row.productId > 0 && Number.isFinite(row.rpp) && row.rpp >= 0) {
              next.set(row.productId, row.rpp)
            }
          }
          setPromoRppByProductId(next)
        } catch {
          if (!cancelled) setPromoRppByProductId(new Map())
        }

        try {
          const [groups, promos] = await Promise.all([
            api.posModifierGroups(companyId, { includeInactive: false }),
            api.posPromotions(companyId),
          ])
          if (cancelled) return
          setModifierGroups(groups)
          setPromotions(promos)
        } catch {
          if (!cancelled) {
            setModifierGroups([])
            setPromotions([])
          }
        }
      } catch (e) {
        if (!cancelled) {
          setApiProducts([])
          setPromoRppByProductId(new Map())
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
  }, [companyId, locationId, refreshKey, offlineFirst])

  const catalog = useMemo(
    () => mapApiProductsToPosCatalog(apiProducts, apiProducts, promoRppByProductId),
    [apiProducts, promoRppByProductId],
  )

  const refreshCatalog = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const reloadStationData = useCallback(async () => {
    if (!isOnline()) {
      throw new Error('Reload requires an internet connection.')
    }
    setReloading(true)
    setCatalogError(null)
    try {
      const snap = await downloadStationPackage(companyId, locationId)
      const menu = snap.products.filter(p => includeInPosEmbedCatalog(p, companyId, locationId))
      setApiProducts(menu)
      const promoMap = new Map<number, number>()
      for (const [k, v] of Object.entries(snap.promoRppByProductId ?? {})) {
        const id = Number(k)
        if (id > 0 && Number.isFinite(v)) promoMap.set(id, v)
      }
      setPromoRppByProductId(promoMap)
      setModifierGroups(snap.modifierGroups ?? [])
      setPromotions(snap.promotions ?? [])
      setCatalogDownloadedAt(snap.downloadedAt)
    } finally {
      setReloading(false)
    }
  }, [companyId, locationId])

  const setLocationId = useCallback(
    (next: string) => {
      if (!next || next === locationId) return
      // Activated stations stay bound to the confirmed location unless Admin Reload changes package.
      if (offlineFirst) return
      onLocationChange?.(next)
    },
    [locationId, onLocationChange, offlineFirst],
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
      reloadStationData,
      reloading,
      offlineFirst,
      catalogDownloadedAt,
      modifierGroups,
      promotions,
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
      reloadStationData,
      reloading,
      offlineFirst,
      catalogDownloadedAt,
      modifierGroups,
      promotions,
    ],
  )

  const posApp = useMemo(
    () => <BisyncPosApp initialEntry={initialEntry} />,
    [initialEntry],
  )

  return (
    <div ref={rootRef} className="bisync-pos-root" data-bisync-pos-embed>
      <PosSessionProvider value={session}>
        {posApp}
      </PosSessionProvider>
    </div>
  )
}
