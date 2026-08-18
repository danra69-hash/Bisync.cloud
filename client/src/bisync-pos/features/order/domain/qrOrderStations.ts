import { fireCartToStations } from '../../boh/domain/kitchenTickets'
import type { CartLine, Product } from '../../register/domain/types'
import { markQrOrderSent, type PosQrOrder } from './qrOrder'

export function orderToStationPayload(order: PosQrOrder): {
  products: Product[]
  lines: CartLine[]
} {
  const products: Product[] = order.items.map(item => {
    const deptHint = `${item.name} ${item.detail || ''}`
    const department = /(beer|wine|drink|beverage|cocktail|coffee|juice|soft)/i.test(deptHint)
      ? 'Beverage'
      : 'Food'
    return {
      id: String(item.productId),
      sku: String(item.productId),
      name: item.name,
      priceCents: Math.round(item.unitPrice * 100),
      department,
      group: 'QR Order',
      emoji: '🍽️',
      accent: '#e0f2fe',
    }
  })
  const lines: CartLine[] = order.items.map(item => ({
    productId: String(item.productId),
    quantity: item.quantity,
  }))
  return { products, lines }
}

/**
 * Accept a guest QR order: fire tickets to Bar/Kitchen, then mark status=sent.
 * Returns false when there is nothing to send or the status update fails.
 */
export async function acceptQrOrderToStations(order: PosQrOrder): Promise<{
  ok: boolean
  error?: string
}> {
  const { products, lines } = orderToStationPayload(order)
  const tickets = fireCartToStations({
    lines,
    products,
    checkNumber: 100000 + (order.id % 900000),
    tableLabel: order.tableLabel || 'QR',
    dining: 'dine-in',
  })
  if (tickets.length === 0) {
    return { ok: false, error: 'Nothing to send to Bar or Kitchen for this order.' }
  }
  try {
    await markQrOrderSent(order.id)
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not accept order.',
    }
  }
}
