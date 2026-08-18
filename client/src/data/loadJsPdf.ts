/**
 * Lazy-load jspdf. After deploys, a stale tab may request an old hashed chunk
 * (404). Reload once so the browser picks up the new asset map.
 */
export async function loadJsPDF() {
  try {
    const { jsPDF } = await import('jspdf');
    return jsPDF;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeStaleChunk =
      /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(
        message,
      );
    if (looksLikeStaleChunk) {
      const key = 'bisync.jspdf-chunk-reload-at';
      const last = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - last >= 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        // Keep the promise pending while the page unloads.
        return new Promise<never>(() => {});
      }
    }
    throw error;
  }
}
