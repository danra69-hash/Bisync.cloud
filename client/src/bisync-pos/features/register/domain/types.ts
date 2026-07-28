import type { MoneyCents } from '../../../core/types/money'

export type ProductId = string

export type ProductDepartment = 'Food' | 'Beverage' | 'Retail'

export type Product = {
  id: ProductId
  sku: string
  name: string
  priceCents: MoneyCents
  department: ProductDepartment
  group: string
  /** Short emoji/icon stand-in for food photography */
  emoji: string
  accent: string
}

export type CartLine = {
  productId: ProductId
  quantity: number
  note?: string
}

export type OrderCharges = {
  discountCents: MoneyCents
  serviceCents: MoneyCents
  taxRegularCents: MoneyCents
  taxAlcoholCents: MoneyCents
}
