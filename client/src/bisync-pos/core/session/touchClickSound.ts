/**
 * Short tactile click for touch-screen POS taps.
 * Synthesized with Web Audio so stations stay offline-capable (no asset fetch).
 */

let audioCtx: AudioContext | null = null
let lastPlayMs = 0

function getAudioContext(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    if (!audioCtx) audioCtx = new Ctx()
    return audioCtx
  } catch {
    return null
  }
}

/** Unlock / resume audio after the browser blocks autoplay until a gesture. */
export function unlockTouchClickSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      /* ignore */
    })
  }
}

/** Play one soft UI click. Safe to call from pointer handlers. */
export function playTouchClickSound(): void {
  const now = performance.now()
  // Coalesce ghosted pointer/touch duplicates from the same physical tap.
  if (now - lastPlayMs < 28) return
  lastPlayMs = now

  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        /* ignore */
      })
    }

    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1650, t0)
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.03)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.045, t0 + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.055)
  } catch {
    /* autoplay / platform restrictions — ignore */
  }
}

const KEYBOARD_INPUT_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[data-no-touch-click-sound]',
].join(',')

/** True when the tap landed on a text/keyboard field (no click sound). */
export function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(KEYBOARD_INPUT_SELECTOR))
}

/** True for finger / pen touch — not mouse or unknown pointers. */
export function isTouchPointerEvent(event: PointerEvent): boolean {
  if (event.pointerType === 'touch') return true
  // Some Android WebViews report empty pointerType on touch.
  if (!event.pointerType && event.pressure > 0 && (navigator.maxTouchPoints ?? 0) > 0) {
    return true
  }
  return false
}
