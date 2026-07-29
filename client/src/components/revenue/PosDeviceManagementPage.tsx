import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosDevice,
  type PosNetworkProbeResult,
  type PosNetworkSuggestions,
  type PosPrinterSdk,
  type UpsertPosDevicePayload,
} from '../../api'
import { inputCls } from '../../data/countries'
import {
  PAPER_WIDTH_OPTIONS,
  POS_CONNECTION_TYPES,
  POS_DEVICE_TYPES,
  defaultPortForDeviceType,
  deviceTypeLabel,
  type PosConnectionType,
  type PosDeviceType,
} from '../../data/posDevices'
import { getPrinterSdkAdapter } from '../../bisync-pos/core/printing/PrinterSdkRegistry'
import { pageShellClass } from '../layout/pageLayout'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { TableScrollContainer } from '../shared/TableScrollContainer'

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

type LocationOpt = { externalId: string; name: string }

type Draft = {
  name: string
  deviceType: PosDeviceType
  connectionType: PosConnectionType
  locationExternalId: string
  hostAddress: string
  port: string
  macAddress: string
  subnetMask: string
  gateway: string
  dnsPrimary: string
  dnsSecondary: string
  hostname: string
  printerBrand: string
  printerModel: string
  printerSdkCode: string
  paperWidthMm: number
  printAlignment: 'left' | 'center'
  printMarginLeft: string
  printMarginRight: string
}

function blankDraft(locationId: string): Draft {
  return {
    name: '',
    deviceType: 'posMain',
    connectionType: 'ethernet',
    locationExternalId: locationId,
    hostAddress: '',
    port: String(defaultPortForDeviceType('posMain')),
    macAddress: '',
    subnetMask: '255.255.255.0',
    gateway: '',
    dnsPrimary: '',
    dnsSecondary: '',
    hostname: '',
    printerBrand: '',
    printerModel: '',
    printerSdkCode: 'generic-escpos',
    paperWidthMm: 80,
    printAlignment: 'left',
    printMarginLeft: '0',
    printMarginRight: '0',
  }
}

export function PosDeviceManagementPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [locations, setLocations] = useState<LocationOpt[]>([])
  const [filterLocationId, setFilterLocationId] = useState(selectedLocationIds[0] ?? '')
  const [devices, setDevices] = useState<PosDevice[]>([])
  const [sdks, setSdks] = useState<PosPrinterSdk[]>([])
  const [suggestions, setSuggestions] = useState<PosNetworkSuggestions | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'add' | 'setup'>('list')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [setupDeviceId, setSetupDeviceId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(() => blankDraft(''))
  const [probeResult, setProbeResult] = useState<PosNetworkProbeResult | null>(null)
  const [probing, setProbing] = useState(false)
  const [alignmentPreview, setAlignmentPreview] = useState('')

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  const loadLocations = useCallback(async () => {
    if (!selectedCompanyId) {
      setLocations([])
      return
    }
    try {
      const rows = await api.locationsConfig()
      const active = rows
        .filter(l => l.companyId === selectedCompanyId && l.active !== false)
        .map(l => ({ externalId: l.externalId, name: l.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setLocations(active)
    } catch {
      setLocations([])
    }
  }, [selectedCompanyId])

  const loadDevices = useCallback(async () => {
    if (!selectedCompanyId) {
      setDevices([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [deviceRows, sdkRows] = await Promise.all([
        api.posDevices(selectedCompanyId, filterLocationId || undefined),
        api.posPrinterSdks(),
      ])
      setDevices(deviceRows)
      setSdks(sdkRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId, filterLocationId])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  useEffect(() => {
    const preferred = selectedLocationIds.find(id => locations.some(l => l.externalId === id))
    if (preferred) {
      setFilterLocationId(preferred)
      return
    }
    if (locations.length > 0) {
      setFilterLocationId(prev => (
        locations.some(l => l.externalId === prev) ? prev : locations[0]!.externalId
      ))
    }
  }, [selectedLocationIds, locations])

  useEffect(() => {
    void loadDevices()
  }, [loadDevices])

  useEffect(() => {
    let cancelled = false
    api.posDeviceNetworkSuggestions(draft.deviceType)
      .then(data => {
        if (!cancelled) setSuggestions(data)
      })
      .catch(() => {
        if (!cancelled) setSuggestions(null)
      })
    return () => {
      cancelled = true
    }
  }, [draft.deviceType])

  const setupDevice = useMemo(
    () => devices.find(d => d.id === setupDeviceId) ?? null,
    [devices, setupDeviceId],
  )

  function openAdd() {
    setEditingId(null)
    setProbeResult(null)
    setDraft(blankDraft(filterLocationId || locations[0]?.externalId || ''))
    setMode('add')
  }

  function openEdit(device: PosDevice) {
    setEditingId(device.id)
    setProbeResult(null)
    setDraft({
      name: device.name,
      deviceType: (device.deviceType as PosDeviceType) || 'posMain',
      connectionType: (device.connectionType as PosConnectionType) || 'ethernet',
      locationExternalId: device.locationExternalId,
      hostAddress: device.hostAddress || '',
      port: device.port != null ? String(device.port) : '',
      macAddress: device.macAddress || '',
      subnetMask: device.subnetMask || '',
      gateway: device.gateway || '',
      dnsPrimary: device.dnsPrimary || '',
      dnsSecondary: device.dnsSecondary || '',
      hostname: device.hostname || '',
      printerBrand: device.printerBrand || '',
      printerModel: device.printerModel || '',
      printerSdkCode: device.printerSdkCode || 'generic-escpos',
      paperWidthMm: device.paperWidthMm === 58 || device.paperWidthMm === 80 || device.paperWidthMm === 112
        ? device.paperWidthMm
        : 80,
      printAlignment: device.printAlignment === 'center' ? 'center' : 'left',
      printMarginLeft: String(device.printMarginLeft ?? 0),
      printMarginRight: String(device.printMarginRight ?? 0),
    })
    setMode('add')
  }

  function openPrinterSetup(device: PosDevice) {
    setSetupDeviceId(device.id)
    setDraft(d => ({
      ...d,
      printerBrand: device.printerBrand || d.printerBrand,
      printerModel: device.printerModel || d.printerModel,
      printerSdkCode: device.printerSdkCode || 'generic-escpos',
      paperWidthMm: device.paperWidthMm || 80,
      printAlignment: device.printAlignment === 'center' ? 'center' : 'left',
      printMarginLeft: String(device.printMarginLeft ?? 0),
      printMarginRight: String(device.printMarginRight ?? 0),
    }))
    const adapter = getPrinterSdkAdapter(device.printerSdkCode || 'generic-escpos')
    setAlignmentPreview(
      adapter?.buildAlignmentTest({
        paperWidthMm: (device.paperWidthMm as 58 | 80 | 112) || 80,
        alignment: device.printAlignment === 'center' ? 'center' : 'left',
        marginLeft: device.printMarginLeft ?? 0,
        marginRight: device.printMarginRight ?? 0,
      }) ?? '',
    )
    setMode('setup')
  }

  async function runProbe() {
    if (!draft.hostAddress.trim()) {
      setError('Enter a host IP or hostname before checking the network.')
      return
    }
    setProbing(true)
    setError(null)
    try {
      const result = await api.probePosDeviceNetwork({
        hostAddress: draft.hostAddress.trim(),
        port: Number(draft.port) || undefined,
        deviceType: draft.deviceType,
      })
      setProbeResult(result)
      flash(result.reachable ? 'Address reachable from API host.' : 'Not reachable from API host — verify on LAN.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProbing(false)
    }
  }

  function applySuggestedAddress(address: string) {
    setDraft(d => ({
      ...d,
      hostAddress: address,
      port: d.port || String(suggestions?.defaultPort ?? defaultPortForDeviceType(d.deviceType)),
    }))
  }

  async function saveDevice() {
    if (!selectedCompanyId) return
    if (!draft.name.trim()) {
      setError('Name the device.')
      return
    }
    if (!draft.locationExternalId) {
      setError('Select a location.')
      return
    }
    setSaving(true)
    setError(null)
    const payload: UpsertPosDevicePayload = {
      companyId: selectedCompanyId,
      locationExternalId: draft.locationExternalId,
      name: draft.name.trim(),
      deviceType: draft.deviceType,
      connectionType: draft.connectionType,
      hostAddress: draft.hostAddress.trim(),
      port: draft.port.trim() ? Number(draft.port) : null,
      macAddress: draft.macAddress.trim(),
      subnetMask: draft.subnetMask.trim(),
      gateway: draft.gateway.trim(),
      dnsPrimary: draft.dnsPrimary.trim(),
      dnsSecondary: draft.dnsSecondary.trim(),
      hostname: draft.hostname.trim(),
      printerBrand: draft.deviceType === 'printer' ? draft.printerBrand.trim() : undefined,
      printerModel: draft.deviceType === 'printer' ? draft.printerModel.trim() : undefined,
      printerSdkCode: draft.deviceType === 'printer' ? draft.printerSdkCode : undefined,
      paperWidthMm: draft.deviceType === 'printer' ? draft.paperWidthMm : undefined,
      printAlignment: draft.deviceType === 'printer' ? draft.printAlignment : undefined,
      printMarginLeft: draft.deviceType === 'printer' ? Number(draft.printMarginLeft) || 0 : undefined,
      printMarginRight: draft.deviceType === 'printer' ? Number(draft.printMarginRight) || 0 : undefined,
      active: true,
    }
    try {
      const saved = editingId
        ? await api.updatePosDevice(editingId, payload)
        : await api.createPosDevice(payload)

      if (saved.deviceType === 'printer') {
        const deployed = await api.deployPosPrinterSdk(saved.id)
        flash(deployed.message)
        await loadDevices()
        openPrinterSetup(deployed.device)
        return
      }

      flash(editingId ? 'Device updated.' : 'Device added.')
      setMode('list')
      await loadDevices()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function savePrinterSetup() {
    if (!setupDeviceId) return
    setSaving(true)
    setError(null)
    try {
      const saved = await api.savePosPrinterSetup(setupDeviceId, {
        paperWidthMm: draft.paperWidthMm,
        printAlignment: draft.printAlignment,
        printMarginLeft: Number(draft.printMarginLeft) || 0,
        printMarginRight: Number(draft.printMarginRight) || 0,
        markComplete: true,
        printerSdkCode: draft.printerSdkCode,
        printerBrand: draft.printerBrand,
        printerModel: draft.printerModel,
      })
      const adapter = getPrinterSdkAdapter(saved.printerSdkCode || draft.printerSdkCode)
      setAlignmentPreview(
        adapter?.buildAlignmentTest({
          paperWidthMm: (saved.paperWidthMm as 58 | 80 | 112) || 80,
          alignment: saved.printAlignment === 'center' ? 'center' : 'left',
          marginLeft: saved.printMarginLeft,
          marginRight: saved.printMarginRight,
        }) ?? '',
      )
      flash('Printer setup saved — paper size & alignment stored.')
      await loadDevices()
      setMode('list')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to manage POS devices.</p>
      </div>
    )
  }

  return (
    <div className={`${pageShellClass({ spacing: 'tight' })} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Device Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Register POS stations, displays, kiosks, and printers. Network helper suggests private addresses when IT details are unknown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            Location
            <select
              className={`${inputCls} w-auto min-w-[160px]`}
              value={filterLocationId}
              onChange={e => setFilterLocationId(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map(l => (
                <option key={l.externalId} value={l.externalId}>{l.name}</option>
              ))}
            </select>
          </label>
          {mode === 'list' ? (
            <button
              type="button"
              onClick={openAdd}
              className="text-xs font-semibold border border-border rounded-md px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90"
            >
              + Add device
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMode('list'); setError(null) }}
              className="text-xs font-semibold border border-border rounded-md px-3 py-1.5"
            >
              Back to list
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-destructive border border-destructive/30 rounded-md px-3 py-2">{error}</p>
      ) : null}
      {toast ? (
        <p className="text-xs text-foreground border border-border rounded-md px-3 py-2 bg-muted/40">{toast}</p>
      ) : null}

      {mode === 'list' ? (
        loading ? (
          <div className="flex justify-center py-12"><MillstoneLoader label="Loading devices…" /></div>
        ) : (
          <TableScrollContainer>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2 font-semibold">Name</th>
                  <th className="py-2 pr-2 font-semibold">Type</th>
                  <th className="py-2 pr-2 font-semibold">Network</th>
                  <th className="py-2 pr-2 font-semibold">SDK / Setup</th>
                  <th className="py-2 pr-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold w-28" />
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-muted-foreground">
                      No devices yet. Click Add device to register a POS station or printer.
                    </td>
                  </tr>
                ) : (
                  devices.map(device => (
                    <tr key={device.id} className="border-b border-border/70">
                      <td className="py-2 pr-2 font-medium">{device.name}</td>
                      <td className="py-2 pr-2">{device.deviceTypeLabel || deviceTypeLabel(device.deviceType)}</td>
                      <td className="py-2 pr-2 font-mono text-[10px] text-muted-foreground">
                        {device.hostAddress
                          ? `${device.hostAddress}${device.port ? `:${device.port}` : ''}`
                          : device.connectionType}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">
                        {device.deviceType === 'printer' ? (
                          <>
                            {device.printerSdkCode || '—'}
                            {device.printerSetupComplete ? ' · setup ✓' : ' · setup needed'}
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-2">
                        <span className={device.active ? 'text-emerald-700' : 'text-muted-foreground'}>
                          {device.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2 text-right space-x-2 whitespace-nowrap">
                        <button type="button" className="text-primary hover:underline" onClick={() => openEdit(device)}>
                          Edit
                        </button>
                        {device.deviceType === 'printer' ? (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => openPrinterSetup(device)}
                          >
                            Setup
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        )
      ) : null}

      {mode === 'add' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <section className="lg:col-span-3 space-y-3 rounded-lg border border-border bg-card p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {editingId ? 'Edit device' : 'Add device'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Name *</span>
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Front Counter POS"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Location *</span>
                <select
                  className={inputCls}
                  value={draft.locationExternalId}
                  onChange={e => setDraft(d => ({ ...d, locationExternalId: e.target.value }))}
                >
                  <option value="">Select location…</option>
                  {locations.map(l => (
                    <option key={l.externalId} value={l.externalId}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">
                <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Type of device *</span>
                <select
                  className={inputCls}
                  value={draft.deviceType}
                  onChange={e => {
                    const deviceType = e.target.value as PosDeviceType
                    setDraft(d => ({
                      ...d,
                      deviceType,
                      port: String(defaultPortForDeviceType(deviceType)),
                    }))
                  }}
                >
                  {POS_DEVICE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Connection</span>
                <select
                  className={inputCls}
                  value={draft.connectionType}
                  onChange={e => setDraft(d => ({ ...d, connectionType: e.target.value as PosConnectionType }))}
                >
                  {POS_CONNECTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Hostname</span>
                <input
                  className={inputCls}
                  value={draft.hostname}
                  onChange={e => setDraft(d => ({ ...d, hostname: e.target.value }))}
                  placeholder="optional"
                />
              </label>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Network information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="space-y-1 text-xs sm:col-span-2">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Host address (IP)</span>
                  <input
                    className={inputCls}
                    value={draft.hostAddress}
                    onChange={e => setDraft(d => ({ ...d, hostAddress: e.target.value }))}
                    placeholder="e.g. 192.168.1.50"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Port</span>
                  <input
                    className={inputCls}
                    value={draft.port}
                    onChange={e => setDraft(d => ({ ...d, port: e.target.value }))}
                    placeholder="9100"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">MAC address</span>
                  <input
                    className={inputCls}
                    value={draft.macAddress}
                    onChange={e => setDraft(d => ({ ...d, macAddress: e.target.value }))}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Subnet mask</span>
                  <input
                    className={inputCls}
                    value={draft.subnetMask}
                    onChange={e => setDraft(d => ({ ...d, subnetMask: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Gateway</span>
                  <input
                    className={inputCls}
                    value={draft.gateway}
                    onChange={e => setDraft(d => ({ ...d, gateway: e.target.value }))}
                    placeholder="e.g. 192.168.1.1"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">DNS primary</span>
                  <input
                    className={inputCls}
                    value={draft.dnsPrimary}
                    onChange={e => setDraft(d => ({ ...d, dnsPrimary: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground uppercase tracking-wide text-[10px]">DNS secondary</span>
                  <input
                    className={inputCls}
                    value={draft.dnsSecondary}
                    onChange={e => setDraft(d => ({ ...d, dnsSecondary: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={probing}
                  onClick={() => void runProbe()}
                  className="text-xs border border-border rounded-md px-3 py-1.5 font-semibold hover:bg-muted/40 disabled:opacity-40"
                >
                  {probing ? 'Checking…' : 'Network check'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDevice()}
                  className="text-xs border border-primary/40 bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save device'}
                </button>
              </div>
              {probeResult ? (
                <p className={`text-[11px] rounded-md px-2 py-1.5 border ${
                  probeResult.reachable
                    ? 'border-emerald-500/40 text-emerald-800 bg-emerald-500/10'
                    : 'border-amber-500/40 text-amber-900 bg-amber-500/10'
                }`}
                >
                  {probeResult.detail} {probeResult.guidance}
                </p>
              ) : null}
            </div>

            {draft.deviceType === 'printer' ? (
              <div className="border-t border-border pt-3 space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Printer identity (SDK auto-deploys on save)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Brand</span>
                    <input
                      className={inputCls}
                      value={draft.printerBrand}
                      onChange={e => setDraft(d => ({ ...d, printerBrand: e.target.value }))}
                      placeholder="Epson / Star / Citizen…"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Model</span>
                    <input
                      className={inputCls}
                      value={draft.printerModel}
                      onChange={e => setDraft(d => ({ ...d, printerModel: e.target.value }))}
                      placeholder="TM-T20III"
                    />
                  </label>
                  <label className="space-y-1 text-xs sm:col-span-2">
                    <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Printer SDK</span>
                    <select
                      className={inputCls}
                      value={draft.printerSdkCode}
                      onChange={e => setDraft(d => ({ ...d, printerSdkCode: e.target.value }))}
                    >
                      {sdks.map(sdk => (
                        <option key={sdk.sdkCode} value={sdk.sdkCode}>
                          {sdk.displayName} ({sdk.sdkCode})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="lg:col-span-2 space-y-3 rounded-lg border border-border bg-card p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Network assistant
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {suggestions?.note
                ?? 'Private venue networks are usually 192.168.x.x. Enter the address your POS terminal can reach.'}
            </p>
            {suggestions ? (
              <>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Suggested ranges</p>
                  <ul className="space-y-1">
                    {suggestions.privateRanges.map(r => (
                      <li key={r.cidr}>
                        <button
                          type="button"
                          className="w-full text-left text-[11px] border border-border rounded-md px-2 py-1.5 hover:bg-muted/40"
                          onClick={() => applySuggestedAddress(r.example)}
                        >
                          <span className="font-mono font-semibold">{r.example}</span>
                          <span className="block text-muted-foreground">{r.label} · {r.cidr}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {suggestions.hostInterfaces.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                      Addresses seen on API host
                    </p>
                    <ul className="space-y-1">
                      {suggestions.hostInterfaces.map(iface => (
                        <li key={`${iface.name}-${iface.address}`}>
                          <button
                            type="button"
                            className="w-full text-left text-[11px] border border-border rounded-md px-2 py-1.5 hover:bg-muted/40"
                            onClick={() => applySuggestedAddress(iface.address)}
                          >
                            <span className="font-mono font-semibold">{iface.address}</span>
                            <span className="block text-muted-foreground">
                              {iface.name}{iface.isPrivate ? ' · private' : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Common ports</p>
                  <ul className="text-[11px] text-muted-foreground space-y-0.5">
                    {suggestions.commonPorts.map(p => (
                      <li key={p.port}>
                        <button
                          type="button"
                          className="hover:text-foreground"
                          onClick={() => setDraft(d => ({ ...d, port: String(p.port) }))}
                        >
                          {p.port} — {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="text-[10px] text-muted-foreground list-disc pl-4 space-y-1">
                  {suggestions.connectionTips.map(tip => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">Loading network suggestions…</p>
            )}

            {draft.deviceType === 'printer' && sdks.length > 0 ? (
              <div className="border-t border-border pt-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                  Printer SDK repository
                </p>
                <ul className="space-y-1 max-h-40 overflow-auto">
                  {sdks.map(sdk => (
                    <li key={sdk.sdkCode} className="text-[11px] border border-border/70 rounded px-2 py-1">
                      <button
                        type="button"
                        className="text-left w-full"
                        onClick={() => setDraft(d => ({
                          ...d,
                          printerSdkCode: sdk.sdkCode,
                          printerBrand: d.printerBrand || sdk.brand,
                          port: d.port || String(sdk.defaultPort),
                        }))}
                      >
                        <span className="font-semibold text-foreground">{sdk.displayName}</span>
                        <span className="block text-muted-foreground">{sdk.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {mode === 'setup' && setupDevice ? (
        <section className="rounded-lg border border-border bg-card p-3 space-y-3 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Printer setup — {setupDevice.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              SDK: <span className="font-mono">{setupDevice.printerSdkCode || draft.printerSdkCode}</span>
              {' · '}Check paper width and alignment before going live.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Paper size</span>
              <select
                className={inputCls}
                value={draft.paperWidthMm}
                onChange={e => setDraft(d => ({ ...d, paperWidthMm: Number(e.target.value) }))}
              >
                {PAPER_WIDTH_OPTIONS.map(w => (
                  <option key={w} value={w}>{w} mm</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Alignment</span>
              <select
                className={inputCls}
                value={draft.printAlignment}
                onChange={e => setDraft(d => ({
                  ...d,
                  printAlignment: e.target.value === 'center' ? 'center' : 'left',
                }))}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Margin left</span>
              <input
                className={inputCls}
                type="number"
                min={0}
                value={draft.printMarginLeft}
                onChange={e => setDraft(d => ({ ...d, printMarginLeft: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide text-[10px]">Margin right</span>
              <input
                className={inputCls}
                type="number"
                min={0}
                value={draft.printMarginRight}
                onChange={e => setDraft(d => ({ ...d, printMarginRight: e.target.value }))}
              />
            </label>
          </div>
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Alignment preview</p>
            <pre className={`text-[11px] font-mono whitespace-pre-wrap ${
              draft.printAlignment === 'center' ? 'text-center' : 'text-left'
            }`}
            >
              {alignmentPreview || `Bisync POS\nPaper ${draft.paperWidthMm}mm\nAlign ${draft.printAlignment}`}
            </pre>
            <button
              type="button"
              className="mt-2 text-[11px] text-primary hover:underline"
              onClick={() => {
                const adapter = getPrinterSdkAdapter(draft.printerSdkCode || 'generic-escpos')
                setAlignmentPreview(
                  adapter?.buildAlignmentTest({
                    paperWidthMm: draft.paperWidthMm as 58 | 80 | 112,
                    alignment: draft.printAlignment,
                    marginLeft: Number(draft.printMarginLeft) || 0,
                    marginRight: Number(draft.printMarginRight) || 0,
                  }) ?? '',
                )
              }}
            >
              Refresh test slip preview
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePrinterSetup()}
              className="text-xs border border-primary/40 bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save paper & alignment'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void api.deployPosPrinterSdk(setupDevice.id).then(r => {
                flash(r.message)
                return loadDevices()
              }).catch(e => setError(e instanceof Error ? e.message : String(e)))}
              className="text-xs border border-border rounded-md px-3 py-1.5 font-semibold"
            >
              Re-deploy SDK
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
