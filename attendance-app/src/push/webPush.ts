import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getInstallations,
  getToken as getInstallationAuthToken,
} from 'firebase/installations'
import {
  getMessaging,
  isSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging'
import { updateDeviceId } from '../api/auth'
import {
  getFirebaseVapidKey,
  getFirebaseWebConfig,
  isWebPushConfigured,
} from './firebaseConfig'

const TOKEN_KEY = 'bisync_rms_web_fcm_token'
const ENABLED_KEY = 'bisync_rms_web_push_enabled'
const GET_TOKEN_TIMEOUT_MS = 20_000
const API_TIMEOUT_MS = 15_000
const FCM_REGISTRATIONS =
  'https://fcmregistrations.googleapis.com/v1/projects'
/** Firebase SDK default VAPID — used when the project Web Push cert is rejected. */
const FIREBASE_DEFAULT_VAPID =
  'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4'

let app: FirebaseApp | null = null
let messaging: Messaging | null = null
/** Prevent overlapping enable attempts (Profile + PushBootstrap). */
let enableInFlight: Promise<string> | null = null

function getApp() {
  const config = getFirebaseWebConfig()
  if (!config) return null
  const existing = app ?? getApps()[0] ?? null
  if (
    existing &&
    existing.options.apiKey === config.apiKey &&
    existing.options.appId === config.appId
  ) {
    app = existing
    return app
  }
  // Avoid reusing a stale default app that was initialized with a wrong key.
  app = initializeApp(config, `bisync-web-${config.appId.slice(-8)}`)
  messaging = null
  return app
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Same encoding Firebase messaging uses for PushSubscription keys. */
function arrayToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Register for an FCM web token.
 *
 * Important: this project’s FCM Registration API accepts
 * `x-goog-firebase-installations-auth: FIS <token>` and rejects
 * `Authorization: FIS_v2 …` with a misleading "invalid argument".
 * Do not send top-level `origin` (unknown field on this backend).
 */
async function registerFcmWebToken(
  registration: ServiceWorkerRegistration,
  vapidKey: string,
): Promise<string> {
  const config = getFirebaseWebConfig()
  const firebaseApp = getApp()
  if (!config || !firebaseApp) {
    throw new Error('Firebase web config is missing')
  }

  const authToken = await withTimeout(
    getInstallationAuthToken(getInstallations(firebaseApp), true),
    GET_TOKEN_TIMEOUT_MS,
    'Firebase Installations',
  )
  if (!authToken) {
    throw new Error('Could not get a Firebase Installations auth token')
  }

  const vapidCandidates = [vapidKey, FIREBASE_DEFAULT_VAPID]
  const failures: string[] = []

  for (const candidate of vapidCandidates) {
    const useDefault = candidate === FIREBASE_DEFAULT_VAPID
    try {
      const existing = await registration.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
    } catch {
      /* ignore */
    }

    let subscription: PushSubscription
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(candidate) as BufferSource,
      })
    } catch (err) {
      failures.push(
        `${useDefault ? 'default' : 'project'}-subscribe: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      continue
    }

    const authKey = subscription.getKey('auth')
    const p256dhKey = subscription.getKey('p256dh')
    if (
      !subscription.endpoint ||
      !authKey ||
      !p256dhKey ||
      authKey.byteLength === 0 ||
      p256dhKey.byteLength === 0
    ) {
      failures.push(
        `${useDefault ? 'default' : 'project'}: empty push subscription`,
      )
      continue
    }

    const web: Record<string, string> = {
      endpoint: subscription.endpoint,
      auth: arrayToBase64(authKey),
      p256dh: arrayToBase64(p256dhKey),
    }
    if (!useDefault) web.applicationPubKey = candidate

    const response = await withTimeout(
      fetch(`${FCM_REGISTRATIONS}/${config.projectId}/registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-goog-api-key': config.apiKey,
          'x-goog-firebase-installations-auth': `FIS ${authToken}`,
        },
        body: JSON.stringify({ web }),
      }),
      GET_TOKEN_TIMEOUT_MS,
      'FCM registration',
    )

    let data: {
      token?: string
      error?: { message?: string; status?: string }
    } = {}
    try {
      data = (await response.json()) as typeof data
    } catch {
      /* ignore */
    }

    if (response.ok && data.token) {
      if (useDefault) {
        console.warn(
          '[Bisync push] Project Web Push cert was rejected; using Firebase default VAPID',
        )
      }
      return data.token
    }

    const detail =
      data.error?.message ||
      data.error?.status ||
      `HTTP ${response.status}`
    failures.push(`${useDefault ? 'default' : 'project'}: ${detail}`)
    console.error('[Bisync push] FCM registration failed', {
      useDefault,
      status: response.status,
      data,
    })
  }

  throw new Error(`FCM registration failed (${failures.join(' | ')})`)
}

async function getMessagingIfSupported() {
  if (!(await isSupported())) return null
  const firebaseApp = getApp()
  if (!firebaseApp) return null
  if (!messaging) messaging = getMessaging(firebaseApp)
  return messaging
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${Math.round(ms / 1000)}s. Check network, then try again.`,
        ),
      )
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export function isPushEnabledLocally() {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function setPushEnabledLocally(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    /* ignore */
  }
}

export function getStoredFcmToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeFcmToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

/** Deep link used by SW notification clicks (Flutter uses Id + Status). */
export function buildNotifyPath(orderId?: string | number | null, status?: string | null) {
  if (orderId == null || orderId === '') return '/'
  const params = new URLSearchParams({ id: String(orderId) })
  if (status) params.set('status', status)
  return `/notify?${params.toString()}`
}

/**
 * Request permission, obtain FCM web token, register with Mobile API.
 * After this, the backend can push while the PWA is closed (Android Chrome /
 * installed iOS Home Screen PWA).
 */
export async function enableWebPush(accessToken: string): Promise<string> {
  if (enableInFlight) return enableInFlight
  enableInFlight = doEnableWebPush(accessToken).finally(() => {
    enableInFlight = null
  })
  return enableInFlight
}

async function doEnableWebPush(accessToken: string): Promise<string> {
  if (!isWebPushConfigured()) {
    throw new Error(
      'Push is not configured. Add VITE_FIREBASE_APP_ID and VITE_FIREBASE_VAPID_KEY from Firebase Console (project cubevalue-d7497).',
    )
  }
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser')
  }
  if (!window.isSecureContext) {
    throw new Error('Push notifications require HTTPS')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied')
  }

  const messagingInstance = await getMessagingIfSupported()
  if (!messagingInstance) {
    throw new Error('Firebase messaging is not supported on this device')
  }

  // Ready registration only — do not await registration.update() (hangs on some Android WebViews).
  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    8_000,
    'Service worker ready',
  )

  const vapidKey = getFirebaseVapidKey().trim()
  if (!vapidKey) {
    throw new Error('Missing VITE_FIREBASE_VAPID_KEY')
  }

  // Keep messaging initialized for foreground banners.
  void messagingInstance

  let fcmToken: string | null = null
  try {
    fcmToken = await registerFcmWebToken(registration, vapidKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      /token-subscribe-failed|authentication credential|invalid argument|FCM registration failed|timed out/i.test(
        message,
      )
    ) {
      await clearLocalFcmState()
      messaging = null
      try {
        fcmToken = await registerFcmWebToken(registration, vapidKey)
      } catch (retryErr) {
        throw enrichPushError(retryErr)
      }
    } else {
      throw enrichPushError(err)
    }
  }
  if (!fcmToken) throw new Error('Could not get a push token from Firebase')

  const previous = getStoredFcmToken()
  await withTimeout(
    updateDeviceId(accessToken, fcmToken),
    API_TIMEOUT_MS,
    'Register device with Mobile API',
  )
  storeFcmToken(fcmToken)
  setPushEnabledLocally(true)
  if (previous && previous !== fcmToken) {
    console.info('[Bisync push] FCM token refreshed and registered')
  }
  return fcmToken
}

async function clearLocalFcmState() {
  storeFcmToken(null)
  if (!('indexedDB' in window)) return
  try {
    const names = new Set<string>([
      'firebase-messaging-database',
      'firebase-installations-database',
      'fcm_token_details_db',
      'firebase-heartbeat-database',
    ])
    if (indexedDB.databases) {
      const listed = await withTimeout(
        indexedDB.databases(),
        3_000,
        'List IndexedDB',
      ).catch(() => [] as IDBDatabaseInfo[])
      for (const db of listed) {
        if (db.name) names.add(db.name)
      }
    }
    await Promise.all(
      [...names]
        .filter(
          (name) =>
            name.includes('firebase') ||
            name.includes('fcm') ||
            name === 'fcm_token_details_db',
        )
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const timer = window.setTimeout(resolve, 2_000)
              const req = indexedDB.deleteDatabase(name)
              req.onsuccess = () => {
                window.clearTimeout(timer)
                resolve()
              }
              req.onerror = () => {
                window.clearTimeout(timer)
                resolve()
              }
              req.onblocked = () => {
                window.clearTimeout(timer)
                resolve()
              }
            }),
        ),
    )
  } catch {
    /* ignore */
  }
}

function enrichPushError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err)
  // Keep the real FCM/Installations detail so Profile can show it.
  if (/Failed to fetch|NetworkError|CORS/i.test(message)) {
    return new Error(
      `${message} — Browser blocked the FCM request. Try again on Chrome, or clear site data for mobile.bisync.cloud.`,
    )
  }
  return err instanceof Error ? err : new Error(message)
}

/** Re-register token after login when user previously enabled push. */
export async function syncWebPushIfEnabled(accessToken: string) {
  if (!isWebPushConfigured()) return null
  if (!isPushEnabledLocally()) return null
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null
  }
  try {
    return await enableWebPush(accessToken)
  } catch {
    return null
  }
}

export function disableWebPushLocally() {
  setPushEnabledLocally(false)
  // Keep last FCM token string for debugging; server still has it until next login overwrite.
}

/** Foreground messages while the app tab is open. */
export async function listenForForegroundPush(
  onPayload: (title: string, body: string, path: string) => void,
) {
  if (!isWebPushConfigured()) return () => {}
  const msg = await getMessagingIfSupported()
  if (!msg) return () => {}
  return onMessage(msg, (payload) => {
    const title =
      payload.notification?.title ||
      payload.data?.title ||
      'Bisync RMS'
    const body =
      payload.notification?.body ||
      payload.data?.body ||
      'You have a new notification'
    const id = payload.data?.Id || payload.data?.id
    const status = payload.data?.Status || payload.data?.status
    onPayload(String(title), String(body), buildNotifyPath(id, status))
  })
}

export { isWebPushConfigured, webPushConfigHint } from './firebaseConfig'
