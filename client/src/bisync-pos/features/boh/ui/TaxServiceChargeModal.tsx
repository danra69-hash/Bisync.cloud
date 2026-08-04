import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosTaxServiceChargeLine,
  type PosTaxServiceConfig,
  type PosTaxServiceSalesTypeRule,
} from '../../../../api'
import './TaxServiceChargeModal.css'

const SALES_TYPES: { id: string; label: string }[] = [
  { id: 'dine-in', label: 'Dine In' },
  { id: 'takeaway', label: 'Takeaway' },
  { id: 'delivery', label: 'Delivery' },
]

type Props = {
  companyId: number
  productGroups: string[]
  onClose: () => void
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
  const byType = new Map((raw?.salesTypes ?? []).map((r) => [r.salesType.toLowerCase(), r]))
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

export function TaxServiceChargeModal({ companyId, productGroups, onClose }: Props) {
  const [taxes, setTaxes] = useState<PosTaxServiceChargeLine[]>([])
  const [services, setServices] = useState<PosTaxServiceChargeLine[]>([])
  const [salesTypes, setSalesTypes] = useState<PosTaxServiceSalesTypeRule[]>(
    SALES_TYPES.map(({ id }) => emptyRule(id)),
  )
  const [activeSalesType, setActiveSalesType] = useState(SALES_TYPES[0].id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (companyId <= 0) {
      setLoading(false)
      setError('Select a company location first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const raw = await api.posTaxServiceConfig(companyId)
      const cfg = normalizeConfig(raw, companyId)
      setTaxes(cfg.taxes)
      setServices(cfg.services)
      setSalesTypes(cfg.salesTypes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax & service setup.')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeRule = useMemo(
    () => salesTypes.find((r) => r.salesType === activeSalesType) ?? emptyRule(activeSalesType),
    [salesTypes, activeSalesType],
  )

  const groupOptions = useMemo(() => {
    const set = new Set<string>()
    for (const g of productGroups) {
      const t = g.trim()
      if (t) set.add(t)
    }
    for (const r of salesTypes) {
      for (const g of r.productGroups) {
        const t = g.trim()
        if (t) set.add(t)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [productGroups, salesTypes])

  function updateLine(
    kind: 'tax' | 'service',
    id: string,
    patch: Partial<Pick<PosTaxServiceChargeLine, 'name' | 'percent'>>,
  ) {
    const setter = kind === 'tax' ? setTaxes : setServices
    setter((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addLine(kind: 'tax' | 'service') {
    const line: PosTaxServiceChargeLine = {
      id: newId(kind === 'tax' ? 'tax' : 'svc'),
      name: '',
      percent: 0,
    }
    if (kind === 'tax') setTaxes((rows) => [...rows, line])
    else setServices((rows) => [...rows, line])
  }

  function removeLine(kind: 'tax' | 'service', id: string) {
    if (kind === 'tax') {
      setTaxes((rows) => rows.filter((r) => r.id !== id))
      setSalesTypes((rules) =>
        rules.map((r) => ({ ...r, taxIds: r.taxIds.filter((x) => x !== id) })),
      )
    } else {
      setServices((rows) => rows.filter((r) => r.id !== id))
      setSalesTypes((rules) =>
        rules.map((r) => ({ ...r, serviceIds: r.serviceIds.filter((x) => x !== id) })),
      )
    }
  }

  function patchRule(salesType: string, patch: Partial<PosTaxServiceSalesTypeRule>) {
    setSalesTypes((rules) =>
      rules.map((r) => (r.salesType === salesType ? { ...r, ...patch } : r)),
    )
  }

  function toggleId(salesType: string, field: 'taxIds' | 'serviceIds', id: string) {
    setSalesTypes((rules) =>
      rules.map((r) => {
        if (r.salesType !== salesType) return r
        const list = r[field]
        const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
        return { ...r, [field]: next }
      }),
    )
  }

  function toggleGroup(salesType: string, group: string) {
    setSalesTypes((rules) =>
      rules.map((r) => {
        if (r.salesType !== salesType) return r
        const list = r.productGroups
        const next = list.includes(group) ? list.filter((x) => x !== group) : [...list, group]
        return { ...r, productGroups: next, applyToAllProducts: false }
      }),
    )
  }

  async function save() {
    if (companyId <= 0) return
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
    try {
      const saved = await api.savePosTaxServiceConfig({
        companyId,
        taxes: taxes.map((t) => ({
          id: t.id,
          name: t.name.trim(),
          percent: Number(t.percent) || 0,
        })),
        services: services.map((s) => ({
          id: s.id,
          name: s.name.trim(),
          percent: Number(s.percent) || 0,
        })),
        salesTypes: salesTypes.map((r) => ({
          salesType: r.salesType,
          taxIds: r.taxIds,
          serviceIds: r.serviceIds,
          applyToAllProducts: r.applyToAllProducts,
          productGroups: r.applyToAllProducts ? [] : r.productGroups,
        })),
      })
      const cfg = normalizeConfig(saved, companyId)
      setTaxes(cfg.taxes)
      setServices(cfg.services)
      setSalesTypes(cfg.salesTypes)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tax-svc-modal pos-setup-sheet" role="dialog" aria-modal="true" aria-labelledby="tax-svc-title">
      <button type="button" className="tax-svc-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="tax-svc-modal__card">
        <header className="tax-svc-modal__header">
          <div>
            <h2 id="tax-svc-title">Tax &amp; service charge</h2>
            <p>Define tax and service rates, then attach them by sales type and product group.</p>
          </div>
          <button type="button" className="tax-svc-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="tax-svc-modal__scroll">
          {loading ? (
            <p className="tax-svc-modal__status">Loading…</p>
          ) : (
            <>
              <ChargeSection
                title="Tax"
                rows={taxes}
                onAdd={() => addLine('tax')}
                onChange={(id, patch) => updateLine('tax', id, patch)}
                onRemove={(id) => removeLine('tax', id)}
                addLabel="+ Add tax"
              />
              <ChargeSection
                title="Service charge"
                rows={services}
                onAdd={() => addLine('service')}
                onChange={(id, patch) => updateLine('service', id, patch)}
                onRemove={(id) => removeLine('service', id)}
                addLabel="+ Add service"
              />

              <section className="tax-svc-block">
                <h3>Sales type attachment</h3>
                <p className="tax-svc-block__hint">
                  Choose which tax and service apply for each sales type. Use All products when one rate
                  covers the whole menu, or filter specific product groups.
                </p>
                <div className="tax-svc-tabs" role="tablist" aria-label="Sales type">
                  {SALES_TYPES.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={activeSalesType === id}
                      className={`tax-svc-tabs__btn${activeSalesType === id ? ' is-active' : ''}`}
                      onClick={() => setActiveSalesType(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="tax-svc-rule" role="tabpanel">
                  <div className="tax-svc-rule__cols">
                    <fieldset className="tax-svc-fieldset">
                      <legend>Tax applied</legend>
                      {taxes.length === 0 ? (
                        <p className="tax-svc-empty">Add a tax above first.</p>
                      ) : (
                        taxes.map((t) => (
                          <label key={t.id} className="tax-svc-check">
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
                    <fieldset className="tax-svc-fieldset">
                      <legend>Service applied</legend>
                      {services.length === 0 ? (
                        <p className="tax-svc-empty">Add a service above first.</p>
                      ) : (
                        services.map((s) => (
                          <label key={s.id} className="tax-svc-check">
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

                  <label className="tax-svc-check tax-svc-check--all">
                    <input
                      type="checkbox"
                      checked={activeRule.applyToAllProducts}
                      onChange={(e) =>
                        patchRule(activeSalesType, {
                          applyToAllProducts: e.target.checked,
                          productGroups: e.target.checked ? [] : activeRule.productGroups,
                        })
                      }
                    />
                    <span>
                      <strong>All products</strong>
                      <em> — apply selected tax / service % to every product for this sales type</em>
                    </span>
                  </label>

                  {!activeRule.applyToAllProducts && (
                    <fieldset className="tax-svc-fieldset">
                      <legend>Product groups</legend>
                      {groupOptions.length === 0 ? (
                        <p className="tax-svc-empty">
                          No product groups in the catalog yet. Load products or type groups after catalog sync.
                        </p>
                      ) : (
                        <div className="tax-svc-groups">
                          {groupOptions.map((g) => (
                            <label key={g} className="tax-svc-check">
                              <input
                                type="checkbox"
                                checked={activeRule.productGroups.includes(g)}
                                onChange={() => toggleGroup(activeSalesType, g)}
                              />
                              <span>{g}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  )}
                </div>
              </section>
            </>
          )}
          {error && <p className="tax-svc-modal__error">{error}</p>}
        </div>

        <footer className="tax-svc-modal__footer">
          <button type="button" className="tax-svc-btn tax-svc-btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="tax-svc-btn tax-svc-btn--primary"
            onClick={() => void save()}
            disabled={saving || loading || companyId <= 0}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function formatPct(n: number) {
  const v = Number(n) || 0
  return `${v % 1 === 0 ? v.toFixed(0) : String(v)}%`
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
    <section className="tax-svc-block">
      <div className="tax-svc-block__head">
        <h3>{title}</h3>
        <button type="button" className="tax-svc-btn tax-svc-btn--ghost" onClick={onAdd}>
          {addLabel}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="tax-svc-empty">None yet — use {addLabel} to create a line.</p>
      ) : (
        <div className="tax-svc-lines">
          <div className="tax-svc-lines__header" aria-hidden="true">
            <span>Name</span>
            <span>%</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="tax-svc-lines__row">
              <input
                type="text"
                className="tax-svc-input"
                placeholder={`${title} name`}
                value={row.name}
                onChange={(e) => onChange(row.id, { name: e.target.value })}
                maxLength={80}
              />
              <input
                type="number"
                className="tax-svc-input tax-svc-input--pct"
                min={0}
                max={100}
                step={0.01}
                value={row.percent}
                onChange={(e) => onChange(row.id, { percent: Number(e.target.value) })}
                aria-label={`${title} percent`}
              />
              <button
                type="button"
                className="tax-svc-btn tax-svc-btn--danger"
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
