export type SalesCartLine = {
  productId: number
  productName: string
  quantity: number
  price: number
  uom?: string
  deliveryPackage?: string
  recipeUom?: string
  parStock?: number
  quantityOnHand?: number
}

export type SavedSalesOrder = {
  id: string
  clientId: number
  clientName: string
  lines: SalesCartLine[]
  total: number
  createdAt: string
  shareUrl?: string
  /** Saved until link is copied / WhatsApp; then Submitted */
  status?: 'Saved' | 'Submitted'
  demo: boolean
}

function cartKey(clientId: number) {
  return `bisync_demo_cart_${clientId}`
}

function savedOrderKey(orderId: string) {
  return `bisync_sales_order_${orderId}`
}

export function loadSalesCart(clientId: number): SalesCartLine[] {
  try {
    const raw = localStorage.getItem(cartKey(clientId))
    return raw ? (JSON.parse(raw) as SalesCartLine[]) : []
  } catch {
    return []
  }
}

export function saveSalesCart(clientId: number, lines: SalesCartLine[]) {
  localStorage.setItem(cartKey(clientId), JSON.stringify(lines))
}

export function clearSalesCart(clientId: number) {
  localStorage.removeItem(cartKey(clientId))
}

export function cartItemCount(lines: SalesCartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function cartTotal(lines: SalesCartLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}

export function saveSalesOrder(order: SavedSalesOrder) {
  localStorage.setItem(savedOrderKey(order.id), JSON.stringify(order))
  localStorage.setItem('bisync_last_sales_order_id', order.id)
}

export function loadSalesOrder(orderId: string): SavedSalesOrder | null {
  try {
    const raw = localStorage.getItem(savedOrderKey(orderId))
    return raw ? (JSON.parse(raw) as SavedSalesOrder) : null
  } catch {
    return null
  }
}

export function loadLastSalesOrder(): SavedSalesOrder | null {
  const id = localStorage.getItem('bisync_last_sales_order_id')
  return id ? loadSalesOrder(id) : null
}

export function buildOrderShareText(order: SavedSalesOrder) {
  // PDF link only — never dump line items as text.
  if (!order.shareUrl) {
    return `Sales order ${order.id} (PDF link not ready yet)`
  }
  return [
    `Sales order ${order.id} (PDF)`,
    order.clientName ? `Client: ${order.clientName}` : '',
    order.shareUrl,
  ]
    .filter(Boolean)
    .join('\n')
}
