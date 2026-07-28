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
  pax?: number
  openedAt?: string
}

export function buildQrPayload(data: TableQrPayload): string {
  return JSON.stringify({
    app: 'BisyncPOS',
    ...data,
  })
}

export function qrImageUrl(data: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
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

/** Opens a print-ready slip with QR for the table. */
export function printTableQr(data: TableQrPayload) {
  const payload = buildQrPayload(data)
  const img = qrImageUrl(payload, 280)
  const opened = data.openedAt ? formatOpenedAt(data.openedAt) : null
  const title =
    data.mode === 'fixed'
      ? `Fixed QR · Table ${data.table}`
      : `Dynamic QR · Table ${data.table}`

  const details =
    data.mode === 'fixed'
      ? `<p class="meta">Permanent table QR</p>
         <p class="meta">Scan to order at this table</p>`
      : `<p class="meta"><strong>Pax:</strong> ${data.pax ?? '—'}</p>
         <p class="meta"><strong>Date:</strong> ${opened?.date ?? ''}</p>
         <p class="meta"><strong>Time:</strong> ${opened?.time ?? ''}</p>`

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; color: #111; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .brand { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 16px; }
    img { width: 280px; height: 280px; margin: 12px 0 16px; }
    .meta { margin: 4px 0; font-size: 15px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="brand">Bisync POS</div>
  <h1>Table ${data.table}</h1>
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
