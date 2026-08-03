import { useEffect, type RefObject } from 'react'

/**
 * Dynamically size POS UI to the live device viewport / screen.
 * Tracks ResizeObserver, window resize, orientation, visualViewport (Chrome
 * URL bar / keyboard), and fullscreen changes so Windows / Android / iOS
 * Chrome all keep the shell filling available space.
 */
export function usePosViewportScale(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const apply = () => {
      const vv = window.visualViewport
      const width = Math.max(
        1,
        root.clientWidth
          || Math.round(vv?.width ?? 0)
          || window.innerWidth
          || screen.availWidth
          || 1,
      )
      const height = Math.max(
        1,
        root.clientHeight
          || Math.round(vv?.height ?? 0)
          || window.innerHeight
          || screen.availHeight
          || 1,
      )

      // Reference: compact landscape POS canvas; scale to whatever screen we have.
      const scaleW = width / 1280
      const scaleH = height / 720
      const raw = Math.min(scaleW, scaleH)
      // Phone portrait → denser UI; large desktop monitors → slightly roomier chrome.
      const scale = Math.min(1.35, Math.max(0.62, raw))

      root.style.setProperty('--pos-ui-scale', scale.toFixed(3))
      root.style.setProperty('--pos-vw', `${width}px`)
      root.style.setProperty('--pos-vh', `${height}px`)
      root.style.setProperty('--pos-screen-w', `${screen.width || width}px`)
      root.style.setProperty('--pos-screen-h', `${screen.height || height}px`)
      root.dataset.posViewport = `${width}x${height}`
    }

    apply()

    const ro = new ResizeObserver(apply)
    ro.observe(root)

    const vv = window.visualViewport
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    document.addEventListener('fullscreenchange', apply)
    document.addEventListener('webkitfullscreenchange', apply)

    return () => {
      ro.disconnect()
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      document.removeEventListener('fullscreenchange', apply)
      document.removeEventListener('webkitfullscreenchange', apply)
    }
  }, [rootRef])
}
