/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { getFirebaseWebConfig } from './push/firebaseConfig'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const apiPaths = ({ url }: { url: URL }) =>
  url.pathname.startsWith('/mobile-api') ||
  url.pathname.startsWith('/identity') ||
  url.pathname.startsWith('/share-api')

registerRoute(apiPaths, new NetworkOnly(), 'GET')
registerRoute(apiPaths, new NetworkOnly(), 'POST')
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/mobile-api') ||
    url.pathname.startsWith('/identity'),
  new NetworkOnly(),
  'PUT',
)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/mobile-api') ||
    url.pathname.startsWith('/identity'),
  new NetworkOnly(),
  'PATCH',
)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/mobile-api') ||
    url.pathname.startsWith('/identity'),
  new NetworkOnly(),
  'DELETE',
)

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/mobile-api/, /^\/identity/, /^\/share-api/, /^\/s\//],
  }),
)

function notifyPath(orderId?: string | null, status?: string | null) {
  if (!orderId) return '/'
  const params = new URLSearchParams({ id: String(orderId) })
  if (status) params.set('status', status)
  return `/notify?${params.toString()}`
}

function payloadTitle(payload: {
  notification?: { title?: string }
  data?: Record<string, string>
}) {
  return (
    payload.notification?.title ||
    payload.data?.title ||
    payload.data?.Title ||
    'Bisync RMS'
  )
}

function payloadBody(payload: {
  notification?: { body?: string }
  data?: Record<string, string>
}) {
  return (
    payload.notification?.body ||
    payload.data?.body ||
    payload.data?.Body ||
    'You have a new notification'
  )
}

function payloadIds(data?: Record<string, string>) {
  const id = data?.Id || data?.id || null
  const status = data?.Status || data?.status || null
  return { id, status }
}

async function showPushNotification(payload: {
  notification?: { title?: string; body?: string }
  data?: Record<string, string>
}) {
  const { id, status } = payloadIds(payload.data)
  await self.registration.showNotification(String(payloadTitle(payload)), {
    body: String(payloadBody(payload)),
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: id ? `bisync-order-${id}` : 'bisync-push',
    data: {
      url: notifyPath(
        id != null ? String(id) : null,
        status != null ? String(status) : null,
      ),
      id,
      status,
    },
  })
}

const firebaseConfig = getFirebaseWebConfig()
if (firebaseConfig) {
  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)
  // Required for closed-app / background delivery on Android Chrome & iOS PWA.
  onBackgroundMessage(messaging, (payload) => {
    // FCM may auto-display when a `notification` block is present; still show
    // for data-only payloads and when the OS does not surface one.
    void showPushNotification({
      notification: payload.notification,
      data: payload.data as Record<string, string> | undefined,
    })
  })
} else {
  // Without Web APP_ID the SW never hooks FCM — closed-app push stays dead.
  console.warn(
    '[Bisync SW] Firebase web config missing (VITE_FIREBASE_APP_ID). Background push disabled.',
  )
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const raw =
    (event.notification.data &&
      (event.notification.data.url || event.notification.data.path)) ||
    '/'
  // Mobile Chrome / Samsung Internet require an absolute URL for openWindow.
  let targetUrl: string
  try {
    targetUrl = new URL(String(raw), self.location.origin).href
  } catch {
    targetUrl = self.location.origin + '/'
  }
  const pathOnly = (() => {
    try {
      const u = new URL(targetUrl)
      return `${u.pathname}${u.search}${u.hash}`
    } catch {
      return '/'
    }
  })()

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of all) {
        if (!('focus' in client)) continue
        if (!client.url.startsWith(self.location.origin)) continue

        // Tell the open PWA to route — more reliable than WindowClient.navigate on Android.
        client.postMessage({
          type: 'NOTIFICATION_CLICK',
          url: pathOnly,
        })
        await client.focus()
        return
      }

      const opened = await self.clients.openWindow(targetUrl)
      if (!opened) {
        // Some WebViews return null; try origin + path again.
        await self.clients.openWindow(self.location.origin + pathOnly)
      }
    })(),
  )
})
