import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosDevice,
  type PosDeviceSetupRule,
  type Product,
  type UpsertPosDeviceSetupRulePayload,
} from '../../api'
import { inputCls } from '../../data/countries'
import { deviceTypeLabel } from '../../data/posDevices'
import { productMatchesPosGroupFilter } from '../../data/posCatalog'
import { getSiCategoryFilterOptions, getSiGroupFilterOptions } from '../../data/revenueManagement'
import { ToggleSwitch } from '../admin/ToggleSwitch'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { TableScrollContainer } from '../shared/TableScrollContainer'
import { ColGroup } from '../shared/SortableTableHead'

type Props = {
  selectedCompanyId: number
  selectedLocationIds: string[]
}

type LocationOpt = { externalId: string; name: string }

type Draft = {
  locationExternalId: string
  productCategory: string
  productGroup: string
  productId: string
  primaryDeviceId: string
  secondaryDeviceId: string
  concurrentDeviceId: string
  sequence: string
  active: boolean
}

function emptyDraft(locationId: string): Draft {
  return {
    locationExternalId: locationId,
    productCategory: '',
    productGroup: '',
    productId: '',
    primaryDeviceId: '',
    secondaryDeviceId: '',
    concurrentDeviceId: '',
    sequence: '0',
    active: true,
  }
}

function scopeLabel(value: string | null | undefined, fallback = 'All'): string {
  const trimmed = (value ?? '').trim()
  return trimmed || fallback
}

function deviceOptionLabel(device: PosDevice): string {
  const type = deviceTypeLabel(device.deviceType) || device.deviceType
  return `${device.name} (${type})`
}

function parseOptionalId(raw: string): number | null {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function PosDeviceSetupTab({ selectedCompanyId, selectedLocationIds }: Props) {
  const [locations, setLocations] = useState<LocationOpt[]>([])
  const [filterLocationId, setFilterLocationId] = useState(selectedLocationIds[0] ?? '')
  const [rules, setRules] = useState<PosDeviceSetupRule[]>([])
  const [devices, setDevices] = useState<PosDevice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(selectedLocationIds[0] ?? ''))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const loadLocations = useCallback(async () => {
    try {
      const rows = await api.locationsConfig()
      const active = rows
        .filter(l => l.companyId === selectedCompanyId && l.active !== false)
        .map(l => ({ externalId: l.externalId, name: l.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setLocations(active)
      if (!filterLocationId && active.length > 0) {
        const preferred = selectedLocationIds.find(id => active.some(a => a.externalId === id))
          ?? active[0].externalId
        setFilterLocationId(preferred)
      }
    } catch {
      setLocations([])
    }
  }, [selectedCompanyId, selectedLocationIds, filterLocationId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ruleRows, deviceRows, productRows] = await Promise.all([
        api.posDeviceSetupRules(selectedCompanyId, {
          locationExternalId: filterLocationId || undefined,
          includeInactive: true,
        }),
        api.posDevices(selectedCompanyId, filterLocationId || undefined),
        api.products(selectedCompanyId),
      ])
      setRules(ruleRows)
      setDevices(deviceRows.filter(d => d.active !== false))
      setProducts(productRows.filter(p => p.active !== false && !p.isSubProduct))
    } catch (e) {
      setRules([])
      setDevices([])
      setProducts([])
      setError(e instanceof Error ? e.message : 'Failed to load device set up.')
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId, filterLocationId])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  useEffect(() => {
    void load()
  }, [load])

  const categoryOptions = useMemo(() => {
    const extras = products.map(p => (p.category || '').trim()).filter(Boolean)
    return getSiCategoryFilterOptions(extras).filter(c => c !== 'All')
  }, [products])

  const groupOptions = useMemo(() => {
    const extras = products
      .filter(p => {
        if (!draft.productCategory) return true
        return (p.category || '').trim().toLowerCase() === draft.productCategory.trim().toLowerCase()
      })
      .map(p => (p.group || '').trim())
      .filter(Boolean)
    return getSiGroupFilterOptions(extras, draft.productCategory || 'All').filter(g => g !== 'All')
  }, [products, draft.productCategory])

  const productOptions = useMemo(() => {
    return products
      .filter(p => {
        if (draft.productCategory) {
          if ((p.category || '').trim().toLowerCase() !== draft.productCategory.trim().toLowerCase()) {
            return false
          }
        }
        if (draft.productGroup) {
          if (!productMatchesPosGroupFilter(p.group || '', draft.productGroup)) return false
        }
        return true
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, draft.productCategory, draft.productGroup])

  const sortedRules = useMemo(
    () =>
      [...rules].sort(
        (a, b) =>
          a.sequence - b.sequence
          || scopeLabel(a.productCategory).localeCompare(scopeLabel(b.productCategory))
          || scopeLabel(a.productGroup).localeCompare(scopeLabel(b.productGroup))
          || scopeLabel(a.productName, 'All').localeCompare(scopeLabel(b.productName, 'All'))
          || a.id - b.id,
      ),
    [rules],
  )

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setDraft(emptyDraft(filterLocationId))
  }

  function openAdd() {
    setEditingId(null)
    setDraft(emptyDraft(filterLocationId))
    setShowForm(true)
  }

  function openEdit(row: PosDeviceSetupRule) {
    setEditingId(row.id)
    setDraft({
      locationExternalId: row.locationExternalId || filterLocationId,
      productCategory: row.productCategory || '',
      productGroup: row.productGroup || '',
      productId: row.productId ? String(row.productId) : '',
      primaryDeviceId: row.primaryDeviceId ? String(row.primaryDeviceId) : '',
      secondaryDeviceId: row.secondaryDeviceId ? String(row.secondaryDeviceId) : '',
      concurrentDeviceId: row.concurrentDeviceId ? String(row.concurrentDeviceId) : '',
      sequence: String(row.sequence ?? 0),
      active: row.active !== false,
    })
    setShowForm(true)
  }

  async function submitForm() {
    const primaryDeviceId = parseOptionalId(draft.primaryDeviceId)
    const secondaryDeviceId = parseOptionalId(draft.secondaryDeviceId)
    const concurrentDeviceId = parseOptionalId(draft.concurrentDeviceId)
    if (!primaryDeviceId && !secondaryDeviceId && !concurrentDeviceId) {
      setError('Select at least one device (Primary, Secondary, or Concurrent).')
      return
    }

    const productId = parseOptionalId(draft.productId)
    const product = productId ? products.find(p => p.id === productId) : undefined
    const sequence = Number.parseInt(draft.sequence, 10)
    const payload: UpsertPosDeviceSetupRulePayload = {
      companyId: selectedCompanyId,
      locationExternalId: draft.locationExternalId.trim(),
      productCategory: draft.productCategory.trim(),
      productGroup: draft.productGroup.trim(),
      productId,
      productName: product?.name ?? '',
      primaryDeviceId,
      secondaryDeviceId,
      concurrentDeviceId,
      sequence: Number.isFinite(sequence) ? Math.max(0, sequence) : 0,
      active: draft.active,
    }

    setSaving(true)
    setError(null)
    try {
      if (editingId != null) {
        await api.updatePosDeviceSetupRule(editingId, payload)
      } else {
        await api.createPosDeviceSetupRule(payload)
      }
      closeForm()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: PosDeviceSetupRule, active: boolean) {
    setError(null)
    try {
      await api.setPosDeviceSetupRuleActive(row.id, active)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update active flag.')
    }
  }

  async function removeRow(row: PosDeviceSetupRule) {
    const label = [
      scopeLabel(row.productCategory),
      scopeLabel(row.productGroup),
      scopeLabel(row.productName, 'All products'),
    ].join(' / ')
    if (!window.confirm(`Delete device set up for “${label}”?`)) return
    setError(null)
    try {
      await api.deletePosDeviceSetupRule(row.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  function renderDeviceCell(device: PosDeviceSetupRule['primaryDevice']) {
    if (!device) return <span className="text-muted-foreground">—</span>
    const type = device.deviceType ? deviceTypeLabel(device.deviceType) || device.deviceType : ''
    return (
      <span className="text-foreground">
        {device.name}
        {type ? <span className="text-muted-foreground"> · {type}</span> : null}
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="max-w-2xl">
          <p className="text-xs text-muted-foreground">
            Route orders by product category, group, or product.
            Primary receives the order (kitchen printer, KDS, bar printer, etc.).
            Secondary is used when primary is unavailable.
            Concurrent receives the same order at the same time as primary.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Location</span>
            <select
              className={`${inputCls} min-w-[10rem]`}
              value={filterLocationId}
              onChange={e => {
                setFilterLocationId(e.target.value)
                closeForm()
              }}
            >
              <option value="">All locations</option>
              {locations.map(loc => (
                <option key={loc.externalId} value={loc.externalId}>{loc.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            onClick={openAdd}
          >
            Add device route
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      ) : null}

      {showForm ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-foreground">
              {editingId != null ? 'Edit device route' : 'New device route'}
            </h3>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Location</span>
              <select
                className={inputCls}
                value={draft.locationExternalId}
                onChange={e => setDraft(d => ({ ...d, locationExternalId: e.target.value }))}
              >
                <option value="">All locations</option>
                {locations.map(loc => (
                  <option key={loc.externalId} value={loc.externalId}>{loc.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Product Category</span>
              <select
                className={inputCls}
                value={draft.productCategory}
                onChange={e => setDraft(d => ({
                  ...d,
                  productCategory: e.target.value,
                  productGroup: '',
                  productId: '',
                }))}
              >
                <option value="">All</option>
                {categoryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Product Group</span>
              <select
                className={inputCls}
                value={draft.productGroup}
                onChange={e => setDraft(d => ({
                  ...d,
                  productGroup: e.target.value,
                  productId: '',
                }))}
              >
                <option value="">All</option>
                {groupOptions.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Product</span>
              <select
                className={inputCls}
                value={draft.productId}
                onChange={e => setDraft(d => ({ ...d, productId: e.target.value }))}
              >
                <option value="">All</option>
                {productOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Primary</span>
              <select
                className={inputCls}
                value={draft.primaryDeviceId}
                onChange={e => setDraft(d => ({ ...d, primaryDeviceId: e.target.value }))}
              >
                <option value="">—</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{deviceOptionLabel(d)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Secondary</span>
              <select
                className={inputCls}
                value={draft.secondaryDeviceId}
                onChange={e => setDraft(d => ({ ...d, secondaryDeviceId: e.target.value }))}
              >
                <option value="">—</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{deviceOptionLabel(d)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Concurrent</span>
              <select
                className={inputCls}
                value={draft.concurrentDeviceId}
                onChange={e => setDraft(d => ({ ...d, concurrentDeviceId: e.target.value }))}
              >
                <option value="">—</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{deviceOptionLabel(d)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground space-y-1">
              <span>Sequence</span>
              <input
                className={inputCls}
                type="number"
                min={0}
                value={draft.sequence}
                onChange={e => setDraft(d => ({ ...d, sequence: e.target.value }))}
              />
            </label>
            <label className="text-xs text-muted-foreground flex items-end gap-2 pb-2">
              <ToggleSwitch
                checked={draft.active}
                onChange={active => setDraft(d => ({ ...d, active }))}
                label="Active"
              />
              <span>Active</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              onClick={() => void submitForm()}
            >
              {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <MillstoneLoader />
        </div>
      ) : (
        <TableScrollContainer>
          <table className="w-full text-xs">
            <ColGroup widths={['14%', '14%', '16%', '14%', '14%', '14%', '14%']} />
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-semibold">Product Category</th>
                <th className="px-2 py-2 font-semibold">Product Group</th>
                <th className="px-2 py-2 font-semibold">Product</th>
                <th className="px-2 py-2 font-semibold">Primary</th>
                <th className="px-2 py-2 font-semibold">Secondary</th>
                <th className="px-2 py-2 font-semibold">Concurrent</th>
                <th className="px-2 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-muted-foreground">
                    No device routes yet. Add one to send orders to kitchen / bar / printers.
                    {devices.length === 0 ? (
                      <span className="block mt-1">
                        Register devices under Device Management first.
                      </span>
                    ) : null}
                  </td>
                </tr>
              ) : (
                sortedRules.map(row => (
                  <tr key={row.id} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="px-2 py-2 text-foreground">{scopeLabel(row.productCategory)}</td>
                    <td className="px-2 py-2 text-foreground">{scopeLabel(row.productGroup)}</td>
                    <td className="px-2 py-2 text-foreground">
                      {row.productId ? scopeLabel(row.productName, `Product #${row.productId}`) : 'All'}
                    </td>
                    <td className="px-2 py-2">{renderDeviceCell(row.primaryDevice)}</td>
                    <td className="px-2 py-2">{renderDeviceCell(row.secondaryDevice)}</td>
                    <td className="px-2 py-2">{renderDeviceCell(row.concurrentDevice)}</td>
                    <td className="px-2 py-2 text-right space-x-2 whitespace-nowrap">
                      <ToggleSwitch
                        checked={row.active}
                        onChange={v => void toggleActive(row, v)}
                        label={`Active route ${row.id}`}
                      />
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        onClick={() => void removeRow(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      )}
    </div>
  )
}
