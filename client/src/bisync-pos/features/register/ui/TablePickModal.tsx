import { loadFloorPlan, type FloorTable } from '../../order/domain/tables'
import './TablePickModal.css'

type Props = {
  title: string
  subtitle?: string
  /** Exclude the current table from the list. */
  excludeTableId?: string | null
  /** When true, only show ordered tables (for move-to occupied checks). */
  preferOrdered?: boolean
  onCancel: () => void
  onPick: (table: FloorTable) => void
}

export function TablePickModal({
  title,
  subtitle,
  excludeTableId,
  preferOrdered = false,
  onCancel,
  onPick,
}: Props) {
  const tables = loadFloorPlan().tables
    .filter(t => t.id !== excludeTableId)
    .sort((a, b) => {
      if (preferOrdered) {
        const ao = a.status === 'ordered' ? 0 : 1
        const bo = b.status === 'ordered' ? 0 : 1
        if (ao !== bo) return ao - bo
      }
      return a.label.localeCompare(b.label, undefined, { numeric: true })
    })

  return (
    <div className="table-pick-modal" role="dialog" aria-modal="true" aria-labelledby="table-pick-title">
      <button type="button" className="table-pick-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="table-pick-modal__card">
        <header className="table-pick-modal__head">
          <div>
            <h2 id="table-pick-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="table-pick-modal__close" onClick={onCancel} aria-label="Cancel">
            ×
          </button>
        </header>
        <div className="table-pick-modal__grid">
          {tables.length === 0 ? (
            <p className="table-pick-modal__empty">No tables on the floor plan.</p>
          ) : (
            tables.map(table => (
              <button
                key={table.id}
                type="button"
                className={`table-pick-modal__table is-${table.status}`}
                onClick={() => onPick(table)}
              >
                <strong>{table.label}</strong>
                <span>{table.status === 'ordered' ? 'Occupied' : table.status === 'reserved' ? 'Reserved' : 'Open'}</span>
                <em>{table.seats} seats</em>
              </button>
            ))
          )}
        </div>
        <footer className="table-pick-modal__foot">
          <button type="button" className="chip-btn" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
