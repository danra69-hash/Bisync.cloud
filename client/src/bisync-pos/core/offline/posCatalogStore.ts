import { api, type Product as ApiProduct, type PosPromotion } from '../../../api'
import { pullFloorPlanFromServer } from '../../features/order/domain/floorPlanSync'
import { idbGet, idbSet } from './idbStore'
import {
  loadStationActivation,
  saveStationActivation,
  type StationActivation,
} from '../station/stationActivation'

export type PosModifierGroupSnapshot = Awaited<ReturnType<typeof api.posModifierGroups>>[number]

export type PosCatalogSnapshot = {
  companyId: number
  locationExternalId: string
  downloadedAt: string
  products: ApiProduct[]
  promoRppByProductId: Record<string, number>
  modifierGroups: PosModifierGroupSnapshot[]
  promotions: PosPromotion[]
}

function catalogKey(companyId: number, locationExternalId: string) {
  return `catalog:${companyId}:${locationExternalId}`
}

export async function loadCatalogSnapshot(
  companyId: number,
  locationExternalId: string,
): Promise<PosCatalogSnapshot | null> {
  return idbGet<PosCatalogSnapshot>(catalogKey(companyId, locationExternalId))
}

/** Download products, promo prices, modifiers, promotions, and floor plan onto the device. */
export async function downloadStationPackage(
  companyId: number,
  locationExternalId: string,
): Promise<PosCatalogSnapshot> {
  const [products, activePrices, modifierGroups, promotions] = await Promise.all([
    api.products(companyId),
    api.posPromotionActivePrices(companyId, {
      locationExternalId,
    }),
    api.posModifierGroups(companyId, { includeInactive: false }),
    api.posPromotions(companyId),
  ])

  const promoRppByProductId: Record<string, number> = {}
  for (const row of activePrices.prices ?? []) {
    if (row.productId > 0 && Number.isFinite(row.rpp) && row.rpp >= 0) {
      promoRppByProductId[String(row.productId)] = row.rpp
    }
  }

  // Floor plan → device cache (force pull; never push stock demo back to server).
  await pullFloorPlanFromServer(companyId, locationExternalId)

  const snapshot: PosCatalogSnapshot = {
    companyId,
    locationExternalId,
    downloadedAt: new Date().toISOString(),
    products,
    promoRppByProductId,
    modifierGroups,
    promotions,
  }
  await idbSet(catalogKey(companyId, locationExternalId), snapshot)

  const activation = await loadStationActivation()
  if (activation && activation.companyId === companyId && activation.locationExternalId === locationExternalId) {
    const next: StationActivation = { ...activation, catalogDownloadedAt: snapshot.downloadedAt }
    await saveStationActivation(next)
  }

  return snapshot
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
