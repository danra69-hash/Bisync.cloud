import { useEffect, useRef } from 'react';

export const IDLE_LOGOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'bisync.lastActivityAt';
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

function readLastActivityAt(): number {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function markUserActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function clearUserActivity() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function useIdleLogout(enabled: boolean, onIdle: () => void) {
  const onIdleRef = useRef(onIdle);
  const timeoutRef = useRef<number | null>(null);
  const lastPersistRef = useRef(0);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) {
      clearUserActivity();
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const scheduleLogout = (delayMs: number) => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => onIdleRef.current(), delayMs);
    };

    const persistActivity = () => {
      const now = Date.now();
      if (now - lastPersistRef.current < 30_000) return;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      lastPersistRef.current = now;
    };

    const resetIdleTimer = () => {
      persistActivity();
      scheduleLogout(IDLE_LOGOUT_MS);
    };

    const elapsed = Date.now() - readLastActivityAt();
    if (elapsed >= IDLE_LOGOUT_MS) {
      onIdleRef.current();
      return;
    }

    scheduleLogout(IDLE_LOGOUT_MS - elapsed);

    const handleActivity = () => resetIdleTimer();
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled]);
}
