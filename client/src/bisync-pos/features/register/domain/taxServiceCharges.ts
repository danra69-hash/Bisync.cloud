import type {
  PosTaxServiceChannelFlags,
  PosTaxServiceChargeLine,
  PosTaxServiceChargeType,
  PosTaxServiceConfig,
  PosTaxServiceProductRule,
  PosTaxServiceSalesTypeRule,
} from '../../../../api'
import { discountCentsFromPercent } from '../../../../data/entertainmentSettlement'
import { normalizePosGroupLabel } from '../../../../data/posCatalog'
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

const EMPTY_FLAGS: PosTaxServiceChannelFlags = {
  taxRegular: false,
  taxAlcohol: false,
  service: false,
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

export function resolveChargeType(line: PosTaxServiceChargeLine): PosTaxServiceChargeType {
  const raw = (line.type || '').trim().toLowerCase().replace(/_/g, '-')
  if (raw === 'tax-regular' || raw === 'taxregular' || raw === 'regular') return 'tax-regular'
  if (raw === 'tax-alcohol' || raw === 'taxalcohol' || raw === 'alcohol') return 'tax-alcohol'
  if (raw === 'service' || raw === 'service-charge' || raw === 'svc') return 'service'
  if (isAlcoholTaxLineName(line.name)) return 'tax-alcohol'
  return 'tax-regular'
}

export function listConfigCharges(config: PosTaxServiceConfig | null | undefined): PosTaxServiceChargeLine[] {
  if (!config) return []
  if (config.charges && config.charges.length > 0) return config.charges
  const taxes = (config.taxes ?? []).map(t => ({
    ...t,
    type: resolveChargeType(t),
  }))
  const services = (config.services ?? []).map(s => ({
    ...s,
    type: 'service' as const,
  }))
  return [...taxes, ...services]
}

function lineAmountCents(line: CartLine, product: Product): number {
  const unit = line.unitPriceCents ?? product.priceCents
  return Math.max(0, Math.round(unit * line.quantity + saleDetailExtraChargeCents(line.saleDetail)))
}

function groupsMatch(productGroup: string, configured: string[]): boolean {
  const needle = normalizePosGroupLabel(productGroup || '')
  if (!needle || needle === 'General') return false
  return configured.some(g => normalizePosGroupLabel(g || '') === needle)
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

function channelFlagsForProduct(
  rule: PosTaxServiceProductRule | undefined,
  salesType: string,
): PosTaxServiceChannelFlags {
  if (!rule) return EMPTY_FLAGS
  const key = normalizeSalesType(salesType)
  if (key === 'takeaway') return rule.takeaway ?? EMPTY_FLAGS
  if (key === 'delivery') return rule.delivery ?? EMPTY_FLAGS
  return rule.dineIn ?? EMPTY_FLAGS
}

function hasAnyProductRuleFlag(config: PosTaxServiceConfig): boolean {
  for (const rule of config.productRules ?? []) {
    for (const ch of [rule.dineIn, rule.takeaway, rule.delivery]) {
      if (ch?.taxRegular || ch?.taxAlcohol || ch?.service) return true
    }
  }
  return false
}

/** True when config has rates that should drive (and lock) register charge fields. */
export function configDrivesRegisterCharges(
  config: PosTaxServiceConfig | null | undefined,
): boolean {
  if (!config) return false
  const charges = listConfigCharges(config)
  const hasOpenLines = charges.some(c => c.percent > 0)
  if (!hasOpenLines) return false
  if ((config.productRules ?? []).length > 0 && hasAnyProductRuleFlag(config)) return true

  const taxById = new Map((config.taxes ?? []).map(t => [t.id, t]))
  const svcById = new Map((config.services ?? []).map(s => [s.id, s]))
  for (const rule of config.salesTypes ?? []) {
    for (const id of rule.taxIds ?? []) {
      const line = taxById.get(id)
      if (line && line.percent > 0) return true
    }
    for (const id of rule.serviceIds ?? []) {
      const line = svcById.get(id)
      if (line && line.percent > 0) return true
    }
  }
  // Incomplete legacy setup: lines exist but none attached yet.
  return hasOpenLines && (config.productRules ?? []).length === 0
}

function computeFromProductRules(args: {
  lines: CartLine[]
  products: Product[]
  dining: string
  discountCents: number
  config: PosTaxServiceConfig
}): TaxServiceChargeCents {
  const { lines, products, dining, discountCents, config } = args
  const charges = listConfigCharges(config).filter(c => c.percent > 0)
  if (charges.length === 0) return EMPTY

  const regularCharges = charges.filter(c => resolveChargeType(c) === 'tax-regular')
  const alcoholCharges = charges.filter(c => resolveChargeType(c) === 'tax-alcohol')
  const serviceCharges = charges.filter(c => resolveChargeType(c) === 'service')

  const byProductId = new Map(products.map(p => [String(p.id), p]))
  const ruleByProductId = new Map(
    (config.productRules ?? []).map(r => [String(r.productId), r]),
  )

  type Row = {
    amount: number
    flags: PosTaxServiceChannelFlags
  }
  const rows: Row[] = []
  let totalGross = 0

  for (const line of lines) {
    const product = byProductId.get(String(line.productId))
    if (!product) continue
    const amount = lineAmountCents(line, product)
    totalGross += amount
    const flags = channelFlagsForProduct(ruleByProductId.get(String(product.id)), dining)
    rows.push({ amount, flags })
  }

  if (totalGross <= 0 || rows.length === 0) return EMPTY

  const disc = Math.max(0, Math.round(discountCents))
  let serviceCents = 0
  let taxRegularCents = 0
  let taxAlcoholCents = 0

  for (const row of rows) {
    const discShare =
      totalGross > 0 ? Math.min(row.amount, Math.round((disc * row.amount) / totalGross)) : 0
    const net = Math.max(0, row.amount - discShare)

    let lineService = 0
    if (row.flags.service) {
      for (const svc of serviceCharges) {
        lineService += discountCentsFromPercent(net, svc.percent)
      }
    }
    serviceCents += lineService

    const taxable = net + lineService
    if (row.flags.taxRegular) {
      for (const tax of regularCharges) {
        taxRegularCents += discountCentsFromPercent(taxable, tax.percent)
      }
    } else if (row.flags.taxAlcohol) {
      for (const tax of alcoholCharges) {
        taxAlcoholCents += discountCentsFromPercent(taxable, tax.percent)
      }
    }
  }

  return {
    serviceCents: Math.max(0, serviceCents),
    taxRegularCents: Math.max(0, taxRegularCents),
    taxAlcoholCents: Math.max(0, taxAlcoholCents),
  }
}

/**
 * Apply POS Config → Tax & service charge rates to the current check.
 *
 * Prefers per-product × sales-type flags (productRules). Falls back to legacy
 * sales-type + product-group attachment when no product matrix is configured.
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

  if ((config.productRules ?? []).length > 0) {
    return computeFromProductRules({ lines, products, dining, discountCents, config })
  }

  const rule = ruleForSalesType(config, dining)
    ?? {
      salesType: normalizeSalesType(dining),
      taxIds: [] as string[],
      serviceIds: [] as string[],
      applyToAllProducts: true,
      productGroups: [] as string[],
    }

  let taxIds = new Set(rule.taxIds ?? [])
  let serviceIds = new Set(rule.serviceIds ?? [])

  const anySalesTypeHasTax = (config.salesTypes ?? []).some(r => (r.taxIds ?? []).length > 0)
  const anySalesTypeHasService = (config.salesTypes ?? []).some(r => (r.serviceIds ?? []).length > 0)
  if (taxIds.size === 0 && !anySalesTypeHasTax) {
    taxIds = new Set((config.taxes ?? []).filter(t => t.percent > 0).map(t => t.id))
  }
  if (serviceIds.size === 0 && !anySalesTypeHasService) {
    serviceIds = new Set((config.services ?? []).filter(s => s.percent > 0).map(s => s.id))
  }
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
    if (resolveChargeType(tax) === 'tax-alcohol' || isAlcoholTaxLineName(tax.name)) {
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
