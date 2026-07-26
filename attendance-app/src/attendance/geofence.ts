import type { GeoPoint, GeofenceCheck } from './types'

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

/** Great-circle distance in meters (Haversine). */
export function distanceMeters(
  a: Pick<GeoPoint, 'latitude' | 'longitude'>,
  b: Pick<GeoPoint, 'latitude' | 'longitude'>,
): number {
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function checkGeofence(
  point: GeoPoint | null,
  fence: (GeoPoint & { radiusMeters: number }) | null,
): GeofenceCheck {
  if (!fence) {
    return {
      configured: false,
      inside: false,
      distanceMeters: null,
      radiusMeters: null,
      accuracyMeters: point?.accuracyMeters ?? null,
    }
  }
  if (!point) {
    return {
      configured: true,
      inside: false,
      distanceMeters: null,
      radiusMeters: fence.radiusMeters,
      accuracyMeters: null,
    }
  }
  const d = distanceMeters(point, fence)
  // Allow GPS accuracy slack so a 20m-accurate fix near the edge isn't rejected.
  const slack = Math.min(point.accuracyMeters ?? 0, 40)
  return {
    configured: true,
    inside: d <= fence.radiusMeters + slack,
    distanceMeters: Math.round(d),
    radiusMeters: fence.radiusMeters,
    accuracyMeters: point.accuracyMeters ?? null,
  }
}

export function formatDistance(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0m'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}
