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

if (shouldRegisterPosServiceWorker()) {
  registerSW({ immediate: true })
} else if ('serviceWorker' in navigator) {
  // Portal / HR / RMS: drop a root-scoped POS SW that may still be controlling this origin
  // from an earlier deploy (broken chunk loads look like "Human Resources not working").
  void navigator.serviceWorker.getRegistrations().then(regs => {
    for (const reg of regs) {
      const script = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
      if (script.includes('/sw.js') || script.endsWith('sw.js')) {
        void reg.unregister()
      }
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
