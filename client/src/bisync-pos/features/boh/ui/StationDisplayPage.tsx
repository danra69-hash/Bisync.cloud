import { useEffect, useMemo, useState } from 'react'
import {
  bumpKitchenTicket,
  KDS_TICKETS_EVENT,
  loadKitchenTickets,
  ticketAgeLabel,
  ticketTimestampLabel,
  type KitchenStation,
  type KitchenTicket,
} from '../domain/kitchenTickets'
import './StationDisplayPage.css'

type Props = {
  station: KitchenStation
  /** Short title in chrome — KDS or BDS */
  code: 'KDS' | 'BDS'
  title: string
  subtitle: string
}

type TableDocket = {
  tableLabel: string
  tickets: KitchenTicket[]
  oldestAt: string
}

function groupByTable(tickets: KitchenTicket[]): TableDocket[] {
  const map = new Map<string, KitchenTicket[]>()
  for (const ticket of tickets) {
    const key = ticket.tableLabel?.trim() || 'Walk-in'
    const list = map.get(key) ?? []
    list.push(ticket)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([tableLabel, group]) => {
      const sorted = [...group].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      )
      return {
        tableLabel,
        tickets: sorted,
        oldestAt: sorted[0]?.createdAt ?? new Date().toISOString(),
      }
    })
    .sort((a, b) => Date.parse(a.oldestAt) - Date.parse(b.oldestAt))
}

export function StationDisplayPage({ station, code, title, subtitle }: Props) {
  const [tickets, setTickets] = useState<KitchenTicket[]>(() => loadKitchenTickets())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    function refresh() {
      setTickets(loadKitchenTickets())
    }
    window.addEventListener(KDS_TICKETS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    const ageId = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      window.removeEventListener(KDS_TICKETS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.clearInterval(ageId)
    }
  }, [])

  const dockets = useMemo(
    () =>
      groupByTable(
        tickets.filter(t => t.status === 'open' && t.station === station),
      ),
    [tickets, station],
  )

  function bumpTable(docket: TableDocket) {
    for (const ticket of docket.tickets) {
      bumpKitchenTicket(ticket.id)
    }
    setTickets(loadKitchenTickets())
  }

  return (
    <div className={`station-display station-display--${code.toLowerCase()}`}>
      <header className="station-display__head">
        <div>
          <p className="station-display__code">{code}</p>
          <h1>{title}</h1>
          <p className="station-display__sub">{subtitle}</p>
        </div>
        <div className="station-display__clock" aria-live="polite">
          <strong>{dockets.length}</strong>
          <span>{dockets.length === 1 ? 'table' : 'tables'}</span>
        </div>
      </header>

      {dockets.length === 0 ? (
        <p className="station-display__empty">
          No open {station.toLowerCase()} tickets. Save an order on the register to fire here.
        </p>
      ) : (
        <div className="station-display__board">
          {dockets.map(docket => (
            <article key={docket.tableLabel} className="kitchen-docket">
              <header className="kitchen-docket__head">
                <div className="kitchen-docket__table">
                  <span className="kitchen-docket__label">Table</span>
                  <strong>{docket.tableLabel}</strong>
                </div>
                <div className="kitchen-docket__meta">
                  <time dateTime={docket.oldestAt} className="kitchen-docket__time">
                    {ticketTimestampLabel(docket.oldestAt)}
                  </time>
                  <span className="kitchen-docket__age">{ticketAgeLabel(docket.oldestAt, now)}</span>
                  <span>
                    {docket.tickets.length === 1
                      ? `#${docket.tickets[0].checkNumber}`
                      : `${docket.tickets.length} tickets`}
                  </span>
                </div>
              </header>

              <div className="kitchen-docket__rule" aria-hidden />

              {docket.tickets.map(ticket => (
                <section key={ticket.id} className="kitchen-docket__check">
                  <p className="kitchen-docket__check-no">
                    {docket.tickets.length > 1 ? <span>#{ticket.checkNumber}</span> : null}
                    <time dateTime={ticket.createdAt}>{ticketTimestampLabel(ticket.createdAt)}</time>
                    <span>{ticketAgeLabel(ticket.createdAt, now)}</span>
                    {ticket.dining ? <span>{ticket.dining}</span> : null}
                  </p>
                  <ul className="kitchen-docket__items">
                    {ticket.items.map((item, itemIndex) => (
                      <li key={`${ticket.id}-${item.name}-${item.detail ?? ''}-${itemIndex}`}>
                        <span className="kitchen-docket__qty">{item.quantity}</span>
                        <span className="kitchen-docket__item-body">
                          <span className="kitchen-docket__name">{item.name}</span>
                          {item.detail ? (
                            <span className="kitchen-docket__detail">{item.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <div className="kitchen-docket__rule" aria-hidden />

              <button
                type="button"
                className="kitchen-docket__bump"
                onClick={() => bumpTable(docket)}
              >
                Bump {docket.tableLabel}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
