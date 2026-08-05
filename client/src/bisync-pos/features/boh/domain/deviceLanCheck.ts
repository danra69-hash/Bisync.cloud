/** Client-side LAN / peripheral helpers for POS Device Setup. */

import type { PosDeviceType } from '../../../../data/posDevices'

const STATION_IP_STORAGE_KEY = 'bisync-pos-station-lan-ip'

export type LocalNetworkAddress = {
  address: string
  source: 'webrtc' | 'api' | 'manual' | 'stored'
}

export type LocalUsbPeripheral = {
  key: string
  vendorId: number
  productId: number
  productName: string
  manufacturerName: string
  serialNumber: string
}

export type LanProbePort = {
  port: number
  label: string
  suggestedDeviceType: PosDeviceType
}

/** Common POS / printer / display ports probed during Network check (order = probe priority). */
export const LAN_PROBE_PORTS: LanProbePort[] = [
  { port: 80, label: 'HTTP device / KDS', suggestedDeviceType: 'kitchenDisplay' },
  { port: 9100, label: 'Raw ESC/POS printer', suggestedDeviceType: 'printer' },
  { port: 8008, label: 'Epson ePOS HTTP', suggestedDeviceType: 'printer' },
  { port: 443, label: 'HTTPS device', suggestedDeviceType: 'kitchenDisplay' },
  { port: 8080, label: 'HTTP alt / KDS', suggestedDeviceType: 'kitchenDisplay' },
  { port: 631, label: 'IPP printer', suggestedDeviceType: 'printer' },
  { port: 9101, label: 'Alternate printer', suggestedDeviceType: 'printer' },
]

export type DiscoveredLanHost = {
  host: string
  openPorts: number[]
  labels: string[]
  suggestedDeviceType: PosDeviceType
  latencyMs: number
  isStation: boolean
}

export type LanSubnetScanProgress = {
  scanned: number
  total: number
  found: number
  subnetCidr: string
}

export type LanSubnetScanResult = {
  stationIps: string[]
  subnetCidr: string
  hosts: DiscoveredLanHost[]
  scannedHosts: number
  durationMs: number
  permission: 'granted' | 'denied' | 'unsupported' | 'unknown'
  note: string
}

type FetchInitWithLocal = RequestInit & {
  targetAddressSpace?: 'local' | 'loopback' | 'public'
}

export function isPrivateIpv4(ip: string): boolean {
  const octets = parseIpv4Octets(ip)
  if (!octets) return false
  const [a, b] = octets
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function ipv4FromCandidate(candidate: string): string | null {
  // host candidate: ... 192.168.1.10 ...
  const m = candidate.match(
    /\b((?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3})\b/,
  )
  return m?.[1] ?? null
}

function collectPrivateIpsFromText(text: string, into: Set<string>) {
  if (!text) return
  const re =
    /\b((?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3})\b/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (isPrivateIpv4(match[1])) into.add(match[1])
  }
}

/** Persist last successful station IP for the next Network check. */
export function loadStoredStationIpv4(): string | null {
  try {
    const raw = localStorage.getItem(STATION_IP_STORAGE_KEY)?.trim() || ''
    return isPrivateIpv4(raw) ? raw : null
  } catch {
    return null
  }
}

export function storeStationIpv4(ip: string): void {
  if (!isPrivateIpv4(ip)) return
  try {
    localStorage.setItem(STATION_IP_STORAGE_KEY, ip.trim())
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredStationIpv4(): void {
  try {
    localStorage.removeItem(STATION_IP_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Discover this browser/station private IPv4 addresses via WebRTC ICE + SDP scrape.
 * Chromium often mDNS-obfuscates host candidates — callers must support manual override.
 */
export async function discoverLocalIpv4Addresses(): Promise<string[]> {
  const found = new Set<string>()
  if (typeof RTCPeerConnection === 'undefined') return []

  async function runIce(iceServers: RTCIceServer[]): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers })
    try {
      pc.createDataChannel('lan-check')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (pc.localDescription?.sdp) {
        collectPrivateIpsFromText(pc.localDescription.sdp, found)
      }

      await new Promise<void>((resolve) => {
        const done = () => resolve()
        const timer = window.setTimeout(done, 2000)
        pc.onicecandidate = (ev) => {
          if (!ev.candidate) {
            window.clearTimeout(timer)
            done()
            return
          }
          const cand = ev.candidate
          const fromAddress =
            typeof (cand as RTCIceCandidate & { address?: string }).address === 'string'
              ? (cand as RTCIceCandidate & { address?: string }).address
              : null
          if (fromAddress && isPrivateIpv4(fromAddress)) found.add(fromAddress)
          const fromLine = ipv4FromCandidate(cand.candidate || '')
          if (fromLine) found.add(fromLine)
        }
      })

      if (pc.localDescription?.sdp) {
        collectPrivateIpsFromText(pc.localDescription.sdp, found)
      }
    } catch {
      // WebRTC may be blocked; ignore.
    } finally {
      pc.close()
    }
  }

  // Host-only first (no STUN), then a short STUN pass — still keep only RFC1918.
  await runIce([])
  if (found.size === 0) {
    await runIce([{ urls: 'stun:stun.l.google.com:19302' }])
  }

  return [...found]
}

/**
 * Resolve station IPs for LAN scan: manual override → WebRTC → last stored.
 */
export async function resolveStationIpv4Addresses(options?: {
  manualIp?: string | null
}): Promise<{ ips: string[]; source: 'manual' | 'webrtc' | 'stored' | 'none' }> {
  const manual = (options?.manualIp || '').trim()
  if (manual && isPrivateIpv4(manual)) {
    storeStationIpv4(manual)
    return { ips: [manual], source: 'manual' }
  }

  const webrtc = await discoverLocalIpv4Addresses()
  if (webrtc.length > 0) {
    storeStationIpv4(webrtc[0])
    return { ips: webrtc, source: 'webrtc' }
  }

  const stored = loadStoredStationIpv4()
  if (stored) {
    return { ips: [stored], source: 'stored' }
  }

  return { ips: [], source: 'none' }
}

export function parseIpv4Octets(ip: string): number[] | null {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((p) => Number(p))
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return octets
}

/** Build host list for a /24 around the station IP (excludes .0 and .255). */
export function buildSubnetHostList(stationIp: string): { hosts: string[]; subnetCidr: string } | null {
  const octets = parseIpv4Octets(stationIp)
  if (!octets) return null
  const prefix = `${octets[0]}.${octets[1]}.${octets[2]}`
  const hosts: string[] = []
  for (let i = 1; i <= 254; i++) {
    hosts.push(`${prefix}.${i}`)
  }
  return { hosts, subnetCidr: `${prefix}.0/24` }
}

async function queryLocalNetworkPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  try {
    const perms = navigator.permissions
    if (!perms?.query) return 'unsupported'
    // Chromium: local-network / local-network-access (name varies by version).
    for (const name of ['local-network', 'local-network-access'] as const) {
      try {
        const status = await perms.query({ name: name as PermissionName })
        if (status.state === 'granted') return 'granted'
        if (status.state === 'denied') return 'denied'
        if (status.state === 'prompt') return 'prompt'
      } catch {
        // try next name
      }
    }
    return 'unsupported'
  } catch {
    return 'unsupported'
  }
}

/**
 * Trigger Chrome Local Network Access permission (secure context).
 * Returns whether subsequent private-IP fetches are likely allowed.
 */
export async function ensureLocalNetworkAccess(samplePrivateIp: string): Promise<
  'granted' | 'denied' | 'unsupported' | 'unknown'
> {
  const before = await queryLocalNetworkPermission()
  if (before === 'granted') return 'granted'
  if (before === 'denied') return 'denied'

  const gatewayGuess = (() => {
    const octets = parseIpv4Octets(samplePrivateIp)
    if (!octets) return samplePrivateIp
    return `${octets[0]}.${octets[1]}.${octets[2]}.1`
  })()

  try {
    const init: FetchInitWithLocal = {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      targetAddressSpace: 'local',
      signal: AbortSignal.timeout(2000),
    }
    await fetch(`http://${gatewayGuess}/`, init)
  } catch {
    // Permission prompt may still have appeared; connection failure is expected.
  }

  const after = await queryLocalNetworkPermission()
  if (after === 'granted') return 'granted'
  if (after === 'denied') return 'denied'
  if (after === 'unsupported') return 'unsupported'
  return 'unknown'
}

async function probeHttpPort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{ open: boolean; latencyMs: number; signal?: string }> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const url =
    port === 443 ? `https://${host}/` : port === 80 ? `http://${host}/` : `http://${host}:${port}/`
  try {
    const init: FetchInitWithLocal = {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'manual',
      targetAddressSpace: 'local',
      signal: controller.signal,
    }
    await fetch(url, init)
    // Opaque / any completion after connect → treat as reachable.
    return { open: true, latencyMs: Math.round(performance.now() - started), signal: 'fetch-ok' }
  } catch (err) {
    const elapsed = Math.round(performance.now() - started)
    const name = err instanceof Error ? err.name : ''
    const message = err instanceof Error ? err.message : String(err)
    // Abort ≈ filtered/open-but-slow or firewall drop — not a clear open for HTTP ports.
    if (name === 'AbortError' || name === 'TimeoutError') {
      return { open: false, latencyMs: elapsed, signal: 'timeout' }
    }
    // Fast network errors usually mean refused / unreachable.
    return { open: false, latencyMs: elapsed, signal: message || 'error' }
  } finally {
    window.clearTimeout(timer)
  }
}

/** Raw ESC/POS ports often reject HTTP; WebSocket / error heuristics can still spot an open TCP listener. */
const RAW_PRINTER_PORTS = new Set([9100, 9101, 515])

function probeWebSocketPort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{ open: boolean; latencyMs: number; signal: string }> {
  const started = performance.now()
  return new Promise((resolve) => {
    let settled = false
    let ws: WebSocket | null = null
    const finish = (open: boolean, signal: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      try {
        ws?.close()
      } catch {
        // ignore
      }
      resolve({ open, latencyMs: Math.round(performance.now() - started), signal })
    }
    const timer = window.setTimeout(() => finish(false, 'ws-timeout'), timeoutMs)
    try {
      ws = new WebSocket(`ws://${host}:${port}`)
      ws.onopen = () => finish(true, 'ws-open')
      ws.onmessage = () => finish(true, 'ws-message')
      ws.onerror = () => {
        const elapsed = performance.now() - started
        // Refused connections fail almost immediately; protocol mismatch after TCP accept takes longer.
        if (elapsed >= 40) finish(true, 'ws-error-after-connect')
        else finish(false, 'ws-error-fast')
      }
      ws.onclose = (ev) => {
        const elapsed = performance.now() - started
        if (elapsed >= 40 && !ev.wasClean) finish(true, 'ws-close-after-connect')
        else finish(false, 'ws-close')
      }
    } catch {
      finish(false, 'ws-throw')
    }
  })
}

async function probePrinterPort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{ open: boolean; latencyMs: number; signal: string }> {
  const httpTimeout = Math.max(timeoutMs, RAW_PRINTER_PORTS.has(port) ? 700 : timeoutMs)
  const http = await probeHttpPort(host, port, httpTimeout)
  if (http.open) {
    return { open: true, latencyMs: http.latencyMs, signal: http.signal || 'fetch-ok' }
  }

  // Open raw TCP listeners often yield INVALID_HTTP_RESPONSE / EMPTY_RESPONSE after connect.
  const msg = (http.signal || '').toLowerCase()
  if (
    RAW_PRINTER_PORTS.has(port)
    && (msg.includes('invalid') || msg.includes('empty') || msg.includes('reset') || msg.includes('failed to fetch'))
    && http.latencyMs >= 35
  ) {
    return { open: true, latencyMs: http.latencyMs, signal: `http-heuristic:${http.signal}` }
  }

  if (RAW_PRINTER_PORTS.has(port) || port === 8008) {
    const ws = await probeWebSocketPort(host, port, Math.max(timeoutMs, 650))
    if (ws.open) return ws
  }

  return { open: false, latencyMs: http.latencyMs, signal: http.signal || 'closed' }
}

/**
 * Probe a single host for POS/printer ports (used by “Probe this IP” and subnet scan).
 */
export async function probeLanHost(
  host: string,
  options?: { isStation?: boolean; timeoutMs?: number },
): Promise<DiscoveredLanHost | null> {
  const timeoutMs = options?.timeoutMs ?? 450
  const isStation = Boolean(options?.isStation)
  const openPorts: number[] = []
  const labels: string[] = []
  let suggested: PosDeviceType = 'posOrderStation'
  let bestLatency = Number.POSITIVE_INFINITY

  for (const spec of LAN_PROBE_PORTS) {
    const result = RAW_PRINTER_PORTS.has(spec.port) || spec.port === 8008 || spec.port === 631
      ? await probePrinterPort(host, spec.port, timeoutMs)
      : await probeHttpPort(host, spec.port, timeoutMs)
    if (!result.open) continue
    openPorts.push(spec.port)
    labels.push(spec.label)
    if (result.latencyMs < bestLatency) bestLatency = result.latencyMs
    if (openPorts.length === 1 || spec.suggestedDeviceType === 'printer') {
      suggested = spec.suggestedDeviceType
    }
    if (openPorts.length >= 2) break
  }

  if (openPorts.length === 0) return null

  return {
    host,
    openPorts,
    labels,
    suggestedDeviceType: suggested,
    latencyMs: Number.isFinite(bestLatency) ? bestLatency : 0,
    isStation,
  }
}

async function probeHost(
  host: string,
  isStation: boolean,
  timeoutMs: number,
): Promise<DiscoveredLanHost | null> {
  return probeLanHost(host, { isStation, timeoutMs })
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onItemDone?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  let completed = 0
  const total = items.length

  async function run() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
      completed++
      onItemDone?.(completed, total)
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(runners)
  return results
}

/**
 * Scan this station’s /24 for hosts that answer on common POS ports.
 * Requires browser Local Network Access (Chrome) when the app is on a public HTTPS origin.
 */
export async function scanLocalSubnetDevices(
  stationIps: string[],
  options?: {
    timeoutMs?: number
    concurrency?: number
    onProgress?: (progress: LanSubnetScanProgress) => void
  },
): Promise<LanSubnetScanResult> {
  const started = performance.now()
  const timeoutMs = options?.timeoutMs ?? 350
  const concurrency = options?.concurrency ?? 32
  const primary = stationIps[0]
  if (!primary) {
    return {
      stationIps,
      subnetCidr: '',
      hosts: [],
      scannedHosts: 0,
      durationMs: 0,
      permission: 'unknown',
      note:
        'No private station IP detected — cannot scan the LAN from this browser. Enter this PC’s IPv4 (Windows: Settings → Network → Properties, or ipconfig) in Station IP below, then run Network check again.',
    }
  }

  const subnet = buildSubnetHostList(primary)
  if (!subnet) {
    return {
      stationIps,
      subnetCidr: '',
      hosts: [],
      scannedHosts: 0,
      durationMs: 0,
      permission: 'unknown',
      note: 'Station IP is not a valid private IPv4 address.',
    }
  }

  const permission = await ensureLocalNetworkAccess(primary)
  if (permission === 'denied') {
    return {
      stationIps,
      subnetCidr: subnet.subnetCidr,
      hosts: [],
      scannedHosts: 0,
      durationMs: Math.round(performance.now() - started),
      permission,
      note: 'Local network access was blocked for this site. Allow local network access in the browser prompt (or site settings), then run Network check again.',
    }
  }

  const stationSet = new Set(stationIps)
  let found = 0
  const probed = await mapPool(
    subnet.hosts,
    concurrency,
    async (host) => {
      const hit = await probeHost(host, stationSet.has(host), timeoutMs)
      if (hit) found++
      return hit
    },
    (scanned, total) => {
      options?.onProgress?.({
        scanned,
        total,
        found,
        subnetCidr: subnet.subnetCidr,
      })
    },
  )

  const hosts = probed
    .filter((h): h is DiscoveredLanHost => h != null)
    .sort((a, b) => {
      if (a.isStation !== b.isStation) return a.isStation ? -1 : 1
      const aPrint = a.suggestedDeviceType === 'printer' ? 0 : 1
      const bPrint = b.suggestedDeviceType === 'printer' ? 0 : 1
      if (aPrint !== bPrint) return aPrint - bPrint
      return a.host.localeCompare(b.host, undefined, { numeric: true })
    })

  const durationMs = Math.round(performance.now() - started)
  let note = `Scanned ${subnet.subnetCidr} from this station — found ${hosts.length} reachable host(s) on common POS ports.`
  if (permission === 'unsupported') {
    note +=
      ' This browser may not expose Local Network Access controls; results can be incomplete on public HTTPS origins.'
  } else if (permission === 'unknown') {
    note +=
      ' If few hosts appear, allow Local Network Access when Chrome prompts, then scan again.'
  }
  if (hosts.length === 0) {
    note +=
      ' ESC/POS printers on port 9100 often ignore browser HTTP probes — use “Add printer by IP” below, or run Find-BisyncPrinters.cmd from the Windows LAN package and paste the results.'
  }

  return {
    stationIps,
    subnetCidr: subnet.subnetCidr,
    hosts,
    scannedHosts: subnet.hosts.length,
    durationMs,
    permission,
    note,
  }
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
