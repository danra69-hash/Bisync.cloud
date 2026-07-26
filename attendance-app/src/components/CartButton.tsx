type Props = {
  count: number
  disabled?: boolean
  onClick: () => void
}

export function CartButton({ count, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      className="cart-button"
      disabled={disabled || count <= 0}
      onClick={onClick}
      aria-label={`Shopping cart, ${count} items`}
    >
      <span className="cart-button-icon" aria-hidden>
        🛒
      </span>
      <span className="cart-button-label">Cart</span>
      <span className={`cart-badge${count > 0 ? ' active' : ''}`}>{count}</span>
    </button>
  )
}
