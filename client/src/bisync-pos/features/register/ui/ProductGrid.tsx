import type { KeyboardEvent } from 'react'
import type { Product } from '../domain/types'
import { formatMoney } from '../../../core/types/money'
import './ProductGrid.css'

type Props = {
  products: Product[]
  onAdd: (product: Product) => void
  disabled?: boolean
}

export function ProductGrid({ products, onAdd, disabled = false }: Props) {
  if (products.length === 0) {
    return <p className="product-grid__empty">No products match your filters.</p>
  }

  function activateCard(product: Product) {
    if (disabled) return
    onAdd(product)
  }

  function onCardKeyDown(e: KeyboardEvent<HTMLElement>, product: Product) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onAdd(product)
    }
  }

  return (
    <div className={`product-grid${disabled ? ' is-disabled' : ''}`}>
      {products.map((product) => (
        <article
          key={product.id}
          className="product-card"
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Add ${product.name}`}
          aria-disabled={disabled || undefined}
          onClick={() => activateCard(product)}
          onKeyDown={e => onCardKeyDown(e, product)}
        >
          <div
            className="product-card__media"
            style={{ background: product.accent }}
            aria-hidden
          >
            <span>{product.emoji}</span>
          </div>
          <div className="product-card__body">
            <h3 className="product-card__name">{product.name}</h3>
            <span className="product-card__price">
              {product.pricedByWeight && product.weightUom
                ? `${formatMoney(product.priceCents)}/${product.weightUom}`
                : formatMoney(product.priceCents)}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}
