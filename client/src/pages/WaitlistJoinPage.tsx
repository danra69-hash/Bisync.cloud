import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../api'
import './WaitlistJoinPage.css'

function readQuery() {
  const params = new URLSearchParams(window.location.search)
  const companyId = Number(params.get('c') || params.get('companyId') || 0)
  const locationId = (params.get('l') || params.get('location') || '').trim()
  return {
    companyId: Number.isFinite(companyId) && companyId > 0 ? companyId : 0,
    locationId,
  }
}

/** Public customer form at /WAITLIST — scan QR, enter name / mobile / pax. */
export function WaitlistJoinPage() {
  const query = useMemo(() => readQuery(), [])
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [pax, setPax] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [ticket, setTicket] = useState<{ name: string; pax: number } | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.companyId || !query.locationId) {
      setError('This waitlist link is missing restaurant details. Ask staff for a new QR.')
      return
    }
    const trimmedName = name.trim()
    const trimmedMobile = mobile.trim()
    if (!trimmedName || !trimmedMobile) {
      setError('Name and mobile number are required.')
      return
    }
    if (pax < 1 || pax > 99) {
      setError('Number of guests must be between 1 and 99.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const row = await api.posWaitlistJoin({
        companyId: query.companyId,
        locationExternalId: query.locationId,
        name: trimmedName,
        mobile: trimmedMobile,
        pax: Math.round(pax),
      })
      setTicket({ name: row.name, pax: row.pax })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the waitlist.')
    } finally {
      setBusy(false)
    }
  }

  if (!query.companyId || !query.locationId) {
    return (
      <div className="waitlist-join">
        <div className="waitlist-join__card">
          <p className="waitlist-join__code">Waitlist</p>
          <h1>Link incomplete</h1>
          <p>Ask staff to show the waitlist QR from the POS again.</p>
        </div>
      </div>
    )
  }

  if (done && ticket) {
    return (
      <div className="waitlist-join">
        <div className="waitlist-join__card waitlist-join__card--ok">
          <p className="waitlist-join__code">You&apos;re on the list</p>
          <h1>{ticket.name}</h1>
          <p>
            Party of <strong>{ticket.pax}</strong>. We&apos;ll call you when your table is ready.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="waitlist-join">
      <form className="waitlist-join__card" onSubmit={onSubmit}>
        <p className="waitlist-join__code">Join waitlist</p>
        <h1>Tell us your party</h1>
        <p className="waitlist-join__sub">Enter your name, mobile, and number of guests.</p>

        <label>
          Name
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </label>
        <label>
          Mobile number
          <input
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            placeholder="Mobile number"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </label>
        <label>
          Number of pax
          <input
            type="number"
            min={1}
            max={99}
            value={pax}
            onChange={e => setPax(Number(e.target.value) || 1)}
            required
          />
        </label>

        {error ? <p className="waitlist-join__error" role="alert">{error}</p> : null}

        <button type="submit" disabled={busy}>
          {busy ? 'Joining…' : 'Join waitlist'}
        </button>
      </form>
    </div>
  )
}
