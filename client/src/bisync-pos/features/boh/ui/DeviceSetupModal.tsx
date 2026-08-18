import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  api,
  type PosDevice,
  type PosLanCheckResult,
  type PosPrinterSdk,
} from '../../../../api'
import {
  POS_CONNECTION_TYPES,
  POS_DEVICE_TYPES,
  defaultPortForDeviceType,
  deviceTypeLabel,
  type PosConnectionType,
  type PosDeviceType,
} from '../../../../data/posDevices'
import {
  discoverLocalIpv4Addresses,
  isPrivateIpv4,
  listAuthorizedUsbPeripherals,
  loadStoredStationIpv4,
  probeLanHost,
  requestUsbPeripheral,
  resolveStationIpv4Addresses,
  scanLocalSubnetDevices,
  storeStationIpv4,
  webUsbSupported,
  type DiscoveredLanHost,
  type LanSubnetScanProgress,
  type LanSubnetScanResult,
  type LocalUsbPeripheral,
} from '../domain/deviceLanCheck'
import { isAndroidDevice } from '../../../../data/posKiosk'
import { WINDOWS_ESCPOS_SDK_CODE } from '../../../../data/windowsEscposSdk'
import { DANTSU_PRINTER_SDK_CODE } from '../../../../data/dantsuPrinterSdk'
import { usePosOverlayHost } from '../../../core/ui/posOverlayHost'
import './DeviceSetupModal.css'

function isWindowsDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || ''
  return /windows/i.test(ua) || /win/i.test(platform)
}

function preferredPrinterSdkCode(): string {
  if (isWindowsDevice()) return WINDOWS_ESCPOS_SDK_CODE
  if (isAndroidDevice()) return DANTSU_PRINTER_SDK_CODE
  return DANTSU_PRINTER_SDK_CODE
}

type Props = {
  companyId: number
  locationId: string
  onClose: () => void
}

type AddDraft = {
  name: string
  deviceType: PosDeviceType
  connectionType: PosConnectionType
  hostAddress: string
  port: string
  printerSdkCode: string
}

/** Roles users can assign when linking a network device. */
const ASSIGNABLE_DEVICE_TYPES: { value: PosDeviceType; label: string }[] = [
  { value: 'printer', label: 'Printer' },
  { value: 'kitchenDisplay', label: 'Kitchen Display (KDS)' },
  { value: 'barDisplay', label: 'Bar Display (BDS)' },
  { value: 'posMain', label: 'POS Main' },
  { value: 'posOrderStation', label: 'POS Order Station' },
  { value: 'kiosk', label: 'Kiosk' },
]

function blankDraft(): AddDraft {
  return {
    name: '',
    deviceType: 'printer',
    connectionType: 'ethernet',
    hostAddress: '',
    port: String(defaultPortForDeviceType('printer')),
    printerSdkCode: preferredPrinterSdkCode(),
  }
}

function asPosDeviceType(value: string | undefined | null): PosDeviceType {
  const hit = POS_DEVICE_TYPES.find((t) => t.value === value)
  return hit?.value ?? 'printer'
}

function upsertPayloadFromDevice(
  device: PosDevice,
  patch: Partial<{
    name: string
    deviceType: PosDeviceType
    connectionType: PosConnectionType
    hostAddress: string
    port: number | null
    active: boolean
    printerSdkCode: string
  }>,
) {
  const deviceType = patch.deviceType ?? asPosDeviceType(device.deviceType)
  const printerSdkCode =
    patch.printerSdkCode !== undefined
      ? patch.printerSdkCode
      : deviceType === 'printer'
        ? device.printerSdkCode || 'dantsu-escpos-android'
        : device.printerSdkCode || undefined
  return {
    companyId: device.companyId,
    locationExternalId: device.locationExternalId,
    name: patch.name ?? device.name,
    deviceType,
    connectionType: patch.connectionType ?? (device.connectionType as PosConnectionType),
    hostAddress: patch.hostAddress ?? device.hostAddress,
    port: patch.port !== undefined ? patch.port : device.port,
    macAddress: device.macAddress,
    subnetMask: device.subnetMask,
    gateway: device.gateway,
    dnsPrimary: device.dnsPrimary,
    dnsSecondary: device.dnsSecondary,
    hostname: device.hostname,
    printerSdkCode,
    printerBrand: device.printerBrand,
    printerModel: device.printerModel,
    paperWidthMm: device.paperWidthMm,
    printAlignment: device.printAlignment,
    printMarginLeft: device.printMarginLeft,
    printMarginRight: device.printMarginRight,
    printerSetupComplete: device.printerSetupComplete,
    active: patch.active ?? device.active,
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DeviceSetupModal({ companyId, locationId, onClose }: Props) {
  const overlayHost = usePosOverlayHost()
  const [devices, setDevices] = useState<PosDevice[]>([])
  const [sdks, setSdks] = useState<PosPrinterSdk[]>([])
  const [lan, setLan] = useState<PosLanCheckResult | null>(null)
  const [usbList, setUsbList] = useState<LocalUsbPeripheral[]>([])
  const [checkingLan, setCheckingLan] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [draft, setDraft] = useState<AddDraft>(blankDraft)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  /** Selected link role per registered network device (after Network check). */
  const [assignTypes, setAssignTypes] = useState<Record<number, PosDeviceType>>({})
  const [linkDraft, setLinkDraft] = useState<AddDraft>(() => ({
    ...blankDraft(),
    deviceType: 'printer',
    connectionType: 'ethernet',
  }))
  const [lanScan, setLanScan] = useState<LanSubnetScanResult | null>(null)
  const [scanProgress, setScanProgress] = useState<LanSubnetScanProgress | null>(null)
  /** Role selection for newly discovered (not yet registered) hosts. */
  const [discoverAssignTypes, setDiscoverAssignTypes] = useState<Record<string, PosDeviceType>>({})
  const [linkingHost, setLinkingHost] = useState<string | null>(null)
  /** Manual station IPv4 when browser WebRTC cannot detect it (common on Windows Chrome). */
  const [stationIpOverride, setStationIpOverride] = useState(() => loadStoredStationIpv4() || '')
  const [stationIpSource, setStationIpSource] = useState<'manual' | 'webrtc' | 'stored' | 'none' | null>(null)
  const [printerIpDraft, setPrinterIpDraft] = useState('')
  const [printerNameDraft, setPrinterNameDraft] = useState('Kitchen Printer')
  const [probingPrinter, setProbingPrinter] = useState(false)
  const [windowsScanJson, setWindowsScanJson] = useState('')
  const [importedHosts, setImportedHosts] = useState<DiscoveredLanHost[]>([])

  const load = useCallback(async () => {
    if (companyId <= 0) {
      setLoading(false)
      setError('Select a company location first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [deviceRows, sdkRows, usb] = await Promise.all([
        api.posDevices(companyId, locationId || undefined),
        api.posPrinterSdks(),
        listAuthorizedUsbPeripherals(),
      ])
      setDevices(deviceRows)
      setSdks(sdkRows)
      setUsbList(usb)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices.')
    } finally {
      setLoading(false)
    }
  }, [companyId, locationId])

  useEffect(() => {
    void load()
  }, [load])

  function mergeDiscoveredHosts(extra: DiscoveredLanHost[]) {
    setLanScan((prev) => {
      const base = prev ?? {
        stationIps: stationIpOverride.trim() ? [stationIpOverride.trim()] : [],
        subnetCidr: '',
        hosts: [],
        scannedHosts: 0,
        durationMs: 0,
        permission: 'unknown' as const,
        note: 'Imported / probed hosts (browser scan may still miss raw ESC/POS printers).',
      }
      const byHost = new Map<string, DiscoveredLanHost>()
      for (const h of base.hosts) byHost.set(h.host, h)
      for (const h of extra) byHost.set(h.host, h)
      const hosts = [...byHost.values()].sort((a, b) => {
        if (a.isStation !== b.isStation) return a.isStation ? -1 : 1
        const aPrint = a.suggestedDeviceType === 'printer' ? 0 : 1
        const bPrint = b.suggestedDeviceType === 'printer' ? 0 : 1
        if (aPrint !== bPrint) return aPrint - bPrint
        return a.host.localeCompare(b.host, undefined, { numeric: true })
      })
      const nextDiscover: Record<string, PosDeviceType> = {}
      for (const h of hosts) nextDiscover[h.host] = discoverAssignTypes[h.host] ?? h.suggestedDeviceType
      setDiscoverAssignTypes((prevTypes) => ({ ...nextDiscover, ...prevTypes }))
      return {
        ...base,
        hosts,
        note: `Showing ${hosts.length} host(s). Raw printers on 9100 may only appear after Windows Find-BisyncPrinters import or Add printer by IP.`,
      }
    })
  }

  async function probeAndAddPrinterIp() {
    const host = printerIpDraft.trim()
    if (!isPrivateIpv4(host)) {
      setError('Enter a private printer IP (e.g. 192.168.70.50).')
      return
    }
    setProbingPrinter(true)
    setError(null)
    setStatus(`Probing ${host} for printer ports…`)
    try {
      const hit = await probeLanHost(host, { timeoutMs: 800 })
      if (!hit) {
        // Still allow linking — raw 9100 often invisible to the browser.
        const fallback: DiscoveredLanHost = {
          host,
          openPorts: [9100],
          labels: ['Assumed ESC/POS (browser could not confirm — link & test on Windows)'],
          suggestedDeviceType: 'printer',
          latencyMs: 0,
          isStation: false,
        }
        mergeDiscoveredHosts([fallback])
        setDiscoverAssignTypes((prev) => ({ ...prev, [host]: 'printer' }))
        setLinkDraft({
          name: printerNameDraft.trim() || `Printer ${host}`,
          deviceType: 'printer',
          connectionType: 'ethernet',
          hostAddress: host,
          port: '9100',
          printerSdkCode: preferredPrinterSdkCode(),
        })
        setStatus(
          `Browser could not confirm ${host} (common for ESC/POS). Form ready with port 9100 — tap Link device, then run Windows Test-BisyncPrinter / Find-BisyncPrinters if needed.`,
        )
        return
      }
      mergeDiscoveredHosts([hit])
      const deviceType = hit.suggestedDeviceType === 'printer' ? 'printer' : hit.suggestedDeviceType
      setDiscoverAssignTypes((prev) => ({ ...prev, [host]: deviceType }))
      const port =
        hit.openPorts.find((p) => p === 9100 || p === 9101 || p === 8008 || p === 631)
        ?? hit.openPorts[0]
        ?? 9100
      setLinkDraft({
        name: printerNameDraft.trim() || `Printer ${host}`,
        deviceType,
        connectionType: 'ethernet',
        hostAddress: host,
        port: String(port),
        printerSdkCode: preferredPrinterSdkCode(),
      })
      setStatus(
        `Found ${host} · ports ${hit.openPorts.join(', ') || '—'} (${hit.labels.join(', ')}). Review Link new device below and tap Link device.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Probe failed.')
    } finally {
      setProbingPrinter(false)
    }
  }

  function importWindowsScanJson() {
    const raw = windowsScanJson.trim()
    if (!raw) {
      setError('Paste JSON from Find-BisyncPrinters.cmd (bisync-lan-find-result.json).')
      return
    }
    try {
      const parsed = JSON.parse(raw) as {
        stationIp?: string
        subnetCidr?: string
        hosts?: Array<{
          host?: string
          openPorts?: number[]
          suggestedDeviceType?: string
          isStation?: boolean
        }>
      }
      const rows = Array.isArray(parsed.hosts) ? parsed.hosts : []
      const mapped: DiscoveredLanHost[] = []
      for (const row of rows) {
        const host = String(row.host || '').trim()
        if (!isPrivateIpv4(host)) continue
        const openPorts = Array.isArray(row.openPorts)
          ? row.openPorts.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
          : []
        const suggested = asPosDeviceType(row.suggestedDeviceType || 'printer')
        mapped.push({
          host,
          openPorts,
          labels: openPorts.length
            ? openPorts.map((p) => (p === 9100 || p === 9101 ? `TCP ${p} ESC/POS` : `TCP ${p}`))
            : ['Windows TCP scan'],
          suggestedDeviceType: suggested,
          latencyMs: 0,
          isStation: Boolean(row.isStation),
        })
      }
      if (mapped.length === 0) {
        setError('No private hosts found in that JSON. Re-run Find-BisyncPrinters.cmd on the venue PC.')
        return
      }
      if (parsed.stationIp && isPrivateIpv4(parsed.stationIp)) {
        setStationIpOverride(parsed.stationIp)
        storeStationIpv4(parsed.stationIp)
      }
      setImportedHosts(mapped)
      mergeDiscoveredHosts(mapped)
      setLan((prev) => prev ?? {
        checkedAt: new Date().toISOString(),
        note: `Imported Windows LAN scan (${parsed.subnetCidr || 'subnet'}).`,
        clientLocalIps: parsed.stationIp && isPrivateIpv4(parsed.stationIp) ? [parsed.stationIp] : [],
        serverInterfaces: [],
        privateRanges: [],
        registeredDevices: [],
      })
      setStatus(
        `Imported ${mapped.length} host(s) from Windows scan${parsed.subnetCidr ? ` · ${parsed.subnetCidr}` : ''}. Assign Link as / Link device on each printer.`,
      )
      setError(null)
    } catch {
      setError('Invalid JSON. Paste the full output from Find-BisyncPrinters.ps1 / bisync-lan-find-result.json.')
    }
  }

  async function runNetworkCheck() {

    if (companyId <= 0) return
    setCheckingLan(true)
    setError(null)
    setStatus(null)
    setScanProgress(null)
    setLanScan(null)
    try {
      const manual = stationIpOverride.trim()
      if (manual && !isPrivateIpv4(manual)) {
        setError(
          'Station IP must be a private address (10.x, 172.16–31.x, or 192.168.x). Check Windows → Network properties → IPv4 address.',
        )
        setCheckingLan(false)
        return
      }

      const resolved = await resolveStationIpv4Addresses({ manualIp: manual || null })
      const clientIps = resolved.ips
      setStationIpSource(resolved.source)
      if (clientIps[0] && !manual) {
        setStationIpOverride(clientIps[0])
      }

      setStatus(
        clientIps.length
          ? `Scanning ${clientIps[0]} subnet for connected devices… Allow local network access if the browser asks.`
          : 'No station IP yet — enter this PC’s IPv4 below (Windows: Network properties or ipconfig), then run Network check again.',
      )

      const [result, scan] = await Promise.all([
        api.posDeviceLanCheck({
          companyId,
          locationExternalId: locationId || undefined,
          clientLocalIps: clientIps,
        }),
        scanLocalSubnetDevices(clientIps, {
          timeoutMs: 320,
          concurrency: 28,
          onProgress: (p) => {
            setScanProgress(p)
            setStatus(
              `Scanning ${p.subnetCidr}… ${p.scanned}/${p.total} hosts (${p.found} responding)`,
            )
          },
        }),
      ])

      setLan(result)
      setLanScan(scan)
      setScanProgress(null)

      const nextAssign: Record<number, PosDeviceType> = {}
      for (const d of result.registeredDevices) {
        if (d.isLocalPeripheral) continue
        nextAssign[d.id] = asPosDeviceType(d.deviceType)
      }
      setAssignTypes(nextAssign)

      const nextDiscover: Record<string, PosDeviceType> = {}
      for (const h of scan.hosts) {
        nextDiscover[h.host] = h.suggestedDeviceType
      }
      setDiscoverAssignTypes(nextDiscover)

      if (clientIps[0] && !linkDraft.hostAddress.trim()) {
        const parts = clientIps[0].split('.')
        if (parts.length === 4) {
          setLinkDraft((d) => ({
            ...d,
            hostAddress: `${parts[0]}.${parts[1]}.${parts[2]}.`,
          }))
        }
      }
      const usb = await listAuthorizedUsbPeripherals()
      setUsbList(usb)
      const networkCount = result.registeredDevices.filter((d) => !d.isLocalPeripheral).length
      const liveCount = scan.hosts.filter((h) => !h.isStation).length
      const sourceLabel =
        resolved.source === 'manual'
          ? 'manual station IP'
          : resolved.source === 'stored'
            ? 'saved station IP'
            : resolved.source === 'webrtc'
              ? 'browser detection'
              : 'no station IP'
      setStatus(
        clientIps.length
          ? `LAN scan complete on ${scan.subnetCidr || 'local subnet'} (${sourceLabel}) — ${liveCount} other host(s) responding, ${networkCount} registered. Assign roles below or install printer SDKs.`
          : `LAN check complete — no private station IP detected. Enter IPv4 below to scan. ${networkCount} registered device(s) listed.`,
      )
      if (scan.permission === 'denied') {
        setError(scan.note)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'LAN check failed.')
    } finally {
      setCheckingLan(false)
      setScanProgress(null)
    }
  }

  async function refreshLanAfterAssign(statusMessage: string) {
    try {
      const resolved = await resolveStationIpv4Addresses({
        manualIp: stationIpOverride.trim() || null,
      })
      const clientIps = resolved.ips.length
        ? resolved.ips
        : lan?.clientLocalIps?.length
          ? lan.clientLocalIps
          : await discoverLocalIpv4Addresses()
      const result = await api.posDeviceLanCheck({
        companyId,
        locationExternalId: locationId || undefined,
        clientLocalIps: clientIps,
      })
      setLan(result)
      const nextAssign: Record<number, PosDeviceType> = {}
      for (const d of result.registeredDevices) {
        if (d.isLocalPeripheral) continue
        nextAssign[d.id] = asPosDeviceType(d.deviceType)
      }
      setAssignTypes(nextAssign)
      setStatus(statusMessage)
    } catch {
      setStatus(statusMessage)
    }
  }

  async function assignNetworkDevice(lanDevice: PosLanCheckResult['registeredDevices'][number]) {
    const full = devices.find((d) => d.id === lanDevice.id)
    if (!full) {
      setError('Device not found — run Network check again.')
      return
    }
    const deviceType = assignTypes[lanDevice.id] ?? asPosDeviceType(lanDevice.deviceType)
    const portChanged = asPosDeviceType(full.deviceType) !== deviceType
    setBusyId(full.id)
    setError(null)
    try {
      const updated = await api.updatePosDevice(
        full.id,
        upsertPayloadFromDevice(full, {
          deviceType,
          port: portChanged ? defaultPortForDeviceType(deviceType) : full.port,
          printerSdkCode:
            deviceType === 'printer'
              ? full.printerSdkCode || 'dantsu-escpos-android'
              : '',
          active: true,
        }),
      )
      const msg = `Linked “${updated.name}” as ${updated.deviceTypeLabel || deviceTypeLabel(deviceType)}.`
      await load()
      await refreshLanAfterAssign(msg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign device.')
    } finally {
      setBusyId(null)
    }
  }

  async function linkNewNetworkDevice() {
    if (companyId <= 0) return
    if (!locationId) {
      setError('Select a POS location before linking devices.')
      return
    }
    if (!linkDraft.name.trim()) {
      setError('Enter a name for the device link (e.g. Kitchen Printer).')
      return
    }
    if (!linkDraft.hostAddress.trim()) {
      setError('Enter the device IP / host on this network.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await api.createPosDevice({
        companyId,
        locationExternalId: locationId,
        name: linkDraft.name.trim(),
        deviceType: linkDraft.deviceType,
        connectionType: linkDraft.connectionType === 'wifi' ? 'wifi' : 'ethernet',
        hostAddress: linkDraft.hostAddress.trim(),
        port: linkDraft.port.trim() ? Number(linkDraft.port) : defaultPortForDeviceType(linkDraft.deviceType),
        printerSdkCode:
          linkDraft.deviceType === 'printer'
            ? linkDraft.printerSdkCode || 'dantsu-escpos-android'
            : undefined,
        active: true,
      })
      const msg = `Linked “${created.name}” as ${created.deviceTypeLabel || deviceTypeLabel(created.deviceType)} at ${created.hostAddress || linkDraft.hostAddress}.`
      setLinkDraft((d) => ({
        ...blankDraft(),
        connectionType: 'ethernet',
        hostAddress: d.hostAddress.replace(/\d+$/, ''),
        deviceType: 'printer',
        port: String(defaultPortForDeviceType('printer')),
      }))
      await load()
      await refreshLanAfterAssign(msg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link device.')
    } finally {
      setSaving(false)
    }
  }

  function registeredMatchForHost(host: string) {
    const needle = host.trim().toLowerCase()
    return devices.find(
      (d) =>
        (d.hostAddress || '').trim().toLowerCase() === needle &&
        d.connectionType !== 'usb' &&
        d.connectionType !== 'bluetooth',
    )
  }

  function useDiscoveredHostInForm(host: DiscoveredLanHost) {
    const deviceType = discoverAssignTypes[host.host] ?? host.suggestedDeviceType
    const port =
      host.openPorts.find((p) =>
        deviceType === 'printer' ? p === 9100 || p === 9101 || p === 8008 || p === 631 : true,
      ) ?? defaultPortForDeviceType(deviceType)
    setLinkDraft({
      name: host.isStation ? 'This POS station' : `Device ${host.host}`,
      deviceType,
      connectionType: 'ethernet',
      hostAddress: host.host,
      port: String(port),
      printerSdkCode: preferredPrinterSdkCode(),
    })
    setShowAdd(false)
    setStatus(`Ready to link ${host.host} — review “Link new device” below and tap Link device.`)
  }

  async function linkDiscoveredHost(host: DiscoveredLanHost) {
    if (companyId <= 0) return
    if (!locationId) {
      setError('Select a POS location before linking devices.')
      return
    }
    const existing = registeredMatchForHost(host.host)
    const deviceType = discoverAssignTypes[host.host] ?? host.suggestedDeviceType
    const port =
      host.openPorts.find((p) =>
        deviceType === 'printer' ? p === 9100 || p === 9101 || p === 8008 || p === 631 : true,
      ) ?? defaultPortForDeviceType(deviceType)

    setLinkingHost(host.host)
    setError(null)
    try {
      if (existing) {
        const updated = await api.updatePosDevice(
          existing.id,
          upsertPayloadFromDevice(existing, {
            deviceType,
            hostAddress: host.host,
            port,
            printerSdkCode:
              deviceType === 'printer'
                ? existing.printerSdkCode || preferredPrinterSdkCode()
                : '',
            active: true,
          }),
        )
        const msg = `Linked “${updated.name}” as ${updated.deviceTypeLabel || deviceTypeLabel(deviceType)} at ${host.host}.`
        await load()
        await refreshLanAfterAssign(msg)
        return
      }

      const created = await api.createPosDevice({
        companyId,
        locationExternalId: locationId,
        name: `Device ${host.host}`,
        deviceType,
        connectionType: 'ethernet',
        hostAddress: host.host,
        port,
        printerSdkCode:
          deviceType === 'printer' ? preferredPrinterSdkCode() : undefined,
        active: true,
      })
      const msg = `Linked “${created.name}” as ${created.deviceTypeLabel || deviceTypeLabel(deviceType)} at ${host.host}.`
      await load()
      await refreshLanAfterAssign(msg)
      if (deviceType === 'printer') {
        const sdk =
          sdks.find((s) => s.sdkCode === preferredPrinterSdkCode()) || sdks[0]
        if (sdk) {
          setStatus(`${msg} Downloading printer SDK…`)
          await downloadAndInstall(sdk, created.id)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link discovered device.')
    } finally {
      setLinkingHost(null)
    }
  }

  async function saveNewDevice() {
    if (companyId <= 0) return
    if (!draft.name.trim()) {
      setError('Enter a device name (e.g. Kitchen Printer).')
      return
    }
    if (!locationId) {
      setError('Select a POS location before adding devices.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await api.createPosDevice({
        companyId,
        locationExternalId: locationId,
        name: draft.name.trim(),
        deviceType: draft.deviceType,
        connectionType: draft.connectionType,
        hostAddress: draft.hostAddress.trim(),
        port: draft.port.trim() ? Number(draft.port) : null,
        printerSdkCode: draft.deviceType === 'printer' ? draft.printerSdkCode : undefined,
        active: true,
      })
      if (created.deviceType === 'printer' && draft.printerSdkCode) {
        const deployed = await api.deployPosPrinterSdk(created.id)
        const test = await api.testPosPrinterPrint(created.id)
        setStatus(
          test.sent
            ? `${deployed.message} ${test.message}`
            : `${deployed.message} ${test.message}`,
        )
      } else {
        setStatus(`Added ${created.name}.`)
      }
      setDraft(blankDraft())
      setShowAdd(false)
      await load()
      if (lan) void runNetworkCheck()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add device.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(device: PosDevice) {
    setBusyId(device.id)
    setError(null)
    try {
      await api.setPosDeviceActive(device.id, !device.active)
      setStatus(`${device.name} ${device.active ? 'disabled' : 'enabled'}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update device.')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteDevice(device: PosDevice) {
    if (
      !window.confirm(
        `Permanently delete “${device.name}” from this location? This cannot be undone.`,
      )
    ) {
      return
    }
    setBusyId(device.id)
    setError(null)
    setStatus(null)
    try {
      await api.deletePosDevice(device.id)
      setStatus(`Deleted “${device.name}”.`)
      if (renameId === device.id) setRenameId(null)
      await load()
      if (lan) void runNetworkCheck()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete device.')
    } finally {
      setBusyId(null)
    }
  }

  async function commitRename(device: PosDevice) {
    const name = renameValue.trim()
    if (!name) {
      setError('Name cannot be empty.')
      return
    }
    setBusyId(device.id)
    setError(null)
    try {
      await api.updatePosDevice(device.id, upsertPayloadFromDevice(device, { name }))
      setRenameId(null)
      setStatus(`Renamed to ${name}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function downloadAndInstall(sdk: PosPrinterSdk, printerId?: number) {
    setError(null)
    try {
      const pack = await api.downloadPosPrinterSdkPackage(sdk.sdkCode)
      downloadBlob(pack.blob, pack.fileName)
      const platform = (sdk.platform || '').toLowerCase()
      const androidHint =
        platform === 'android' || sdk.packageKind === 'android-aar'
          ? isAndroidDevice()
            ? ' Package saved on this Android device — open Files/Downloads, unzip, and follow INSTALL.md to load the AAR.'
            : ' Android package downloaded — copy the zip onto the Android POS tablet and follow INSTALL.md.'
          : ''
      const windowsHint =
        platform === 'windows'
          ? ' Unzip on this Windows PC, run Test-BisyncPrinter.cmd, enter the printer IP (port 9100). The PC must be on the same LAN as the printer.'
          : ''
      if (printerId) {
        setBusyId(printerId)
        const deployed = await api.deployPosPrinterSdk(printerId)
        const test = await api.testPosPrinterPrint(printerId)
        const lanNote =
          !test.sent && isWindowsDevice()
            ? ' Cloud Test print cannot reach LAN printers — use the Windows LAN test script you just downloaded.'
            : ''
        setStatus(
          `${deployed.message} Package: ${pack.fileName}.${androidHint || windowsHint} ${test.message}${lanNote}`,
        )
        await load()
      } else {
        setStatus(
          `Downloaded ${pack.fileName}.${androidHint || windowsHint || ' Select a printer and Install to bind the driver.'}`,
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Driver download failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function runTestPrint(device: PosDevice) {
    if (device.deviceType !== 'printer') return
    setBusyId(device.id)
    setError(null)
    setStatus(null)
    try {
      const result = await api.testPosPrinterPrint(device.id)
      if (result.sent) setStatus(result.message)
      else {
        setStatus(result.message)
        if (!result.skipped && isWindowsDevice()) {
          setError(
            `${result.message} Tip: download “ESC/POS LAN Test (Windows)” below and run Test-BisyncPrinter.cmd with ${device.hostAddress || 'the printer IP'}.`,
          )
        } else if (!result.sent && !result.skipped) {
          setError(result.message)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test print failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function addUsbPeripheral() {
    setError(null)
    if (!webUsbSupported()) {
      setError('WebUSB is not available in this browser. Use Chrome/Edge on HTTPS, or add the device manually.')
      return
    }
    if (!locationId) {
      setError('Select a POS location first.')
      return
    }
    const picked = await requestUsbPeripheral()
    if (!picked) return
    setUsbList((prev) => {
      if (prev.some((p) => p.key === picked.key)) return prev
      return [...prev, picked]
    })
    setSaving(true)
    try {
      const name = picked.productName || 'USB peripheral'
      await api.createPosDevice({
        companyId,
        locationExternalId: locationId,
        name,
        deviceType: 'printer',
        connectionType: 'usb',
        hostAddress: '',
        macAddress: picked.serialNumber || `${picked.vendorId}:${picked.productId}`,
        hostname: picked.manufacturerName || '',
        printerSdkCode: 'dantsu-escpos-android',
        active: true,
      })
      setStatus(`Enabled local peripheral “${name}”. Rename it below if needed.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register USB peripheral.')
    } finally {
      setSaving(false)
    }
  }

  const localDevices = devices.filter(
    (d) => d.connectionType === 'usb' || d.connectionType === 'bluetooth',
  )
  const networkDevices = devices.filter(
    (d) => d.connectionType !== 'usb' && d.connectionType !== 'bluetooth',
  )
  const printers = devices.filter((d) => d.deviceType === 'printer')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!overlayHost) return null

  return createPortal(
    <div className="device-setup-modal pos-setup-sheet" role="dialog" aria-modal="true" aria-labelledby="device-setup-title">
      <div className="device-setup-modal__card">
        <header className="device-setup-modal__header">
          <div>
            <h2 id="device-setup-title">Device set up</h2>
            <p>Check the LAN, register printers / KDS / POS stations, and install drivers from the server.</p>
          </div>
          <button type="button" className="device-setup-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="device-setup-modal__scroll">
          <section className="device-setup-block">
            <div className="device-setup-block__head">
              <h3>Local area network</h3>
              <button
                type="button"
                className="device-setup-btn device-setup-btn--primary"
                onClick={() => void runNetworkCheck()}
                disabled={checkingLan || companyId <= 0}
              >
                {checkingLan ? 'Checking…' : 'Network check'}
              </button>
            </div>
            <p className="device-setup-hint">
              Scans this station’s local subnet for connected devices (printers, KDS, stations), then
              lets you assign each as printer, kitchen display, bar display, POS, or kiosk. Allow local
              network access when the browser asks.
            </p>
            <div className="device-setup-station-ip">
              <label>
                <span>Station IP (this PC)</span>
                <input
                  className="device-setup-input"
                  value={stationIpOverride}
                  placeholder="e.g. 192.168.70.131"
                  inputMode="decimal"
                  onChange={(e) => setStationIpOverride(e.target.value.trim())}
                  onBlur={() => {
                    const v = stationIpOverride.trim()
                    if (isPrivateIpv4(v)) storeStationIpv4(v)
                  }}
                />
              </label>
              <p className="device-setup-hint device-setup-hint--tight">
                Browsers often hide the private IP. On Windows: Settings → Network &amp; internet →
                Ethernet/Wi‑Fi → Properties → <strong>IPv4 address</strong> (or run <code>ipconfig</code>).
                Enter it here, then tap Network check to scan every host on that /24 and assign roles.
                {stationIpSource
                  ? ` Last scan used ${stationIpSource === 'manual' ? 'your entry' : stationIpSource === 'stored' ? 'saved IP' : stationIpSource === 'webrtc' ? 'browser detection' : 'no IP'}.`
                  : ''}
              </p>
            </div>

            <div className="device-setup-printer-tools">
              <h4>Add printer by IP</h4>
              <p className="device-setup-hint device-setup-hint--tight">
                Thermal printers on port <strong>9100</strong> often do <strong>not</strong> appear in the browser
                Network check. Enter the printer IP from the sticker / router DHCP list, probe, then link.
              </p>
              <div className="device-setup-printer-tools__row">
                <label>
                  Printer IP
                  <input
                    className="device-setup-input"
                    value={printerIpDraft}
                    placeholder="192.168.70.50"
                    onChange={(e) => setPrinterIpDraft(e.target.value.trim())}
                  />
                </label>
                <label>
                  Name
                  <input
                    className="device-setup-input"
                    value={printerNameDraft}
                    onChange={(e) => setPrinterNameDraft(e.target.value)}
                    maxLength={200}
                  />
                </label>
                <button
                  type="button"
                  className="device-setup-btn device-setup-btn--primary"
                  disabled={probingPrinter || companyId <= 0}
                  onClick={() => void probeAndAddPrinterIp()}
                >
                  {probingPrinter ? 'Probing…' : 'Probe & prepare link'}
                </button>
              </div>

              <h4>Import Windows scan</h4>
              <p className="device-setup-hint device-setup-hint--tight">
                On this PC download <strong>ESC/POS LAN Test (Windows)</strong> under Drivers, unzip, run{' '}
                <code>Find-BisyncPrinters.cmd</code> (Station IP e.g. <code>192.168.70.131</code>), then paste
                the JSON here. That uses real TCP connects — the only reliable way to list raw 9100 printers.
              </p>
              <textarea
                className="device-setup-input device-setup-input--json"
                rows={4}
                value={windowsScanJson}
                placeholder='{ "source": "bisync-find-printers", "hosts": [ … ] }'
                onChange={(e) => setWindowsScanJson(e.target.value)}
              />
              <div className="device-setup-printer-tools__row">
                <button
                  type="button"
                  className="device-setup-btn device-setup-btn--primary"
                  disabled={companyId <= 0}
                  onClick={() => importWindowsScanJson()}
                >
                  Import Windows scan
                </button>
                <button
                  type="button"
                  className="device-setup-btn device-setup-btn--ghost"
                  onClick={() => {
                    const sdk = sdks.find((s) => s.sdkCode === WINDOWS_ESCPOS_SDK_CODE) || sdks.find((s) => s.platform === 'windows')
                    if (sdk) void downloadAndInstall(sdk)
                    else setError('Windows LAN package not loaded yet — open Drivers below after refresh.')
                  }}
                >
                  Download Windows finder
                </button>
              </div>
              {importedHosts.length > 0 ? (
                <p className="device-setup-note">
                  Last import: {importedHosts.length} host(s) — see Connected devices list below.
                </p>
              ) : null}
            </div>

            {(checkingLan || lan || stationIpOverride.trim() || lanScan || importedHosts.length > 0) && (
              <div className="device-setup-lan">
                {checkingLan && scanProgress && (
                  <p className="device-setup-note">
                    Scanning {scanProgress.subnetCidr}: {scanProgress.scanned}/{scanProgress.total}{' '}
                    hosts checked · {scanProgress.found} responding
                  </p>
                )}
                {lan && <p className="device-setup-note">{lan.note}</p>}
                {lanScan && <p className="device-setup-note">{lanScan.note}</p>}
                {lan && (
                  <div className="device-setup-lan__grid">
                    <div>
                      <h4>This station</h4>
                      {lan.clientLocalIps.length === 0 ? (
                        <p className="device-setup-empty">
                          No private IP from browser
                          {stationIpOverride.trim()
                            ? ` — scanning with ${stationIpOverride.trim()}`
                            : ' — enter Station IP above'}
                        </p>
                      ) : (
                        <ul>
                          {lan.clientLocalIps.map((ip) => (
                            <li key={ip}>
                              <code>{ip}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h4>Subnet scan</h4>
                      {lanScan ? (
                        <ul>
                          <li>
                            Range: <code>{lanScan.subnetCidr || '—'}</code>
                          </li>
                          <li>
                            Found: <strong>{lanScan.hosts.length}</strong> host(s) ·{' '}
                            {lanScan.durationMs} ms
                          </li>
                          <li>
                            Access:{' '}
                            <code>{lanScan.permission}</code>
                          </li>
                        </ul>
                      ) : checkingLan ? (
                        <p className="device-setup-empty">Scanning…</p>
                      ) : (
                        <p className="device-setup-empty">Run Network check to scan</p>
                      )}
                    </div>
                  </div>
                )}

                {lanScan && (
                  <>
                    <h4>Connected devices found on LAN</h4>
                    <p className="device-setup-hint">
                      Live hosts that answered common POS ports on this subnet. Assign a role and tap
                      Assign link, or Use in form to edit the name first.
                    </p>
                    {lanScan.hosts.length === 0 ? (
                      <p className="device-setup-empty">
                        No hosts answered the browser probe. ESC/POS printers on 9100 usually will not.
                        Use <strong>Add printer by IP</strong> above, or run <code>Find-BisyncPrinters.cmd</code> on
                        Windows and <strong>Import Windows scan</strong>.
                      </p>
                    ) : (
                      <ul className="device-setup-assign-list">
                        {lanScan.hosts.map((h) => {
                          const matched = registeredMatchForHost(h.host)
                          const selected =
                            discoverAssignTypes[h.host] ?? h.suggestedDeviceType
                          return (
                            <li
                              key={h.host}
                              className={[
                                'device-setup-assign-row',
                                'is-discovered',
                                h.isStation ? 'is-station' : '',
                                matched ? 'is-registered' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <div className="device-setup-assign-row__info">
                                <strong>
                                  {h.isStation
                                    ? 'This station'
                                    : matched
                                      ? matched.name
                                      : `Host ${h.host}`}
                                </strong>
                                <code>
                                  {h.host}
                                  {h.openPorts.length ? ` · ports ${h.openPorts.join(', ')}` : ''}
                                  {h.latencyMs ? ` · ${h.latencyMs} ms` : ''}
                                </code>
                                <span className="device-setup-assign-row__meta">
                                  {h.labels.join(' · ') || 'Responding host'}
                                  {matched
                                    ? ` · registered as ${matched.deviceTypeLabel || deviceTypeLabel(matched.deviceType)}`
                                    : ' · not linked yet'}
                                </span>
                              </div>
                              <div className="device-setup-assign-row__actions">
                                <label className="device-setup-assign-row__role">
                                  <span>Link as</span>
                                  <select
                                    className="device-setup-input device-setup-input--compact"
                                    value={selected}
                                    onChange={(e) =>
                                      setDiscoverAssignTypes((prev) => ({
                                        ...prev,
                                        [h.host]: e.target.value as PosDeviceType,
                                      }))
                                    }
                                    aria-label={`Assign role for ${h.host}`}
                                  >
                                    {ASSIGNABLE_DEVICE_TYPES.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className="device-setup-btn device-setup-btn--ghost"
                                  onClick={() => useDiscoveredHostInForm(h)}
                                >
                                  Use in form
                                </button>
                                <button
                                  type="button"
                                  className="device-setup-btn device-setup-btn--primary"
                                  disabled={linkingHost === h.host || h.isStation}
                                  onClick={() => void linkDiscoveredHost(h)}
                                  title={
                                    h.isStation
                                      ? 'This is the current POS station'
                                      : 'Create or update device link'
                                  }
                                >
                                  {linkingHost === h.host
                                    ? 'Saving…'
                                    : matched
                                      ? 'Assign link'
                                      : 'Link device'}
                                </button>
                                {(selected === 'printer' || h.suggestedDeviceType === 'printer') && !h.isStation ? (
                                  <button
                                    type="button"
                                    className="device-setup-btn device-setup-btn--ghost"
                                    disabled={busyId != null}
                                    onClick={() => {
                                      const sdk =
                                        sdks.find((s) => s.sdkCode === preferredPrinterSdkCode())
                                        || sdks[0]
                                      if (!sdk) {
                                        setError('No printer SDK available — open Drivers from server below.')
                                        return
                                      }
                                      const linked = registeredMatchForHost(h.host)
                                      void downloadAndInstall(sdk, linked?.id)
                                    }}
                                    title="Download and bind the printer SDK for this host"
                                  >
                                    Install SDK
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                )}

                {lan && (
                  <>
                    <h4>Registered devices on this network</h4>
                    <p className="device-setup-hint">
                      Choose a role and tap <strong>Assign link</strong> to bind the device. Same-subnet
                      hosts are highlighted first.
                    </p>
                    {lan.registeredDevices.filter((d) => !d.isLocalPeripheral).length === 0 ? (
                      <p className="device-setup-empty">
                        No network devices registered yet — use “Link new device” below with the IP from
                        the device sticker or router.
                      </p>
                    ) : (
                      <ul className="device-setup-assign-list">
                        {[...lan.registeredDevices]
                          .filter((d) => !d.isLocalPeripheral)
                          .sort((a, b) => Number(b.sameSubnetAsStation) - Number(a.sameSubnetAsStation))
                          .map((d) => {
                            const selected =
                              assignTypes[d.id] ?? asPosDeviceType(d.deviceType)
                            const dirty = selected !== asPosDeviceType(d.deviceType) || !d.active
                            return (
                              <li
                                key={d.id}
                                className={[
                                  'device-setup-assign-row',
                                  d.sameSubnetAsStation ? 'is-same-subnet' : '',
                                  !d.active ? 'is-inactive' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                <div className="device-setup-assign-row__info">
                                  <strong>{d.name}</strong>
                                  <code>
                                    {d.hostAddress || '—'}
                                    {d.port ? `:${d.port}` : ''}
                                    {d.connectionType ? ` · ${d.connectionType}` : ''}
                                  </code>
                                  <span className="device-setup-assign-row__meta">
                                    Current: {d.deviceTypeLabel || deviceTypeLabel(d.deviceType)}
                                    {d.sameSubnetAsStation ? ' · same subnet' : ''}
                                    {!d.active ? ' · disabled' : ''}
                                  </span>
                                </div>
                                <div className="device-setup-assign-row__actions">
                                  <label className="device-setup-assign-row__role">
                                    <span>Link as</span>
                                    <select
                                      className="device-setup-input device-setup-input--compact"
                                      value={selected}
                                      onChange={(e) =>
                                        setAssignTypes((prev) => ({
                                          ...prev,
                                          [d.id]: e.target.value as PosDeviceType,
                                        }))
                                      }
                                      aria-label={`Assign role for ${d.name}`}
                                    >
                                      {ASSIGNABLE_DEVICE_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                          {t.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    className="device-setup-btn device-setup-btn--primary"
                                    disabled={busyId === d.id || (!dirty && d.active)}
                                    onClick={() => void assignNetworkDevice(d)}
                                  >
                                    {busyId === d.id ? 'Saving…' : dirty ? 'Assign link' : 'Linked'}
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                      </ul>
                    )}
                  </>
                )}

                <h4>Link new device on this network</h4>
                  <p className="device-setup-hint">
                    Enter the IP of a printer, KDS, or station on the same LAN, pick its role, choose an
                    SDK for printers, and save the device link — or assign from the scan list above.
                  </p>
                <div className="device-setup-link-new">
                  <label>
                    Name
                    <input
                      className="device-setup-input"
                      value={linkDraft.name}
                      placeholder="Kitchen Printer"
                      onChange={(e) => setLinkDraft((d) => ({ ...d, name: e.target.value }))}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Link as
                    <select
                      className="device-setup-input"
                      value={linkDraft.deviceType}
                      onChange={(e) => {
                        const deviceType = e.target.value as PosDeviceType
                        setLinkDraft((d) => ({
                          ...d,
                          deviceType,
                          port: String(defaultPortForDeviceType(deviceType)),
                        }))
                      }}
                    >
                      {ASSIGNABLE_DEVICE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Host / IP
                    <input
                      className="device-setup-input"
                      value={linkDraft.hostAddress}
                      placeholder="192.168.1.50"
                      onChange={(e) => setLinkDraft((d) => ({ ...d, hostAddress: e.target.value }))}
                    />
                  </label>
                  <label>
                    Port
                    <input
                      className="device-setup-input"
                      value={linkDraft.port}
                      onChange={(e) => setLinkDraft((d) => ({ ...d, port: e.target.value }))}
                    />
                  </label>
                  <label>
                    Connection
                    <select
                      className="device-setup-input"
                      value={linkDraft.connectionType}
                      onChange={(e) =>
                        setLinkDraft((d) => ({
                          ...d,
                          connectionType: e.target.value as PosConnectionType,
                        }))
                      }
                    >
                      <option value="ethernet">Ethernet</option>
                      <option value="wifi">Wi‑Fi</option>
                    </select>
                  </label>
                  {linkDraft.deviceType === 'printer' && (
                    <label>
                      Printer SDK
                      <select
                        className="device-setup-input"
                        value={linkDraft.printerSdkCode}
                        onChange={(e) =>
                          setLinkDraft((d) => ({ ...d, printerSdkCode: e.target.value }))
                        }
                      >
                        {sdks.map((s) => (
                          <option key={s.sdkCode} value={s.sdkCode}>
                            {s.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className="device-setup-btn device-setup-btn--primary"
                    onClick={() => void linkNewNetworkDevice()}
                    disabled={saving || companyId <= 0}
                  >
                    {saving ? 'Linking…' : 'Link device'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="device-setup-block">
            <div className="device-setup-block__head">
              <h3>Local peripherals</h3>
              <button
                type="button"
                className="device-setup-btn device-setup-btn--ghost"
                onClick={() => void addUsbPeripheral()}
                disabled={saving || companyId <= 0}
              >
                Scan / add USB
              </button>
            </div>
            <p className="device-setup-hint">
              Peripherals attached to this station (USB / Bluetooth). Enable or rename them here.
              {!webUsbSupported() && ' WebUSB is unavailable in this browser — add manually below.'}
            </p>
            {usbList.length > 0 && (
              <ul className="device-setup-device-list">
                {usbList.map((u) => (
                  <li key={u.key}>
                    <strong>{u.productName}</strong>
                    <span>{u.manufacturerName || 'USB'}</span>
                    <code>
                      {u.vendorId.toString(16)}:{u.productId.toString(16)}
                    </code>
                  </li>
                ))}
              </ul>
            )}
            {localDevices.length === 0 ? (
              <p className="device-setup-empty">No local peripherals registered yet.</p>
            ) : (
              <div className="device-setup-table">
                {localDevices.map((d) => (
                  <DeviceRow
                    key={d.id}
                    device={d}
                    busy={busyId === d.id}
                    renaming={renameId === d.id}
                    renameValue={renameValue}
                    onRenameStart={() => {
                      setRenameId(d.id)
                      setRenameValue(d.name)
                    }}
                    onRenameChange={setRenameValue}
                    onRenameCancel={() => setRenameId(null)}
                    onRenameSave={() => void commitRename(d)}
                    onToggle={() => void toggleActive(d)}
                    onDelete={() => void deleteDevice(d)}
                    onTestPrint={
                      d.deviceType === 'printer'
                        ? () => void runTestPrint(d)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="device-setup-block">
            <div className="device-setup-block__head">
              <h3>Registered devices</h3>
              <button
                type="button"
                className="device-setup-btn device-setup-btn--ghost"
                onClick={() => {
                  setShowAdd((v) => !v)
                  setError(null)
                }}
              >
                {showAdd ? 'Cancel' : '+ Add device'}
              </button>
            </div>

            {showAdd && (
              <div className="device-setup-add">
                <label>
                  Name
                  <input
                    className="device-setup-input"
                    value={draft.name}
                    placeholder="Kitchen Printer"
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    maxLength={200}
                  />
                </label>
                <label>
                  Device type
                  <select
                    className="device-setup-input"
                    value={draft.deviceType}
                    onChange={(e) => {
                      const deviceType = e.target.value as PosDeviceType
                      setDraft((d) => ({
                        ...d,
                        deviceType,
                        port: String(defaultPortForDeviceType(deviceType)),
                      }))
                    }}
                  >
                    {POS_DEVICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Connection
                  <select
                    className="device-setup-input"
                    value={draft.connectionType}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, connectionType: e.target.value as PosConnectionType }))
                    }
                  >
                    {POS_CONNECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Host / IP
                  <input
                    className="device-setup-input"
                    value={draft.hostAddress}
                    placeholder="192.168.1.50"
                    onChange={(e) => setDraft((d) => ({ ...d, hostAddress: e.target.value }))}
                  />
                </label>
                <label>
                  Port
                  <input
                    className="device-setup-input"
                    value={draft.port}
                    onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value }))}
                  />
                </label>
                {draft.deviceType === 'printer' && (
                  <label>
                    Printer SDK
                    <select
                      className="device-setup-input"
                      value={draft.printerSdkCode}
                      onChange={(e) => setDraft((d) => ({ ...d, printerSdkCode: e.target.value }))}
                    >
                      {sdks.map((s) => (
                        <option key={s.sdkCode} value={s.sdkCode}>
                          {s.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="device-setup-btn device-setup-btn--primary"
                  onClick={() => void saveNewDevice()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save device'}
                </button>
              </div>
            )}

            {loading ? (
              <p className="device-setup-empty">Loading…</p>
            ) : networkDevices.length === 0 && localDevices.length === 0 ? (
              <p className="device-setup-empty">No devices yet — use + Add device.</p>
            ) : (
              <div className="device-setup-table">
                {networkDevices.map((d) => (
                  <DeviceRow
                    key={d.id}
                    device={d}
                    busy={busyId === d.id}
                    renaming={renameId === d.id}
                    renameValue={renameValue}
                    onRenameStart={() => {
                      setRenameId(d.id)
                      setRenameValue(d.name)
                    }}
                    onRenameChange={setRenameValue}
                    onRenameCancel={() => setRenameId(null)}
                    onRenameSave={() => void commitRename(d)}
                    onToggle={() => void toggleActive(d)}
                    onDelete={() => void deleteDevice(d)}
                    onTestPrint={
                      d.deviceType === 'printer'
                        ? () => void runTestPrint(d)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="device-setup-block">
            <h3>Drivers from server</h3>
            <p className="device-setup-hint">
              {isWindowsDevice()
                ? 'On Windows, download the ESC/POS LAN test package and run it against the printer IP on this PC (same Wi‑Fi/LAN). Cloud Test print cannot reach private LAN printers. Use DantSu on the Android POS for production.'
                : 'Download DantSu for Android POS tablets, or the Windows ESC/POS LAN test package to verify a printer from a Windows PC on the same network.'}
            </p>
            {sdks.length === 0 ? (
              <p className="device-setup-empty">No printer SDKs seeded yet.</p>
            ) : (
              <ul className="device-setup-sdk-list">
                {sdks.map((sdk) => (
                  <li key={sdk.sdkCode}>
                    <div>
                      <strong>
                        {sdk.displayName}
                        {(sdk.platform || '').toLowerCase() === 'android' ? (
                          <span className="device-setup-sdk-badge"> Android</span>
                        ) : null}
                        {(sdk.platform || '').toLowerCase() === 'windows' ? (
                          <span className="device-setup-sdk-badge"> Windows</span>
                        ) : null}
                      </strong>
                      <span>
                        {sdk.brand} · {sdk.protocol} · v{sdk.version}
                        {sdk.hasBinaryPackage ? ' · install package' : ''}
                      </span>
                      <em>{sdk.description}</em>
                    </div>
                    <div className="device-setup-sdk-list__actions">
                      <button
                        type="button"
                        className="device-setup-btn device-setup-btn--ghost"
                        onClick={() => void downloadAndInstall(sdk)}
                      >
                        {(sdk.platform || '').toLowerCase() === 'android'
                          ? 'Download for Android'
                          : (sdk.platform || '').toLowerCase() === 'windows'
                            ? 'Download for Windows'
                            : 'Download'}
                      </button>
                      {printers.length > 0 && (
                        <select
                          className="device-setup-input device-setup-input--compact"
                          defaultValue=""
                          aria-label={`Install ${sdk.displayName} on printer`}
                          onChange={(e) => {
                            const id = Number(e.target.value)
                            if (id) void downloadAndInstall(sdk, id)
                            e.target.value = ''
                          }}
                        >
                          <option value="">Install on…</option>
                          {printers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {status && <p className="device-setup-status">{status}</p>}
          {error && <p className="device-setup-error">{error}</p>}
        </div>

        <footer className="device-setup-modal__footer">
          <button type="button" className="device-setup-btn device-setup-btn--ghost" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>,
    overlayHost,
  )
}

function DeviceRow({
  device,
  busy,
  renaming,
  renameValue,
  onRenameStart,
  onRenameChange,
  onRenameCancel,
  onRenameSave,
  onToggle,
  onDelete,
  onTestPrint,
}: {
  device: PosDevice
  busy: boolean
  renaming: boolean
  renameValue: string
  onRenameStart: () => void
  onRenameChange: (v: string) => void
  onRenameCancel: () => void
  onRenameSave: () => void
  onToggle: () => void
  onDelete: () => void
  onTestPrint?: () => void
}) {
  return (
    <div className={`device-setup-row${!device.active ? ' is-disabled' : ''}`}>
      <div className="device-setup-row__main">
        {renaming ? (
          <input
            className="device-setup-input"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            autoFocus
          />
        ) : (
          <strong>{device.name}</strong>
        )}
        <span>{device.deviceTypeLabel || deviceTypeLabel(device.deviceType)}</span>
        <code>
          {device.connectionType}
          {device.hostAddress ? ` · ${device.hostAddress}` : ''}
          {device.port ? `:${device.port}` : ''}
          {device.printerSdkCode ? ` · ${device.printerSdkCode}` : ''}
        </code>
      </div>
      <div className="device-setup-row__actions">
        {renaming ? (
          <>
            <button type="button" className="device-setup-btn device-setup-btn--primary" disabled={busy} onClick={onRenameSave}>
              Save
            </button>
            <button type="button" className="device-setup-btn device-setup-btn--ghost" onClick={onRenameCancel}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {onTestPrint ? (
              <button
                type="button"
                className="device-setup-btn device-setup-btn--primary"
                disabled={busy}
                onClick={onTestPrint}
                title="Send a Bisync test slip to this printer"
              >
                {busy ? 'Printing…' : 'Test print'}
              </button>
            ) : null}
            <button type="button" className="device-setup-btn device-setup-btn--ghost" onClick={onRenameStart}>
              Rename
            </button>
            <button type="button" className="device-setup-btn device-setup-btn--ghost" disabled={busy} onClick={onToggle}>
              {device.active ? 'Disable' : 'Enable'}
            </button>
            <button
              type="button"
              className="device-setup-btn device-setup-btn--danger"
              disabled={busy}
              onClick={onDelete}
              title="Permanently delete this device from the database"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
