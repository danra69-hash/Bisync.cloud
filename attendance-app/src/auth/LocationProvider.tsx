import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth, type UsageRole } from './AuthProvider'
import { isAttendanceMock } from '../api/attendance'
import { listHrDepartments } from '../api/hr'
import { getInventoryOutlets } from '../api/inventory'
import { getOperatorOutlets } from '../api/operatorOrders'
import { getVirtualOutlets } from '../api/vendorOrders'
import { useInvalidateOnChange } from '../hooks/useInvalidateOnChange'
import type { Outlet } from '../types'

/** Local attendance company locations — greenfield Clock product. */
const DEMO_OUTLETS: Outlet[] = [
  {
    outletId: 9001,
    name: 'Kitchen (HQ)',
    isDefault: true,
    outletAddress: 'Set geofence from Clock screen',
  },
  {
    outletId: 9002,
    name: 'Cafe (Mall)',
    outletAddress: 'Second company location',
  },
]

function locationStorageKey(role: UsageRole) {
  return `bisync_rms_web_location_id_${role}`
}

type LocationContextValue = {
  locations: Outlet[]
  selectedLocationId: number | null
  selectedLocation: Outlet | null
  setSelectedLocationId: (id: number | null) => void
  loading: boolean
  error: string | null
}

const LocationContext = createContext<LocationContextValue | null>(null)

function normalizeList(data: unknown): Outlet[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    const r = row as Record<string, unknown>
    const outletId = Number(r.outletId ?? r.id)
    if (!Number.isFinite(outletId)) return []
    return [
      {
        outletId,
        name: String(r.name ?? r.outletName ?? `Location ${outletId}`),
        isDefault: Boolean(r.isDefault),
        outletAddress: r.outletAddress
          ? String(r.outletAddress)
          : r.address
            ? String(r.address)
            : undefined,
      } satisfies Outlet,
    ]
  })
}

function mergeOutlets(primary: Outlet[], extra: Outlet[]): Outlet[] {
  const byId = new Map<number, Outlet>()
  for (const o of primary) byId.set(o.outletId, o)
  for (const o of extra) {
    if (!byId.has(o.outletId)) byId.set(o.outletId, o)
  }
  return [...byId.values()].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
  )
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { token, usageRole, session } = useAuth()
  const [locations, setLocations] = useState<Outlet[]>([])
  const [selectedLocationId, setSelectedLocationIdState] = useState<number | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setSelectedLocationId = useCallback(
    (id: number | null) => {
      setSelectedLocationIdState(id)
      const key = locationStorageKey(usageRole)
      if (id == null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(id))
    },
    [usageRole],
  )

  // Any screen whose queryKey includes outlet/location will refetch.
  useInvalidateOnChange('location', selectedLocationId, {
    enabled: !!token && !loading,
  })

  // Role switch: refresh lists for the new role (skip first mount).
  useInvalidateOnChange('usageRole', usageRole, { enabled: !!token })

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!token) {
        setLocations([])
        setSelectedLocationIdState(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setLocations([])
      setSelectedLocationIdState(null)

      try {
        let list: Outlet[]
        const isHrSession = !!session?.employeeId || token.startsWith('hr-employee-')

        if (isAttendanceMock()) {
          list = DEMO_OUTLETS
        } else if (isHrSession) {
          // Bisync.cloud HR — company locations from department directory.
          const departments = await listHrDepartments()
          list = departments
            .map(
              (d) =>
                ({
                  outletId: d.id,
                  name: d.name,
                  isDefault: session?.departmentId === d.id,
                }) satisfies Outlet,
            )
            .sort((a, b) =>
              (a.name || '').localeCompare(b.name || '', undefined, {
                sensitivity: 'base',
              }),
            )
          if (list.length === 0 && session?.department) {
            list = [
              {
                outletId: session.departmentId || 1,
                name: session.department,
                isDefault: true,
              },
            ]
          }
        } else if (usageRole === 'vendor') {
          list = normalizeList(await getVirtualOutlets(token))
        } else {
          const [orderOutlets, inventoryOutlets] = await Promise.all([
            getOperatorOutlets(token).catch(() => [] as Outlet[]),
            getInventoryOutlets(token).catch(() => [] as Outlet[]),
          ])
          list = mergeOutlets(
            normalizeList(orderOutlets),
            normalizeList(inventoryOutlets),
          )
        }
        if (cancelled) return

        setLocations(list)

        const rawSaved = localStorage.getItem(locationStorageKey(usageRole))
        const saved = rawSaved != null ? Number(rawSaved) : NaN
        const preferred =
          (session?.departmentId != null
            ? list.find((l) => l.outletId === session.departmentId)
            : undefined) ||
          (Number.isFinite(saved)
            ? list.find((l) => l.outletId === saved)
            : undefined) ||
          list.find((l) => l.isDefault) ||
          list[0] ||
          null

        setSelectedLocationIdState(preferred?.outletId ?? null)
        if (preferred) {
          localStorage.setItem(
            locationStorageKey(usageRole),
            String(preferred.outletId),
          )
        }
      } catch (err) {
        if (!cancelled) {
          setLocations([])
          setSelectedLocationIdState(null)
          setError((err as Error).message || 'Failed to load locations')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, usageRole, session?.departmentId, session?.department, session?.employeeId])

  const value = useMemo<LocationContextValue>(() => {
    const selectedLocation =
      locations.find((l) => l.outletId === selectedLocationId) || null
    return {
      locations,
      selectedLocationId,
      selectedLocation,
      setSelectedLocationId,
      loading,
      error,
    }
  }, [locations, selectedLocationId, setSelectedLocationId, loading, error])

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  )
}

export function useLocationFilter() {
  const ctx = useContext(LocationContext)
  if (!ctx) {
    throw new Error('useLocationFilter must be used within LocationProvider')
  }
  return ctx
}
