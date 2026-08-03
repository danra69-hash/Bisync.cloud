import { useEffect, useMemo, useState } from 'react'
import {
  enterPosFullscreen,
  exitPosFullscreen,
  isAndroidDevice,
  isDocumentFullscreen,
  isIosDevice,
  isStandaloneDisplay,
  subscribeFullscreenChange,
  wantsPosFullscreen,
} from '../../data/posKiosk'
import './PosDesktopInstall.css'

const DISMISS_KEY = 'bisync-pos-desktop-install-dismissed'
const INSTALLED_KEY = 'bisync-pos-desktop-installed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Props = {
  /** Compact toolbar row vs card prompt. */
  variant?: 'toolbar' | 'card'
  companyId?: number | null
  locationId?: string
  /**
   * When true (standalone /POS kiosk), hide the toolbar once fullscreen/PWA
   * so the POS fills the whole device screen. A floating control remains.
   */
  kioskMode?: boolean
  /** Notify parent when document fullscreen / display-mode changes. */
  onKioskChange?: (active: boolean) => void
}

/**
 * Install / download Bisync POS for desktop and enter fullscreen kiosk use.
 * Optimized for Google Chrome on Windows, Android, and iOS (Add to Home Screen).
 */
export function PosDesktopInstall({
  variant = 'toolbar',
  companyId = null,
  locationId = '',
  kioskMode = false,
  onKioskChange,
}: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const [fsNote, setFsNote] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(() => isDocumentFullscreen() || isStandaloneDisplay())
  const [needsGesture, setNeedsGesture] = useState(false)
  const [chromeExpanded, setChromeExpanded] = useState(false)

  const posUrl = useMemo(() => {
    const url = new URL('/POS', window.location.origin)
    if (companyId != null && companyId > 0) url.searchParams.set('c', String(companyId))
    if (locationId.trim()) url.searchParams.set('l', locationId.trim())
    url.searchParams.set('fs', '1')
    return url.toString()
  }, [companyId, locationId])

  const desktopZipUrl = '/downloads/bisync-pos-desktop.zip'
  const ios = isIosDevice()
  const android = isAndroidDevice()

  useEffect(() => {
    const sync = () => {
      const active = isDocumentFullscreen() || isStandaloneDisplay()
      setFullscreen(active)
      onKioskChange?.(active)
      if (active) setNeedsGesture(false)
    }
    sync()
    return subscribeFullscreenChange(sync)
  }, [onKioskChange])

  useEffect(() => {
    if (!wantsPosFullscreen() && !isStandaloneDisplay()) return
    let cancelled = false
    void (async () => {
      if (isStandaloneDisplay() || isDocumentFullscreen()) return
      // Chrome blocks fullscreen without a user gesture — try once, then prompt.
      const ok = await enterPosFullscreen(document.documentElement)
      if (cancelled) return
      if (!ok && !ios) setNeedsGesture(true)
    })()
    return () => {
      cancelled = true
    }
  }, [ios])

  useEffect(() => {
    if (variant !== 'card') return
    if (
      isStandaloneDisplay()
      || localStorage.getItem(INSTALLED_KEY) === '1'
      || localStorage.getItem(DISMISS_KEY) === '1'
    ) {
      return
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setCardVisible(true)
      setIosHelp(false)
    }
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1')
      setCardVisible(false)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    const timer = window.setTimeout(() => {
      if (isStandaloneDisplay()) return
      setCardVisible(true)
      if (ios) setIosHelp(true)
    }, 900)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [variant, ios])

  async function installPwa() {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1')
      else localStorage.setItem(DISMISS_KEY, '1')
      setDeferred(null)
      setCardVisible(false)
      return
    }
    setIosHelp(true)
    setCardVisible(true)
  }

  async function goFullscreen() {
    const ok = await enterPosFullscreen(document.documentElement)
    if (ok) {
      setNeedsGesture(false)
      setFsNote('Fullscreen on — POS matches your screen')
      window.focus()
    } else if (ios) {
      setFsNote('On iPhone/iPad: Share → Add to Home Screen for full-screen POS.')
    } else {
      setFsNote('Tap Full screen again, or use the desktop Chrome launcher.')
    }
    window.setTimeout(() => setFsNote(null), 3200)
  }

  async function leaveFullscreen() {
    await exitPosFullscreen()
    setChromeExpanded(true)
  }

  function dismissCard() {
    localStorage.setItem(DISMISS_KEY, '1')
    setCardVisible(false)
  }

  const hideToolbar = kioskMode && fullscreen && !chromeExpanded
  const showFab = kioskMode

  const toolbar = hideToolbar ? null : (
    <div className="pos-desktop-toolbar" role="group" aria-label="POS desktop controls">
      <button type="button" className="pos-desktop-btn pos-desktop-btn--primary" onClick={() => void goFullscreen()}>
        Full screen
      </button>
      {fullscreen ? (
        <button type="button" className="pos-desktop-btn" onClick={() => void leaveFullscreen()}>
          Exit full screen
        </button>
      ) : null}
      <a className="pos-desktop-btn" href={desktopZipUrl} download>
        Download desktop
      </a>
      <button type="button" className="pos-desktop-btn" onClick={() => void installPwa()}>
        Install app
      </button>
      <a className="pos-desktop-btn pos-desktop-btn--ghost" href={posUrl} target="_blank" rel="noreferrer">
        Open POS window
      </a>
      {fsNote ? <span className="pos-desktop-note">{fsNote}</span> : null}
      {android || (!ios && !android) ? (
        <span className="pos-desktop-note pos-desktop-note--hint">
          Best in Google Chrome · fills your device screen
        </span>
      ) : null}
      {kioskMode && fullscreen ? (
        <button
          type="button"
          className="pos-desktop-btn pos-desktop-btn--ghost"
          onClick={() => setChromeExpanded(false)}
        >
          Hide bar
        </button>
      ) : null}
    </div>
  )

  return (
    <>
      {toolbar}
      {showFab ? (
        <button
          type="button"
          className="pos-desktop-fab"
          aria-label={fullscreen ? 'POS screen controls' : 'Enter full screen'}
          title={fullscreen ? 'Show controls' : 'Enter full screen'}
          onClick={() => {
            if (!fullscreen) void goFullscreen()
            else setChromeExpanded(v => !v)
          }}
        >
          {fullscreen ? '⋯' : '⛶'}
        </button>
      ) : null}
      {needsGesture && !fullscreen ? (
        <button
          type="button"
          className="pos-desktop-fs-gate"
          onClick={() => void goFullscreen()}
        >
          <strong>Tap to enter full screen</strong>
          <span>POS will fill your device screen and stay on top in Chrome</span>
        </button>
      ) : null}
      {variant === 'card' && cardVisible ? (
        <div className="pos-desktop-prompt" role="dialog" aria-labelledby="pos-desktop-prompt-title">
          <div className="pos-desktop-prompt__card">
            <img src="/pwa-192x192.png" alt="" width={48} height={48} />
            <div className="pos-desktop-prompt__copy">
              <strong id="pos-desktop-prompt-title">Install Bisync POS</strong>
              {iosHelp || !deferred ? (
                <p>
                  {ios
                    ? 'Tap Share, then Add to Home Screen for a full-screen POS icon that matches your iPhone/iPad display.'
                    : 'Install the Chrome app, or download the desktop launcher for Windows fullscreen POS on top of other windows.'}
                </p>
              ) : (
                <p>Add Bisync POS to your desktop for one-tap full-screen use that matches your screen size.</p>
              )}
            </div>
            <div className="pos-desktop-prompt__actions">
              {deferred ? (
                <button type="button" className="pos-desktop-btn pos-desktop-btn--primary" onClick={() => void installPwa()}>
                  Install
                </button>
              ) : (
                <a className="pos-desktop-btn pos-desktop-btn--primary" href={desktopZipUrl} download>
                  Download desktop
                </a>
              )}
              <button type="button" className="pos-desktop-btn" onClick={dismissCard}>
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
