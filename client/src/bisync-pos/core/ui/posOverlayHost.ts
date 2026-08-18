import { useEffect, useState } from 'react'

/** Host for POS fullscreen sheets — stays inside the POS frame (transform root). */
export function getPosOverlayHost(): HTMLElement {
  return (
    (typeof document !== 'undefined'
      ? (document.querySelector('.bisync-pos-root') as HTMLElement | null)
      : null) ?? document.body
  )
}

export function usePosOverlayHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setHost(getPosOverlayHost())
  }, [])
  return host
}
