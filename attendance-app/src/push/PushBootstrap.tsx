import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  enableWebPush,
  isPushEnabledLocally,
  isWebPushConfigured,
  listenForForegroundPush,
} from './webPush'
import { showAppNotification } from './showAppNotification'

/**
 * Registers FCM after login and shows foreground banners.
 * Background delivery is handled by the service worker (works while logged out).
 */
export function PushBootstrap() {
  const { token } = useAuth()
  const [banner, setBanner] = useState<{
    title: string
    body: string
    path: string
  } | null>(null)

  useEffect(() => {
    if (!token || !isWebPushConfigured()) return
    let cancelled = false
    void (async () => {
      try {
        if (typeof Notification === 'undefined') return
        // Only auto-sync when already enabled locally — avoid racing Profile "Enable"
        // and hanging getToken on first visit.
        if (
          Notification.permission === 'granted' &&
          isPushEnabledLocally()
        ) {
          await enableWebPush(token)
        }
      } catch {
        /* permission denied or Firebase config / API issue */
      }
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !isWebPushConfigured()) return
    let unsub: (() => void) | undefined
    let alive = true
    void listenForForegroundPush((title, body, path) => {
      if (!alive) return
      setBanner({ title, body, path })
      void showAppNotification({ title, body, url: path })
    }).then((fn) => {
      if (typeof fn === 'function') unsub = fn
    })
    return () => {
      alive = false
      unsub?.()
    }
  }, [token])

  if (!banner) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 72,
        zIndex: 80,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--color-surface, #1a120c)',
        color: 'var(--color-on-surface, #fff)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>{banner.title}</strong>
        <span style={{ opacity: 0.9, fontSize: 14 }}>{banner.body}</span>
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ flexShrink: 0 }}
        onClick={() => {
          const path = banner.path
          setBanner(null)
          window.location.assign(path)
        }}
      >
        View
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ flexShrink: 0 }}
        onClick={() => setBanner(null)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
