import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosModifierGroup,
  type PosModifierKind,
  type PosModifierStockCatalogProduct,
  type Product,
  type UpsertPosModifierGroupPayload,
} from '../../api'
import {
  kindLabel,
  POS_MODIFIER_KINDS,
  STOCK_PRODUCT_GROUP_BY_KIND,
} from '../../data/posModifierGroups'
import { inputCls, selectCls } from '../../data/countries'
import { pageShellClass } from '../layout/pageLayout'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { TableScrollContainer } from '../shared/TableScrollContainer'

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

type OptionDraft = {
  key: string
  label: string
  extraChargeCents: number
  linkedProductId: number | null
  linkedProductName: string
}

type AttachmentDraft = {
  key: string
  targetType: 'product-group' | 'product'
  targetProductGroup: string
  targetProductId: number | null
  targetProductName: string
}

type FormState = {
  kind: PosModifierKind
  name: string
  sequence: number
  required: boolean
  minSelect: number
  maxSelect: number
  affectsStock: boolean
  active: boolean
  options: OptionDraft[]
  attachments: AttachmentDraft[]
}

function blankForm(kind: PosModifierKind = 'compulsory'): FormState {
  return {
    kind,
    name: '',
    sequence: 0,
    required: kind === 'compulsory',
    minSelect: kind === 'compulsory' ? 1 : 0,
    maxSelect: 1,
    affectsStock: false,
    active: true,
    options: [{ key: cryptoKey(), label: '', extraChargeCents: 0, linkedProductId: null, linkedProductName: '' }],
    attachments: [],
  }
}

function cryptoKey() {
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function uniqueGroups(products: Product[]): string[] {
  return [...new Set(products.map(p => (p.group || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
}

export function PosModifierGroupPage({ selectedCompanyId }: Props) {
  const [kindTab, setKindTab] = useState<PosModifierKind | 'all'>('all')
  const [rows, setRows] = useState<PosModifierGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stockCatalog, setStockCatalog] = useState<PosModifierStockCatalogProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => blankForm())

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setRows([])
      setProducts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [groups, catalog] = await Promise.all([
        api.posModifierGroups(selectedCompanyId, { includeInactive: true }),
        api.products(selectedCompanyId),
      ])
      setRows(groups)
      setProducts(catalog.filter(p => p.active !== false))
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedCompanyId || !formOpen) {
      setStockCatalog([])
      return
    }
    if (form.kind !== 'food' && form.kind !== 'beverage' && form.kind !== 'component-swap') {
      setStockCatalog([])
      return
    }
    let cancelled = false
    api.posModifierStockCatalog(selectedCompanyId, form.kind)
      .then(data => {
        if (!cancelled) setStockCatalog(data.products)
      })
      .catch(() => {
        if (!cancelled) setStockCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedCompanyId, formOpen, form.kind])

  const filtered = useMemo(
    () => (kindTab === 'all' ? rows : rows.filter(r => r.kind === kindTab))
      .slice()
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.sequence - b.sequence || a.name.localeCompare(b.name)),
    [rows, kindTab],
  )

  const productGroups = useMemo(() => uniqueGroups(products), [products])

  function openCreate(kind: PosModifierKind = 'compulsory') {
    setEditingId(null)
    setForm(blankForm(kind))
    setFormOpen(true)
  }

  function openEdit(row: PosModifierGroup) {
    setEditingId(row.id)
    setForm({
      kind: (row.kind as PosModifierKind) || 'food',
      name: row.name,
      sequence: row.sequence,
      required: row.required,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      affectsStock: row.affectsStock,
      active: row.active,
      options: (row.options?.length ? row.options : [{ label: '', extraChargeCents: 0 }]).map(o => ({
        key: cryptoKey(),
        label: 'label' in o ? o.label : '',
        extraChargeCents: 'extraChargeCents' in o ? o.extraChargeCents : 0,
        linkedProductId: 'linkedProductId' in o ? (o.linkedProductId ?? null) : null,
        linkedProductName: 'linkedProductName' in o ? (o.linkedProductName || '') : '',
      })),
      attachments: (row.attachments ?? []).map(a => ({
        key: cryptoKey(),
        targetType: a.targetType === 'product' ? 'product' : 'product-group',
        targetProductGroup: a.targetProductGroup || '',
        targetProductId: a.targetProductId ?? null,
        targetProductName: a.targetProductName || '',
      })),
    })
    setFormOpen(true)
  }

  function buildPayload(): UpsertPosModifierGroupPayload | null {
    if (!selectedCompanyId) return null
    const options = form.options
      .map((o, i) => ({
        label: o.label.trim(),
        sequence: i,
        extraChargeCents: Math.max(0, Math.round(o.extraChargeCents)),
        linkedProductId: o.linkedProductId,
        linkedProductName: o.linkedProductName,
        active: true,
      }))
      .filter(o => o.label)
    if (options.length === 0) {
      setError('Add at least one option.')
      return null
    }
    return {
      companyId: selectedCompanyId,
      kind: form.kind,
      name: form.name.trim(),
      sequence: form.sequence,
      required: form.kind === 'compulsory' || form.required,
      minSelect: form.kind === 'compulsory' ? Math.max(1, form.minSelect) : form.minSelect,
      maxSelect: Math.max(1, form.maxSelect),
      affectsStock: form.affectsStock,
      active: form.active,
      options,
      attachments: form.attachments.map(a => ({
        targetType: a.targetType,
        targetProductGroup: a.targetType === 'product-group' ? a.targetProductGroup : undefined,
        targetProductId: a.targetType === 'product' ? a.targetProductId : undefined,
        targetProductName: a.targetType === 'product' ? a.targetProductName : undefined,
      })),
    }
  }

  async function save() {
    const payload = buildPayload()
    if (!payload) return
    if (!payload.name) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) await api.updatePosModifierGroup(editingId, payload)
      else await api.createPosModifierGroup(payload)
      setFormOpen(false)
      flash(editingId ? 'Modifier group updated' : 'Modifier group created')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function inheritSwap() {
    if (!selectedCompanyId) return
    setSaving(true)
    setError(null)
    try {
      await api.inheritPosComponentSwapModifiers(selectedCompanyId)
      flash('Inherited Component SWAP options from RMS')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: PosModifierGroup) {
    try {
      await api.setPosModifierGroupActive(row.id, !row.active)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function remove(row: PosModifierGroup) {
    if (!window.confirm(`Delete modifier group “${row.name}”?`)) return
    try {
      await api.deletePosModifierGroup(row.id)
      flash('Deleted')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={`${pageShellClass} p-4`}>
        <p className="text-sm text-muted-foreground">Select a company to manage POS Modifier Groups.</p>
      </div>
    )
  }

  const stockGroupName = STOCK_PRODUCT_GROUP_BY_KIND[form.kind]

  return (
    <div className={`${pageShellClass} p-3 sm:p-4 space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">POS Modifier Group</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Configure Compulsory, Food, Beverage, and Component SWAP modifiers. Attach each group to a
            product group or individual product. Stock-influencing Food/Beverage options must use products
            from the matching RMS product group.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-semibold rounded border border-border bg-background"
            disabled={saving}
            onClick={() => void inheritSwap()}
          >
            Inherit Component SWAP
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground"
            onClick={() => openCreate(kindTab === 'all' ? 'compulsory' : kindTab)}
          >
            New modifier group
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`px-2.5 py-1 text-xs rounded border ${kindTab === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
          onClick={() => setKindTab('all')}
        >
          All
        </button>
        {POS_MODIFIER_KINDS.map(k => (
          <button
            key={k.id}
            type="button"
            className={`px-2.5 py-1 text-xs rounded border ${kindTab === k.id ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
            onClick={() => setKindTab(k.id)}
            title={k.hint}
          >
            {k.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {toast ? <p className="text-sm text-foreground">{toast}</p> : null}

      {loading ? (
        <MillstoneLoader label="Loading modifier groups…" />
      ) : (
        <TableScrollContainer>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Seq</th>
                <th className="py-2 pr-3">Options</th>
                <th className="py-2 pr-3">Attached to</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-muted-foreground">
                    No modifier groups yet. Create one or inherit Component SWAP from RMS.
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="border-b border-border/70 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{kindLabel(row.kind)}</td>
                    <td className="py-2 pr-3 font-medium">{row.name}</td>
                    <td className="py-2 pr-3">{row.sequence}</td>
                    <td className="py-2 pr-3">{row.options?.length ?? 0}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[220px]">
                      {(row.attachments ?? []).length === 0
                        ? '—'
                        : row.attachments.map(a =>
                            a.targetType === 'product'
                              ? `Product: ${a.targetProductName || a.targetProductId}`
                              : `Group: ${a.targetProductGroup}`,
                          ).join(' · ')}
                    </td>
                    <td className="py-2 pr-3">{row.affectsStock ? 'Yes' : '—'}</td>
                    <td className="py-2 pr-3">{row.active ? 'Active' : 'Inactive'}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className="text-xs underline" onClick={() => openEdit(row)}>Edit</button>
                        <button type="button" className="text-xs underline" onClick={() => void toggleActive(row)}>
                          {row.active ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="text-xs underline text-destructive" onClick={() => void remove(row)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-background p-4 space-y-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{editingId ? 'Edit modifier group' : 'New modifier group'}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {POS_MODIFIER_KINDS.find(k => k.id === form.kind)?.hint}
                </p>
              </div>
              <button
                type="button"
                className="text-xs underline"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs space-y-1">
                <span className="uppercase tracking-wide text-muted-foreground">Kind</span>
                <select
                  className={selectCls}
                  value={form.kind}
                  onChange={e => {
                    const kind = e.target.value as PosModifierKind
                    setForm(f => ({
                      ...f,
                      kind,
                      required: kind === 'compulsory' ? true : f.required,
                      minSelect: kind === 'compulsory' ? Math.max(1, f.minSelect) : f.minSelect,
                    }))
                  }}
                >
                  {POS_MODIFIER_KINDS.map(k => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs space-y-1">
                <span className="uppercase tracking-wide text-muted-foreground">Name</span>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cooking temperature"
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="uppercase tracking-wide text-muted-foreground">Sequence</span>
                <input
                  type="number"
                  className={inputCls}
                  value={form.sequence}
                  onChange={e => setForm(f => ({ ...f, sequence: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="uppercase tracking-wide text-muted-foreground">Min / Max select</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className={inputCls}
                    value={form.minSelect}
                    onChange={e => setForm(f => ({ ...f, minSelect: Number(e.target.value) || 0 }))}
                  />
                  <input
                    type="number"
                    className={inputCls}
                    value={form.maxSelect}
                    onChange={e => setForm(f => ({ ...f, maxSelect: Number(e.target.value) || 1 }))}
                  />
                </div>
              </label>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.required || form.kind === 'compulsory'}
                  disabled={form.kind === 'compulsory'}
                  onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
                />
                Required
              </label>
              {(form.kind === 'food' || form.kind === 'beverage') ? (
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.affectsStock}
                    onChange={e => setForm(f => ({ ...f, affectsStock: e.target.checked }))}
                  />
                  Affects stock (options from “{stockGroupName}” product group)
                </label>
              ) : null}
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                />
                Active
              </label>
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide">Options</h4>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    setForm(f => ({
                      ...f,
                      options: [
                        ...f.options,
                        { key: cryptoKey(), label: '', extraChargeCents: 0, linkedProductId: null, linkedProductName: '' },
                      ],
                    }))
                  }
                >
                  Add option
                </button>
              </div>
              {form.affectsStock && stockGroupName ? (
                <p className="text-xs text-muted-foreground">
                  Stock catalog: {stockCatalog.length} product(s) in “{stockGroupName}”.
                  {stockCatalog.length === 0
                    ? ' Create products under that product group in RMS Products first.'
                    : ''}
                </p>
              ) : null}
              <div className="space-y-2">
                {form.options.map((opt, idx) => (
                  <div key={opt.key} className="grid sm:grid-cols-[1fr_100px_1fr_auto] gap-2 items-end">
                    <label className="text-xs space-y-1">
                      <span className="text-muted-foreground">Label</span>
                      <input
                        className={inputCls}
                        value={opt.label}
                        onChange={e => {
                          const label = e.target.value
                          setForm(f => ({
                            ...f,
                            options: f.options.map((o, i) => (i === idx ? { ...o, label } : o)),
                          }))
                        }}
                      />
                    </label>
                    <label className="text-xs space-y-1">
                      <span className="text-muted-foreground">Extra ¢</span>
                      <input
                        type="number"
                        className={inputCls}
                        value={opt.extraChargeCents}
                        onChange={e => {
                          const extraChargeCents = Number(e.target.value) || 0
                          setForm(f => ({
                            ...f,
                            options: f.options.map((o, i) => (i === idx ? { ...o, extraChargeCents } : o)),
                          }))
                        }}
                      />
                    </label>
                    {(form.affectsStock || form.kind === 'component-swap') ? (
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Linked product</span>
                        <select
                          className={selectCls}
                          value={opt.linkedProductId ?? ''}
                          onChange={e => {
                            const id = e.target.value ? Number(e.target.value) : null
                            const hit = stockCatalog.find(p => p.id === id)
                            setForm(f => ({
                              ...f,
                              options: f.options.map((o, i) =>
                                i === idx
                                  ? {
                                      ...o,
                                      linkedProductId: id,
                                      linkedProductName: hit?.name || '',
                                      label: o.label || hit?.name || '',
                                    }
                                  : o,
                              ),
                            }))
                          }}
                        >
                          <option value="">—</option>
                          {stockCatalog.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div />
                    )}
                    <button
                      type="button"
                      className="text-xs underline text-destructive pb-2"
                      onClick={() =>
                        setForm(f => ({
                          ...f,
                          options: f.options.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide">Attach by group or product</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      setForm(f => ({
                        ...f,
                        attachments: [
                          ...f.attachments,
                          {
                            key: cryptoKey(),
                            targetType: 'product-group',
                            targetProductGroup: '',
                            targetProductId: null,
                            targetProductName: '',
                          },
                        ],
                      }))
                    }
                  >
                    + Product group
                  </button>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      setForm(f => ({
                        ...f,
                        attachments: [
                          ...f.attachments,
                          {
                            key: cryptoKey(),
                            targetType: 'product',
                            targetProductGroup: '',
                            targetProductId: null,
                            targetProductName: '',
                          },
                        ],
                      }))
                    }
                  >
                    + Product
                  </button>
                </div>
              </div>
              {form.attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Not attached yet. Compulsory groups need an attachment to appear on register.
                </p>
              ) : null}
              {form.attachments.map((att, idx) => (
                <div key={att.key} className="grid sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
                  <label className="text-xs space-y-1">
                    <span className="text-muted-foreground">Target</span>
                    <select
                      className={selectCls}
                      value={att.targetType}
                      onChange={e => {
                        const targetType = e.target.value as 'product-group' | 'product'
                        setForm(f => ({
                          ...f,
                          attachments: f.attachments.map((a, i) =>
                            i === idx
                              ? {
                                  ...a,
                                  targetType,
                                  targetProductGroup: '',
                                  targetProductId: null,
                                  targetProductName: '',
                                }
                              : a,
                          ),
                        }))
                      }}
                    >
                      <option value="product-group">Product group</option>
                      <option value="product">Product</option>
                    </select>
                  </label>
                  {att.targetType === 'product-group' ? (
                    <label className="text-xs space-y-1">
                      <span className="text-muted-foreground">Product group</span>
                      <select
                        className={selectCls}
                        value={att.targetProductGroup}
                        onChange={e => {
                          const targetProductGroup = e.target.value
                          setForm(f => ({
                            ...f,
                            attachments: f.attachments.map((a, i) =>
                              i === idx ? { ...a, targetProductGroup } : a,
                            ),
                          }))
                        }}
                      >
                        <option value="">— Select —</option>
                        {productGroups.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="text-xs space-y-1">
                      <span className="text-muted-foreground">Product</span>
                      <select
                        className={selectCls}
                        value={att.targetProductId ?? ''}
                        onChange={e => {
                          const id = e.target.value ? Number(e.target.value) : null
                          const hit = products.find(p => p.id === id)
                          setForm(f => ({
                            ...f,
                            attachments: f.attachments.map((a, i) =>
                              i === idx
                                ? {
                                    ...a,
                                    targetProductId: id,
                                    targetProductName: hit?.name || '',
                                  }
                                : a,
                            ),
                          }))
                        }}
                      >
                        <option value="">— Select —</option>
                        {products
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.group || '—'})</option>
                          ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className="text-xs underline text-destructive pb-2"
                    onClick={() =>
                      setForm(f => ({
                        ...f,
                        attachments: f.attachments.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </section>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded border border-border"
                disabled={saving}
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
