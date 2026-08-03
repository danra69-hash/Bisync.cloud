/** POS kiosk / fullscreen helpers for Chrome on Windows, Android, and iOS. */

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.(
    '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)',
  )
  return (
    mq?.matches === true
    || ('standalone' in navigator
      && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

/** Query intent: /POS?fs=1 from desktop launchers / station links. */
export function wantsPosFullscreen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('fs') === '1' || params.get('fullscreen') === '1'
  } catch {
    return false
  }
}

export function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null
    msFullscreenElement?: Element | null
  }
  return Boolean(
    document.fullscreenElement
    || doc.webkitFullscreenElement
    || doc.msFullscreenElement,
  )
}

export async function enterPosFullscreen(
  el: Element | null = typeof document !== 'undefined' ? document.documentElement : null,
): Promise<boolean> {
  if (!el) return false
  const anyEl = el as Element & {
    requestFullscreen?: (options?: FullscreenOptions) => Promise<void>
    webkitRequestFullscreen?: () => Promise<void>
    msRequestFullscreen?: () => Promise<void>
  }
  try {
    if (anyEl.requestFullscreen) {
      await anyEl.requestFullscreen({ navigationUI: 'hide' })
      return true
    }
    if (anyEl.webkitRequestFullscreen) {
      await anyEl.webkitRequestFullscreen()
      return true
    }
    if (anyEl.msRequestFullscreen) {
      await anyEl.msRequestFullscreen()
      return true
    }
  } catch {
    return false
  }
  return false
}

export async function exitPosFullscreen(): Promise<boolean> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void>
    msExitFullscreen?: () => Promise<void>
  }
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen()
      return true
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen()
      return true
    }
    if (doc.msExitFullscreen) {
      await doc.msExitFullscreen()
      return true
    }
  } catch {
    return false
  }
  return false
}

/** Lock document to the device viewport (no page scroll / bounce). */
export function setPosViewportLock(locked: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('pos-kiosk-lock', locked)
  document.body?.classList.toggle('pos-kiosk-lock', locked)
}

export function subscribeFullscreenChange(handler: () => void): () => void {
  const events = ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'] as const
  for (const event of events) {
    document.addEventListener(event, handler)
  }
  const mq = window.matchMedia?.(
    '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)',
  )
  mq?.addEventListener?.('change', handler)
  return () => {
    for (const event of events) {
      document.removeEventListener(event, handler)
    }
    mq?.removeEventListener?.('change', handler)
  }
}
