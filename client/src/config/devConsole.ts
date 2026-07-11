/**
 * Hidden Dev Team console — only reachable via a deploy-time URL path.
 *
 * Set at build time:
 *   VITE_DEV_CONSOLE_PATH=/dev/ops-<secret>
 *
 * Local Development defaults to `/dev/console` when the env var is unset.
 * Production builds with an empty path disable the console entirely.
 */

const RAW_PATH = (import.meta.env.VITE_DEV_CONSOLE_PATH as string | undefined)?.trim() ?? '';

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/** Resolved console path, or empty when disabled. */
export const DEV_CONSOLE_PATH = normalizePath(
  RAW_PATH || (import.meta.env.DEV ? '/dev/console' : ''),
);

export function isDevConsoleEnabled(): boolean {
  return DEV_CONSOLE_PATH.length > 0;
}

/** Returns true when the current browser path matches the deploy-time console URL. */
export function matchDevConsolePath(pathname: string): boolean {
  if (!isDevConsoleEnabled()) return false;
  const current = normalizePath(pathname.split('?')[0] ?? '');
  return current === DEV_CONSOLE_PATH || current.startsWith(`${DEV_CONSOLE_PATH}/`);
}
