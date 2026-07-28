import type { Product as ApiProduct } from '../../../api'
import { resolvePosMenuRrp } from '../../../data/posCatalog'
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
  return apiProducts
    .map(product => {
      const rrp = resolvePosMenuRrp(product, catalogProducts)
      if (rrp <= 0) return null
      const group = (product.group || product.category || 'General').trim() || 'General'
      const department = mapDepartment(product.category || '', group)
      return {
        id: String(product.id),
        sku: product.productId || String(product.id),
        name: product.name,
        priceCents: Math.round(rrp * 100),
        department,
        group,
        emoji: pickEmoji(product.name),
        accent: pickAccent(product.name),
      } satisfies PosProduct
    })
    .filter((row): row is PosProduct => row != null)
    .sort((a, b) => a.name.localeCompare(b.name))
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
