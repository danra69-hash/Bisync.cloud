/**
 * Hard reload equivalent to Ctrl+Shift+R / Cmd+Shift+R:
 * drop service workers and Cache Storage, then reload the document.
 */
export async function hardReloadPage(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch {
    /* still attempt reload */
  }
  window.location.reload();
}
