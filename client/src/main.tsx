import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { AppRoot } from './AppRoot.tsx'
import { CurrentUserProvider } from './context/CurrentUserContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrentUserProvider>
      <AppRoot />
    </CurrentUserProvider>
  </StrictMode>,
)
