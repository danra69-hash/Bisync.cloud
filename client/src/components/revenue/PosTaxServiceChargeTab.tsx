import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosTaxServiceChargeLine,
  type PosTaxServiceConfig,
  type PosTaxServiceSalesTypeRule,
  type Product,
} from '../../api'
import { inputCls } from '../../data/countries'
import { MillstoneLoader } from '../shared/MillstoneLoader'

const SALES_TYPES: { id: string; label: string }[] = [
  { id: 'dine-in', label: 'Dine In' },
  { id: 'takeaway', label: 'Takeaway' },
  { id: 'delivery', label: 'Delivery' },
]

type Props = {
  selectedCompanyId: number
  products: Product[]
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyRule(salesType: string): PosTaxServiceSalesTypeRule {
  return {
    salesType,
    taxIds: [],
    serviceIds: [],
    applyToAllProducts: true,
    productGroups: [],
  }
}

function normalizeConfig(raw: PosTaxServiceConfig | null, companyId: number): PosTaxServiceConfig {
  const taxes = raw?.taxes ?? []
  const services = raw?.services ?? []
  const byType = new Map((raw?.salesTypes ?? []).map(r => [r.salesType.toLowerCase(), r]))
  const salesTypes = SALES_TYPES.map(({ id }) => {
    const existing = byType.get(id)
    return existing
      ? {
          salesType: id,
          taxIds: existing.taxIds ?? [],
          serviceIds: existing.serviceIds ?? [],
          applyToAllProducts: existing.applyToAllProducts !== false,
          productGroups: existing.applyToAllProducts !== false ? [] : existing.productGroups ?? [],
        }
      : emptyRule(id)
  })
  return {
    companyId,
    taxes,
    services,
    salesTypes,
    updatedAt: raw?.updatedAt ?? null,
  }
}

function formatPct(n: number) {
  const v = Number(n) || 0
  return `${v % 1 === 0 ? v.toFixed(0) : String(v)}%`
}

/**
 * POS Config → Tax & Service Charge tab.
 * Defines tax/service % lines and attaches them by sales type + product group.
 */
export function PosTaxServiceChargeTab({ selectedCompanyId, products }: Props) {
  const [taxes, setTaxes] = useState<PosTaxServiceChargeLine[]>([])
  const [services, setServices] = useState<PosTaxServiceChargeLine[]>([])
  const [salesTypes, setSalesTypes] = useState<PosTaxServiceSalesTypeRule[]>(
    SALES_TYPES.map(({ id }) => emptyRule(id)),
  )
  const [activeSalesType, setActiveSalesType] = useState(SALES_TYPES[0].id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  const productGroups = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      const g = (p.group || '').trim()
      if (g) set.add(g)
    }
    for (const r of salesTypes) {
      for (const g of r.productGroups) {
        const t = g.trim()
        if (t) set.add(t)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [products, salesTypes])

  const load = useCallback(async () => {
    if (selectedCompanyId <= 0) {
      setLoading(false)
      setError('Select a company first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const raw = await api.posTaxServiceConfig(selectedCompanyId)
      const cfg = normalizeConfig(raw, selectedCompanyId)
      setTaxes(cfg.taxes)
      setServices(cfg.services)
      setSalesTypes(cfg.salesTypes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax & service setup.')
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId])

  useEffect(() => {
    void load()
  }, [load])

  const activeRule = useMemo(
    () => salesTypes.find(r => r.salesType === activeSalesType) ?? emptyRule(activeSalesType),
    [salesTypes, activeSalesType],
  )

  function updateLine(
    kind: 'tax' | 'service',
    id: string,
    patch: Partial<Pick<PosTaxServiceChargeLine, 'name' | 'percent'>>,
  ) {
    const setter = kind === 'tax' ? setTaxes : setServices
    setter(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addLine(kind: 'tax' | 'service') {
    const line: PosTaxServiceChargeLine = {
      id: newId(kind === 'tax' ? 'tax' : 'svc'),
      name: '',
      percent: 0,
    }
    if (kind === 'tax') {
      setTaxes(rows => [...rows, line])
      // Auto-attach new tax to every sales type so it appears on the bill without a second step.
      setSalesTypes(rules => rules.map(r => ({ ...r, taxIds: [...r.taxIds, line.id] })))
    } else {
      setServices(rows => [...rows, line])
      setSalesTypes(rules => rules.map(r => ({ ...r, serviceIds: [...r.serviceIds, line.id] })))
    }
  }

  function removeLine(kind: 'tax' | 'service', id: string) {
    if (kind === 'tax') {
      setTaxes(rows => rows.filter(r => r.id !== id))
      setSalesTypes(rules => rules.map(r => ({ ...r, taxIds: r.taxIds.filter(x => x !== id) })))
    } else {
      setServices(rows => rows.filter(r => r.id !== id))
      setSalesTypes(rules =>
        rules.map(r => ({ ...r, serviceIds: r.serviceIds.filter(x => x !== id) })),
      )
    }
  }

  function patchRule(salesType: string, patch: Partial<PosTaxServiceSalesTypeRule>) {
    setSalesTypes(rules => rules.map(r => (r.salesType === salesType ? { ...r, ...patch } : r)))
  }

  function toggleId(salesType: string, field: 'taxIds' | 'serviceIds', id: string) {
    setSalesTypes(rules =>
      rules.map(r => {
        if (r.salesType !== salesType) return r
        const list = r[field]
        const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id]
        return { ...r, [field]: next }
      }),
    )
  }

  function toggleGroup(salesType: string, group: string) {
    setSalesTypes(rules =>
      rules.map(r => {
        if (r.salesType !== salesType) return r
        const list = r.productGroups
        const next = list.includes(group) ? list.filter(x => x !== group) : [...list, group]
        return { ...r, productGroups: next, applyToAllProducts: false }
      }),
    )
  }

  async function save() {
    if (selectedCompanyId <= 0) return
    for (const [label, rows] of [
      ['Tax', taxes],
      ['Service', services],
    ] as const) {
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].name.trim()) {
          setError(`${label} line ${i + 1}: enter a name.`)
          return
        }
        if (Number.isNaN(rows[i].percent) || rows[i].percent < 0 || rows[i].percent > 100) {
          setError(`${label} line ${i + 1}: percent must be 0–100.`)
          return
        }
      }
    }

    setSaving(true)
    setError(null)
    setSavedHint(null)
    try {
      const saved = await api.savePosTaxServiceConfig({
        companyId: selectedCompanyId,
        taxes: taxes.map(t => ({
          id: t.id,
          name: t.name.trim(),
          percent: Number(t.percent) || 0,
        })),
        services: services.map(s => ({
          id: s.id,
          name: s.name.trim(),
          percent: Number(s.percent) || 0,
        })),
        salesTypes: salesTypes.map(r => ({
          salesType: r.salesType,
          taxIds: r.taxIds,
          serviceIds: r.serviceIds,
          applyToAllProducts: r.applyToAllProducts,
          productGroups: r.applyToAllProducts ? [] : r.productGroups,
        })),
      })
      const cfg = normalizeConfig(saved, selectedCompanyId)
      setTaxes(cfg.taxes)
      setServices(cfg.services)
      setSalesTypes(cfg.salesTypes)
      setSavedHint('Saved. Open a POS check to see service / tax on the bill.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <MillstoneLoader size="md" layout="block" label="Loading tax & service…" className="mt-6" />
  }

  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-2xl">
          Define tax and service charge percentages, then attach them by sales type (Dine In /
          Takeaway / Delivery). New lines are attached to every sales type automatically — uncheck
          a sales type if it should not apply.
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          onClick={() => void save()}
          disabled={saving || selectedCompanyId <= 0}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {savedHint ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{savedHint}</p> : null}

      <ChargeSection
        title="Tax"
        rows={taxes}
        onAdd={() => addLine('tax')}
        onChange={(id, patch) => updateLine('tax', id, patch)}
        onRemove={id => removeLine('tax', id)}
        addLabel="+ Add tax"
      />
      <ChargeSection
        title="Service charge"
        rows={services}
        onAdd={() => addLine('service')}
        onChange={(id, patch) => updateLine('service', id, patch)}
        onRemove={id => removeLine('service', id)}
        addLabel="+ Add service"
      />

      <section className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Sales type attachment</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choose which tax and service apply for each sales type. Use All products when one rate
            covers the whole menu, or filter specific product groups.
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sales type">
          {SALES_TYPES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSalesType === id}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                activeSalesType === id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveSalesType(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2" role="tabpanel">
          <fieldset className="rounded-md border border-border p-2 space-y-1">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tax applied
            </legend>
            {taxes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a tax above first.</p>
            ) : (
              taxes.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={activeRule.taxIds.includes(t.id)}
                    onChange={() => toggleId(activeSalesType, 'taxIds', t.id)}
                  />
                  <span>
                    {t.name || 'Untitled'} ({formatPct(t.percent)})
                  </span>
                </label>
              ))
            )}
          </fieldset>
          <fieldset className="rounded-md border border-border p-2 space-y-1">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Service applied
            </legend>
            {services.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add a service above first.</p>
            ) : (
              services.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={activeRule.serviceIds.includes(s.id)}
                    onChange={() => toggleId(activeSalesType, 'serviceIds', s.id)}
                  />
                  <span>
                    {s.name || 'Untitled'} ({formatPct(s.percent)})
                  </span>
                </label>
              ))
            )}
          </fieldset>
        </div>

        <label className="flex items-start gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={activeRule.applyToAllProducts}
            onChange={e =>
              patchRule(activeSalesType, {
                applyToAllProducts: e.target.checked,
                productGroups: e.target.checked ? [] : activeRule.productGroups,
              })
            }
          />
          <span>
            <strong>All products</strong>
            <span className="text-muted-foreground">
              {' '}
              — apply selected tax / service % to every product for this sales type
            </span>
          </span>
        </label>

        {!activeRule.applyToAllProducts && (
          <fieldset className="rounded-md border border-border p-2 space-y-1">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Product groups
            </legend>
            {productGroups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No product groups in the catalog yet. Load products for this company first.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-40 overflow-auto">
                {productGroups.map(g => (
                  <label key={g} className="flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={activeRule.productGroups.includes(g)}
                      onChange={() => toggleGroup(activeSalesType, g)}
                    />
                    <span className="truncate">{g}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}
      </section>
    </div>
  )
}

function ChargeSection({
  title,
  rows,
  onAdd,
  onChange,
  onRemove,
  addLabel,
}: {
  title: string
  rows: PosTaxServiceChargeLine[]
  onAdd: () => void
  onChange: (id: string, patch: Partial<Pick<PosTaxServiceChargeLine, 'name' | 'percent'>>) => void
  onRemove: (id: string) => void
  addLabel: string
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
          onClick={onAdd}
        >
          {addLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None yet — use {addLabel} to create a line.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_72px_auto] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            <span>Name</span>
            <span>%</span>
            <span />
          </div>
          {rows.map(row => (
            <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_72px_auto] gap-2 items-center">
              <input
                type="text"
                className={inputCls}
                placeholder={`${title} name`}
                value={row.name}
                onChange={e => onChange(row.id, { name: e.target.value })}
                maxLength={80}
              />
              <input
                type="number"
                className={inputCls}
                min={0}
                max={100}
                step={0.01}
                value={row.percent}
                onChange={e => onChange(row.id, { percent: Number(e.target.value) })}
                aria-label={`${title} percent`}
              />
              <button
                type="button"
                className="rounded-md border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                onClick={() => onRemove(row.id)}
                aria-label={`Remove ${row.name || title}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
