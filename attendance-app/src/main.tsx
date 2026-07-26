import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './auth/AuthProvider'
import { LocationProvider } from './auth/LocationProvider'
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay'
import { InstallPrompt } from './components/InstallPrompt'
import { PushBootstrap } from './push/PushBootstrap'
import { isClockProduct } from './clockMode'
import App from './App'
import './styles/tokens.css'

/** Open the order route when the user taps an OS notification (mobile PWA). */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string; url?: string } | null
    if (data?.type !== 'NOTIFICATION_CLICK' || typeof data.url !== 'string') return
    const path = data.url.startsWith('/') ? data.url : `/${data.url}`
    const next = `${window.location.origin}${path}`
    if (window.location.href === next) {
      window.focus()
      return
    }
    // Full navigation so the order page opens even if the SPA was suspended.
    window.location.assign(path)
  })
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Pull new SW promptly so stale caches (old API bases / share routes) don't stick.
    if (registration) {
      void registration.update()
      setInterval(() => void registration.update(), 60_000)
      // Force clients onto the latest SW when a new one is waiting.
      registration.addEventListener('updatefound', () => {
        const next = registration.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            void registration.update()
          }
        })
      })
    }
  },
  onNeedRefresh() {
    // Auto-reload once when a new SW takes over.
    window.location.reload()
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        basename={(import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined}
      >
        <AuthProvider>
          <LocationProvider>
            <GlobalLoadingOverlay />
            {!isClockProduct() && <InstallPrompt />}
            <PushBootstrap />
            <App />
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
