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

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

type TabId = PosConfigTypeKind

const TABS: { id: TabId; label: string }[] = [
  { id: 'payment', label: 'Payment Type' },
  { id: 'entertainment', label: 'Entertainment Type' },
  { id: 'discount', label: 'Discount Type' },
]

const TAB_TITLE: Record<TabId, string> = {
  payment: 'Payment Type',
  entertainment: 'Entertainment Type',
  discount: 'Discount Type',
}

type Draft = {
  name: string
  code: string
  sequence: string
  active: boolean
}

const emptyDraft = (): Draft => ({
  name: '',
  code: '',
  sequence: '0',
  active: true,
})

function suggestCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function PosConfigPage({ selectedCompanyId }: Props) {
  const [tab, setTab] = useState<TabId>('payment')
  const [rows, setRows] = useState<PosConfigType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [codeTouched, setCodeTouched] = useState(false)

  const load = useCallback(async (companyId: number, kind: TabId) => {
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
    if (!selectedCompanyId) {
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
    setEditingId(null)
    setDraft(emptyDraft())
    setCodeTouched(false)
    setShowForm(true)
    setError(null)
  }

  function openEdit(row: PosConfigType) {
    setEditingId(row.id)
    setDraft({
      name: row.name,
      code: row.code,
      sequence: String(row.sequence),
      active: row.active,
    })
    setCodeTouched(true)
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setDraft(emptyDraft())
    setCodeTouched(false)
  }

  async function submitForm() {
    if (!selectedCompanyId) return
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
    if (!selectedCompanyId) return
    setError(null)
    try {
      await api.setPosConfigTypeActive(row.id, active)
      await load(selectedCompanyId, tab)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update active flag.')
    }
  }

  async function removeRow(row: PosConfigType) {
    if (!selectedCompanyId) return
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
            Company lookup tables for payment, entertainment, and discount types used at the register.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          onClick={openAdd}
        >
          Add {TAB_TITLE[tab]}
        </button>
      </div>

      <div className="mt-3">
        <HrConfigTabBar tabs={TABS} active={tab} onChange={id => {
          setTab(id)
          closeForm()
        }} />
      </div>

      {error ? (
        <p className="mt-3 text-xs text-destructive" role="alert">{error}</p>
      ) : null}

      {showForm ? (
        <div className="mt-3 rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-foreground">
              {editingId != null ? `Edit ${TAB_TITLE[tab]}` : `New ${TAB_TITLE[tab]}`}
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
                placeholder={`${TAB_TITLE[tab]} name`}
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

      <div className="mt-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <MillstoneLoader />
          </div>
        ) : (
          <TableScrollContainer>
            <table className="w-full text-xs">
              <ColGroup widths={['28%', '18%', '12%', '12%', '30%']} />
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Code</th>
                  <th className="px-2 py-2 font-semibold">Sequence</th>
                  <th className="px-2 py-2 font-semibold">Active</th>
                  <th className="px-2 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-muted-foreground">
                      No {TAB_TITLE[tab].toLowerCase()}s yet. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  sorted.map(row => (
                    <tr key={row.id} className="border-b border-border/70 hover:bg-muted/30">
                      <td className="px-2 py-2 font-medium text-foreground">{row.name}</td>
                      <td className="px-2 py-2 font-mono text-muted-foreground">{row.code}</td>
                      <td className="px-2 py-2 text-muted-foreground">{row.sequence}</td>
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
    </div>
  )
}
