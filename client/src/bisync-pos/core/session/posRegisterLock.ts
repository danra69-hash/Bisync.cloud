/** Soft-lock POS register while staff remain on duty (mid-shift re-auth). */

const KEY = 'bisync-pos-register-locked'
export const POS_REGISTER_LOCK_EVENT = 'bisync-pos-register-lock-changed'
export const POS_IDLE_LOCK_MS = 60_000

export function isPosRegisterLocked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function lockPosRegister() {
  localStorage.setItem(KEY, '1')
  window.dispatchEvent(new CustomEvent(POS_REGISTER_LOCK_EVENT))
}

export function unlockPosRegister() {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(POS_REGISTER_LOCK_EVENT))
}
