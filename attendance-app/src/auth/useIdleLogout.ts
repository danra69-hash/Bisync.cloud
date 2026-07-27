import { useEffect, useRef } from 'react'

const IDLE_MS = 15 * 60 * 1000
const ACTIVITY_KEY = 'bisync_rms_web_last_activity'
const CHECK_MS = 30_000

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'pointerdown',
  'keydown',
  'touchstart',
  'mousemove',
  'scroll',
  'wheel',
]

function now() {
  return Date.now()
}

function readLastActivity(): number {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : now()
  } catch {
    return now()
  }
}

function writeLastActivity(ts: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(ts))
  } catch {
    /* ignore */
  }
}

/**
 * Logs out after `idleMs` without pointer/key/touch/scroll activity.
 * Cross-tab activity shares a localStorage timestamp.
 */
export function useIdleLogout(
  enabled: boolean,
  onIdle: () => void,
  idleMs = IDLE_MS,
) {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled) return

    writeLastActivity(now())
    let lastWrite = 0

    const bump = () => {
      const t = now()
      if (t - lastWrite < 1000) return
      lastWrite = t
      writeLastActivity(t)
    }

    const maybeLogout = () => {
      if (now() - readLastActivity() >= idleMs) {
        onIdleRef.current()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        maybeLogout()
      }
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, bump, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)

    const timer = window.setInterval(maybeLogout, CHECK_MS)
    window.addEventListener('storage', maybeLogout)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', maybeLogout)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, bump)
      }
    }
  }, [enabled, idleMs])
}

export function clearIdleActivityStamp() {
  try {
    localStorage.removeItem(ACTIVITY_KEY)
  } catch {
    /* ignore */
  }
}

export const IDLE_LOGOUT_MS = IDLE_MS
