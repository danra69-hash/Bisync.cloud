import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n'
import { AppRoot } from './AppRoot.tsx'
import { CurrentUserProvider } from './context/CurrentUserContext.tsx'

/** Only install/update the POS service worker on station routes — avoid trapping the portal. */
function shouldRegisterPosServiceWorker() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return /^\/(POS|KDS|BDS|CDS)$/i.test(path)
}

async function clearStalePosCaches() {
  if (!('caches' in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter(k => /workbox|bisync|pwa|precache/i.test(k))
        .map(k => caches.delete(k)),
    )
  } catch {
    /* ignore */
  }
}

/**
 * After a Cloud Run deploy, hashed lazy chunks (e.g. jspdf-*.js) change.
 * A tab still holding the previous module graph, or an outdated SW precache,
 * requests the old hash → 404 "Failed to fetch dynamically imported module".
 * Reload once so the browser picks up the new index + chunk map.
 */
function installStaleChunkReload() {
  const key = 'bisync.chunk-reload-at'
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault()
    const last = Number(sessionStorage.getItem(key) || '0')
    if (Date.now() - last < 15_000) return
    sessionStorage.setItem(key, String(Date.now()))
    window.location.reload()
  })
}

installStaleChunkReload()

if (shouldRegisterPosServiceWorker()) {
  registerSW({ immediate: true })
} else if ('serviceWorker' in navigator) {
  // Portal / HR / RMS: drop a root-scoped POS SW that may still be controlling this origin
  // from an earlier deploy (broken chunk loads look like "Failed to fetch … jspdf-*.js").
  const wasControlled = Boolean(navigator.serviceWorker.controller)
  void navigator.serviceWorker.getRegistrations().then(async regs => {
    let unregistered = false
    for (const reg of regs) {
      const script = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
      if (script.includes('/sw.js') || script.endsWith('sw.js')) {
        await reg.unregister()
        unregistered = true
      }
    }
    await clearStalePosCaches()
    if ((wasControlled || unregistered) && !sessionStorage.getItem('bisync.sw-cleared-reload')) {
      sessionStorage.setItem('bisync.sw-cleared-reload', '1')
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrentUserProvider>
      <AppRoot />
    </CurrentUserProvider>
  </StrictMode>,
)
