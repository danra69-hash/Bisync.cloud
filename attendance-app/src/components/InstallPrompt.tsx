import { useEffect, useMemo, useState } from 'react'

const DISMISS_KEY = 'bisync_rms_web_install_dismissed'
const INSTALLED_KEY = 'bisync_rms_web_installed'

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
    mq?.matches === true ||
    // iOS Safari
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * First-visit prompt to install the PWA (home-screen icon + fullscreen app).
 * Android/Chrome: native beforeinstallprompt.
 * iOS: Share → Add to Home Screen instructions.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  const alreadyInstalled = useMemo(() => {
    if (typeof window === 'undefined') return true
    return (
      isStandaloneDisplay() ||
      localStorage.getItem(INSTALLED_KEY) === '1' ||
      localStorage.getItem(DISMISS_KEY) === '1'
    )
  }, [])

  useEffect(() => {
    if (alreadyInstalled) return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setVisible(true)
      setIosHelp(false)
    }

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, '1')
      setVisible(false)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // First visit: show install guidance even before the browser fires
    // beforeinstallprompt (and always on iOS, which never fires it).
    const timer = window.setTimeout(() => {
      if (isStandaloneDisplay()) return
      setVisible(true)
      if (isIos()) setIosHelp(true)
    }, 1200)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [alreadyInstalled])

  if (!visible) return null

  async function install() {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1')
      } else {
        localStorage.setItem(DISMISS_KEY, '1')
      }
      setDeferred(null)
      setVisible(false)
      return
    }
    setIosHelp(true)
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const showNativeInstall = !!deferred
  const showManualHelp = iosHelp || !deferred

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-prompt-title">
      <div className="install-prompt-card">
        <img
          src="/pwa-192x192.png"
          alt=""
          className="install-prompt-icon"
          width={48}
          height={48}
        />
        <div className="install-prompt-copy">
          <strong id="install-prompt-title">Install Bisync RMS</strong>
          {showManualHelp && isIos() ? (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Tap Share, then <strong>Add to Home Screen</strong> for a full-screen
              app icon on your phone.
            </p>
          ) : showManualHelp && !showNativeInstall ? (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Use your browser menu → <strong>Install app</strong> /{' '}
              <strong>Add to Home screen</strong> for full-screen use.
            </p>
          ) : (
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Add to your home screen for full-screen use and a one-tap app icon.
            </p>
          )}
        </div>
        <div className="install-prompt-actions">
          {showNativeInstall && (
            <button type="button" className="btn btn-primary" onClick={() => void install()}>
              Install
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={dismiss}>
            {showNativeInstall ? 'Not now' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
