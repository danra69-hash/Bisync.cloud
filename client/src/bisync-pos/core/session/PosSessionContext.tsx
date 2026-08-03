import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { Product as PosProduct } from '../../features/register/domain/types'
import type { PosPromotion } from '../../../api'
import type { PosModifierGroupSnapshot } from '../offline/posCatalogStore'

export type PosLocationOption = {
  externalId: string
  name: string
}

export type PosSessionValue = {
  companyId: number
  locationId: string
  locations: PosLocationOption[]
  setLocationId: (locationId: string) => void
  /** Live POS sell catalog mapped for the register UI. */
  catalog: PosProduct[]
  catalogLoading: boolean
  catalogError: string | null
  /** Soft refresh from device cache (or network when Reload runs). */
  refreshCatalog: () => void
  /** Admin Reload: re-download catalog/floor from server (requires internet). */
  reloadStationData: () => Promise<void>
  reloading: boolean
  offlineFirst: boolean
  catalogDownloadedAt: string | null
  modifierGroups: PosModifierGroupSnapshot[]
  promotions: PosPromotion[]
}

const PosSessionContext = createContext<PosSessionValue | null>(null)

type Props = {
  value: PosSessionValue
  children: ReactNode
}

export function PosSessionProvider({ value, children }: Props) {
  const memo = useMemo(() => value, [value])
  return (
    <PosSessionContext.Provider value={memo}>
      {children}
    </PosSessionContext.Provider>
  )
}

export function usePosSession(): PosSessionValue {
  const ctx = useContext(PosSessionContext)
  if (!ctx) throw new Error('usePosSession must be used within PosSessionProvider')
  return ctx
}

export function usePosSessionOptional(): PosSessionValue | null {
  return useContext(PosSessionContext)
}
