import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type PosTaxServiceChannelFlags,
  type PosTaxServiceChargeLine,
  type PosTaxServiceChargeType,
  type PosTaxServiceConfig,
  type PosTaxServiceProductRule,
  type Product,
} from '../../api'
import { inputCls } from '../../data/countries'
import { getSiCategoryFilterOptions, getSiGroupFilterOptions } from '../../data/revenueManagement'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { TableScrollContainer } from '../shared/TableScrollContainer'
import {
  isAlcoholTaxLineName,
  listConfigCharges,
  resolveChargeType,
} from '../../bisync-pos/features/register/domain/taxServiceCharges'

type Props = {
  selectedCompanyId: number
  products: Product[]
}

type ChannelKey = 'dineIn' | 'takeaway' | 'delivery'
type FlagKey = keyof PosTaxServiceChannelFlags

type ChargeDraft = {
  id: string | null
  type: PosTaxServiceChargeType
  name: string
  percent: string
}

const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: 'dineIn', label: 'Dine in' },
  { key: 'takeaway', label: 'Takeout' },
  { key: 'delivery', label: 'Delivery' },
]

const FLAG_COLS: { key: FlagKey; label: string; isTax: boolean }[] = [
  { key: 'taxRegular', label: 'Tax Regular', isTax: true },
  { key: 'taxAlcohol', label: 'Tax Alcohol', isTax: true },
  { key: 'service', label: 'Service', isTax: false },
]

const CHARGE_TYPE_OPTIONS: { value: PosTaxServiceChargeType; label: string }[] = [
  { value: 'tax-regular', label: 'Tax Regular' },
  { value: 'tax-alcohol', label: 'Tax Alcohol' },
  { value: 'service', label: 'Service' },
]

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyFlags(): PosTaxServiceChannelFlags {
  return { taxRegular: false, taxAlcohol: false, service: false }
}

function emptyRule(productId: number): PosTaxServiceProductRule {
  return {
    productId,
    dineIn: emptyFlags(),
    takeaway: emptyFlags(),
    delivery: emptyFlags(),
  }
}

function enforceTaxMutex(flags: PosTaxServiceChannelFlags, toggled: FlagKey): PosTaxServiceChannelFlags {
  const next = { ...flags }
  if (toggled === 'taxRegular' && next.taxRegular) next.taxAlcohol = false
  if (toggled === 'taxAlcohol' && next.taxAlcohol) next.taxRegular = false
  return next
}

function formatPct(n: number) {
  const v = Number(n) || 0
  return `${v % 1 === 0 ? v.toFixed(0) : String(v)}%`
}

function chargeTypeLabel(type: PosTaxServiceChargeType) {
  return CHARGE_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

function normalizeChargesFromConfig(raw: PosTaxServiceConfig | null): PosTaxServiceChargeLine[] {
  return listConfigCharges(raw).map(c => ({
    id: c.id,
    name: c.name,
    percent: Number(c.percent) || 0,
    type: resolveChargeType(c),
  }))
}

function seedProductRules(
  products: Product[],
  saved: PosTaxServiceProductRule[] | undefined,
  config: PosTaxServiceConfig | null,
): Map<number, PosTaxServiceProductRule> {
  const map = new Map<number, PosTaxServiceProductRule>()
  for (const p of products) {
    map.set(p.id, emptyRule(p.id))
  }

  if (saved && saved.length > 0) {
    for (const rule of saved) {
      if (!map.has(rule.productId)) continue
      map.set(rule.productId, {
        productId: rule.productId,
        dineIn: enforceTaxMutex(
          {
            taxRegular: !!rule.dineIn?.taxRegular,
            taxAlcohol: !!rule.dineIn?.taxAlcohol,
            service: !!rule.dineIn?.service,
          },
          rule.dineIn?.taxAlcohol ? 'taxAlcohol' : 'taxRegular',
        ),
        takeaway: enforceTaxMutex(
          {
            taxRegular: !!rule.takeaway?.taxRegular,
            taxAlcohol: !!rule.takeaway?.taxAlcohol,
            service: !!rule.takeaway?.service,
          },
          rule.takeaway?.taxAlcohol ? 'taxAlcohol' : 'taxRegular',
        ),
        delivery: enforceTaxMutex(
          {
            taxRegular: !!rule.delivery?.taxRegular,
            taxAlcohol: !!rule.delivery?.taxAlcohol,
            service: !!rule.delivery?.service,
          },
          rule.delivery?.taxAlcohol ? 'taxAlcohol' : 'taxRegular',
        ),
      })
    }
    return map
  }

  // Migrate legacy sales-type + group rules into the product matrix once.
  if (!config) return map
  const charges = normalizeChargesFromConfig(config)
  const hasRegular = charges.some(c => resolveChargeType(c) === 'tax-regular' && c.percent > 0)
  const hasAlcohol = charges.some(c => resolveChargeType(c) === 'tax-alcohol' && c.percent > 0)
  const hasService = charges.some(c => resolveChargeType(c) === 'service' && c.percent > 0)
  if (!hasRegular && !hasAlcohol && !hasService) return map

  for (const sales of config.salesTypes ?? []) {
    const channel: ChannelKey =
      sales.salesType === 'takeaway' || sales.salesType === 'takeout'
        ? 'takeaway'
        : sales.salesType === 'delivery'
          ? 'delivery'
          : 'dineIn'
    const taxIds = new Set(sales.taxIds ?? [])
    const serviceIds = new Set(sales.serviceIds ?? [])
    const applyTaxRegular =
      hasRegular
      && charges.some(
        c => taxIds.has(c.id) && resolveChargeType(c) === 'tax-regular',
      )
    const applyTaxAlcohol =
      hasAlcohol
      && charges.some(
        c =>
          taxIds.has(c.id)
          && (resolveChargeType(c) === 'tax-alcohol' || isAlcoholTaxLineName(c.name)),
      )
    const applyService =
      hasService && charges.some(c => serviceIds.has(c.id) && resolveChargeType(c) === 'service')

    // Incomplete legacy: lines exist but nothing attached — treat as all-on for dine-in.
    const unattached =
      (config.salesTypes ?? []).every(
        r => (r.taxIds ?? []).length === 0 && (r.serviceIds ?? []).length === 0,
      )
    const forceAll = unattached && channel === 'dineIn'

    for (const p of products) {
      const included =
        forceAll
        || sales.applyToAllProducts !== false
        || (sales.productGroups ?? []).some(
          g => g.trim().toLowerCase() === (p.group || '').trim().toLowerCase(),
        )
      if (!included) continue
      const current = map.get(p.id) ?? emptyRule(p.id)
      const alcoholProduct = /alcohol|beer|wine|spirit|liquor|cocktail/i.test(
        `${p.group} ${p.name}`,
      )
      let taxRegular = forceAll ? hasRegular : applyTaxRegular
      let taxAlcohol = forceAll ? hasAlcohol : applyTaxAlcohol
      if (taxRegular && taxAlcohol) {
        if (alcoholProduct) taxRegular = false
        else taxAlcohol = false
      }
      const flags = enforceTaxMutex(
        {
          taxRegular,
          taxAlcohol,
          service: forceAll ? hasService : applyService,
        },
        taxAlcohol ? 'taxAlcohol' : 'taxRegular',
      )
      map.set(p.id, { ...current, [channel]: flags })
    }
  }
  return map
}

/**
 * POS Config → Tax & Service Charge tab.
 * Charge definitions (type / name / %) + per-product Dine-in / Takeout / Delivery flags.
 */
export function PosTaxServiceChargeTab({ selectedCompanyId, products }: Props) {
  const [charges, setCharges] = useState<PosTaxServiceChargeLine[]>([])
  const [rulesByProductId, setRulesByProductId] = useState<Map<number, PosTaxServiceProductRule>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [filterGroup, setFilterGroup] = useState('All')
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<ChargeDraft>({
    id: null,
    type: 'tax-regular',
    name: '',
    percent: '0',
  })

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
      setCharges(normalizeChargesFromConfig(raw))
      setRulesByProductId(seedProductRules(products, raw.productRules, raw))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax & service setup.')
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId, products])

  useEffect(() => {
    void load()
  }, [load])

  // Keep matrix rows in sync when the product catalog refreshes.
  useEffect(() => {
    setRulesByProductId(prev => {
      const next = new Map(prev)
      for (const p of products) {
        if (!next.has(p.id)) next.set(p.id, emptyRule(p.id))
      }
      for (const id of [...next.keys()]) {
        if (!products.some(p => p.id === id)) next.delete(id)
      }
      return next
    })
  }, [products])

  const categoryOptions = useMemo(
    () => getSiCategoryFilterOptions(products.map(p => p.category || '')),
    [products],
  )

  const groupOptions = useMemo(() => {
    const scoped =
      filterCategory === 'All'
        ? products
        : products.filter(p => (p.category || '') === filterCategory)
    return getSiGroupFilterOptions(
      scoped.map(p => p.group || ''),
      filterCategory,
    )
  }, [products, filterCategory])

  const sortedProducts = useMemo(() => {
    return [...products]
      .filter(p => {
        if (filterCategory !== 'All' && (p.category || '') !== filterCategory) return false
        if (filterGroup !== 'All' && (p.group || '') !== filterGroup) return false
        return true
      })
      .sort((a, b) => {
        const c = (a.category || '').localeCompare(b.category || '')
        if (c !== 0) return c
        const g = (a.group || '').localeCompare(b.group || '')
        if (g !== 0) return g
        return a.name.localeCompare(b.name)
      })
  }, [products, filterCategory, filterGroup])

  function openCreate() {
    setDraft({ id: null, type: 'tax-regular', name: '', percent: '0' })
    setEditorOpen(true)
    setError(null)
  }

  function openEdit(line: PosTaxServiceChargeLine) {
    setDraft({
      id: line.id,
      type: resolveChargeType(line),
      name: line.name,
      percent: String(line.percent ?? 0),
    })
    setEditorOpen(true)
    setError(null)
  }

  function saveDraft() {
    const name = draft.name.trim()
    if (!name) {
      setError('Enter a name for the tax or service charge.')
      return
    }
    const percent = Number(draft.percent)
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      setError('Percent must be between 0 and 100.')
      return
    }
    setCharges(rows => {
      if (draft.id) {
        return rows.map(r =>
          r.id === draft.id
            ? { ...r, type: draft.type, name, percent }
            : r,
        )
      }
      return [
        ...rows,
        {
          id: newId(draft.type === 'service' ? 'svc' : 'tax'),
          type: draft.type,
          name,
          percent,
        },
      ]
    })
    setEditorOpen(false)
    setSavedHint(null)
    setError(null)
  }

  function removeCharge(id: string) {
    setCharges(rows => rows.filter(r => r.id !== id))
    if (draft.id === id) setEditorOpen(false)
  }

  function toggleFlag(productId: number, channel: ChannelKey, flag: FlagKey) {
    setRulesByProductId(prev => {
      const next = new Map(prev)
      const current = next.get(productId) ?? emptyRule(productId)
      const channelFlags = { ...current[channel] }
      channelFlags[flag] = !channelFlags[flag]
      const enforced = enforceTaxMutex(channelFlags, flag)
      next.set(productId, { ...current, [channel]: enforced })
      return next
    })
    setSavedHint(null)
  }

  async function save() {
    if (selectedCompanyId <= 0) return
    for (let i = 0; i < charges.length; i++) {
      if (!charges[i].name.trim()) {
        setError(`Charge ${i + 1}: enter a name.`)
        return
      }
      if (
        Number.isNaN(charges[i].percent)
        || charges[i].percent < 0
        || charges[i].percent > 100
      ) {
        setError(`Charge ${i + 1}: percent must be 0–100.`)
        return
      }
    }

    setSaving(true)
    setError(null)
    setSavedHint(null)
    try {
      const productRules = products.map(p => rulesByProductId.get(p.id) ?? emptyRule(p.id))
      const payloadCharges = charges.map(c => ({
        id: c.id,
        name: c.name.trim(),
        percent: Number(c.percent) || 0,
        type: resolveChargeType(c),
      }))
      const saved = await api.savePosTaxServiceConfig({
        companyId: selectedCompanyId,
        charges: payloadCharges,
        productRules,
      })
      setCharges(normalizeChargesFromConfig(saved))
      setRulesByProductId(seedProductRules(products, saved.productRules, saved))
      setSavedHint('Saved. Open a POS check — tax / service apply from the product matrix by sales type.')
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
        <p className="text-xs text-muted-foreground max-w-3xl">
          Define tax and service charge rates, then tick which apply per product for Dine in,
          Takeout, and Delivery. Tax Regular and Tax Alcohol cannot both be selected for the same
          product under the same sales type.
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

      <section className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-foreground">Tax &amp; service definitions</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Create or edit a charge: type, name, and percent. Ticking a column on the product
              table applies every definition of that type.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted"
            onClick={openCreate}
          >
            Create / Edit
          </button>
        </div>

        {charges.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No charges yet — use Create / Edit to add Tax Regular, Tax Alcohol, or Service.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">Type</th>
                  <th className="py-1 pr-2 font-semibold">Name</th>
                  <th className="py-1 pr-2 font-semibold">%</th>
                  <th className="py-1 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {charges.map(line => (
                  <tr key={line.id} className="border-t border-border/60">
                    <td className="py-1.5 pr-2 text-foreground">
                      {chargeTypeLabel(resolveChargeType(line))}
                    </td>
                    <td className="py-1.5 pr-2 text-foreground">{line.name || '—'}</td>
                    <td className="py-1.5 pr-2 text-foreground">{formatPct(line.percent)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted mr-1"
                        onClick={() => openEdit(line)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded border border-destructive/40 px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
                        onClick={() => removeCharge(line.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editorOpen ? (
          <div className="rounded-md border border-border bg-background p-3 space-y-2">
            <h4 className="text-xs font-semibold text-foreground">
              {draft.id ? 'Edit charge' : 'Create charge'}
            </h4>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span>Type</span>
                <select
                  className={inputCls}
                  value={draft.type}
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      type: e.target.value as PosTaxServiceChargeType,
                    }))
                  }
                >
                  {CHARGE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground space-y-1 sm:col-span-1">
                <span>Name</span>
                <input
                  type="text"
                  className={inputCls}
                  value={draft.name}
                  maxLength={80}
                  placeholder="e.g. GST / Service charge"
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span>%</span>
                <input
                  type="number"
                  className={inputCls}
                  min={0}
                  max={100}
                  step={0.01}
                  value={draft.percent}
                  onChange={e => setDraft(d => ({ ...d, percent: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                onClick={saveDraft}
              >
                {draft.id ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-foreground">Product assignment</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Category · Group · Product Name, then Dine in / Takeout / Delivery checkboxes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-[11px] text-muted-foreground space-y-0.5">
              <span>Category</span>
              <select
                className={inputCls}
                value={filterCategory}
                onChange={e => {
                  setFilterCategory(e.target.value)
                  setFilterGroup('All')
                }}
              >
                {categoryOptions.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-muted-foreground space-y-0.5">
              <span>Group</span>
              <select
                className={inputCls}
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
              >
                {groupOptions.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <TableScrollContainer tableId="pos-tax-service-product-matrix" showColumnAdjust={false}>
          <table className="w-full min-w-[1100px] text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th rowSpan={2} className="sticky left-0 z-10 bg-muted/40 px-2 py-2 text-left font-semibold text-foreground">
                  Category
                </th>
                <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-foreground">
                  Group
                </th>
                <th rowSpan={2} className="px-2 py-2 text-left font-semibold text-foreground min-w-[140px]">
                  Product Name
                </th>
                {CHANNELS.map(ch => (
                  <th
                    key={ch.key}
                    colSpan={3}
                    className="px-2 py-1 text-center font-semibold text-foreground border-l border-border"
                  >
                    {ch.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/30">
                {CHANNELS.map(ch =>
                  FLAG_COLS.map(flag => (
                    <th
                      key={`${ch.key}-${flag.key}`}
                      className="px-1 py-1 text-center text-[10px] font-medium text-muted-foreground border-l border-border/70 whitespace-nowrap"
                    >
                      {flag.label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={3 + CHANNELS.length * 3} className="px-2 py-6 text-center text-muted-foreground">
                    No products match the selected filters for this company.
                  </td>
                </tr>
              ) : (
                sortedProducts.map(product => {
                  const rule = rulesByProductId.get(product.id) ?? emptyRule(product.id)
                  return (
                    <tr key={product.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1.5 text-foreground whitespace-nowrap">
                        {product.category || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-foreground whitespace-nowrap">
                        {product.group || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-foreground">{product.name}</td>
                      {CHANNELS.map(ch =>
                        FLAG_COLS.map(flag => {
                          const checked = !!rule[ch.key][flag.key]
                          return (
                            <td
                              key={`${product.id}-${ch.key}-${flag.key}`}
                              className="px-1 py-1 text-center border-l border-border/40"
                            >
                              <input
                                type="checkbox"
                                aria-label={`${product.name} ${ch.label} ${flag.label}`}
                                checked={checked}
                                onChange={() => toggleFlag(product.id, ch.key, flag.key)}
                              />
                            </td>
                          )
                        }),
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      </section>
    </div>
  )
}
