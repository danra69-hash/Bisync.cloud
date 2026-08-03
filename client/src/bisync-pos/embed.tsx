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
import {
  productMatchesPosMenu,
  productMatchesPosOrgScope,
} from '../data/posCatalog'
import {
  hasConfiguredVariableComponentSlots,
  parseVariableComponentOptionsJson,
} from '../data/productVariableComponent'

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
/** Refresh in-effect promo RPPs so schedule windows apply without a full reload. */
const PROMO_PRICE_POLL_MS = 60_000

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
}

/** Mountable Bisync POS UI for POS Test — live company catalog + demo POS shell. */
export function BisyncPosEmbed({
  companyId,
  locationId,
  locations = [],
  onLocationChange,
  initialEntry = '/order/floor',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  usePosViewportScale(rootRef)

  const [apiProducts, setApiProducts] = useState<ApiProduct[]>([])
  const [promoRppByProductId, setPromoRppByProductId] = useState<Map<number, number>>(
    () => new Map(),
  )
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
  }, [companyId, locationId, refreshKey])

  // Keep promo windows current while the POS stays open across hour/day boundaries.
  useEffect(() => {
    let cancelled = false
    async function refreshPromoPrices() {
      if (apiProducts.length === 0) {
        if (!cancelled) setPromoRppByProductId(new Map())
        return
      }
      try {
        const active = await api.posPromotionActivePrices(companyId, {
          locationExternalId: locationId,
          productIds: apiProducts.map(p => p.id),
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
        /* keep last known promo map */
      }
    }

    const id = window.setInterval(() => void refreshPromoPrices(), PROMO_PRICE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [apiProducts, companyId, locationId])

  const catalog = useMemo(
    () => mapApiProductsToPosCatalog(apiProducts, apiProducts, promoRppByProductId),
    [apiProducts, promoRppByProductId],
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

  // Keep one POS app instance so MemoryRouter navigation (POS Setup, Home, etc.)
  // is not reset when catalog/session props refresh.
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
