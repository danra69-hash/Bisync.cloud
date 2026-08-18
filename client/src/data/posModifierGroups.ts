import type { PosModifierGroup, PosModifierKind, PosModifierOption } from '../api'
import type { ModifierGroup, ModifierOption } from '../bisync-pos/features/order/domain/ordering'
import {
  BEVERAGE_MODIFIER_GROUPS,
  FOOD_MODIFIER_GROUPS,
} from '../bisync-pos/features/order/domain/ordering'
import { normalizePosGroupLabel, productMatchesPosGroupFilter } from './posCatalog'
import {
  newVariableComponentKey,
  type VariableComponentSlot,
} from './productVariableComponent'

export const POS_MODIFIER_KINDS: Array<{
  id: PosModifierKind
  label: string
  hint: string
}> = [
  {
    id: 'compulsory',
    label: 'Compulsory Modifier',
    hint: 'Shown in sequence when the product is selected. Guest must choose before the order continues. Optionally Affects Stock so linked components/products deplete on POS.',
  },
  {
    id: 'food',
    label: 'Food Modifier',
    hint: 'Optional food notes / add-ons. Tie options to a component or product when Affects Stock is on so POS can deplete them.',
  },
  {
    id: 'beverage',
    label: 'Beverage Modifier',
    hint: 'Optional drink notes / add-ons. Tie options to a component or product when Affects Stock is on so POS can deplete them.',
  },
  {
    id: 'component-swap',
    label: 'Component SWAP',
    hint: 'Swappable pairs from RMS Variable Component (e.g. Base Garlic Mash → Fries). Use Inherit Component SWAP to refresh.',
  },
]

export const STOCK_PRODUCT_GROUP_BY_KIND: Partial<Record<PosModifierKind, string>> = {
  food: 'Food Modifier',
  beverage: 'Beverage Modifier',
  'component-swap': 'Component SWAP',
}

export function kindLabel(kind: string): string {
  return POS_MODIFIER_KINDS.find(k => k.id === kind)?.label ?? kind
}

export function groupsMatchName(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

/** Match POS product groups after synonym normalize (Draft Beer ↔ Draught Beer). */
export function groupsMatchPosLabel(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizePosGroupLabel(a || '') === normalizePosGroupLabel(b || '')
}

/**
 * Infer Food / Beverage / Retail the same way the register catalog does.
 * Used when RMS category is blank so attach UI can still filter wine/beer.
 */
export function inferPosDepartment(
  category: string | null | undefined,
  group: string | null | undefined,
): 'Food' | 'Beverage' | 'Retail' {
  const raw = `${category || ''} ${group || ''}`.toLowerCase()
  if (/(drink|beverage|beer|wine|coffee|juice|soft)/.test(raw)) return 'Beverage'
  if (/(retail|merch|gift)/.test(raw)) return 'Retail'
  return 'Food'
}

export type ModifierAttachProduct = {
  id: string | number
  category?: string | null
  group?: string | null
  /** POS department (Food / Beverage / Retail) — used when category is blank. */
  department?: string | null
}

/** Category filter for modifier attach UI: match product.category or inferred department. */
export function productMatchesModifierAttachCategory(
  product: Pick<ModifierAttachProduct, 'category' | 'group' | 'department'>,
  categoryFilter: string | null | undefined,
): boolean {
  const category = (categoryFilter || '').trim()
  if (!category) return true
  const productCategory = (product.category || '').trim()
  const productDepartment = (product.department || '').trim()
    || inferPosDepartment(productCategory, product.group)
  return (
    groupsMatchName(category, productCategory)
    || groupsMatchName(category, productDepartment)
  )
}

/** Category ∧ group filters for the modifier-group detail Product dropdown. */
export function productMatchesModifierAttachFilters(
  product: Pick<ModifierAttachProduct, 'category' | 'group' | 'department'>,
  categoryFilter: string | null | undefined,
  groupFilter: string | null | undefined,
): boolean {
  if (!productMatchesModifierAttachCategory(product, categoryFilter)) return false
  const group = (groupFilter || '').trim()
  if (!group) return true
  return productMatchesPosGroupFilter(product.group || '', group)
}

/** Unique POS categories (+ inferred departments) from live products — not SI hierarchy. */
export function listModifierAttachCategories(
  products: Array<Pick<ModifierAttachProduct, 'category' | 'group'>>,
): string[] {
  const set = new Set<string>()
  for (const p of products) {
    const cat = (p.category || '').trim()
    if (cat) set.add(cat)
    set.add(inferPosDepartment(cat, p.group))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Unique POS product groups for attach UI, filtered by category, with synonym collapse. */
export function listModifierAttachGroups(
  products: Array<Pick<ModifierAttachProduct, 'category' | 'group' | 'department'>>,
  categoryFilter: string | null | undefined,
): string[] {
  const byKey = new Map<string, string>()
  for (const p of products) {
    if (!productMatchesModifierAttachCategory(p, categoryFilter)) continue
    const raw = (p.group || '').trim()
    if (!raw) continue
    const label = normalizePosGroupLabel(raw)
    const key = label.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, label)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** Hierarchical attach match: Category ∧ Product Group ∧ Product (empty = All). */
export function attachmentMatchesProduct(
  attachment: {
    targetType?: string
    targetProductCategory?: string | null
    targetProductGroup?: string | null
    targetProductId?: number | null
  },
  product: ModifierAttachProduct,
): boolean {
  const category = (attachment.targetProductCategory || '').trim()
  const group = (attachment.targetProductGroup || '').trim()
  const productId = attachment.targetProductId != null && Number(attachment.targetProductId) > 0
    ? Number(attachment.targetProductId)
    : null
  const type = (attachment.targetType || '').trim().toLowerCase()

  if (!category && !group && productId == null) {
    // Legacy rows that only set targetType without filled fields cannot match.
    return false
  }

  if (productId != null) {
    if (Number(product.id) !== productId) return false
  } else if (type === 'product') {
    return false
  }

  if (group) {
    if (!groupsMatchPosLabel(group, product.group)) return false
  } else if (type === 'product-group' && !category) {
    return false
  }

  if (category) {
    if (!productMatchesModifierAttachCategory(product, category)) return false
  } else if (type === 'category') {
    return false
  }

  return true
}

/** Modifier groups attached to a product (by category, product group, and/or product id). */
export function resolveAttachedModifierGroups(
  all: PosModifierGroup[],
  product: ModifierAttachProduct,
  kind?: PosModifierKind | string,
): PosModifierGroup[] {
  return all
    .filter(g => g.active)
    .filter(g => !kind || g.kind === kind)
    .filter(g => (g.attachments ?? []).some(a => attachmentMatchesProduct(a, product)))
    .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
}

/**
 * Groups that must be answered when a product is added on register:
 * Compulsory kind, plus any attached Food/Beverage group marked required
 * (e.g. Glass for Tower).
 */
export function resolveRequiredModifierGroups(
  all: PosModifierGroup[],
  product: ModifierAttachProduct,
): PosModifierGroup[] {
  const byId = new Map<number, PosModifierGroup>()
  for (const g of resolveAttachedModifierGroups(all, product, 'compulsory')) {
    byId.set(g.id, g)
  }
  for (const kind of ['food', 'beverage'] as const) {
    for (const g of resolveAttachedModifierGroups(all, product, kind)) {
      if (g.required) byId.set(g.id, g)
    }
  }
  return [...byId.values()].sort(
    (a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name),
  )
}

export function toPickerGroups(groups: PosModifierGroup[]): ModifierGroup[] {
  return groups.map(g => ({
    id: `pmg-${g.id}`,
    name: g.name,
    required: g.required || g.kind === 'compulsory',
    options: (g.options ?? [])
      .filter(o => o && o.active !== false)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map(toPickerOption)
      .filter(o => o.label),
  }))
}

function toPickerOption(o: PosModifierOption): ModifierOption {
  const cents = Number(o.extraChargeCents) || 0
  return {
    id: `pmo-${o.id}`,
    label: (o.label || '').trim(),
    priceCents: cents > 0 ? cents : undefined,
  }
}

/**
 * Food/Beverage toolbar picker groups for the selected product.
 * Prefer groups attached to this product. If none match, show unscoped groups
 * (no attachments) of that kind. Never dump every scoped group company-wide
 * (e.g. Glass for Tower stays off Earl Grey).
 */
export function resolveToolbarModifierGroups(
  all: PosModifierGroup[],
  kind: 'food' | 'beverage',
  product?: ModifierAttachProduct | null,
): ModifierGroup[] {
  if (product) {
    const attached = resolveAttachedModifierGroups(all, product, kind)
    if (attached.length > 0) return toPickerGroups(attached)

    const unscoped = all
      .filter(g => g.active && g.kind === kind)
      .filter(g => (g.attachments ?? []).length === 0)
      .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
    if (unscoped.length > 0) return toPickerGroups(unscoped)

    const anyConfigured = all.some(g => g.active && g.kind === kind)
    if (anyConfigured) return []
    return kind === 'food' ? FOOD_MODIFIER_GROUPS : BEVERAGE_MODIFIER_GROUPS
  }
  const anyOfKind = all
    .filter(g => g.active && g.kind === kind)
    .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
  if (anyOfKind.length > 0) return toPickerGroups(anyOfKind)
  return kind === 'food' ? FOOD_MODIFIER_GROUPS : BEVERAGE_MODIFIER_GROUPS
}

export function formatCompulsorySummary(
  all: PosModifierGroup[],
  product: ModifierAttachProduct,
): string {
  const groups = resolveAttachedModifierGroups(all, product, 'compulsory')
  if (groups.length === 0) return '—'
  return groups.map(g => g.name).join(' → ')
}

/**
 * Component SWAP groups for a register line: prefer product attachments,
 * then unscoped (no attachments) component-swap groups — same rule as Food/Beverage.
 */
export function resolveComponentSwapGroups(
  all: PosModifierGroup[],
  product: ModifierAttachProduct,
): PosModifierGroup[] {
  const attached = resolveAttachedModifierGroups(all, product, 'component-swap')
  if (attached.length > 0) return attached
  return all
    .filter(g => g.active && g.kind === 'component-swap')
    .filter(g => (g.attachments ?? []).length === 0)
    .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
}

/** Build Variable Component slots from Component SWAP modifier options (base → alternates). */
export function buildSlotsFromComponentSwapGroups(
  groups: PosModifierGroup[],
): VariableComponentSlot[] {
  type Acc = {
    slotLabel: string
    baseComponentId: string
    baseComponentName: string
    alternatives: Map<string, {
      componentId: string
      componentName: string
      extraCharge: number
    }>
  }
  const byBase = new Map<string, Acc>()

  for (const group of groups) {
    const options = [...(group.options ?? [])]
      .filter(o => o && o.active !== false)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    for (const opt of options) {
      const baseId = (opt.baseComponentId || '').trim()
      const chosenId = (opt.linkedComponentId || '').trim()
      if (!baseId || !chosenId) continue
      if (baseId.toLowerCase() === chosenId.toLowerCase()) continue
      const baseName = (opt.baseComponentName || '').trim() || baseId
      const chosenName = (opt.linkedComponentName || '').trim() || chosenId
      const extraCharge = Math.max(0, (Number(opt.extraChargeCents) || 0) / 100)
      let slot = byBase.get(baseId.toLowerCase())
      if (!slot) {
        slot = {
          slotLabel: baseName,
          baseComponentId: baseId,
          baseComponentName: baseName,
          alternatives: new Map(),
        }
        byBase.set(baseId.toLowerCase(), slot)
      }
      if (!slot.alternatives.has(chosenId.toLowerCase())) {
        slot.alternatives.set(chosenId.toLowerCase(), {
          componentId: chosenId,
          componentName: chosenName,
          extraCharge,
        })
      }
    }
  }

  return [...byBase.values()]
    .map((slot): VariableComponentSlot => ({
      key: newVariableComponentKey('swap-slot'),
      slotLabel: slot.slotLabel,
      baseComponentId: slot.baseComponentId,
      baseComponentName: slot.baseComponentName,
      baseComponentUom: '',
      baseUnitPrice: 0,
      quantity: 1,
      alternatives: [...slot.alternatives.values()].map(alt => ({
        key: newVariableComponentKey('swap-alt'),
        componentId: alt.componentId,
        componentName: alt.componentName,
        componentUom: '',
        unitPrice: 0,
        quantity: 1,
        extraCharge: alt.extraCharge,
      })),
    }))
    .filter(s => s.alternatives.length > 0)
}

export type ComponentSwapProduct = ModifierAttachProduct & {
  isVariableComponent?: boolean
  variableComponentSlots?: VariableComponentSlot[] | null
}

/**
 * Slots shown in the POS Component SWAP modal for a check line.
 * Prefer the product's own Variable Component config; otherwise use attached
 * (or unscoped) component-swap modifier groups from Inherit / POS Config.
 */
export function resolveComponentSwapSlots(
  product: ComponentSwapProduct | null | undefined,
  all: PosModifierGroup[],
): VariableComponentSlot[] {
  if (!product) return []
  const own = (product.variableComponentSlots ?? []).filter(
    s => s?.baseComponentId && (s.alternatives?.length ?? 0) > 0,
  )
  if (own.length > 0) return own
  return buildSlotsFromComponentSwapGroups(resolveComponentSwapGroups(all, product))
}

export function productCanComponentSwap(
  product: ComponentSwapProduct | null | undefined,
  all: PosModifierGroup[],
): boolean {
  return resolveComponentSwapSlots(product, all).length > 0
}
