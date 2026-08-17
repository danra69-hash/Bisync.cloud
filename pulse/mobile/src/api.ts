import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './theme';

const TOKEN_KEY = 'mobile_pulse_token';
const PIN_OK_KEY = 'mobile_pulse_pin_ok';

export type MobileUser = {
  type: 'subscriber' | 'coach';
  id: string;
  email: string;
  name: string;
  companyId: string;
  memberId?: string;
  role?: string;
};

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (!token) await AsyncStorage.removeItem(TOKEN_KEY);
  else await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function setPinUnlocked(ok: boolean) {
  if (!ok) await AsyncStorage.removeItem(PIN_OK_KEY);
  else await AsyncStorage.setItem(PIN_OK_KEY, '1');
}

export async function isPinUnlocked() {
  return (await AsyncStorage.getItem(PIN_OK_KEY)) === '1';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = await getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
