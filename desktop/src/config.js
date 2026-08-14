'use strict';

const DEFAULT_CLOUD_URL = 'https://bisync-cloud-389272498937.asia-southeast1.run.app';

/**
 * Resolve the URL the desktop shell should load.
 * Override with BISYNC_DESKTOP_URL (e.g. http://localhost:5173 for local Vite).
 * @param {{ bustCache?: boolean }} [opts]
 */
function resolveAppUrl(opts = {}) {
  const fromEnv = (process.env.BISYNC_DESKTOP_URL || '').trim();
  const base = stripTrailingSlash(fromEnv || DEFAULT_CLOUD_URL);
  try {
    const url = new URL(base);
    url.searchParams.set('desktop', '1');
    if (opts.bustCache) {
      url.searchParams.set('_boot', String(Date.now()));
    }
    return url.toString();
  } catch {
    return base;
  }
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

module.exports = {
  DEFAULT_CLOUD_URL,
  resolveAppUrl,
};
