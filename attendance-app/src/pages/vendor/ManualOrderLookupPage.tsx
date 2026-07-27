import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { canViewVendorOrders } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'

export function ManualOrderLookupPage() {
  const { hasPermission } = useAuth()
  const canView = canViewVendorOrders(hasPermission)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const raw = value.trim()
    const match = raw.match(/ORDER[_\s-]?(\d+)/i) || raw.match(/^(\d+)$/)
    if (!match) {
      setError('Enter an order id or ORDER_{id}')
      return
    }
    navigate(`/vendor/orders/${match[1]}`)
  }

  if (!canView) {
    return (
      <div className="stack">
        <PermissionDenied
          title="Lookup unavailable"
          message="Vendor order view permission is required."
        />
      </div>
    )
  }

  return (
    <div className="stack">
      <div>
        <h2 style={{ margin: '0 0 4px' }}>Find order</h2>
        <p className="muted" style={{ margin: 0 }}>
          QR substitute — enter order id manually (mobile uses live camera scan)
        </p>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Order ID</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 12345 or ORDER_12345"
            autoFocus
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary">
          Open order
        </button>
      </form>
    </div>
  )
}
