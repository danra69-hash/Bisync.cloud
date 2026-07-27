import { useState } from 'react'

type Props = {
  value: number
  disabled?: boolean
  min?: number
  /** Inclusive max (default 1000). */
  max?: number
  /** Allow fractional qty (order receive / amend). Default true. */
  allowDecimal?: boolean
  onChange: (next: number) => void
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function parseQty(raw: string, min: number, max: number, allowDecimal: boolean) {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '.') return min
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return min
  const normalized = allowDecimal
    ? Math.round(parsed * 100) / 100
    : Math.trunc(parsed)
  return clamp(normalized, min, max)
}

/**
 * Qty control with mobile keyboard support.
 * Digits edit locally while focused; value commits on blur / Enter so
 * each keystroke does not hit the API or remount the list.
 */
export function QtyStepper({
  value,
  disabled,
  min = 0,
  max = 1000,
  allowDecimal = true,
  onChange,
}: Props) {
  const qty = clamp(Number.isFinite(value) ? value : 0, min, max)
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const display = editing ? draft : String(qty)

  function commit(raw: string) {
    const next = parseQty(raw, min, max, allowDecimal)
    setDraft(null)
    if (next !== qty) onChange(next)
  }

  function bump(delta: number) {
    if (disabled) return
    // Prefer in-progress draft so −/+ match what the user sees while typing.
    const base = draft !== null ? parseQty(draft, min, max, allowDecimal) : qty
    const next = clamp(
      allowDecimal ? Math.round((base + delta) * 100) / 100 : base + delta,
      min,
      max,
    )
    setDraft(null)
    if (next !== qty) onChange(next)
  }

  const shownQty = draft !== null ? parseQty(draft || String(min), min, max, allowDecimal) : qty

  return (
    <div
      className="qty-stepper"
      role="group"
      aria-label="Quantity"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="qty-btn"
        disabled={disabled || shownQty <= min}
        // preventDefault so the focused input does not steal the tap (1→0).
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (disabled || shownQty <= min) return
          bump(-1)
        }}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        className="qty-input"
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        pattern={allowDecimal ? '[0-9.]*' : '[0-9]*'}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={display}
        disabled={disabled}
        onFocus={() => {
          setDraft(String(qty))
        }}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            setDraft('')
            return
          }
          const ok = allowDecimal
            ? /^\d{0,4}(\.\d{0,2})?$/.test(raw)
            : /^\d{1,4}$/.test(raw)
          if (ok) setDraft(raw)
        }}
        onBlur={() => {
          if (draft !== null) commit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          }
        }}
        aria-label="Quantity"
      />
      <button
        type="button"
        className="qty-btn"
        disabled={disabled || shownQty >= max}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (disabled || shownQty >= max) return
          bump(1)
        }}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}
