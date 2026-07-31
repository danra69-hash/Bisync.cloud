import { loadFloorPlan, type FloorTable } from '../domain/tables'
import { loadFloorPlanLocal } from '../domain/floorPlanSync'
import './AssignTableModal.css'

type Props = {
  companyId: number
  locationId: string
  guestName: string
  pax: number
  onCancel: () => void
  onPick: (table: FloorTable) => void
}

export function AssignTableModal({
  companyId,
  locationId,
  guestName,
  pax,
  onCancel,
  onPick,
}: Props) {
  const plan =
    companyId > 0 && locationId
      ? loadFloorPlanLocal(companyId, locationId)
      : loadFloorPlan()

  const tables = [...plan.tables].sort((a, b) => {
    const ao = a.status === 'open' ? 0 : a.status === 'reserved' ? 1 : 2
    const bo = b.status === 'open' ? 0 : b.status === 'reserved' ? 1 : 2
    if (ao !== bo) return ao - bo
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  })

  return (
    <div className="assign-table-modal" role="dialog" aria-modal="true" aria-labelledby="assign-table-title">
      <button type="button" className="assign-table-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="assign-table-modal__card">
        <header className="assign-table-modal__head">
          <div>
            <h2 id="assign-table-title">Assign table</h2>
            <p>
              {guestName} · {pax} pax
            </p>
          </div>
          <button type="button" className="assign-table-modal__close" onClick={onCancel} aria-label="Cancel">
            ×
          </button>
        </header>
        <div className="assign-table-modal__grid">
          {tables.length === 0 ? (
            <p className="assign-table-modal__empty">No tables on the floor plan.</p>
          ) : (
            tables.map(table => (
              <button
                key={table.id}
                type="button"
                className={`assign-table-modal__table is-${table.status}`}
                disabled={table.status === 'ordered'}
                onClick={() => onPick(table)}
              >
                <strong>{table.label}</strong>
                <span>
                  {table.status === 'open'
                    ? 'Open'
                    : table.status === 'reserved'
                      ? 'Reserved'
                      : 'In service'}
                </span>
                <em>
                  {table.seats} seats
                  {table.seats < pax ? ' · tight' : ''}
                </em>
              </button>
            ))
          )}
        </div>
        <footer className="assign-table-modal__foot">
          <button type="button" className="chip-btn" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
