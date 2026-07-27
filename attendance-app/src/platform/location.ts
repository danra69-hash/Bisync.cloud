import type { GeoPoint } from '../attendance/types'

/**
 * Device location — web Geolocation API today.
 * Swap the body for Capacitor `@capacitor/geolocation` when wrapping for Android/iOS;
 * keep this module as the single call site so pages stay platform-agnostic.
 */
export class LocationError extends Error {
  code: 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown'
  constructor(
    code: LocationError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'LocationError'
    this.code = code
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation
}

export async function getCurrentPosition(options?: {
  enableHighAccuracy?: boolean
  timeoutMs?: number
  maximumAgeMs?: number
}): Promise<GeoPoint> {
  if (!isGeolocationSupported()) {
    throw new LocationError(
      'unsupported',
      'Location is not supported in this browser. Use HTTPS or a native app build.',
    )
  }

  // Desktop / embedded browsers often hang if high-accuracy is required.
  const enableHighAccuracy = options?.enableHighAccuracy ?? false
  const timeout = options?.timeoutMs ?? 8_000
  const maximumAge = options?.maximumAgeMs ?? 30_000

  const geoPromise = new Promise<GeoPoint>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp).toISOString(),
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new LocationError(
              'denied',
              'Location permission denied. Enable location for this site to clock in.',
            ),
          )
          return
        }
        if (err.code === err.TIMEOUT) {
          reject(
            new LocationError(
              'timeout',
              'Timed out reading GPS. Move outdoors or try again.',
            ),
          )
          return
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          reject(
            new LocationError(
              'unavailable',
              'GPS unavailable. Check device location settings.',
            ),
          )
          return
        }
        reject(new LocationError('unknown', err.message || 'Could not read location'))
      },
      { enableHighAccuracy, timeout, maximumAge },
    )
  })

  // Some browsers never fire the error callback on permission prompts — hard stop.
  const watchdog = new Promise<GeoPoint>((_, reject) => {
    window.setTimeout(() => {
      reject(
        new LocationError(
          'timeout',
          'Timed out reading GPS. Use “Simulate at site” for local testing.',
        ),
      )
    }, timeout + 1_000)
  })

  return Promise.race([geoPromise, watchdog])
}

/** Fixed coordinate for local Clock development when device GPS is unavailable. */
export function createSimulatedPosition(
  base?: Pick<GeoPoint, 'latitude' | 'longitude'> | null,
): GeoPoint {
  return {
    latitude: base?.latitude ?? 1.3521,
    longitude: base?.longitude ?? 103.8198,
    accuracyMeters: 10,
    capturedAt: new Date().toISOString(),
  }
}
