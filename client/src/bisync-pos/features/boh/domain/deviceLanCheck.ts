/** Client-side LAN / peripheral helpers for POS Device Setup. */

export type LocalNetworkAddress = {
  address: string
  source: 'webrtc' | 'api'
}

export type LocalUsbPeripheral = {
  key: string
  vendorId: number
  productId: number
  productName: string
  manufacturerName: string
  serialNumber: string
}

function ipv4FromCandidate(candidate: string): string | null {
  // host candidate: ... 192.168.1.10 ...
  const m = candidate.match(
    /\b((?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3})\b/,
  )
  return m?.[1] ?? null
}

/** Discover this browser/station private IPv4 addresses via WebRTC ICE. */
export async function discoverLocalIpv4Addresses(): Promise<string[]> {
  const found = new Set<string>()
  if (typeof RTCPeerConnection === 'undefined') return []

  const pc = new RTCPeerConnection({ iceServers: [] })
  try {
    pc.createDataChannel('lan-check')
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await new Promise<void>((resolve) => {
      const done = () => resolve()
      const timer = window.setTimeout(done, 1500)
      pc.onicecandidate = (ev) => {
        if (!ev.candidate) {
          window.clearTimeout(timer)
          done()
          return
        }
        const ip = ipv4FromCandidate(ev.candidate.candidate)
        if (ip) found.add(ip)
      }
    })
  } catch {
    // WebRTC may be blocked; ignore.
  } finally {
    pc.close()
  }
  return [...found]
}

type UsbLike = {
  vendorId: number
  productId: number
  productName?: string
  manufacturerName?: string
  serialNumber?: string
  opened?: boolean
}

function mapUsb(device: UsbLike): LocalUsbPeripheral {
  return {
    key: `${device.vendorId}:${device.productId}:${device.serialNumber || ''}`,
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName?.trim() || `USB ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
    manufacturerName: device.manufacturerName?.trim() || '',
    serialNumber: device.serialNumber?.trim() || '',
  }
}

function usbApi(): { getDevices: () => Promise<UsbLike[]>; requestDevice: (opts: { filters: object[] }) => Promise<UsbLike> } | null {
  const nav = navigator as Navigator & {
    usb?: {
      getDevices: () => Promise<UsbLike[]>
      requestDevice: (opts: { filters: object[] }) => Promise<UsbLike>
    }
  }
  return nav.usb ?? null
}

export function webUsbSupported(): boolean {
  return Boolean(usbApi())
}

/** Already-authorized USB devices for this origin. */
export async function listAuthorizedUsbPeripherals(): Promise<LocalUsbPeripheral[]> {
  const usb = usbApi()
  if (!usb) return []
  try {
    const devices = await usb.getDevices()
    return devices.map(mapUsb)
  } catch {
    return []
  }
}

/** Prompt user to pick a USB peripheral (requires user gesture). */
export async function requestUsbPeripheral(): Promise<LocalUsbPeripheral | null> {
  const usb = usbApi()
  if (!usb) return null
  try {
    const device = await usb.requestDevice({ filters: [] })
    return mapUsb(device)
  } catch {
    return null
  }
}
