/**
 * Hidden Dev Team console — only reachable via a dedicated URL path.
 *
 * Override at build time with:
 *   VITE_DEV_CONSOLE_PATH=/dev/ops-<secret>
 *
 * Defaults to `/dev/console` in all environments so Cloud builds never ship
 * a disabled console when the Docker build-arg is missing.
 */

const DEFAULT_PATH = '/dev/console';

const RAW_PATH = (import.meta.env.VITE_DEV_CONSOLE_PATH as string | undefined)?.trim() ?? '';

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/** Resolved console path (never empty — falls back to /dev/console). */
export const DEV_CONSOLE_PATH = normalizePath(RAW_PATH || DEFAULT_PATH) || DEFAULT_PATH;

export function isDevConsoleEnabled(): boolean {
  return DEV_CONSOLE_PATH.length > 0;
}

/** Returns true when the current browser path matches the Dev Console URL. */
export function matchDevConsolePath(pathname: string): boolean {
  if (!isDevConsoleEnabled()) return false;
  const current = normalizePath((pathname.split('?')[0] ?? '').split('#')[0] ?? '').toLowerCase();
  const expected = DEV_CONSOLE_PATH.toLowerCase();
  if (!current || !expected) return false;
  // Always recognize the default path even if a custom path is configured.
  if (current === DEFAULT_PATH || current.startsWith(`${DEFAULT_PATH}/`)) return true;
  return current === expected || current.startsWith(`${expected}/`);
}
