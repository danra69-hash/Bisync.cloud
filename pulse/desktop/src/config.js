'use strict';

const DEFAULT_URL = 'http://localhost:5401/?surface=admin';

function resolveAppUrl() {
  const raw = process.env.PULSE_DESKTOP_URL || DEFAULT_URL;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('surface')) u.searchParams.set('surface', 'admin');
    return u.toString();
  } catch {
    return DEFAULT_URL;
  }
}

module.exports = { resolveAppUrl, DEFAULT_URL };
