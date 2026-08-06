import { useMemo, useState } from 'react'
import {
  TABLE_STATUS_LABEL,
  loadFloorPlan,
  type FloorTable,
} from '../domain/tables'
import {
  loadFloorPlanDocumentLocal,
  loadFloorPlanLocal,
} from '../domain/floorPlanSync'
import {
  documentToActivePlan,
  setActiveFloorKey,
  type FloorPlanDocument,
} from '../domain/multiFloor'
import { loadOpenCheckForTable } from '../../register/domain/openChecks'
import './FloorPlanPage.css'
import './FloorPlanTablePickerModal.css'

export type FloorPlanTablePickerMode = 'changeTable' | 'moveProduct'

type Props = {
  companyId: number
  locationId: string
  mode: FloorPlanTablePickerMode
  excludeTableId?: string | null
  onCancel: () => void
  onPick: (table: FloorTable) => void
}

function emptyDocFromLegacy(): FloorPlanDocument {
  const plan = loadFloorPlan()
  return {
    floors: [{
      key: 'ground',
      name: 'Ground floor',
      sortOrder: 0,
      tables: plan.tables,
      zones: plan.zones,
    }],
    activeFloorKey: 'ground',
  }
}

export function FloorPlanTablePickerModal({
  companyId,
  locationId,
  mode,
  excludeTableId = null,
  onCancel,
  onPick,
}: Props) {
  const [doc, setDoc] = useState<FloorPlanDocument>(() =>
    companyId > 0 && locationId
      ? loadFloorPlanDocumentLocal(companyId, locationId)
      : emptyDocFromLegacy(),
  )

  const plan = useMemo(() => documentToActivePlan(doc), [doc])
  const floors = useMemo(
    () => [...doc.floors].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [doc.floors],
  )

  const title = mode === 'changeTable' ? 'Change Table' : 'Move Product'
  const subtitle = mode === 'changeTable'
    ? 'Tap a free table on the floor plan to move this check.'
    : 'Tap a destination table for the highlighted product(s).'

  function tableBlocked(table: FloorTable): { blocked: boolean; reason?: string } {
    if (excludeTableId && table.id === excludeTableId) {
      return { blocked: true, reason: 'Current' }
    }
    if (mode === 'changeTable') {
      const occupying = loadOpenCheckForTable(table.id)
      if (occupying && occupying.lines.length > 0) {
        return { blocked: true, reason: 'In use' }
      }
      if (table.status === 'ordered') {
        return { blocked: true, reason: 'In use' }
      }
    }
    return { blocked: false }
  }

  return (
    <div
      className="floor-pick-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="floor-pick-title"
    >
      <button
        type="button"
        className="floor-pick-modal__backdrop"
        aria-label="Close"
        onClick={onCancel}
      />
      <div className="floor-pick-modal__card">
        <header className="floor-pick-modal__head">
          <div>
            <h2 id="floor-pick-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            type="button"
            className="floor-pick-modal__close"
            onClick={onCancel}
            aria-label="Cancel"
          >
            ×
          </button>
        </header>

        {floors.length > 1 ? (
          <div className="floor-pick-modal__floors" role="tablist" aria-label="Floors">
            {floors.map(floor => (
              <button
                key={floor.key}
                type="button"
                role="tab"
                aria-selected={doc.activeFloorKey === floor.key}
                className={
                  doc.activeFloorKey === floor.key
                    ? 'floor-pick-modal__floor is-active'
                    : 'floor-pick-modal__floor'
                }
                onClick={() => setDoc(prev => setActiveFloorKey(prev, floor.key))}
              >
                {floor.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="floor-pick-modal__stage">
          <div className="floor-canvas-stage">
            <div className="floor-canvas floor-pick-modal__canvas" aria-label="Floor plan">
              <div className="floor-canvas__grid" aria-hidden />
              {plan.zones.map(zone => (
                <div
                  key={zone.id}
                  className={`floor-zone floor-zone--${zone.kind}`}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.w}%`,
                    height: `${zone.h}%`,
                  }}
                >
                  <span className="floor-zone__label">{zone.label}</span>
                </div>
              ))}
              {plan.tables.length === 0 ? (
                <p className="floor-pick-modal__empty">No tables on this floor plan.</p>
              ) : (
                plan.tables.map(table => {
                  const { blocked, reason } = tableBlocked(table)
                  return (
                    <button
                      key={table.id}
                      type="button"
                      className={[
                        'floor-table',
                        `floor-table--${table.status}`,
                        `floor-table--${table.shape}`,
                        blocked ? 'is-blocked' : '',
                      ].filter(Boolean).join(' ')}
                      style={{
                        left: `${table.x}%`,
                        top: `${table.y}%`,
                        width: `${table.w}%`,
                        height: `${table.h}%`,
                      }}
                      disabled={blocked}
                      title={blocked ? (reason ?? 'Unavailable') : `Select ${table.label}`}
                      onClick={() => {
                        if (blocked) return
                        onPick(table)
                      }}
                    >
                      <div className="floor-table__label">{table.label}</div>
                      <div className="floor-table__meta">
                        {table.seats} · {table.section}
                      </div>
                      <span className={`status-pill status-pill--${table.status}`}>
                        {blocked && reason ? reason : TABLE_STATUS_LABEL[table.status]}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <footer className="floor-pick-modal__foot">
          <p className="floor-pick-modal__hint">
            {mode === 'changeTable'
              ? 'Only free tables can receive the whole check.'
              : 'Occupied tables are allowed — products join that check.'}
          </p>
          <button type="button" className="chip-btn" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Prefetch helper kept for callers that only need the active floor table list. */
export function loadPickerFloorTables(companyId: number, locationId: string): FloorTable[] {
  if (companyId > 0 && locationId) return loadFloorPlanLocal(companyId, locationId).tables
  return loadFloorPlan().tables
}
