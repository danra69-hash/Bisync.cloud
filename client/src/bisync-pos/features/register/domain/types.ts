import type { MoneyCents } from '../../../core/types/money'

export type ProductId = string

export type ProductDepartment = 'Food' | 'Beverage' | 'Retail'

export type Product = {
  id: ProductId
  sku: string
  name: string
  /**
   * Unit price in cents.
   * For weight-based products this is the price per 1 weight UOM
   * (derived from quoted RRP ÷ weightQty).
   */
  priceCents: MoneyCents
  department: ProductDepartment
  group: string
  /** Short emoji/icon stand-in for food photography */
  emoji: string
  accent: string
  /** When true, cashier must enter sold weight; quantity is weight in weightUom. */
  pricedByWeight?: boolean
  weightUom?: string
  /** Quoted package weight that the original product RRP applied to. */
  weightQty?: number
}

export type CartLine = {
  productId: ProductId
  /** Count for normal items; sold weight (in weightUom) for weight-based items. */
  quantity: number
  note?: string
}

export type OrderCharges = {
  discountCents: MoneyCents
  serviceCents: MoneyCents
  taxRegularCents: MoneyCents
  taxAlcoholCents: MoneyCents
}
