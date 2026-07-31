import type { Product as ApiProduct } from '../../../api'
import { resolvePosMenuRrp, resolvePosMenuSellPrice } from '../../../data/posCatalog'
import {
  calcWeightUnitRrp,
  parseVariableMode,
  parseVariableOptionsJson,
} from '../../../data/productVariable'
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
    const group = (product.group || product.category || 'General').trim() || 'General'
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
  const groupsByDepartment = {} as Record<ProductDepartment, string[]>
  for (const dept of departments) {
    groupsByDepartment[dept] = [...(byDept.get(dept) ?? [])].sort((a, b) =>
      a.localeCompare(b),
    )
  }
  return { departments, groupsByDepartment }
}
