import type { MoneyCents } from '../../../core/types/money'
import type {
  VariableCombinationOption,
  VariableReplacementSlot,
} from '../../../../data/productVariable'
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
  variableMode?: 'combination' | 'replacement' | 'weight'
  /** Combination: total choice units the customer must pick. */
  choiceQty?: number
  combinationOptions?: VariableCombinationOption[]
  replacementSlots?: VariableReplacementSlot[]
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
}

export type OrderCharges = {
  discountCents: MoneyCents
  serviceCents: MoneyCents
  taxRegularCents: MoneyCents
  taxAlcoholCents: MoneyCents
}
