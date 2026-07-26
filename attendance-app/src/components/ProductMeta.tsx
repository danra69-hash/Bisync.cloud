type QtyInput = number | string | null | undefined

type ProductMetaProps = {
  /** Vendor product / SKU name (primary title) */
  name: string
  /** Smart ingredient name — shown above the product name as “Ingredient …” */
  ingredientName?: string | null
  /** Delivery UOM / delivery package — shown under the name in smaller print */
  deliveryUom?: string | null
  /** Recipe UOM appended to Par / On hand (e.g. PCS, CAN) */
  recipeUom?: string | null
  parStock?: QtyInput
  onHand?: QtyInput
  /** Optional extra muted line (vendor, type, demo flag, etc.) */
  extra?: string | null
}

/** Parse API qty that may be a number or a string like "1.00 PCS" / "1.00PCS". */
export function parseQtyWithUom(value: QtyInput): {
  qty: number | null
  uom?: string
} {
  if (value == null || value === '') return { qty: null }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { qty: value } : { qty: null }
  }
  const text = String(value).trim()
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/)
  if (!match) return { qty: null }
  const qty = Number(match[1])
  const uom = match[2]?.replace(/\s+/g, ' ').trim() || undefined
  return { qty: Number.isFinite(qty) ? qty : null, uom }
}

/** Unit portion of delivery package, e.g. "1.00CAN" → "CAN", "Bag" → "Bag". */
export function unitFromDeliveryPackage(pkg?: string | null) {
  if (!pkg) return undefined
  const trimmed = pkg.trim()
  if (!trimmed) return undefined
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(.+)$/)
  if (match) {
    const unit = match[2].trim()
    return unit || undefined
  }
  return trimmed
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function formatStock(label: string, qty: number | null, uom?: string) {
  if (qty == null) return `${label} -`
  return uom ? `${label} ${formatQty(qty)} ${uom}` : `${label} ${formatQty(qty)}`
}

/** Consistent product identity: Ingredient label, vendor product name, stock. */
export function ProductMeta({
  name,
  ingredientName,
  deliveryUom,
  recipeUom,
  parStock,
  onHand,
  extra,
}: ProductMetaProps) {
  const hand = parseQtyWithUom(onHand)
  const par = parseQtyWithUom(parStock)
  const uom = recipeUom || hand.uom || par.uom || undefined
  const smart = (ingredientName || '').trim()
  const product = (name || '').trim()
  // Only show the Ingredient row when we have a real name (blank → no “—”).
  const showIngredient = smart.length > 0

  return (
    <div className="product-meta">
      {showIngredient ? (
        <div className="product-meta-ingredient">
          <span className="product-meta-ingredient-mark">Ingredient</span>
          <span className="product-meta-ingredient-name">
            {smart}
          </span>
        </div>
      ) : null}
      <strong className="product-meta-name">{product || 'Product'}</strong>
      <div className="product-meta-stock">
        <span>{formatStock('Par', par.qty, uom)}</span>
        <span className="product-meta-stock-sep" aria-hidden>
          ·
        </span>
        <span>{formatStock('On hand', hand.qty, uom)}</span>
      </div>
      {deliveryUom ? (
        <div className="product-meta-uom">{deliveryUom}</div>
      ) : null}
      {extra ? <div className="product-meta-extra">{extra}</div> : null}
    </div>
  )
}

export function deliveryUomOf(item: {
  deliveryPackage?: string | null
  uom?: string | null
}) {
  return item.deliveryPackage || item.uom || undefined
}

/** Prefer explicit recipe unit, else UOM embedded in on-hand, else unit from delivery package. */
export function recipeUomOf(item: {
  recipeUnit?: string | null
  recipeUom?: string | null
  onHandQuantity?: QtyInput
  quantityOnHand?: QtyInput
  onHand?: QtyInput
  deliveryPackage?: string | null
}) {
  const fromApi = item.recipeUnit || item.recipeUom
  if (fromApi) return fromApi
  const fromOnHand = parseQtyWithUom(
    item.onHandQuantity ?? item.quantityOnHand ?? item.onHand,
  ).uom
  if (fromOnHand) return fromOnHand
  return unitFromDeliveryPackage(item.deliveryPackage)
}

export function productNameOf(item: {
  productName?: string | null
  ingredientName?: string | null
  name?: string | null
}) {
  return item.productName || item.ingredientName || item.name || 'Product'
}
