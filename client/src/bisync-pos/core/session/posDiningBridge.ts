/** Cross-shell bridge so TopBar can start Take Away on the register. */

export const POS_TAKEAWAY_REQUEST_EVENT = 'bisync-pos-request-takeaway'
export const POS_DINING_CHANGED_EVENT = 'bisync-pos-dining-changed'
const PENDING_TAKEAWAY_KEY = 'bisync-pos-pending-takeaway'

export function requestPosTakeaway() {
  try {
    sessionStorage.setItem(PENDING_TAKEAWAY_KEY, '1')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(POS_TAKEAWAY_REQUEST_EVENT))
}

export function consumePendingTakeawayRequest(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_TAKEAWAY_KEY) !== '1') return false
    sessionStorage.removeItem(PENDING_TAKEAWAY_KEY)
    return true
  } catch {
    return false
  }
}

export function publishPosDiningMode(dining: string) {
  window.dispatchEvent(
    new CustomEvent(POS_DINING_CHANGED_EVENT, { detail: { dining } }),
  )
}

export function readPosDiningFromEvent(event: Event): string {
  const detail = (event as CustomEvent<{ dining?: string }>).detail
  return typeof detail?.dining === 'string' ? detail.dining : ''
}
