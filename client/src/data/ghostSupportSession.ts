import { DEV_CONSOLE_PATH } from '../config/devConsole';

const GHOST_KEY = 'bisync.ghostSupportSession';

export type GhostSupportSession = {
  companyId: number;
  companyName: string;
  locationId: number;
  locationExternalId: string;
  locationName: string;
  actorEmail: string;
  returnPath: string;
  enteredAt: string;
};

export function getGhostSupportSession(): GhostSupportSession | null {
  try {
    const raw = sessionStorage.getItem(GHOST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhostSupportSession;
    if (!parsed?.companyId || !parsed?.locationExternalId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setGhostSupportSession(session: GhostSupportSession) {
  sessionStorage.setItem(GHOST_KEY, JSON.stringify(session));
}

export function clearGhostSupportSession() {
  sessionStorage.removeItem(GHOST_KEY);
}

export function defaultGhostReturnPath(): string {
  return DEV_CONSOLE_PATH || '/dev/console';
}
