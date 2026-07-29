import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  TABLE_STATUS_LABEL,
  clamp,
  createTable,
  createZone,
  loadFloorPlan,
  normalizeTable,
  saveFloorPlan,
  type FloorPlanState,
  type FloorTable,
  type FloorZone,
  type TableShape,
  type TableStatus,
  type ZoneKind,
} from '../domain/tables'
import { useConfig } from '../../../core/config/ConfigProvider'
import { formatOpenedAt, printTableQr } from '../../../core/config/qrTable'
import { OpenTableModal } from './OpenTableModal'
import './FloorPlanPage.css'
import '../../common/FeaturePage.css'

type Selection =
  | { type: 'table'; id: string }
  | { type: 'zone'; id: string }

type DragState = {
  target: Selection
  offsetX: number
  offsetY: number
}

type ResizeState = {
  target: Selection
}

export function FloorPlanPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const editRoute = pathname.endsWith('/floor/edit')
  const { qrTableMode } = useConfig()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<FloorPlanState>(() => loadFloorPlan())
  const [editing, setEditing] = useState(editRoute)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [draft, setDraft] = useState<FloorPlanState | null>(() =>
    editRoute ? structuredClone(loadFloorPlan()) : null,
  )
  const [drag, setDrag] = useState<DragState | null>(null)
  const [resize, setResize] = useState<ResizeState | null>(null)
  const [openingTableId, setOpeningTableId] = useState<string | null>(null)

  useEffect(() => {
    if (!editRoute) {
      setEditing(false)
      setDraft(null)
      setSelected(null)
      setDrag(null)
      setResize(null)
      return
    }
    const latest = loadFloorPlan()
    setPlan(latest)
    setDraft(structuredClone(latest))
    setEditing(true)
    setSelected(null)
    setDrag(null)
    setResize(null)
  }, [editRoute])

  const visible = editing && draft ? draft : plan
  const selectedTable =
    selected?.type === 'table'
      ? visible.tables.find((t) => t.id === selected.id) ?? null
      : null
  const selectedZone =
    selected?.type === 'zone'
      ? visible.zones.find((z) => z.id === selected.id) ?? null
      : null
  const openingTable =
    openingTableId == null
      ? null
      : plan.tables.find((t) => t.id === openingTableId) ?? null

  function persistPlan(next: FloorPlanState) {
    setPlan(next)
    saveFloorPlan(next)
  }

  function printFixedQr(table: FloorTable) {
    printTableQr({ mode: 'fixed', table: table.label })
  }

  function handlePrintQrClick() {
    if (qrTableMode !== 'fixed') return
    if (!selectedTable) {
      window.alert('Select a table on the floor plan, then print its QR.')
      return
    }
    printFixedQr(selectedTable)
  }

  function handleTableActivate(table: FloorTable) {
    setSelected({ type: 'table', id: table.id })
    if (editing) return

    if (qrTableMode === 'dynamic' && table.status === 'open') {
      setOpeningTableId(table.id)
      return
    }

    if (qrTableMode === 'fixed') {
      // Selection only — use Print table QR or Take Order.
      return
    }

    navigate('/order/register')
  }

  function confirmOpenTable(pax: number) {
    if (!openingTable) return
    const openedAt = formatOpenedAt().iso
    const nextTables = plan.tables.map((t) =>
      t.id === openingTable.id
        ? {
            ...t,
            status: 'ordered' as const,
            pax,
            openedAt,
          }
        : t,
    )
    persistPlan({ ...plan, tables: nextTables })
    printTableQr({
      mode: 'dynamic',
      table: openingTable.label,
      pax,
      openedAt,
    })
    setOpeningTableId(null)
    navigate('/order/register')
  }

  useEffect(() => {
    if ((!drag && !resize) || !editing) return

    function onMove(e: PointerEvent) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const xPct = ((e.clientX - rect.left) / rect.width) * 100
      const yPct = ((e.clientY - rect.top) / rect.height) * 100

      if (drag) {
        const nextX = xPct - drag.offsetX
        const nextY = yPct - drag.offsetY
        setDraft((prev) => {
          if (!prev) return prev
          if (drag.target.type === 'table') {
            return {
              ...prev,
              tables: prev.tables.map((t) =>
                t.id === drag.target.id
                  ? {
                      ...t,
                      x: clamp(nextX, 0, 100 - t.w),
                      y: clamp(nextY, 0, 100 - t.h),
                    }
                  : t,
              ),
            }
          }
          return {
            ...prev,
            zones: prev.zones.map((z) =>
              z.id === drag.target.id
                ? {
                    ...z,
                    x: clamp(nextX, 0, 100 - z.w),
                    y: clamp(nextY, 0, 100 - z.h),
                  }
                : z,
            ),
          }
        })
      }

      if (resize) {
        setDraft((prev) => {
          if (!prev) return prev
          if (resize.target.type === 'table') {
            return {
              ...prev,
              tables: prev.tables.map((t) => {
                if (t.id !== resize.target.id) return t
                let w = clamp(xPct - t.x, 8, 100 - t.x)
                let h = clamp(yPct - t.y, 8, 100 - t.y)
                if (t.shape === 'round') {
                  // Size from width %; aspect-ratio CSS keeps it a true circle.
                  const size = clamp(w, 8, 100 - t.x)
                  return normalizeTable({ ...t, w: size, h: size })
                }
                return { ...t, w, h }
              }),
            }
          }
          return {
            ...prev,
            zones: prev.zones.map((z) => {
              if (z.id !== resize.target.id) return z
              const w = clamp(xPct - z.x, 8, 100 - z.x)
              const h = clamp(yPct - z.y, 8, 100 - z.y)
              return { ...z, w, h }
            }),
          }
        })
      }
    }

    function onUp() {
      setDrag(null)
      setResize(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, resize, editing])

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
    setSelected(null)
    setDrag(null)
    setResize(null)
    if (editRoute) navigate('/order/floor', { replace: true })
  }

  function saveEdit() {
    if (!draft) return
    setPlan(draft)
    saveFloorPlan(draft)
    setEditing(false)
    setDraft(null)
    setSelected(null)
    if (editRoute) navigate('/order/floor', { replace: true })
  }

  function updateSelectedTable(patch: Partial<FloorTable>) {
    if (!selectedTable || !draft) return
    setDraft({
      ...draft,
      tables: draft.tables.map((t) =>
        t.id === selectedTable.id
          ? normalizeTable({ ...t, ...patch })
          : t,
      ),
    })
  }

  function updateSelectedZone(patch: Partial<FloorZone>) {
    if (!selectedZone || !draft) return
    setDraft({
      ...draft,
      zones: draft.zones.map((z) =>
        z.id === selectedZone.id ? { ...z, ...patch } : z,
      ),
    })
  }

  function addTable(shape: TableShape = 'square') {
    if (!draft) return
    const next = createTable(draft.tables, { shape, x: 42, y: 38 })
    setDraft({ ...draft, tables: [...draft.tables, next] })
    setSelected({ type: 'table', id: next.id })
  }

  function addZone(kind: ZoneKind) {
    if (!draft) return
    const existing = draft.zones.find((z) => z.kind === kind)
    if ((kind === 'bar' || kind === 'kitchen') && existing) {
      setSelected({ type: 'zone', id: existing.id })
      return
    }
    const next = createZone(draft.zones, kind)
    setDraft({ ...draft, zones: [...draft.zones, next] })
    setSelected({ type: 'zone', id: next.id })
  }

  function removeSelected() {
    if (!selected || !draft) return
    if (selected.type === 'table') {
      setDraft({
        ...draft,
        tables: draft.tables.filter((t) => t.id !== selected.id),
      })
    } else {
      setDraft({
        ...draft,
        zones: draft.zones.filter((z) => z.id !== selected.id),
      })
    }
    setSelected(null)
  }

  function beginDrag(
    e: ReactPointerEvent,
    target: Selection,
    item: { x: number; y: number },
  ) {
    if (!editing) return
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pointerX = ((e.clientX - rect.left) / rect.width) * 100
    const pointerY = ((e.clientY - rect.top) / rect.height) * 100
    setSelected(target)
    setDrag({
      target,
      offsetX: pointerX - item.x,
      offsetY: pointerY - item.y,
    })
  }

  function beginResize(e: ReactPointerEvent, target: Selection) {
    if (!editing) return
    e.preventDefault()
    e.stopPropagation()
    setSelected(target)
    setResize({ target })
  }

  return (
    <div className="floor-page">
      <div className="floor-toolbar">
        {editing ? (
          <>
            <span className="floor-edit-hint">Edit mode — drag tables & zones</span>
            <button type="button" className="chip-btn" onClick={cancelEdit}>
              Cancel
            </button>
            <button
              type="button"
              className="chip-btn chip-btn--primary"
              onClick={saveEdit}
            >
              Save layout
            </button>
          </>
        ) : (
          <>
            {qrTableMode === 'fixed' && (
              <button
                type="button"
                className="chip-btn"
                onClick={handlePrintQrClick}
                disabled={!selectedTable}
                title={
                  selectedTable
                    ? `Print QR for ${selectedTable.label}`
                    : 'Select a table first'
                }
              >
                Print table QR
              </button>
            )}
            <button
              type="button"
              className="chip-btn chip-btn--primary"
              onClick={() => navigate('/order/register')}
            >
              Take Order
            </button>
          </>
        )}
      </div>

      <div className={`floor-workspace${editing ? ' is-editing' : ''}`}>
        <div
          ref={canvasRef}
          className="floor-canvas"
          onPointerDown={() => {
            if (editing) setSelected(null)
          }}
        >
          <div className="floor-canvas__grid" aria-hidden />

          {visible.zones.map((zone) => (
            <div
              key={zone.id}
              role={editing ? 'button' : 'presentation'}
              tabIndex={editing ? 0 : undefined}
              className={[
                'floor-zone',
                `floor-zone--${zone.kind}`,
                selected?.type === 'zone' && selected.id === zone.id
                  ? 'is-selected'
                  : '',
                editing ? 'is-editable' : '',
                drag?.target.type === 'zone' && drag.target.id === zone.id
                  ? 'is-dragging'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.w}%`,
                height: `${zone.h}%`,
              }}
              onPointerDown={(e) =>
                beginDrag(e, { type: 'zone', id: zone.id }, zone)
              }
              onClick={(e) => {
                e.stopPropagation()
                if (editing) setSelected({ type: 'zone', id: zone.id })
              }}
            >
              <span className="floor-zone__label">{zone.label}</span>
              {editing && (
                <span
                  className="floor-resize-handle"
                  onPointerDown={(e) =>
                    beginResize(e, { type: 'zone', id: zone.id })
                  }
                  title="Resize"
                />
              )}
            </div>
          ))}

          {visible.tables.map((table) => (
            <button
              key={table.id}
              type="button"
              className={[
                'floor-table',
                `floor-table--${table.status}`,
                `floor-table--${table.shape}`,
                selected?.type === 'table' && selected.id === table.id
                  ? 'is-selected'
                  : '',
                editing ? 'is-draggable' : '',
                drag?.target.type === 'table' && drag.target.id === table.id
                  ? 'is-dragging'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: `${table.x}%`,
                top: `${table.y}%`,
                width: `${table.w}%`,
                ...(table.shape === 'round'
                  ? {}
                  : { height: `${table.h}%` }),
              }}
              onPointerDown={(e) =>
                beginDrag(e, { type: 'table', id: table.id }, table)
              }
              onClick={(e) => {
                e.stopPropagation()
                if (editing) {
                  setSelected({ type: 'table', id: table.id })
                  return
                }
                handleTableActivate(table)
              }}
            >
              <div className="floor-table__label">{table.label}</div>
              <div className="floor-table__meta">
                {table.seats} · {table.section}
              </div>
              <span className={`status-pill status-pill--${table.status}`}>
                {TABLE_STATUS_LABEL[table.status]}
              </span>
              {table.status === 'reserved' && table.reservedTime && (
                <div className="floor-table__reserved">
                  {table.reservedTime}
                  {table.reservedName ? ` · ${table.reservedName}` : ''}
                </div>
              )}
              {table.serverName && table.status !== 'reserved' && !editing && (
                <div className="floor-table__server">{table.serverName}</div>
              )}
              {editing && (
                <span
                  className="floor-resize-handle"
                  onPointerDown={(e) =>
                    beginResize(e, { type: 'table', id: table.id })
                  }
                  title="Resize"
                />
              )}
            </button>
          ))}
        </div>

        {editing && (
          <aside className="floor-inspector">
            <h3>Layout tools</h3>
            <div className="floor-inspector__actions">
              <button type="button" className="chip-btn" onClick={() => addTable('square')}>
                + Square
              </button>
              <button type="button" className="chip-btn" onClick={() => addTable('round')}>
                + Round
              </button>
              <button type="button" className="chip-btn" onClick={() => addTable('oval')}>
                + Oval
              </button>
              <button type="button" className="chip-btn" onClick={() => addTable('rect')}>
                + Banquet
              </button>
            </div>
            <div className="floor-inspector__actions">
              <button type="button" className="chip-btn" onClick={() => addZone('bar')}>
                + Bar
              </button>
              <button type="button" className="chip-btn" onClick={() => addZone('kitchen')}>
                + Kitchen
              </button>
              <button type="button" className="chip-btn" onClick={() => addZone('custom')}>
                + Area
              </button>
            </div>

            {selectedTable ? (
              <div className="floor-inspector__form">
                <h4>Table · {selectedTable.label}</h4>
                <label>
                  Label
                  <input
                    value={selectedTable.label}
                    onChange={(e) =>
                      updateSelectedTable({ label: e.target.value })
                    }
                  />
                </label>
                <label>
                  Seats
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedTable.seats}
                    onChange={(e) =>
                      updateSelectedTable({
                        seats: clamp(Number(e.target.value) || 1, 1, 20),
                      })
                    }
                  />
                </label>
                <label>
                  Section
                  <select
                    value={selectedTable.section}
                    onChange={(e) =>
                      updateSelectedTable({ section: e.target.value })
                    }
                  >
                    {['Main', 'Patio', 'Bar', 'Private'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={selectedTable.status}
                    onChange={(e) => {
                      const status = e.target.value as TableStatus
                      updateSelectedTable({
                        status,
                        reservedTime:
                          status === 'reserved'
                            ? selectedTable.reservedTime || '19:00'
                            : undefined,
                      })
                    }}
                  >
                    {(Object.keys(TABLE_STATUS_LABEL) as TableStatus[]).map(
                      (status) => (
                        <option key={status} value={status}>
                          {TABLE_STATUS_LABEL[status]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {selectedTable.status === 'reserved' && (
                  <>
                    <label>
                      Reserved time
                      <input
                        type="time"
                        value={selectedTable.reservedTime ?? '19:00'}
                        onChange={(e) =>
                          updateSelectedTable({ reservedTime: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Guest name
                      <input
                        value={selectedTable.reservedName ?? ''}
                        placeholder="Optional"
                        onChange={(e) =>
                          updateSelectedTable({
                            reservedName: e.target.value || undefined,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  Shape
                  <select
                    value={selectedTable.shape}
                    onChange={(e) => {
                      const shape = e.target.value as TableShape
                      const size =
                        shape === 'rect'
                          ? { w: 18, h: 24 }
                          : shape === 'oval'
                            ? { w: 12, h: 18 }
                            : shape === 'round'
                              ? { w: 14, h: 14 }
                              : { w: 14, h: 20 }
                      updateSelectedTable({ shape, ...size })
                    }}
                  >
                    <option value="square">Square</option>
                    <option value="round">Round</option>
                    <option value="oval">Oval</option>
                    <option value="rect">Banquet</option>
                  </select>
                </label>
                <label>
                  {selectedTable.shape === 'round' ? 'Size %' : 'Width %'}
                  <input
                    type="number"
                    min={8}
                    max={100}
                    value={Math.round(selectedTable.w)}
                    onChange={(e) => {
                      const w = clamp(
                        Number(e.target.value) || 8,
                        8,
                        100 - selectedTable.x,
                      )
                      updateSelectedTable(
                        selectedTable.shape === 'round' ? { w, h: w } : { w },
                      )
                    }}
                  />
                </label>
                {selectedTable.shape !== 'round' && (
                  <label>
                    Height %
                    <input
                      type="number"
                      min={8}
                      max={100}
                      value={Math.round(selectedTable.h)}
                      onChange={(e) => {
                        const h = clamp(
                          Number(e.target.value) || 8,
                          8,
                          100 - selectedTable.y,
                        )
                        updateSelectedTable({ h })
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="chip-btn chip-btn--danger"
                  onClick={removeSelected}
                >
                  Delete table
                </button>
              </div>
            ) : selectedZone ? (
              <div className="floor-inspector__form">
                <h4>Zone · {selectedZone.label}</h4>
                <label>
                  Label
                  <input
                    value={selectedZone.label}
                    onChange={(e) =>
                      updateSelectedZone({ label: e.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={selectedZone.kind}
                    onChange={(e) =>
                      updateSelectedZone({ kind: e.target.value as ZoneKind })
                    }
                  >
                    <option value="bar">Bar</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="custom">Custom area</option>
                  </select>
                </label>
                <label>
                  Width %
                  <input
                    type="number"
                    min={8}
                    max={100}
                    value={Math.round(selectedZone.w)}
                    onChange={(e) =>
                      updateSelectedZone({
                        w: clamp(Number(e.target.value) || 8, 8, 100 - selectedZone.x),
                      })
                    }
                  />
                </label>
                <label>
                  Height %
                  <input
                    type="number"
                    min={8}
                    max={100}
                    value={Math.round(selectedZone.h)}
                    onChange={(e) =>
                      updateSelectedZone({
                        h: clamp(Number(e.target.value) || 8, 8, 100 - selectedZone.y),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="chip-btn chip-btn--danger"
                  onClick={removeSelected}
                >
                  Delete zone
                </button>
              </div>
            ) : (
              <p className="floor-inspector__empty">
                Select a table or zone, or add a new one.
              </p>
            )}
          </aside>
        )}
      </div>

      {openingTable && (
        <OpenTableModal
          tableLabel={openingTable.label}
          onCancel={() => setOpeningTableId(null)}
          onConfirm={confirmOpenTable}
        />
      )}
    </div>
  )
}
