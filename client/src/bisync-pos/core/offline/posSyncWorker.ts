import { flushPosOutbox } from './posOutbox'

const HOUR_MS = 60 * 60 * 1000
let started = false
let timer: ReturnType<typeof setInterval> | null = null

/**
 * Background lift of device transaction outbox to the server.
 * Runs every hour, on online, and when the tab becomes visible.
 */
export function startPosSyncWorker(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const tick = () => {
    void flushPosOutbox().catch(() => { /* best-effort */ })
  }

  tick()
  timer = window.setInterval(tick, HOUR_MS)

  window.addEventListener('online', tick)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick()
  })
}

export function stopPosSyncWorker(): void {
  if (timer != null) {
    window.clearInterval(timer)
    timer = null
  }
  started = false
}
