import type { Product as ApiProduct } from '../../../api'
import { resolvePosMenuRrp, resolvePosMenuSellPrice } from '../../../data/posCatalog'
import {
  calcWeightUnitRrp,
  parseVariableMode,
  parseVariableOptionsJson,
} from '../../../data/productVariable'
import {
  hasConfiguredVariableComponentSlots,
  parseVariableComponentOptionsJson,
} from '../../../data/productVariableComponent'
import type {
  Product as PosProduct,
  ProductDepartment,
} from '../../features/register/domain/types'

export type PosPromoRppMap = ReadonlyMap<number, number> | Record<number, number> | null | undefined

const ACCENTS = [
  '#dcfce7',
  '#ffedd5',
  '#ecfccb',
  '#fef3c7',
  '#fee2e2',
  '#e0f2fe',
  '#fce7f3',
  '#f3e8ff',
  '#fef9c3',
  '#ccfbf1',
]

const EMOJIS = ['🍽️', '🥗', '🍕', '🍔', '🍜', '🍰', '🍺', '☕', '🧃', '🍤', '🥩', '🧀']

function pickAccent(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}

function pickEmoji(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 17 + seed.charCodeAt(i)) >>> 0
  return EMOJIS[hash % EMOJIS.length]
}

function mapDepartment(category: string, group: string): ProductDepartment {
  const raw = `${category} ${group}`.toLowerCase()
  if (/(drink|beverage|beer|wine|coffee|juice|soft)/.test(raw)) return 'Beverage'
  if (/(retail|merch|gift)/.test(raw)) return 'Retail'
  return 'Food'
}

/** Collapse synonym product groups so POS tabs do not split the same menu. */
export function normalizePosGroupLabel(group: string): string {
  const trimmed = group.trim()
  if (!trimmed) return 'General'
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ')
  if (
    key === 'beer draft'
    || key === 'draft beer'
    || key === 'draught beer'
    || key === 'draft'
    || key === 'draught'
  ) {
    return 'Draught Beer'
  }
  if (key === 'bottle beer' || key === 'bottled beer' || key === 'beer bottle') {
    return 'Bottled Beer'
  }
  return trimmed
}

/** Map Bisync.cloud POS menu products into Bisync POS register catalog rows. */
export function mapApiProductsToPosCatalog(
  apiProducts: ApiProduct[],
  catalogProducts: ApiProduct[] = apiProducts,
  promoRppByProductId?: PosPromoRppMap,
): PosProduct[] {
  const rows: PosProduct[] = []
  for (const product of apiProducts) {
    const baseRrp = resolvePosMenuRrp(product, catalogProducts)
    if (baseRrp <= 0) continue
    const sellPrice = resolvePosMenuSellPrice(product, catalogProducts, promoRppByProductId)
    if (!(sellPrice >= 0)) continue
    const group = normalizePosGroupLabel(product.group || product.category || 'General')
    const department = mapDepartment(product.category || '', group)

    const isVariable = Boolean(product.isVariableProduct)
    const mode = isVariable ? parseVariableMode(product.variableMode) : undefined
    const cfg = isVariable
      ? parseVariableOptionsJson(product.variableOptionsJson, mode)
      : null

    let priceCents = Math.round(sellPrice * 100)
    let pricedByWeight = false
    let weightUom: string | undefined
    let weightQty: number | undefined

    if (mode === 'weight' && cfg) {
      const qty = (product.variableChoiceQty && product.variableChoiceQty > 0)
        ? product.variableChoiceQty
        : cfg.choiceQty
      if (!(qty > 0) || !cfg.weightUom) continue
      const unitPrice = calcWeightUnitRrp(sellPrice, qty)
      if (!(unitPrice > 0)) continue
      pricedByWeight = true
      weightUom = cfg.weightUom
      weightQty = qty
      // Cart uses quantity = entered weight; price is per 1 weight UOM.
      priceCents = Math.round(unitPrice * 100)
    }

    const vcConfig = product.isVariableComponent
      ? parseVariableComponentOptionsJson(product.variableComponentOptionsJson)
      : null
    const variableComponentSlots = vcConfig && hasConfiguredVariableComponentSlots(vcConfig)
      ? vcConfig.slots.filter(s => s.alternatives.length > 0)
      : undefined

    rows.push({
      id: String(product.id),
      sku: product.productId || String(product.id),
      name: product.name,
      priceCents,
      department,
      group,
      emoji: pickEmoji(product.name),
      accent: pickAccent(product.name),
      pricedByWeight,
      weightUom,
      weightQty,
      variableMode: mode,
      choiceQty: mode === 'combination'
        ? ((product.variableChoiceQty && product.variableChoiceQty > 0)
          ? product.variableChoiceQty
          : cfg?.choiceQty)
        : cfg?.choiceQty,
      combinationOptions: mode === 'combination' ? cfg?.combinationOptions : undefined,
      isVariableComponent: Boolean(variableComponentSlots?.length),
      variableComponentSlots,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export function buildDepartmentGroups(catalog: PosProduct[]): {
  departments: ProductDepartment[]
  groupsByDepartment: Record<ProductDepartment, string[]>
} {
  const byDept = new Map<ProductDepartment, Set<string>>()
  for (const product of catalog) {
    const set = byDept.get(product.department) ?? new Set<string>()
    set.add(product.group)
    byDept.set(product.department, set)
  }
  const departments = (['Food', 'Beverage', 'Retail'] as ProductDepartment[]).filter(
    d => (byDept.get(d)?.size ?? 0) > 0,
  )
  const countByDeptGroup = new Map<string, number>()
  for (const product of catalog) {
    const key = `${product.department}\0${product.group}`
    countByDeptGroup.set(key, (countByDeptGroup.get(key) ?? 0) + 1)
  }

  const groupsByDepartment = {} as Record<ProductDepartment, string[]>
  for (const dept of departments) {
    groupsByDepartment[dept] = [...(byDept.get(dept) ?? [])].sort((a, b) => {
      const countDiff =
        (countByDeptGroup.get(`${dept}\0${b}`) ?? 0)
        - (countByDeptGroup.get(`${dept}\0${a}`) ?? 0)
      if (countDiff !== 0) return countDiff
      return a.localeCompare(b)
    })
  }
  return { departments, groupsByDepartment }
}
