/** Punch / presence proof methods. Backend can require one or more per outlet. */
export type PunchMethod = 'gps' | 'qr' | 'beacon' | 'nfc' | 'pos'

export type PunchAction = 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd'

export type GeoPoint = {
  latitude: number
  longitude: number
  accuracyMeters?: number
  capturedAt?: string
}

export type OutletAttendancePolicy = {
  outletId: number
  outletName?: string
  /** Center of the site geofence. Null = not configured yet. */
  geofence: (GeoPoint & { radiusMeters: number }) | null
  /** Methods allowed at this outlet (at least one must succeed). */
  allowedMethods: PunchMethod[]
  /** If true, GPS must be inside geofence when method includes gps. */
  requireGeofence: boolean
}

export type AttendanceShift = {
  id: string
  outletId: number
  outletName?: string
  staffKey: string
  staffName?: string
  clockInAt: string
  clockOutAt?: string | null
  clockInMethod: PunchMethod
  clockOutMethod?: PunchMethod | null
  clockInGeo?: GeoPoint | null
  clockOutGeo?: GeoPoint | null
  status: 'open' | 'closed'
}

export type AttendanceStatus = {
  openShift: AttendanceShift | null
  todayPunches: AttendanceShift[]
  policy: OutletAttendancePolicy | null
}

export type PunchRequest = {
  outletId: number
  action: PunchAction
  method: PunchMethod
  geo?: GeoPoint | null
  /** Rotating QR payload when method === 'qr' */
  qrToken?: string | null
  /** BLE beacon UUID when method === 'beacon' */
  beaconId?: string | null
  deviceId?: string | null
  notes?: string | null
}

export type PunchResult = {
  shift: AttendanceShift
  message: string
}

export type GeofenceCheck = {
  configured: boolean
  inside: boolean
  distanceMeters: number | null
  radiusMeters: number | null
  accuracyMeters: number | null
}
