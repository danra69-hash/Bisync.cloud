import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosConfigType,
  type PosConfigTypeKind,
  type Product,
  type UpsertPosConfigTypePayload,
} from '../../api'
import { inputCls } from '../../data/countries'
import { HrConfigTabBar } from '../admin/HrConfigTabBar'
import { ToggleSwitch } from '../admin/ToggleSwitch'
import { pageShellClass } from '../layout/pageLayout'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { TableScrollContainer } from '../shared/TableScrollContainer'
import { ColGroup } from '../shared/SortableTableHead'
import { PosDeviceSetupTab } from './PosDeviceSetupTab'

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

type TabId = PosConfigTypeKind | 'devices'

const TABS: { id: TabId; label: string }[] = [
  { id: 'payment', label: 'Payment Type' },
  { id: 'entertainment', label: 'Entertainment Type' },
  { id: 'discount', label: 'Discount Type' },
  { id: 'devices', label: 'Device Set up' },
]

const TAB_TITLE: Record<ConfigTypeTab, string> = {
  payment: 'Payment Type',
  entertainment: 'Entertainment Type',
  discount: 'Discount Type',
}

type Draft = {
  name: string
  code: string
  sequence: string
  active: boolean
  includeAll: boolean
  exceptionGroups: string[]
  exceptionProductIds: number[]
  percentage: string
}

const emptyDraft = (): Draft => ({
  name: '',
  code: '',
  sequence: '0',
  active: true,
  includeAll: false,
  exceptionGroups: [],
  exceptionProductIds: [],
  percentage: '0',
})

function suggestCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

type ConfigTypeTab = 'payment' | 'entertainment' | 'discount'

function isConfigTypeTab(tab: TabId): tab is ConfigTypeTab {
  return tab === 'payment' || tab === 'entertainment' || tab === 'discount'
}

function configTabTitle(tab: TabId): string {
  return isConfigTypeTab(tab) ? TAB_TITLE[tab] : 'Type'
}

function formatExceptionSummary(row: PosConfigType): string {
  const groups = row.exceptionGroups ?? []
  const products = row.exceptionProductIds ?? []
  const parts: string[] = []
  if (groups.length > 0) parts.push(`${groups.length} group${groups.length === 1 ? '' : 's'}`)
  if (products.length > 0) parts.push(`${products.length} product${products.length === 1 ? '' : 's'}`)
  return parts.length > 0 ? parts.join(' · ') : 'Required — none set'
}

export function PosConfigPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [tab, setTab] = useState<TabId>('payment')
  const [rows, setRows] = useState<PosConfigType[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [codeTouched, setCodeTouched] = useState(false)

  const load = useCallback(async (companyId: number, kind: ConfigTypeTab) => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.posConfigTypes(companyId, { kind, includeInactive: true })
      setRows(list)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Failed to load POS config types.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async (companyId: number) => {
    try {
      const list = await api.products(companyId)
      setProducts(list.filter(p => p.active !== false && !p.isSubProduct))
    } catch {
      setProducts([])
    }
  }, [])

  useEffect(() => {
    if (!selectedCompanyId || !isConfigTypeTab(tab)) {
      setRows([])
      return
    }
    void load(selectedCompanyId, tab)
  }, [selectedCompanyId, tab, load])

  useEffect(() => {
    if (!selectedCompanyId || (tab !== 'entertainment' && tab !== 'discount')) {
      return
    }
    void loadProducts(selectedCompanyId)
  }, [selectedCompanyId, tab, loadProducts])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name)),
    [rows],
  )

  const productGroups = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      const g = (p.group || '').trim()
      if (g) set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [products])

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  )

  function openAdd() {
    if (!isConfigTypeTab(tab)) return
    setEditingId(null)
    setDraft(emptyDraft())
    setCodeTouched(false)
    setShowForm(true)
  }

  function openEdit(row: PosConfigType) {
    setEditingId(row.id)
    setDraft({
      name: row.name,
      code: row.code,
      sequence: String(row.sequence ?? 0),
      active: row.active !== false,
      includeAll: Boolean(row.includeAll),
      exceptionGroups: [...(row.exceptionGroups ?? [])],
      exceptionProductIds: [...(row.exceptionProductIds ?? [])],
      percentage: String(row.percentage ?? 0),
    })
    setCodeTouched(true)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setDraft(emptyDraft())
    setCodeTouched(false)
  }

  async function submitForm() {
    if (!selectedCompanyId || !isConfigTypeTab(tab)) return
    const name = draft.name.trim()
    const code = (draft.code.trim() || suggestCode(name)).toUpperCase()
    if (!name) {
      setError('Name is required.')
      return
    }
    if (!code) {
      setError('Code is required.')
      return
    }
    const sequence = Number.parseInt(draft.sequence, 10)
    const payload: UpsertPosConfigTypePayload = {
      companyId: selectedCompanyId,
      kind: tab,
      name,
      code,
      sequence: Number.isFinite(sequence) ? Math.max(0, sequence) : 0,
      active: draft.active,
    }
    if (tab === 'entertainment' || tab === 'discount') {
      const groups = draft.exceptionGroups.map(g => g.trim()).filter(Boolean)
      const productIds = draft.exceptionProductIds.filter(id => id > 0)
      if (groups.length === 0 && productIds.length === 0) {
        setError('Select at least one Exception Product Group or Product (multi-select).')
        return
      }
      payload.includeAll = false
      payload.exceptionGroups = groups
      payload.exceptionProductIds = productIds
    }
    if (tab === 'discount') {
      const pct = Number.parseFloat(draft.percentage)
      payload.percentage = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId != null) {
        await api.updatePosConfigType(editingId, payload)
      } else {
        await api.createPosConfigType(payload)
      }
      closeForm()
      await load(selectedCompanyId, tab)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: PosConfigType, active: boolean) {
    if (!selectedCompanyId || !isConfigTypeTab(tab)) return
    setError(null)
    try {
      await api.setPosConfigTypeActive(row.id, active)
      await load(selectedCompanyId, tab)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update active flag.')
    }
  }

  async function removeRow(row: PosConfigType) {
    if (!selectedCompanyId || !isConfigTypeTab(tab)) return
    if (!window.confirm(`Delete ${TAB_TITLE[tab]} “${row.name}”?`)) return
    setError(null)
    try {
      await api.deletePosConfigType(row.id)
      await load(selectedCompanyId, tab)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.')
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to open POS Config.</p>
      </div>
    )
  }

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">POS Config</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Company lookup tables for payment, entertainment, and discount types, plus device routing for the register.
          </p>
        </div>
        {isConfigTypeTab(tab) ? (
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            onClick={openAdd}
          >
            Add {configTabTitle(tab)}
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        <HrConfigTabBar
          tabs={TABS}
          active={tab}
          onChange={id => {
            setTab(id)
            closeForm()
            setError(null)
          }}
        />
      </div>

      {tab === 'devices' ? (
        <div className="mt-3">
          <PosDeviceSetupTab
            selectedCompanyId={selectedCompanyId}
            selectedLocationIds={selectedLocationIds}
          />
        </div>
      ) : (
        <>
          {error ? (
            <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>
          ) : null}

          {showForm ? (
            <div className="mt-3 rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">
                  {editingId != null ? `Edit ${configTabTitle(tab)}` : `New ${configTabTitle(tab)}`}
                </h3>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={closeForm}
                >
                  Cancel
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>Name</span>
                  <input
                    className={inputCls}
                    value={draft.name}
                    onChange={e => {
                      const name = e.target.value
                      setDraft(d => ({
                        ...d,
                        name,
                        code: codeTouched ? d.code : suggestCode(name),
                      }))
                    }}
                    placeholder={`${configTabTitle(tab)} name`}
                  />
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>Code</span>
                  <input
                    className={`${inputCls} font-mono uppercase`}
                    value={draft.code}
                    onChange={e => {
                      setCodeTouched(true)
                      setDraft(d => ({ ...d, code: e.target.value.toUpperCase() }))
                    }}
                    placeholder="CASH"
                  />
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
                {tab === 'discount' ? (
                  <label className="text-xs text-muted-foreground space-y-1">
                    <span>Percentage</span>
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={draft.percentage}
                      onChange={e => setDraft(d => ({ ...d, percentage: e.target.value }))}
                    />
                  </label>
                ) : (
                  <label className="text-xs text-muted-foreground flex items-end gap-2 pb-2">
                    <ToggleSwitch
                      checked={draft.active}
                      onChange={active => setDraft(d => ({ ...d, active }))}
                      label="Active"
                    />
                    <span>Active</span>
                  </label>
                )}
                {tab === 'discount' ? (
                  <label className="text-xs text-muted-foreground flex items-end gap-2 pb-2">
                    <ToggleSwitch
                      checked={draft.active}
                      onChange={active => setDraft(d => ({ ...d, active }))}
                      label="Active"
                    />
                    <span>Active</span>
                  </label>
                ) : null}
              </div>

              {tab === 'entertainment' || tab === 'discount' ? (
                <div className="space-y-3 rounded-md border border-border bg-muted/10 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Exceptions (required)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Tick Product Groups and/or Products that POS must not apply this{' '}
                      {tab === 'discount' ? 'discount' : 'entertainment'} to. Multi-select with
                      checkboxes — at least one group or product is required.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Product groups
                      </p>
                      <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1">
                        {productGroups.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground px-1 py-2">
                            No product groups found for this company.
                          </p>
                        ) : (
                          productGroups.map(group => {
                            const checked = draft.exceptionGroups.some(
                              g => g.trim().toLowerCase() === group.toLowerCase(),
                            )
                            return (
                              <label
                                key={group}
                                className="flex items-center gap-2 text-xs text-foreground cursor-pointer px-1 py-0.5 rounded hover:bg-muted/40"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-border"
                                  checked={checked}
                                  onChange={() => {
                                    setDraft(d => {
                                      const next = checked
                                        ? d.exceptionGroups.filter(
                                          g => g.trim().toLowerCase() !== group.toLowerCase(),
                                        )
                                        : [...d.exceptionGroups, group]
                                      return { ...d, includeAll: false, exceptionGroups: next }
                                    })
                                  }}
                                />
                                <span>{group}</span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Products
                      </p>
                      <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1">
                        {sortedProducts.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground px-1 py-2">
                            No products found for this company.
                          </p>
                        ) : (
                          sortedProducts.map(product => {
                            const checked = draft.exceptionProductIds.includes(product.id)
                            return (
                              <label
                                key={product.id}
                                className="flex items-center gap-2 text-xs text-foreground cursor-pointer px-1 py-0.5 rounded hover:bg-muted/40"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-border"
                                  checked={checked}
                                  onChange={() => {
                                    setDraft(d => {
                                      const next = checked
                                        ? d.exceptionProductIds.filter(id => id !== product.id)
                                        : [...d.exceptionProductIds, product.id]
                                      return { ...d, includeAll: false, exceptionProductIds: next }
                                    })
                                  }}
                                />
                                <span className="truncate">
                                  {product.name}
                                  {product.group ? (
                                    <span className="text-muted-foreground"> · {product.group}</span>
                                  ) : null}
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

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

          <div className="mt-3">
            {loading ? (
              <div className="flex justify-center py-10">
                <MillstoneLoader />
              </div>
            ) : (
              <TableScrollContainer>
                <table className="w-full text-xs">
                  <ColGroup
                    widths={
                      tab === 'discount'
                        ? ['18%', '12%', '10%', '10%', '18%', '12%', '20%']
                        : tab === 'entertainment'
                          ? ['20%', '14%', '10%', '22%', '12%', '22%']
                          : ['28%', '18%', '12%', '12%', '30%']
                    }
                  />
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-semibold">Name</th>
                      <th className="px-2 py-2 font-semibold">Code</th>
                      <th className="px-2 py-2 font-semibold">Sequence</th>
                      {tab === 'discount' ? (
                        <th className="px-2 py-2 font-semibold">%</th>
                      ) : null}
                      {tab === 'entertainment' || tab === 'discount' ? (
                        <th className="px-2 py-2 font-semibold">Exceptions</th>
                      ) : null}
                      <th className="px-2 py-2 font-semibold">Active</th>
                      <th className="px-2 py-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            tab === 'discount' ? 7 : tab === 'entertainment' ? 6 : 5
                          }
                          className="px-2 py-6 text-muted-foreground"
                        >
                          No {configTabTitle(tab).toLowerCase()}s yet. Add one to get started.
                        </td>
                      </tr>
                    ) : (
                      sorted.map(row => (
                        <tr key={row.id} className="border-b border-border/70 hover:bg-muted/30">
                          <td className="px-2 py-2 font-medium text-foreground">{row.name}</td>
                          <td className="px-2 py-2 font-mono text-muted-foreground">{row.code}</td>
                          <td className="px-2 py-2 text-muted-foreground">{row.sequence}</td>
                          {tab === 'discount' ? (
                            <td className="px-2 py-2 text-muted-foreground tabular-nums">
                              {row.percentage ?? 0}
                            </td>
                          ) : null}
                          {tab === 'entertainment' || tab === 'discount' ? (
                            <td className="px-2 py-2 text-muted-foreground">
                              {formatExceptionSummary(row)}
                            </td>
                          ) : null}
                          <td className="px-2 py-2">
                            <ToggleSwitch
                              checked={row.active}
                              onChange={v => void toggleActive(row, v)}
                              label={`Active ${row.name}`}
                            />
                          </td>
                          <td className="px-2 py-2 text-right space-x-2 whitespace-nowrap">
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
        </>
      )}
    </div>
  )
}
