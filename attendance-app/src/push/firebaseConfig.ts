/** Firebase web config — same project as Flutter: cubevalue-d7497.
 *
 * Public project fields are inlined as defaults so the service worker always
 * gets a config object when APP_ID + VAPID are set. Env vars still override.
 */

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

/** Non-secret project defaults (Web app + Flutter project cubevalue-d7497). */
const PROJECT_DEFAULTS = {
  apiKey: 'AIzaSyCen_azKuiPTEw4hGRggNq6IkA40__QtV0',
  authDomain: 'cubevalue-d7497.firebaseapp.com',
  projectId: 'cubevalue-d7497',
  storageBucket: 'cubevalue-d7497.appspot.com',
  messagingSenderId: '1063716983721',
  appId: '1:1063716983721:web:f9318e85af049116f7aab8',
} as const

function isPlaceholder(value: string) {
  return !value || /REPLACE|YOUR_|xxx|TODO/i.test(value)
}

function env(name: keyof ImportMetaEnv): string {
  return String(import.meta.env[name] || '').trim()
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = env('VITE_FIREBASE_API_KEY') || PROJECT_DEFAULTS.apiKey
  const appId = env('VITE_FIREBASE_APP_ID') || PROJECT_DEFAULTS.appId
  const messagingSenderId =
    env('VITE_FIREBASE_MESSAGING_SENDER_ID') ||
    PROJECT_DEFAULTS.messagingSenderId
  const projectId =
    env('VITE_FIREBASE_PROJECT_ID') || PROJECT_DEFAULTS.projectId

  // Web app id is required — Android/iOS app ids will not work for web push.
  if (!appId || isPlaceholder(appId)) return null
  if (!apiKey || !messagingSenderId || !projectId) return null

  return {
    apiKey,
    authDomain:
      env('VITE_FIREBASE_AUTH_DOMAIN') || PROJECT_DEFAULTS.authDomain,
    projectId,
    storageBucket:
      env('VITE_FIREBASE_STORAGE_BUCKET') || PROJECT_DEFAULTS.storageBucket,
    messagingSenderId,
    appId,
  }
}

export function getFirebaseVapidKey() {
  const key = env('VITE_FIREBASE_VAPID_KEY')
  return isPlaceholder(key) ? '' : key
}

export function isWebPushConfigured() {
  return !!getFirebaseWebConfig() && !!getFirebaseVapidKey()
}

/** Human-readable why push is off (Profile UI). */
export function webPushConfigHint(): string | null {
  if (isWebPushConfigured()) return null
  const missing: string[] = []
  if (!getFirebaseWebConfig()) missing.push('VITE_FIREBASE_APP_ID (Web app)')
  if (!getFirebaseVapidKey()) missing.push('VITE_FIREBASE_VAPID_KEY')
  return missing.length
    ? `Missing ${missing.join(' and ')} in production env — closed-app push cannot start.`
    : 'Push is not configured.'
}
