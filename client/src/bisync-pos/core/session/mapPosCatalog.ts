import type { Product as ApiProduct } from '../../../api'
import { resolvePosMenuRrp } from '../../../data/posCatalog'
import {
  calcWeightUnitRrp,
  parseVariableMode,
  parseVariableOptionsJson,
} from '../../../data/productVariable'
import type {
  Product as PosProduct,
  ProductDepartment,
} from '../../features/register/domain/types'

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
): PosProduct[] {
  const rows: PosProduct[] = []
  for (const product of apiProducts) {
    const rrp = resolvePosMenuRrp(product, catalogProducts)
    if (rrp <= 0) continue
    const group = (product.group || product.category || 'General').trim() || 'General'
    const department = mapDepartment(product.category || '', group)

    const isWeight =
      Boolean(product.isVariableProduct)
      && parseVariableMode(product.variableMode) === 'weight'
    let priceCents = Math.round(rrp * 100)
    let pricedByWeight = false
    let weightUom: string | undefined
    let weightQty: number | undefined

    if (isWeight) {
      const cfg = parseVariableOptionsJson(product.variableOptionsJson, 'weight')
      const qty = (product.variableChoiceQty && product.variableChoiceQty > 0)
        ? product.variableChoiceQty
        : cfg.choiceQty
      if (!(qty > 0) || !cfg.weightUom) continue
      const unitRrp = calcWeightUnitRrp(rrp, qty)
      if (!(unitRrp > 0)) continue
      pricedByWeight = true
      weightUom = cfg.weightUom
      weightQty = qty
      // Cart uses quantity = entered weight; price is per 1 weight UOM.
      priceCents = Math.round(unitRrp * 100)
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
