import { useCallback, useEffect, useState } from 'react';

export const PLATFORM_TEAM_CHAT_HIDDEN_KEY = 'bisync.platformTeamChat.hidden';
export const PLATFORM_TEAM_CHAT_HIDDEN_EVENT = 'bisync-platform-team-chat-hidden';

export function readPlatformTeamChatHidden(): boolean {
  try {
    return window.localStorage.getItem(PLATFORM_TEAM_CHAT_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function writePlatformTeamChatHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(PLATFORM_TEAM_CHAT_HIDDEN_KEY, hidden ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(PLATFORM_TEAM_CHAT_HIDDEN_EVENT, { detail: hidden }),
  );
}

/** Shared Hide preference so page layouts can collapse the chat rail and enlarge content. */
export function usePlatformTeamChatHidden() {
  const [hidden, setHiddenState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return readPlatformTeamChatHidden();
  });

  useEffect(() => {
    function onCustom(event: Event) {
      const detail = (event as CustomEvent<boolean>).detail;
      setHiddenState(Boolean(detail));
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== PLATFORM_TEAM_CHAT_HIDDEN_KEY) return;
      setHiddenState(event.newValue === '1');
    }
    window.addEventListener(PLATFORM_TEAM_CHAT_HIDDEN_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PLATFORM_TEAM_CHAT_HIDDEN_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setHidden = useCallback((next: boolean) => {
    writePlatformTeamChatHidden(next);
    setHiddenState(next);
  }, []);

  return { hidden, setHidden, show: () => setHidden(false), hide: () => setHidden(true) };
}
