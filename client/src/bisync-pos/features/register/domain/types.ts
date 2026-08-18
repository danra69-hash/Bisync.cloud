import type { MoneyCents } from '../../../core/types/money'
import type { VariableCombinationOption } from '../../../../data/productVariable'
import type { VariableComponentSlot } from '../../../../data/productVariableComponent'
import type { PosSaleVariableDetail } from './saleDetail'

export type ProductId = string

export type ProductDepartment = 'Food' | 'Beverage' | 'Retail'

export type { PosSaleVariableDetail }

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
  /** RMS product category (for modifier attach matching). */
  category?: string
  group: string
  /** Short emoji/icon stand-in for food photography */
  emoji: string
  accent: string
  /** When true, cashier must enter sold weight; quantity is weight in weightUom. */
  pricedByWeight?: boolean
  weightUom?: string
  /** Quoted package weight that the original product RRP applied to. */
  weightQty?: number
  /** Variable product mode when applicable. */
  variableMode?: 'combination' | 'weight'
  /** Combination: total choice units the customer must pick. */
  choiceQty?: number
  combinationOptions?: VariableCombinationOption[]
  /** Variable Component substitution slots (POS SWAP). */
  isVariableComponent?: boolean
  variableComponentSlots?: VariableComponentSlot[]
}

export type CartLine = {
  productId: ProductId
  /** Count for normal items; sold weight (in weightUom) for weight-based items. */
  quantity: number
  note?: string
  /** Unique key so variable lines with different selections do not merge. */
  lineKey?: string
  /** Quantified combination / replacement / weight detail for stock depletion. */
  saleDetail?: PosSaleVariableDetail
  /** Optional override of catalog unit price (e.g. prepaid package RPP). */
  unitPriceCents?: MoneyCents
}

export type OrderCharges = {
  discountCents: MoneyCents
  serviceCents: MoneyCents
  taxRegularCents: MoneyCents
  taxAlcoholCents: MoneyCents
  /** Optional audit from PosConfig discount apply. */
  discountTypeCode?: string
  discountPercent?: number
  discountReason?: string
  discountLabel?: string
}
