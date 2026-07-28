import { useEffect } from 'react'
import { BisyncPosApp } from './app/App'
import './core/styles/tokens.css'
import './index.css'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
const FONT_LINK_ID = 'bisync-pos-fonts'

function ensurePosFonts() {
  if (document.getElementById(FONT_LINK_ID)) return
  const preconnectG = document.createElement('link')
  preconnectG.rel = 'preconnect'
  preconnectG.href = 'https://fonts.googleapis.com'
  document.head.appendChild(preconnectG)

  const preconnectS = document.createElement('link')
  preconnectS.rel = 'preconnect'
  preconnectS.href = 'https://fonts.gstatic.com'
  preconnectS.crossOrigin = 'anonymous'
  document.head.appendChild(preconnectS)

  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = FONT_HREF
  document.head.appendChild(link)
}

/** Mountable Bisync POS UI for POS Test Tap (demo catalog until API wiring). */
export function BisyncPosEmbed() {
  useEffect(() => {
    ensurePosFonts()
  }, [])

  return (
    <div className="bisync-pos-root" data-bisync-pos-embed>
      <BisyncPosApp />
    </div>
  )
}
