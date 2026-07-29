export type TakeawayPickup =
  | { mode: 'now' }
  | { mode: 'scheduled'; hour: number; minute: 0 | 30 }

export function nextHalfHourSlot(from = new Date()): { hour: number; minute: 0 | 30 } {
  const hour = from.getHours()
  const minute = from.getMinutes()
  if (minute === 0) return { hour, minute: 0 }
  if (minute <= 30) return { hour, minute: 30 }
  return { hour: (hour + 1) % 24, minute: 0 }
}

export function formatPickupLabel(pickup: TakeawayPickup | null): string {
  if (!pickup) return ''
  if (pickup.mode === 'now') return 'Make now'
  const hh = String(pickup.hour).padStart(2, '0')
  const mm = String(pickup.minute).padStart(2, '0')
  return `Pick up ${hh}:${mm}`
}

export const PICKUP_HOURS = Array.from({ length: 24 }, (_, hour) => hour)
export const PICKUP_MINUTES: Array<0 | 30> = [0, 30]
