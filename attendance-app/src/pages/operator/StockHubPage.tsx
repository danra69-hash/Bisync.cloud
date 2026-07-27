import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  canViewInventory,
  canViewTransfer,
  canViewWastage,
} from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'

const TILES = [
  {
    to: '/operator/stock/wastage',
    title: 'Wastage',
    description: 'Record and review wastage',
    image: '/stock/wastage.png',
    canAccess: canViewWastage,
  },
  {
    to: '/operator/stock/transfer',
    title: 'Transfer',
    description: 'Move stock between outlets',
    image: '/stock/transfer.png',
    canAccess: canViewTransfer,
  },
  {
    to: '/operator/stock/inventory',
    title: 'Inventory',
    description: 'Stock take and inventory history',
    image: '/stock/inventory.png',
    canAccess: canViewInventory,
  },
] as const

export function OperatorStockHubPage() {
  const { hasPermission } = useAuth()
  const tiles = TILES.filter((tile) => tile.canAccess(hasPermission))

  return (
    <div className="stack stock-hub-page">
      <div>
        <h2 style={{ margin: '0 0 4px' }}>Stock</h2>
        <p className="muted" style={{ margin: 0 }}>
          Choose an operation
        </p>
      </div>

      {tiles.length === 0 ? (
        <PermissionDenied
          title="No stock access"
          message="Your account does not include Wastage, Transfer, or Inventory permissions."
        />
      ) : (
        <div className="stock-hub-grid">
          {tiles.map((tile) => (
            <Link key={tile.to} to={tile.to} className="stock-hub-tile">
              <img src={tile.image} alt="" className="stock-hub-tile-icon" />
              <div className="stock-hub-tile-text">
                <span className="stock-hub-tile-title">{tile.title}</span>
                <span className="muted stock-hub-tile-desc">
                  {tile.description}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
