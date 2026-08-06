import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosConfigType,
  type PosConfigTypeKind,
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

export function PosConfigPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const [tab, setTab] = useState<TabId>('payment')
  const [rows, setRows] = useState<PosConfigType[]>([])
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

  useEffect(() => {
    if (!selectedCompanyId || !isConfigTypeTab(tab)) {
      setRows([])
      return
    }
    void load(selectedCompanyId, tab)
  }, [selectedCompanyId, tab, load])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name)),
    [rows],
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
      payload.includeAll = draft.includeAll
      payload.exceptionGroups = draft.exceptionGroups
      payload.exceptionProductIds = draft.exceptionProductIds
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
                        ? ['24%', '16%', '12%', '12%', '12%', '24%']
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
                      <th className="px-2 py-2 font-semibold">Active</th>
                      <th className="px-2 py-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={tab === 'discount' ? 6 : 5}
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
