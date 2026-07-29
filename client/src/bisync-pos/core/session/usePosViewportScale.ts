import { useEffect, type RefObject } from 'react'

/**
 * Dynamically scale POS UI for ~14" screens viewed at 30–40cm.
 * Uses the embed root size vs a reference POS canvas (1280×720).
 * Keeps type readable (~11–13px base) while maximizing usable space.
 */
export function usePosViewportScale(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const apply = () => {
      const width = root.clientWidth || window.innerWidth
      const height = root.clientHeight || window.innerHeight
      // Reference: compact 14" landscape POS usable area.
      const scaleW = width / 1280
      const scaleH = height / 720
      const raw = Math.min(scaleW, scaleH)
      // Floor keeps labels legible at arm’s length; ceiling avoids oversized chrome on large monitors.
      const scale = Math.min(1.12, Math.max(0.78, raw))
      root.style.setProperty('--pos-ui-scale', scale.toFixed(3))
      root.style.setProperty('--pos-vw', `${width}px`)
      root.style.setProperty('--pos-vh', `${height}px`)
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(root)
    window.addEventListener('orientationchange', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', apply)
    }
  }, [rootRef])
}
