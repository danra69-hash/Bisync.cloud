export const colors = {
  paper: '#F4F7FB',
  ink: '#1B2430',
  ink2: '#2F3B4C',
  muted: '#6B778A',
  rule: '#D7DEE8',
  accent: '#2F6FED',
  accentSoft: '#E8F0FF',
  ok: '#1F9D63',
  warn: '#C98512',
  danger: '#C0392B',
  white: '#FFFFFF',
};

const LIVE_API = 'https://pulse-cloud-etx3n2bf5q-as.a.run.app';

function resolveApiBase() {
  const fromEnv = process.env.EXPO_PUBLIC_PULSE_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, '');
  }
  // Hosted at /m on the same Cloud Run origin — call API relatively.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return LIVE_API;
}

export const API_BASE = resolveApiBase();
