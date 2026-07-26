import { useEffect, useId, useRef, useState } from 'react'
import type { Outlet } from '../types'

type Props = {
  locations: Outlet[]
  selectedLocationId: number | null
  onChange: (id: number | null) => void
  loading?: boolean
  emptyLabel?: string
  ariaLabel?: string
  /** Visible prefix in the trigger (e.g. "Company location"). */
  placeholderLabel?: string
}

export function LocationSelect({
  locations,
  selectedLocationId,
  onChange,
  loading,
  emptyLabel = 'No locations',
  ariaLabel = 'Location',
  placeholderLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = locations.find((l) => l.outletId === selectedLocationId)
  const valueLabel = loading
    ? 'Loading…'
    : selected?.name || (locations.length === 0 ? emptyLabel : 'Select…')
  const disabled = !!loading || locations.length === 0

  useEffect(() => {
    if (!open) return
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="location-filter" ref={rootRef}>
      <button
        type="button"
        className="location-filter-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="location-filter-trigger-text">
          {placeholderLabel ? (
            <>
              <span className="location-filter-prefix">{placeholderLabel}</span>
              <span className="location-filter-value">{valueLabel}</span>
            </>
          ) : (
            valueLabel
          )}
        </span>
        <span className="location-filter-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && !disabled && (
        <ul
          id={listId}
          className="location-filter-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {locations.map((loc) => {
            const active = loc.outletId === selectedLocationId
            return (
              <li key={loc.outletId} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`location-filter-option${active ? ' active' : ''}`}
                  onClick={() => {
                    onChange(loc.outletId)
                    setOpen(false)
                  }}
                >
                  {loc.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
