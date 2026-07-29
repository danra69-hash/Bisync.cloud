export type QrTableMode = 'fixed' | 'dynamic'

export const QR_TABLE_MODE_KEY = 'bisync-pos-qr-table-mode'

export function loadQrTableMode(): QrTableMode {
  try {
    const raw = localStorage.getItem(QR_TABLE_MODE_KEY)
    if (raw === 'fixed' || raw === 'dynamic') return raw
  } catch {
    /* ignore */
  }
  return 'fixed'
}

export function saveQrTableMode(mode: QrTableMode) {
  localStorage.setItem(QR_TABLE_MODE_KEY, mode)
}

export type TableQrPayload = {
  mode: QrTableMode
  table: string
  /** Location name baked into the QR at print time. */
  location?: string
  pax?: number
  /** ISO timestamp baked into the QR (print time for fixed; session open for dynamic). */
  openedAt?: string
}

export function formatOpenedAt(iso = new Date().toISOString()) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
    iso: d.toISOString(),
  }
}

export function buildQrPayload(data: TableQrPayload): string {
  const opened = data.openedAt ? formatOpenedAt(data.openedAt) : formatOpenedAt()
  return JSON.stringify({
    app: 'BisyncPOS',
    mode: data.mode,
    location: (data.location ?? '').trim(),
    table: data.table,
    date: opened.date,
    time: data.mode === 'dynamic' ? opened.time : undefined,
    openedAt: opened.iso,
    pax: data.mode === 'dynamic' ? data.pax : undefined,
  })
}

export function qrImageUrl(data: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Opens a print-ready slip with QR for the table. */
export function printTableQr(data: TableQrPayload) {
  const openedAt = data.openedAt ?? new Date().toISOString()
  const payload = buildQrPayload({ ...data, openedAt })
  const img = qrImageUrl(payload, 280)
  const opened = formatOpenedAt(openedAt)
  const location = (data.location ?? '').trim() || '—'
  const title =
    data.mode === 'fixed'
      ? `Fixed QR · Table ${data.table}`
      : `Dynamic QR · Table ${data.table}`

  const details =
    data.mode === 'fixed'
      ? `<p class="meta"><strong>Location:</strong> ${escapeHtml(location)}</p>
         <p class="meta"><strong>Date:</strong> ${escapeHtml(opened.date)}</p>
         <p class="meta"><strong>Table:</strong> ${escapeHtml(data.table)}</p>
         <p class="meta muted">Permanent until reprinted</p>`
      : `<p class="meta"><strong>Location:</strong> ${escapeHtml(location)}</p>
         <p class="meta"><strong>Date:</strong> ${escapeHtml(opened.date)}</p>
         <p class="meta"><strong>Time:</strong> ${escapeHtml(opened.time)}</p>
         <p class="meta"><strong>Table:</strong> ${escapeHtml(data.table)}</p>
         <p class="meta"><strong>Pax:</strong> ${data.pax ?? '—'}</p>
         <p class="meta muted">Session QR — printed at table open</p>`

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; color: #111; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .brand { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 16px; }
    img { width: 280px; height: 280px; margin: 12px 0 16px; }
    .meta { margin: 4px 0; font-size: 15px; }
    .meta.muted { color: #666; font-size: 13px; margin-top: 12px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="brand">Bisync POS</div>
  <h1>Table ${escapeHtml(data.table)}</h1>
  <img src="${img}" alt="Table QR" />
  ${details}
  <script>
    const img = document.querySelector('img');
    function go() { window.focus(); window.print(); }
    if (img.complete) setTimeout(go, 150);
    else img.onload = () => setTimeout(go, 150);
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640')
  if (!win) {
    window.alert('Allow pop-ups to print the table QR.')
    return false
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
