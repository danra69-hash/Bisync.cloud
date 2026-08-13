/** Desktop launcher versioning + update notice helpers (Home zip launchers). */

export const DESKTOP_VERSION_URL = '/downloads/bisync-desktop/version.json';

export const DESKTOP_DOWNLOADS = [
  {
    id: 'windows' as const,
    href: '/downloads/bisync-desktop/Bisync.cloud-Desktop-Windows.zip',
    labelKey: 'home.desktopApp.windows',
    hintKey: 'home.desktopApp.windowsHint',
    fileName: 'Bisync.cloud-Desktop-Windows.zip',
  },
  {
    id: 'mac' as const,
    href: '/downloads/bisync-desktop/Bisync.cloud-Desktop-macOS.zip',
    labelKey: 'home.desktopApp.mac',
    hintKey: 'home.desktopApp.macHint',
    fileName: 'Bisync.cloud-Desktop-macOS.zip',
  },
];

export type DesktopLauncherVersionInfo = {
  version: string;
  releasedAt?: string;
  notes?: string;
  windowsZip?: string;
  macZip?: string;
};

const INSTALLED_KEY = 'bisync.desktopLauncher.installedVersion';
const DISMISSED_KEY = 'bisync.desktopLauncher.dismissedVersion';
const DESKTOP_MODE_KEY = 'bisync.desktopLauncher.isDesktopSession';

/** Compare dotted versions: 1.1.0 > 1.0.2 → 1, equal → 0, less → -1. */
export function compareDesktopVersions(a: string, b: string): number {
  const pa = a.trim().split(/[.+-]/).map(n => Number.parseInt(n, 10) || 0);
  const pb = b.trim().split(/[.+-]/).map(n => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function getInstalledDesktopVersion(): string | null {
  try {
    return localStorage.getItem(INSTALLED_KEY);
  } catch {
    return null;
  }
}

export function setInstalledDesktopVersion(version: string) {
  try {
    localStorage.setItem(INSTALLED_KEY, version.trim());
  } catch {
    /* ignore */
  }
}

export function getDismissedDesktopVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function dismissDesktopVersion(version: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, version.trim());
  } catch {
    /* ignore */
  }
}

/**
 * True for this desktop app window only (sessionStorage).
 * Closing the app clears the flag; a normal browser tab keeps idle logout.
 */
export function isDesktopAppSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(DESKTOP_MODE_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('desktop') === '1') return true;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches;
}

export function markDesktopAppSession() {
  try {
    sessionStorage.setItem(DESKTOP_MODE_KEY, '1');
  } catch {
    /* ignore */
  }
  // Legacy sticky localStorage flag made every tab look like desktop forever.
  try {
    localStorage.removeItem(DESKTOP_MODE_KEY);
  } catch {
    /* ignore */
  }
}

/** Capture ?desktop=1&desktopVersion=x.y.z from launcher URL on boot. */
export function syncDesktopLauncherFromUrl(search = window.location.search): void {
  const params = new URLSearchParams(search);
  if (params.get('desktop') === '1') markDesktopAppSession();
  const version = (params.get('desktopVersion') || params.get('v') || '').trim();
  if (version) setInstalledDesktopVersion(version);
}

export async function fetchDesktopLauncherVersion(): Promise<DesktopLauncherVersionInfo | null> {
  try {
    const res = await fetch(`${DESKTOP_VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as DesktopLauncherVersionInfo;
    if (!data?.version || typeof data.version !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

/** True when published version is newer than dismissed (and newer than installed if known). */
export function shouldOfferDesktopUpdate(
  published: string,
  opts?: { installed?: string | null; dismissed?: string | null },
): boolean {
  const installed = opts?.installed ?? getInstalledDesktopVersion();
  const dismissed = opts?.dismissed ?? getDismissedDesktopVersion();
  if (dismissed && compareDesktopVersions(published, dismissed) <= 0) return false;
  if (installed && compareDesktopVersions(published, installed) <= 0) return false;
  // No installed version yet: still notify logged-in users so they can install/update.
  if (!installed && dismissed && compareDesktopVersions(published, dismissed) <= 0) return false;
  return true;
}
