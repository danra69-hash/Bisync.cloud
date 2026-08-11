import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  normalizePosGroupLabel,
  productMatchesPosGroupFilter,
  productMatchesPosMenu,
} from '../../data/posCatalog'
import { MillstoneLoader } from '../shared/MillstoneLoader'
import { TableScrollContainer } from '../shared/TableScrollContainer'
import {
  isAlcoholTaxLineName,
  listConfigCharges,
  resolveChargeType,
} from '../../bisync-pos/features/register/domain/taxServiceCharges'

type Props = {
  selectedCompanyId: number
  selectedLocationIds: string[]
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
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
          g => normalizePosGroupLabel(g) === normalizePosGroupLabel(p.group || ''),
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
 * Product list / Category · Group filters follow POS Menu (not raw RMS hierarchy).
 * Matrix and definition edits persist immediately (no Save button).
 */
export function PosTaxServiceChargeTab({
  selectedCompanyId,
  selectedLocationIds,
  products,
}: Props) {
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

  const skipPersistRef = useRef(true)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chargesRef = useRef(charges)
  const rulesRef = useRef(rulesByProductId)
  chargesRef.current = charges
  rulesRef.current = rulesByProductId

  /** Same sell list as POS Menu tab — linked catalog, not full RMS. */
  const menuProducts = useMemo(
    () =>
      products
        .filter(p => productMatchesPosMenu(p, selectedCompanyId, selectedLocationIds))
        .sort((a, b) => {
          const c = (a.category || '').localeCompare(b.category || '')
          if (c !== 0) return c
          const g = normalizePosGroupLabel(a.group || '').localeCompare(
            normalizePosGroupLabel(b.group || ''),
          )
          if (g !== 0) return g
          return a.name.localeCompare(b.name)
        }),
    [products, selectedCompanyId, selectedLocationIds],
  )

  const load = useCallback(async () => {
    if (selectedCompanyId <= 0) {
      setLoading(false)
      setError('Select a company first.')
      return
    }
    setLoading(true)
    setError(null)
    skipPersistRef.current = true
    try {
      const raw = await api.posTaxServiceConfig(selectedCompanyId)
      const menu = products.filter(p =>
        productMatchesPosMenu(p, selectedCompanyId, selectedLocationIds),
      )
      setCharges(normalizeChargesFromConfig(raw))
      setRulesByProductId(seedProductRules(menu, raw.productRules, raw))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax & service setup.')
    } finally {
      setLoading(false)
      requestAnimationFrame(() => {
        skipPersistRef.current = false
      })
    }
  }, [selectedCompanyId, selectedLocationIds, products])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setRulesByProductId(prev => {
      const next = new Map(prev)
      for (const p of menuProducts) {
        if (!next.has(p.id)) next.set(p.id, emptyRule(p.id))
      }
      for (const id of [...next.keys()]) {
        if (!menuProducts.some(p => p.id === id)) next.delete(id)
      }
      return next
    })
  }, [menuProducts])

  // Category / Group options from POS Menu products only (same approach as PosMenuPage).
  const categoryOptions = useMemo(
    () => ['All', ...uniqueSorted(menuProducts.map(p => p.category || ''))],
    [menuProducts],
  )

  const groupOptions = useMemo(() => {
    const scoped =
      filterCategory === 'All'
        ? menuProducts
        : menuProducts.filter(p => (p.category || '') === filterCategory)
    return [
      'All',
      ...uniqueSorted(scoped.map(p => normalizePosGroupLabel(p.group || ''))),
    ]
  }, [menuProducts, filterCategory])

  useEffect(() => {
    if (filterCategory !== 'All' && !categoryOptions.includes(filterCategory)) {
      setFilterCategory('All')
    }
  }, [filterCategory, categoryOptions])

  useEffect(() => {
    if (filterGroup !== 'All' && !groupOptions.includes(filterGroup)) {
      setFilterGroup('All')
    }
  }, [filterGroup, groupOptions])

  const sortedProducts = useMemo(() => {
    return menuProducts.filter(p => {
      if (filterCategory !== 'All' && (p.category || '') !== filterCategory) return false
      if (!productMatchesPosGroupFilter(p.group || '', filterGroup)) return false
      return true
    })
  }, [menuProducts, filterCategory, filterGroup])

  const persistNow = useCallback(
    async (
      nextCharges: PosTaxServiceChargeLine[],
      nextRules: Map<number, PosTaxServiceProductRule>,
    ) => {
      if (selectedCompanyId <= 0 || skipPersistRef.current) return
      for (let i = 0; i < nextCharges.length; i++) {
        if (!nextCharges[i].name.trim()) {
          setError(`Charge ${i + 1}: enter a name.`)
          return
        }
        if (
          Number.isNaN(nextCharges[i].percent)
          || nextCharges[i].percent < 0
          || nextCharges[i].percent > 100
        ) {
          setError(`Charge ${i + 1}: percent must be 0–100.`)
          return
        }
      }

      setSaving(true)
      setError(null)
      try {
        const productRules = menuProducts.map(
          p => nextRules.get(p.id) ?? emptyRule(p.id),
        )
        const payloadCharges = nextCharges.map(c => ({
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
        skipPersistRef.current = true
        setCharges(normalizeChargesFromConfig(saved))
        setRulesByProductId(seedProductRules(menuProducts, saved.productRules, saved))
        setSavedHint('Saved')
        requestAnimationFrame(() => {
          skipPersistRef.current = false
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save.')
      } finally {
        setSaving(false)
      }
    },
    [selectedCompanyId, menuProducts],
  )

  const schedulePersist = useCallback(
    (
      nextCharges: PosTaxServiceChargeLine[],
      nextRules: Map<number, PosTaxServiceProductRule>,
    ) => {
      chargesRef.current = nextCharges
      rulesRef.current = nextRules
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        void persistNow(chargesRef.current, rulesRef.current)
      }, 350)
    },
    [persistNow],
  )

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    }
  }, [])

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
    const nextCharges = draft.id
      ? charges.map(r =>
          r.id === draft.id
            ? { ...r, type: draft.type, name, percent }
            : r,
        )
      : [
          ...charges,
          {
            id: newId(draft.type === 'service' ? 'svc' : 'tax'),
            type: draft.type,
            name,
            percent,
          },
        ]
    setCharges(nextCharges)
    setEditorOpen(false)
    setSavedHint(null)
    setError(null)
    schedulePersist(nextCharges, rulesByProductId)
  }

  function removeCharge(id: string) {
    const nextCharges = charges.filter(r => r.id !== id)
    setCharges(nextCharges)
    if (draft.id === id) setEditorOpen(false)
    schedulePersist(nextCharges, rulesByProductId)
  }

  function toggleFlag(productId: number, channel: ChannelKey, flag: FlagKey) {
    const prev = rulesByProductId
    const next = new Map(prev)
    const current = next.get(productId) ?? emptyRule(productId)
    const channelFlags = { ...current[channel] }
    channelFlags[flag] = !channelFlags[flag]
    const enforced = enforceTaxMutex(channelFlags, flag)
    next.set(productId, { ...current, [channel]: enforced })
    setRulesByProductId(next)
    setSavedHint(null)
    schedulePersist(charges, next)
  }

  function setFlagForVisible(channel: ChannelKey, flag: FlagKey, checked: boolean) {
    const next = new Map(rulesByProductId)
    for (const product of sortedProducts) {
      const current = next.get(product.id) ?? emptyRule(product.id)
      const channelFlags = { ...current[channel], [flag]: checked }
      next.set(product.id, {
        ...current,
        [channel]: enforceTaxMutex(channelFlags, flag),
      })
    }
    setRulesByProductId(next)
    setSavedHint(null)
    schedulePersist(charges, next)
  }

  function columnCheckState(channel: ChannelKey, flag: FlagKey): {
    checked: boolean
    indeterminate: boolean
  } {
    if (sortedProducts.length === 0) return { checked: false, indeterminate: false }
    let on = 0
    for (const product of sortedProducts) {
      const rule = rulesByProductId.get(product.id) ?? emptyRule(product.id)
      if (rule[channel][flag]) on += 1
    }
    return {
      checked: on === sortedProducts.length,
      indeterminate: on > 0 && on < sortedProducts.length,
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
          Takeout, and Delivery. Products and Category / Group filters follow the POS Menu tab.
          Changes save automatically. Tax Regular and Tax Alcohol cannot both be selected for the
          same product under the same sales type.
        </p>
        {saving ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">Saving…</span>
        ) : savedHint ? (
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{savedHint}</span>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

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
              POS Menu products — Category · Group · Product Name, then Dine in / Takeout / Delivery.
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
                  FLAG_COLS.map(flag => {
                    const state = columnCheckState(ch.key, flag.key)
                    return (
                      <th
                        key={`${ch.key}-${flag.key}`}
                        className="px-1 py-1 text-center text-[10px] font-medium text-muted-foreground border-l border-border/70 whitespace-nowrap"
                      >
                        <label className="inline-flex flex-col items-center gap-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            aria-label={`Check all ${ch.label} ${flag.label}`}
                            checked={state.checked}
                            ref={el => {
                              if (el) el.indeterminate = state.indeterminate
                            }}
                            disabled={sortedProducts.length === 0}
                            onChange={e =>
                              setFlagForVisible(ch.key, flag.key, e.target.checked)
                            }
                          />
                          <span>{flag.label}</span>
                        </label>
                      </th>
                    )
                  }),
                )}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={3 + CHANNELS.length * 3} className="px-2 py-6 text-center text-muted-foreground">
                    No POS Menu products match the selected filters for this company.
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
                        {normalizePosGroupLabel(product.group || '') || '—'}
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
