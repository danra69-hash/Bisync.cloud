const TOKEN_KEY = 'bisync.devConsoleToken';
const PROFILE_KEY = 'bisync.devConsoleProfile';

export type DevConsoleProfile = {
  email: string;
  fullName: string;
  isRoot: boolean;
  expiresAt: string;
};

export function getDevConsoleToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getDevConsoleProfile(): DevConsoleProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DevConsoleProfile;
  } catch {
    return null;
  }
}

export function setDevConsoleSession(token: string, profile: DevConsoleProfile) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearDevConsoleSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

export function devConsoleAuthHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getDevConsoleToken();
  if (token) headers['X-Bisync-Dev-Console-Token'] = token;
  if (extra) {
    const e = new Headers(extra);
    e.forEach((v, k) => {
      headers[k] = v;
    });
  }
  return headers;
}
