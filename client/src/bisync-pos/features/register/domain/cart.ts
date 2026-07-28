import type { CartLine, OrderCharges, Product, ProductId } from './types'
import type { MoneyCents } from '../../../core/types/money'

export function addToCart(lines: CartLine[], productId: ProductId): CartLine[] {
  const existing = lines.find((l) => l.productId === productId)
  if (existing) {
    return lines.map((l) =>
      l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
    )
  }
  return [...lines, { productId, quantity: 1 }]
}

/** Add or replace a weight-based line. Quantity is the entered weight in the product UOM. */
export function addWeightToCart(
  lines: CartLine[],
  productId: ProductId,
  weight: number,
): CartLine[] {
  if (!(weight > 0)) return lines
  const existing = lines.find((l) => l.productId === productId)
  if (existing) {
    return lines.map((l) =>
      l.productId === productId ? { ...l, quantity: weight } : l,
    )
  }
  return [...lines, { productId, quantity: weight }]
}

export function setLineQty(
  lines: CartLine[],
  productId: ProductId,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) {
    return lines.filter((l) => l.productId !== productId)
  }
  return lines.map((l) => (l.productId === productId ? { ...l, quantity } : l))
}

export function removeLine(lines: CartLine[], productId: ProductId): CartLine[] {
  return lines.filter((l) => l.productId !== productId)
}

export function setLineNote(
  lines: CartLine[],
  productId: ProductId,
  note: string,
): CartLine[] {
  return lines.map((l) => (l.productId === productId ? { ...l, note } : l))
}

export function cartSubtotal(
  lines: CartLine[],
  products: Product[],
): MoneyCents {
  const byId = new Map(products.map((p) => [p.id, p]))
  return lines.reduce((sum, line) => {
    const product = byId.get(line.productId)
    if (!product) return sum
    return sum + product.priceCents * line.quantity
  }, 0)
}

export function cartGrandTotal(
  lines: CartLine[],
  products: Product[],
  charges: OrderCharges,
): MoneyCents {
  const sub = cartSubtotal(lines, products)
  return Math.max(
    0,
    sub -
      charges.discountCents +
      charges.serviceCents +
      charges.taxRegularCents +
      charges.taxAlcoholCents,
  )
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0)
}
