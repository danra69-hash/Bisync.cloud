import type { CartLine, OrderCharges, Product, ProductId } from './types'
import type { MoneyCents } from '../../../core/types/money'
import type { PosSaleVariableDetail } from './saleDetail'
import { saleDetailExtraChargeCents, summarizeSaleDetail } from './saleDetail'

function newLineKey() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Ensure every cart line has a stable key for selection / modifier / SWAP. */
export function ensureCartLineKeys(lines: CartLine[]): CartLine[] {
  let changed = false
  const next = lines.map((line) => {
    if (line.lineKey) return line
    changed = true
    return { ...line, lineKey: newLineKey() }
  })
  return changed ? next : lines
}

export function addToCart(lines: CartLine[], productId: ProductId): CartLine[] {
  const existing = lines.find((l) => l.productId === productId && !l.saleDetail)
  if (existing) {
    return lines.map((l) =>
      l === existing
        ? {
            ...l,
            quantity: l.quantity + 1,
            // Ensure every selectable order line has a stable identity.
            lineKey: l.lineKey ?? newLineKey(),
          }
        : l,
    )
  }
  return [...lines, { productId, quantity: 1, lineKey: newLineKey() }]
}

/** Add or replace a weight-based line. Quantity is the entered weight in the product UOM. */
export function addWeightToCart(
  lines: CartLine[],
  productId: ProductId,
  weight: number,
  detail: PosSaleVariableDetail,
): CartLine[] {
  if (!(weight > 0)) return lines
  const note = summarizeSaleDetail(detail)
  const existing = lines.find((l) => {
    if (l.productId !== productId) return false
    const mode = l.saleDetail?.variableMode
    return mode === 'weight'
      || (mode === 'variableComponent' && (l.saleDetail?.enteredWeight ?? 0) > 0)
  })
  if (existing) {
    return lines.map((l) =>
      l === existing
        ? {
            ...l,
            quantity: weight,
            lineKey: l.lineKey ?? newLineKey(),
            saleDetail: detail,
            note,
          }
        : l,
    )
  }
  return [
    ...lines,
    {
      productId,
      quantity: weight,
      lineKey: newLineKey(),
      saleDetail: detail,
      note,
    },
  ]
}

/** Add a combination or replacement variable line (never merges). */
export function addVariableToCart(
  lines: CartLine[],
  productId: ProductId,
  saleDetail: PosSaleVariableDetail,
  quantity = 1,
): CartLine[] {
  if (!(quantity > 0)) return lines
  return [
    ...lines,
    {
      productId,
      quantity,
      lineKey: newLineKey(),
      saleDetail,
      note: summarizeSaleDetail(saleDetail),
    },
  ]
}

export function setLineQty(
  lines: CartLine[],
  productId: ProductId,
  quantity: number,
  lineKey?: string,
): CartLine[] {
  if (quantity <= 0) {
    return removeLine(lines, productId, lineKey)
  }
  return lines.map((l) => {
    if (lineKey) {
      return l.lineKey === lineKey ? { ...l, quantity } : l
    }
    return l.productId === productId && !l.lineKey ? { ...l, quantity } : l
  })
}

export function removeLine(
  lines: CartLine[],
  productId: ProductId,
  lineKey?: string,
): CartLine[] {
  if (lineKey) {
    return lines.filter((l) => l.lineKey !== lineKey)
  }
  return lines.filter((l) => l.productId !== productId)
}

export function setLineNote(
  lines: CartLine[],
  productId: ProductId,
  note: string,
  lineKey?: string,
): CartLine[] {
  return lines.map((l) => {
    if (lineKey) {
      return l.lineKey === lineKey ? { ...l, note } : l
    }
    return l.productId === productId ? { ...l, note } : l
  })
}

export function cartSubtotal(
  lines: CartLine[],
  products: Product[],
): MoneyCents {
  const byId = new Map(products.map((p) => [String(p.id), p]))
  return lines.reduce((sum, line) => {
    const product = byId.get(String(line.productId))
    if (!product) return sum
    const unit = line.unitPriceCents ?? product.priceCents
    return sum + unit * line.quantity + saleDetailExtraChargeCents(line.saleDetail)
  }, 0)
}

export function updateLineSaleDetail(
  lines: CartLine[],
  lineKey: string | undefined,
  productId: ProductId,
  saleDetail: PosSaleVariableDetail,
): CartLine[] {
  const note = summarizeSaleDetail(saleDetail)
  return lines.map((l) => {
    if (lineKey) {
      return l.lineKey === lineKey ? { ...l, saleDetail, note } : l
    }
    return l.productId === productId ? { ...l, saleDetail, note } : l
  })
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
