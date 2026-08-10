import type { PosTaxServiceConfig, PosTaxServiceSalesTypeRule } from '../../../../api'
import { discountCentsFromPercent } from '../../../../data/entertainmentSettlement'
import { saleDetailExtraChargeCents } from './saleDetail'
import type { CartLine, Product } from './types'

export type TaxServiceChargeCents = {
  serviceCents: number
  taxRegularCents: number
  taxAlcoholCents: number
}

const EMPTY: TaxServiceChargeCents = {
  serviceCents: 0,
  taxRegularCents: 0,
  taxAlcoholCents: 0,
}

/** Normalize dining / sales-type keys for rule lookup. */
export function normalizeSalesType(dining: string | null | undefined): string {
  const key = (dining || 'dine-in').trim().toLowerCase().replace(/_/g, '-')
  if (key === 'dinein' || key === 'dine in' || key === 'eat-in') return 'dine-in'
  if (key === 'take-out' || key === 'takeout' || key === 'to-go') return 'takeaway'
  if (key === 'deliver' || key === 'delivery-app') return 'delivery'
  return key || 'dine-in'
}

export function isAlcoholTaxLineName(name: string | null | undefined): boolean {
  return /alcohol|liquor|spirit|abev|excise/i.test(name || '')
}

export function isAlcoholProduct(product: Product): boolean {
  const hay = `${product.group} ${product.name}`.toLowerCase()
  return /alcohol|beer|wine|spirit|liquor|cocktail|sake|soju|cider|champagne|whisky|whiskey|vodka|gin\b|rum\b|tequila|brandy|aperitif|digestif/.test(
    hay,
  )
}

function lineAmountCents(line: CartLine, product: Product): number {
  const unit = line.unitPriceCents ?? product.priceCents
  return Math.max(0, Math.round(unit * line.quantity + saleDetailExtraChargeCents(line.saleDetail)))
}

function groupsMatch(productGroup: string, configured: string[]): boolean {
  const needle = productGroup.trim().toLowerCase()
  if (!needle) return false
  return configured.some(g => g.trim().toLowerCase() === needle)
}

function ruleForSalesType(
  config: PosTaxServiceConfig | null | undefined,
  salesType: string,
): PosTaxServiceSalesTypeRule | null {
  if (!config) return null
  const key = normalizeSalesType(salesType)
  return (
    config.salesTypes.find(r => normalizeSalesType(r.salesType) === key)
    ?? null
  )
}

/**
 * Apply POS Setup → Tax & service charge rates to the current check.
 *
 * - Picks the sales-type rule from dining mode (dine-in / takeaway / delivery).
 * - Eligible base = lines matching All products or selected product groups.
 * - Discount is allocated proportionally onto the eligible base.
 * - Service % applies to post-discount eligible base.
 * - Non-alcohol tax % applies to (eligible base + service).
 * - Alcohol-named tax % applies to the alcohol product share of that taxable base.
 */
export function computeTaxServiceCharges(args: {
  lines: CartLine[]
  products: Product[]
  dining: string
  discountCents: number
  config: PosTaxServiceConfig | null | undefined
}): TaxServiceChargeCents {
  const { lines, products, dining, discountCents, config } = args
  if (!config || lines.length === 0) return EMPTY

  const rule = ruleForSalesType(config, dining)
  if (!rule) return EMPTY

  const taxIds = new Set(rule.taxIds ?? [])
  const serviceIds = new Set(rule.serviceIds ?? [])
  if (taxIds.size === 0 && serviceIds.size === 0) return EMPTY

  const byId = new Map(products.map(p => [String(p.id), p]))
  let eligibleGross = 0
  let alcoholGross = 0
  let totalGross = 0

  for (const line of lines) {
    const product = byId.get(String(line.productId))
    if (!product) continue
    const amount = lineAmountCents(line, product)
    totalGross += amount
    const included =
      rule.applyToAllProducts !== false
      || groupsMatch(product.group, rule.productGroups ?? [])
    if (!included) continue
    eligibleGross += amount
    if (isAlcoholProduct(product)) alcoholGross += amount
  }

  if (eligibleGross <= 0) return EMPTY

  const disc = Math.max(0, Math.round(discountCents))
  const discShare =
    totalGross > 0
      ? Math.min(eligibleGross, Math.round((disc * eligibleGross) / totalGross))
      : Math.min(eligibleGross, disc)
  const eligibleNet = Math.max(0, eligibleGross - discShare)
  const alcoholRatio = alcoholGross / eligibleGross
  const alcoholNet = Math.round(eligibleNet * alcoholRatio)

  const services = (config.services ?? []).filter(s => serviceIds.has(s.id) && s.percent > 0)
  const taxes = (config.taxes ?? []).filter(t => taxIds.has(t.id) && t.percent > 0)

  let serviceCents = 0
  for (const svc of services) {
    serviceCents += discountCentsFromPercent(eligibleNet, svc.percent)
  }

  const taxableBase = eligibleNet + serviceCents
  const alcoholTaxable = Math.round(
    taxableBase * (eligibleNet > 0 ? alcoholNet / eligibleNet : 0),
  )

  let taxRegularCents = 0
  let taxAlcoholCents = 0
  for (const tax of taxes) {
    if (isAlcoholTaxLineName(tax.name)) {
      taxAlcoholCents += discountCentsFromPercent(alcoholTaxable, tax.percent)
    } else {
      taxRegularCents += discountCentsFromPercent(taxableBase, tax.percent)
    }
  }

  return {
    serviceCents: Math.max(0, serviceCents),
    taxRegularCents: Math.max(0, taxRegularCents),
    taxAlcoholCents: Math.max(0, taxAlcoholCents),
  }
}
