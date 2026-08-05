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
  listAuthorizedUsbPeripherals,
  requestUsbPeripheral,
  webUsbSupported,
  type LocalUsbPeripheral,
} from '../domain/deviceLanCheck'
import { isAndroidDevice } from '../../../../data/posKiosk'
import { usePosOverlayHost } from '../../../core/ui/posOverlayHost'
import './DeviceSetupModal.css'

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
    printerSdkCode: 'dantsu-escpos-android',
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

  async function runNetworkCheck() {
    if (companyId <= 0) return
    setCheckingLan(true)
    setError(null)
    setStatus(null)
    try {
      const clientIps = await discoverLocalIpv4Addresses()
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
      const sameSubnet = result.registeredDevices.filter(
        (d) => !d.isLocalPeripheral && d.sameSubnetAsStation,
      ).length
      setStatus(
        clientIps.length
          ? `LAN check complete — station IP(s): ${clientIps.join(', ')}. ${networkCount} device(s) on this location${sameSubnet ? ` (${sameSubnet} same subnet)` : ''}. Assign each as printer, KDS, etc.`
          : `LAN check complete — no private station IP detected. ${networkCount} registered device(s) listed — assign roles below or link by IP.`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'LAN check failed.')
    } finally {
      setCheckingLan(false)
    }
  }

  async function refreshLanAfterAssign(statusMessage: string) {
    try {
      const clientIps = lan?.clientLocalIps?.length
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
      const androidHint =
        (sdk.platform || '').toLowerCase() === 'android' || sdk.packageKind === 'android-aar'
          ? isAndroidDevice()
            ? ' Package saved on this Android device — open Files/Downloads, unzip, and follow INSTALL.md to load the AAR.'
            : ' Android package downloaded — copy the zip onto the Android POS tablet and follow INSTALL.md.'
          : ''
      if (printerId) {
        setBusyId(printerId)
        const deployed = await api.deployPosPrinterSdk(printerId)
        const test = await api.testPosPrinterPrint(printerId)
        setStatus(
          `${deployed.message} Package: ${pack.fileName}.${androidHint} ${test.message}`,
        )
        await load()
      } else {
        setStatus(
          `Downloaded ${pack.fileName}.${androidHint || ' Select a printer and Install to bind the driver (then a test print runs).'}`,
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
      else setStatus(result.message)
      if (!result.sent && !result.skipped) setError(result.message)
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
              Detects this station’s LAN IP, lists devices attached to this location’s network, and lets
              you assign each as printer, kitchen display (KDS), bar display, POS station, or kiosk.
            </p>
            {lan && (
              <div className="device-setup-lan">
                <p className="device-setup-note">{lan.note}</p>
                <div className="device-setup-lan__grid">
                  <div>
                    <h4>This station</h4>
                    {lan.clientLocalIps.length === 0 ? (
                      <p className="device-setup-empty">No private IP detected</p>
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
                    <h4>API host NICs</h4>
                    {lan.serverInterfaces.length === 0 ? (
                      <p className="device-setup-empty">None (typical on Cloud Run)</p>
                    ) : (
                      <ul>
                        {lan.serverInterfaces.map((iface) => (
                          <li key={`${iface.name}-${iface.address}`}>
                            {iface.name}: <code>{iface.address}</code>
                            {iface.subnet ? ` / ${iface.subnet}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <h4>Devices on this network</h4>
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

                <h4>Link new device on this network</h4>
                <p className="device-setup-hint">
                  Enter the IP of a printer, KDS, or station on the same LAN, pick its role, and save
                  the device link.
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
              Download the DantSu ESC/POS Android SDK package, then install it on a registered printer.
              A test print runs automatically once the driver is installed.
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
