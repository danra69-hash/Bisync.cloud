import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  TABLE_STATUS_LABEL,
  clamp,
  createTable,
  createZone,
  loadFloorPlan,
  normalizeTable,
  setActiveRegisterSession,
  type FloorPlanState,
  type FloorTable,
  type FloorZone,
  type TableShape,
  type TableStatus,
  type ZoneKind,
} from '../domain/tables'
import { cloneJson } from '../domain/clonePlan'
import {
  loadFloorPlanLocal,
  persistFloorPlanRemote,
  pullFloorPlanFromServer,
  syncFloorPlan,
} from '../domain/floorPlanSync'
import { FLOOR_PLAN_CHANGED_EVENT } from '../domain/reservations'
import { useConfig } from '../../../core/config/ConfigProvider'
import { formatOpenedAt, printTableQr } from '../../../core/config/qrTable'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import { usePosDutySession } from '../../../core/session/usePosDutySession'
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
  const session = usePosSessionOptional()
  const { orderingLocked: locked } = usePosDutySession()
  const locationLabel =
    session?.locations.find(loc => loc.externalId === session.locationId)?.name
    || session?.locationId
    || ''
  const canvasRef = useRef<HTMLDivElement>(null)
  const companyId = session?.companyId ?? 0
  const locationId = session?.locationId ?? ''
  const [plan, setPlan] = useState<FloorPlanState>(() =>
    companyId > 0 && locationId
      ? loadFloorPlanLocal(companyId, locationId)
      : loadFloorPlan(),
  )
  const [editing, setEditing] = useState(editRoute)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [draft, setDraft] = useState<FloorPlanState | null>(() =>
    editRoute
      ? cloneJson(
          companyId > 0 && locationId
            ? loadFloorPlanLocal(companyId, locationId)
            : loadFloorPlan(),
        )
      : null,
  )
  const [drag, setDrag] = useState<DragState | null>(null)
  const [resize, setResize] = useState<ResizeState | null>(null)
  const [openingTableId, setOpeningTableId] = useState<string | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [savingLayout, setSavingLayout] = useState(false)
  const draftRef = useRef<FloorPlanState | null>(null)
  draftRef.current = draft

  useEffect(() => {
    if (!locked) return
    setOpeningTableId(null)
    if (!editRoute) return

    // Autosave in-progress layout before leaving edit mode on lockout.
    const pending = draftRef.current
    if (pending && companyId > 0 && locationId) {
      void persistFloorPlanRemote(pending, companyId, locationId).then(ok => {
        if (ok) setPlan(pending)
      })
    }
    navigate('/order/floor', { replace: true })
  }, [locked, editRoute, navigate, companyId, locationId])

  useEffect(() => {
    if (!companyId || !locationId) return
    let cancelled = false
    void (async () => {
      // Activated offline-first stations always pull the server layout when online
      // so a stale T1–T8 device cache cannot keep hiding Weissbrau.
      const synced = session?.offlineFirst
        ? await pullFloorPlanFromServer(companyId, locationId).catch(() =>
            syncFloorPlan(companyId, locationId),
          )
        : await syncFloorPlan(companyId, locationId)
      if (cancelled) return
      setPlan(prev => {
        // Refresh edit draft from DB unless the user already changed the layout.
        if (editRoute) {
          const currentDraft = draftRef.current
          const dirty = Boolean(
            currentDraft
            && JSON.stringify(currentDraft) !== JSON.stringify(prev),
          )
          if (!dirty) {
            setDraft(cloneJson(synced))
          }
        }
        return synced
      })
    })()
    return () => {
      cancelled = true
    }
    // Re-sync when company/location changes — not when toggling edit route
    // (save navigates away and must not race a stale GET over the just-saved layout).
  }, [companyId, locationId, session?.offlineFirst]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional

  // After Team QR + PIN unlock, force a server pull so the permanent venue layout
  // appears immediately (stale device cache / cold start must not leave Home blank).
  const wasLockedRef = useRef(locked)
  useEffect(() => {
    const wasLocked = wasLockedRef.current
    wasLockedRef.current = locked
    if (locked || !wasLocked || !companyId || !locationId) return
    let cancelled = false
    void pullFloorPlanFromServer(companyId, locationId)
      .catch(() => syncFloorPlan(companyId, locationId))
      .then(synced => {
        if (cancelled || !synced) return
        setPlan(synced)
        setSyncNote(
          synced.tables.length > 0
            ? `Floor plan ready — ${synced.tables.length} tables`
            : 'Floor plan empty on server — use Admin → Reload',
        )
        window.setTimeout(() => setSyncNote(null), 2800)
      })
    return () => {
      cancelled = true
    }
  }, [locked, companyId, locationId])

  // Refresh when Reservation → Assign table updates the floor plan.
  useEffect(() => {
    function refreshFromAssignment() {
      if (editing) return
      const next =
        companyId > 0 && locationId
          ? loadFloorPlanLocal(companyId, locationId)
          : loadFloorPlan()
      setPlan(next)
    }
    window.addEventListener(FLOOR_PLAN_CHANGED_EVENT, refreshFromAssignment)
    return () => window.removeEventListener(FLOOR_PLAN_CHANGED_EVENT, refreshFromAssignment)
  }, [companyId, locationId, editing])

  useEffect(() => {
    if (!editRoute) {
      setEditing(false)
      setDraft(null)
      setSelected(null)
      setDrag(null)
      setResize(null)
      return
    }
    const latest =
      companyId > 0 && locationId
        ? loadFloorPlanLocal(companyId, locationId)
        : loadFloorPlan()
    setPlan(latest)
    setDraft(cloneJson(latest))
    setEditing(true)
    setSelected(null)
    setDrag(null)
    setResize(null)
  }, [editRoute, companyId, locationId])

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
    if (companyId > 0 && locationId) {
      void persistFloorPlanRemote(next, companyId, locationId)
    }
  }

  async function persistLayoutToDb(next: FloorPlanState): Promise<boolean> {
    setPlan(next)
    if (!(companyId > 0 && locationId)) {
      setSyncNote('Select a company and location before saving the floor layout.')
      window.setTimeout(() => setSyncNote(null), 3200)
      return false
    }
    const ok = await persistFloorPlanRemote(next, companyId, locationId)
    if (!ok) {
      setSyncNote('Saved on this device — could not reach the server. Will retry on next sync.')
      window.setTimeout(() => setSyncNote(null), 4200)
      return false
    }
    return true
  }

  function beginRegisterForTable(table: FloorTable, openedAt?: string) {
    setActiveRegisterSession({
      tableId: table.id,
      tableLabel: table.label,
      openedAt,
    })
    navigate('/order/register')
  }

  function openTableWithoutPrompt(table: FloorTable) {
    const openedAt = formatOpenedAt().iso
    const nextTables = plan.tables.map((t) =>
      t.id === table.id
        ? {
            ...t,
            status: 'ordered' as const,
            pax: undefined,
            openedAt,
            orderId: undefined,
            serverName: undefined,
          }
        : t,
    )
    persistPlan({ ...plan, tables: nextTables })
    beginRegisterForTable(table, openedAt)
  }

  function handleTableActivate(table: FloorTable) {
    if (locked) return
    setSelected({ type: 'table', id: table.id })
    if (editing) return

    // Open tables: Fixed opens immediately (no pax / no print). Dynamic asks pax then prints.
    if (table.status === 'open') {
      if (qrTableMode === 'fixed') {
        openTableWithoutPrompt(table)
        return
      }
      setOpeningTableId(table.id)
      return
    }

    // Ordered / reserved — continue service on the register.
    beginRegisterForTable(table, table.openedAt)
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
            orderId: undefined,
            serverName: undefined,
          }
        : t,
    )
    persistPlan({ ...plan, tables: nextTables })
    // Dynamic only — Fixed never reaches this modal.
    printTableQr({
      mode: 'dynamic',
      table: openingTable.label,
      location: locationLabel,
      companyId,
      locationExternalId: locationId,
      pax,
      openedAt,
    })
    setOpeningTableId(null)
    beginRegisterForTable(openingTable, openedAt)
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

  async function saveEdit() {
    if (!draft || savingLayout) return
    setSavingLayout(true)
    try {
      const ok = await persistLayoutToDb(draft)
      setEditing(false)
      setDraft(null)
      setSelected(null)
      if (ok) {
        setSyncNote('Floor layout saved to database for this location')
        window.setTimeout(() => setSyncNote(null), 2800)
      }
      if (editRoute) navigate('/order/floor', { replace: true })
    } finally {
      setSavingLayout(false)
    }
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
    <div className={`floor-page${locked ? ' is-locked' : ''}`}>
      {locked ? (
        <div className="floor-toolbar">
          <span className="floor-edit-hint" role="status">
            Ordering locked — Team QR check-in, then Staff PIN to unlock POS
          </span>
        </div>
      ) : editing ? (
        <div className="floor-toolbar">
          <span className="floor-edit-hint">Edit mode — drag tables & zones</span>
          <button
            type="button"
            className="chip-btn"
            onClick={cancelEdit}
            disabled={savingLayout}
          >
            Cancel
          </button>
          <button
            type="button"
            className="chip-btn chip-btn--primary"
            onClick={() => void saveEdit()}
            disabled={savingLayout}
          >
            {savingLayout ? 'Saving…' : 'Save layout'}
          </button>
        </div>
      ) : syncNote ? (
        <div className="floor-toolbar">
          <span className="floor-edit-hint" role="status">{syncNote}</span>
        </div>
      ) : null}

      <div className={`floor-workspace${editing && !locked ? ' is-editing' : ''}`}>
        <div className="floor-canvas-stage">
        <div
          ref={canvasRef}
          className={`floor-canvas${locked ? ' is-locked' : ''}`}
          onPointerDown={() => {
            if (locked) return
            if (editing) setSelected(null)
          }}
        >
          <div className="floor-canvas__grid" aria-hidden />
          {locked ? (
            <div className="floor-lock-overlay" role="status" aria-live="polite">
              <strong>Home deactivated</strong>
              <span>Check in with Team QR, then enter Staff PIN to unlock POS</span>
            </div>
          ) : null}

          {!locked && visible.tables.length === 0 ? (
            <div className="floor-empty-overlay" role="status">
              <strong>No floor plan on this station</strong>
              <span>Use Admin → Reload to download the venue layout from the cloud.</span>
            </div>
          ) : null}

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
              onPointerDown={(e) => {
                if (locked) return
                beginDrag(e, { type: 'zone', id: zone.id }, zone)
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (locked) return
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
              disabled={locked && !editing}
              aria-disabled={locked}
              onPointerDown={(e) => {
                if (locked) return
                beginDrag(e, { type: 'table', id: table.id }, table)
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (locked) return
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
              {table.status === 'reserved' && (table.reservedTime || table.pax) ? (
                <div className="floor-table__reserved">
                  {[
                    table.reservedTime,
                    table.pax && table.pax > 0 ? `${table.pax} pax` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              ) : null}
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
        </div>

        {editing && !locked && (
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

      {openingTable && !locked && (
        <OpenTableModal
          tableLabel={openingTable.label}
          onCancel={() => setOpeningTableId(null)}
          onConfirm={confirmOpenTable}
        />
      )}
    </div>
  )
}
