/** Company office hours for admin (non-shift) attendance. */

const DOW = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

type DayHours = { openFrom: string; openTo: string; closed: boolean }

function normalizeTime(value: unknown): string {
  if (typeof value !== 'string') return ''
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return ''
  const total = hour * 60 + minute
  let snapped = Math.round(total / 30) * 30
  if (snapped >= 24 * 60) snapped = 0
  return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`
}

function parseHours(json: string | null | undefined): Record<string, DayHours> | null {
  if (!json?.trim() || json === '{}') return null
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const out: Record<string, DayHours> = {}
    let any = false
    for (const key of DOW) {
      const raw = parsed[key]
      if (!raw || typeof raw !== 'object') continue
      const row = raw as Record<string, unknown>
      const openFrom = normalizeTime(row.openFrom ?? row.from)
      const openTo = normalizeTime(row.openTo ?? row.to)
      const closed = Boolean(row.closed)
      if (closed || openFrom || openTo) any = true
      out[key] = { openFrom, openTo, closed }
    }
    return any ? out : null
  } catch {
    return null
  }
}

export function resolveOfficeHoursForDate(
  businessHoursJson: string | null | undefined,
  dateStr: string,
): { closed: boolean; openFrom: string | null; openTo: string | null } | null {
  const hours = parseHours(businessHoursJson)
  if (!hours) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const row = hours[DOW[d.getDay()]]
  if (!row) return { closed: false, openFrom: null, openTo: null }
  if (row.closed) return { closed: true, openFrom: null, openTo: null }
  return {
    closed: false,
    openFrom: row.openFrom || null,
    openTo: row.openTo || null,
  }
}
