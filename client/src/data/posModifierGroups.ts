import type { PosModifierGroup, PosModifierKind, PosModifierOption } from '../api'
import type { ModifierGroup, ModifierOption } from '../bisync-pos/features/order/domain/ordering'
import {
  BEVERAGE_MODIFIER_GROUPS,
  FOOD_MODIFIER_GROUPS,
} from '../bisync-pos/features/order/domain/ordering'
import { normalizePosGroupLabel } from './posCatalog'

export const POS_MODIFIER_KINDS: Array<{
  id: PosModifierKind
  label: string
  hint: string
}> = [
  {
    id: 'compulsory',
    label: 'Compulsory Modifier',
    hint: 'Shown in sequence when the product is selected. Guest must choose before the order continues.',
  },
  {
    id: 'food',
    label: 'Food Modifier',
    hint: 'Optional food notes / add-ons. Stock influence requires products in the Food Modifier product group.',
  },
  {
    id: 'beverage',
    label: 'Beverage Modifier',
    hint: 'Optional drink notes / add-ons. Stock influence requires products in the Beverage Modifier product group.',
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

export type ModifierAttachProduct = {
  id: string | number
  category?: string | null
  group?: string | null
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
    if (!groupsMatchName(category, product.category)) return false
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
 * When a product is provided, only groups attached to that product (and kind) are shown —
 * never every beverage/food group company-wide.
 * Without a product, fall back to all active groups of that kind, then hard-coded defaults.
 */
export function resolveToolbarModifierGroups(
  all: PosModifierGroup[],
  kind: 'food' | 'beverage',
  product?: ModifierAttachProduct | null,
): ModifierGroup[] {
  if (product) {
    return toPickerGroups(resolveAttachedModifierGroups(all, product, kind))
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
