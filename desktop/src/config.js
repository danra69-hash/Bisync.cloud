'use strict';

const DEFAULT_CLOUD_URL = 'https://bisync-cloud-389272498937.asia-southeast1.run.app';

/**
 * Resolve the URL the desktop shell should load.
 * Override with BISYNC_DESKTOP_URL (e.g. http://localhost:5173 for local Vite).
 */
function resolveAppUrl() {
  const fromEnv = (process.env.BISYNC_DESKTOP_URL || '').trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);
  return DEFAULT_CLOUD_URL;
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

module.exports = {
  DEFAULT_CLOUD_URL,
  resolveAppUrl,
};
