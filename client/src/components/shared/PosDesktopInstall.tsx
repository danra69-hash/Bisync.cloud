import { useEffect, useMemo, useState } from 'react'
import './PosDesktopInstall.css'

const DISMISS_KEY = 'bisync-pos-desktop-install-dismissed'
const INSTALLED_KEY = 'bisync-pos-desktop-installed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay() {
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

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

async function enterFullscreen(el: Element | null = document.documentElement) {
  if (!el) return false
  const anyEl = el as Element & {
    requestFullscreen?: () => Promise<void>
    webkitRequestFullscreen?: () => Promise<void>
    msRequestFullscreen?: () => Promise<void>
  }
  try {
    if (anyEl.requestFullscreen) {
      await anyEl.requestFullscreen()
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

type Props = {
  /** Compact toolbar row vs card prompt. */
  variant?: 'toolbar' | 'card'
  companyId?: number | null
  locationId?: string
}

/**
 * Install / download Bisync POS for desktop and enter fullscreen kiosk use.
 */
export function PosDesktopInstall({
  variant = 'toolbar',
  companyId = null,
  locationId = '',
}: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const [fsNote, setFsNote] = useState<string | null>(null)

  const posUrl = useMemo(() => {
    const url = new URL('/POS', window.location.origin)
    if (companyId != null && companyId > 0) url.searchParams.set('c', String(companyId))
    if (locationId.trim()) url.searchParams.set('l', locationId.trim())
    url.searchParams.set('fs', '1')
    return url.toString()
  }, [companyId, locationId])

  const desktopZipUrl = '/downloads/bisync-pos-desktop.zip'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('fs') === '1' || isStandaloneDisplay()) {
      void enterFullscreen(document.documentElement)
    }
  }, [])

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
      if (isIos()) setIosHelp(true)
    }, 900)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [variant])

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
    const ok = await enterFullscreen(document.documentElement)
    setFsNote(ok ? 'Fullscreen on' : 'Use F11 or the desktop launcher for fullscreen.')
    window.setTimeout(() => setFsNote(null), 2500)
  }

  function dismissCard() {
    localStorage.setItem(DISMISS_KEY, '1')
    setCardVisible(false)
  }

  const toolbar = (
    <div className="pos-desktop-toolbar" role="group" aria-label="POS desktop controls">
      <button type="button" className="pos-desktop-btn" onClick={() => void goFullscreen()}>
        Full screen
      </button>
      <a className="pos-desktop-btn pos-desktop-btn--primary" href={desktopZipUrl} download>
        Download desktop
      </a>
      <button type="button" className="pos-desktop-btn" onClick={() => void installPwa()}>
        Install app
      </button>
      <a className="pos-desktop-btn pos-desktop-btn--ghost" href={posUrl} target="_blank" rel="noreferrer">
        Open POS window
      </a>
      {fsNote ? <span className="pos-desktop-note">{fsNote}</span> : null}
    </div>
  )

  if (variant === 'toolbar') return toolbar

  return (
    <>
      {toolbar}
      {cardVisible ? (
        <div className="pos-desktop-prompt" role="dialog" aria-labelledby="pos-desktop-prompt-title">
          <div className="pos-desktop-prompt__card">
            <img src="/pwa-192x192.png" alt="" width={48} height={48} />
            <div className="pos-desktop-prompt__copy">
              <strong id="pos-desktop-prompt-title">Install Bisync POS</strong>
              {iosHelp || !deferred ? (
                <p>
                  {isIos()
                    ? 'Tap Share, then Add to Home Screen for a full-screen POS icon.'
                    : 'Install the app, or download the desktop launcher for Windows / Mac / Linux fullscreen POS.'}
                </p>
              ) : (
                <p>Add Bisync POS to your desktop for one-tap full-screen use.</p>
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
