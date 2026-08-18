/**
 * Device-local 4-digit PIN unlock for platform login.
 * Encrypts a small session snapshot so users can sign in without the password.
 */

const STORAGE_KEY = 'bisync.platform.pin';

export type PlatformPinPayload = {
  kind: 'platform-session';
  email: string;
  userId: number;
  fullName: string;
};

type PinEnrollmentStored = {
  version: 1;
  email: string;
  salt: string;
  iv: string;
  ciphertext: string;
};

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!);
  return btoa(binary);
}

function base64ToBytes(encoded: string) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isValidPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

export function loadPinEnrollment(): { email: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PinEnrollmentStored;
    if (data?.version !== 1 || !data.email || !data.ciphertext) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

export function isPinEnabled(email?: string | null) {
  const enrolled = loadPinEnrollment();
  if (!enrolled) return false;
  if (email && enrolled.email.toLowerCase() !== email.trim().toLowerCase()) {
    return false;
  }
  return true;
}

export function clearPinEnrollment() {
  localStorage.removeItem(STORAGE_KEY);
}

async function deriveKey(pin: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 120_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function savePinEnrollment(pin: string, payload: PlatformPinPayload) {
  if (!isValidPin(pin)) throw new Error('PIN must be 4–8 digits');
  if (!window.isSecureContext || !crypto?.subtle) {
    throw new Error('PIN login requires a secure browser context (HTTPS)');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const stored: PinEnrollmentStored = {
    version: 1,
    email: payload.email.trim().toLowerCase(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(cipher),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export async function unlockPinPayload(pin: string): Promise<PlatformPinPayload> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4–8 digits');
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('PIN login is not set up on this device');
  const stored = JSON.parse(raw) as PinEnrollmentStored;
  if (stored.version !== 1) throw new Error('PIN data is invalid — set up PIN again');

  try {
    const salt = base64ToBytes(stored.salt);
    const iv = base64ToBytes(stored.iv);
    const key = await deriveKey(pin, salt);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      base64ToBytes(stored.ciphertext) as BufferSource,
    );
    const payload = JSON.parse(new TextDecoder().decode(plain)) as PlatformPinPayload;
    if (!payload?.email || payload.kind !== 'platform-session' || !payload.userId) {
      throw new Error('PIN data is corrupt');
    }
    return payload;
  } catch (err) {
    if (err instanceof Error && /PIN must|not set up|invalid|corrupt/i.test(err.message)) {
      throw err;
    }
    throw new Error('Incorrect PIN');
  }
}

export function canShowPinLogin() {
  return isPinEnabled() && !!window.isSecureContext;
}
