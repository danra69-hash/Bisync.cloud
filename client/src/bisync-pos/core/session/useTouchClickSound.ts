import { useEffect, type RefObject } from 'react'
import {
  isKeyboardInputTarget,
  isTouchPointerEvent,
  playTouchClickSound,
  unlockTouchClickSound,
} from './touchClickSound'

const HOST_ATTR = 'data-touch-click-sound'

/**
 * Play a click on each touch-screen tap inside `rootRef`, except keyboard fields.
 * Nested hosts are safe — only the nearest host to the tap target plays.
 */
export function useTouchClickSound(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.setAttribute(HOST_ATTR, '')

    const onPointerDown = (event: PointerEvent) => {
      if (!isTouchPointerEvent(event)) return
      if (isKeyboardInputTarget(event.target)) return
      const target = event.target
      if (!(target instanceof Element)) return
      // Prefer the innermost marked host so PosAppPage + embed do not double-play.
      if (target.closest(`[${HOST_ATTR}]`) !== root) return
      unlockTouchClickSound()
      playTouchClickSound()
    }

    // Capture so disabled buttons / stopPropagation targets still click.
    root.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    return () => {
      root.removeEventListener('pointerdown', onPointerDown, true)
      root.removeAttribute(HOST_ATTR)
    }
  }, [rootRef])
}
