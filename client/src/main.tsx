import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n'
import { AppRoot } from './AppRoot.tsx'
import { CurrentUserProvider } from './context/CurrentUserContext.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrentUserProvider>
      <AppRoot />
    </CurrentUserProvider>
  </StrictMode>,
)
