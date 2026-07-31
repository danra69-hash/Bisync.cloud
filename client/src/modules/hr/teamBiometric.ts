/** Device-local WebAuthn gate for Team portal (no Identity access key). */

const STORAGE_KEY = 'bisync-team-biometric';

export type TeamBiometricEnrollment = {
  username: string;
  employeeId: number;
  /** Base64url WebAuthn credential id (platform authenticator). */
  credentialId: string;
};

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(encoded: string) {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomChallenge(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function isWebAuthnPlatformAvailable() {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function' &&
    window.isSecureContext
  );
}

export function loadBiometricEnrollment(): TeamBiometricEnrollment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as TeamBiometricEnrollment;
    if (!data?.username || !data?.employeeId || !data?.credentialId) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveBiometricEnrollment(enrollment: TeamBiometricEnrollment) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollment));
}

export function clearBiometricEnrollment() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isBiometricEnrolled(username?: string | null) {
  const enrolled = loadBiometricEnrollment();
  if (!enrolled) return false;
  if (username && enrolled.username.toLowerCase() !== username.trim().toLowerCase()) {
    return false;
  }
  return true;
}

export function canShowBiometricLogin() {
  return isWebAuthnPlatformAvailable() && isBiometricEnrolled();
}

/** Create a platform WebAuthn credential (Face ID / fingerprint / Windows Hello). */
export async function createPlatformCredential(username: string) {
  if (!isWebAuthnPlatformAvailable()) {
    throw new Error('Biometrics are not supported in this browser');
  }

  const userId = new TextEncoder().encode(username.toLowerCase());
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: {
        name: 'Bisync Team',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Biometric enrollment was cancelled');
  return bytesToBase64Url(credential.rawId);
}

/** Prompt for device biometrics before restoring the Team session. */
export async function assertPlatformCredential(credentialId: string) {
  if (!isWebAuthnPlatformAvailable()) {
    throw new Error('Biometrics are not supported in this browser');
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          type: 'public-key',
          id: base64UrlToBytes(credentialId),
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60_000,
    },
  });

  if (!assertion) throw new Error('Biometric login was cancelled');
}
