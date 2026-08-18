import { isDesktopAppSession } from '../data/desktopLauncher';
import { hardReloadPage } from './hardReload';

const BOOT_HARD_RESET_FLAG = 'bisync.desktop.boot-hard-reset';

/**
 * Desktop app windows keep a Chromium profile across launches, so HTTP/SW
 * caches can serve a stale SPA after Cloud Run deploys.
 *
 * On every cold start (new window / closed-and-reopened), clear service
 * workers + Cache Storage once, then reload. sessionStorage survives that
 * reload but is cleared when the desktop window is closed.
 *
 * @returns true when a hard reset reload was started (caller should not mount React yet)
 */
export async function ensureDesktopColdStartHardReset(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!isDesktopAppSession()) return false;

  try {
    if (sessionStorage.getItem(BOOT_HARD_RESET_FLAG) === '1') return false;
    sessionStorage.setItem(BOOT_HARD_RESET_FLAG, '1');
  } catch {
    return false;
  }

  await hardReloadPage();
  return true;
}
