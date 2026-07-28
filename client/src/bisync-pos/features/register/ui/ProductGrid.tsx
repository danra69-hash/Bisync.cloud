import type { Product } from '../domain/types'
import { formatMoney } from '../../../core/types/money'
import './ProductGrid.css'

type Props = {
  products: Product[]
  onAdd: (product: Product) => void
}

export function ProductGrid({ products, onAdd }: Props) {
  if (products.length === 0) {
    return <p className="product-grid__empty">No products match your filters.</p>
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <article key={product.id} className="product-card">
          <div
            className="product-card__media"
            style={{ background: product.accent }}
            aria-hidden
          >
            <span>{product.emoji}</span>
          </div>
          <div className="product-card__body">
            <h3 className="product-card__name">{product.name}</h3>
            <div className="product-card__row">
              <span className="product-card__price">
                {product.pricedByWeight && product.weightUom
                  ? `${formatMoney(product.priceCents)}/${product.weightUom}`
                  : formatMoney(product.priceCents)}
              </span>
              <button
                type="button"
                className="product-card__add"
                aria-label={`Add ${product.name}`}
                onClick={() => onAdd(product)}
              >
                +
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
