/**
 * Show an OS notification that the service worker can open on click.
 * Mobile browsers (esp. installed PWAs) often ignore Notification.onclick —
 * always prefer registration.showNotification with data.url.
 */
export async function showAppNotification(options: {
  title: string
  body: string
  /** In-app path, e.g. /operator/orders/123 or /notify?id=1 */
  url: string
  tag?: string
}): Promise<void> {
  const { title, body, url, tag } = options
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return
  }

  const path = url.startsWith('/') ? url : `/${url}`

  try {
    const registration = await navigator.serviceWorker?.ready
    if (registration?.showNotification) {
      await registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: tag || path,
        data: { url: path },
      })
      return
    }
  } catch {
    /* fall through to page Notification */
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: tag || path,
      data: { url: path },
    })
    notification.onclick = () => {
      try {
        window.focus()
      } catch {
        /* ignore */
      }
      // Hard navigation — React Router navigate() often no-ops when backgrounded on mobile.
      window.location.assign(path)
      notification.close()
    }
  } catch {
    /* unsupported */
  }
}
