/**
 * Cloudflare Pages Advanced Mode worker.
 * Proxies /identity and /mobile-api so the browser stays same-origin
 * (production Identity API does not send CORS headers).
 *
 * Also hosts short PO share links in SHARE_KV:
 *   POST /share-api  → { id, url }
 *   GET  /share-api/:id → payload JSON
 *   GET  /s/:id → printable HTML document (no SPA required)
 */
function backendsFor(host) {
  const h = String(host || '').toLowerCase()
  const isUat =
    h.includes('uat') ||
    h.includes('bisync-rms-mobile-uat') ||
    h.startsWith('localhost')
  if (isUat) {
    return {
      identity: 'https://uat.identity.bisync.cloud',
      mobileApi: 'https://uat.mobileapi.bisync.cloud',
    }
  }
  return {
    identity: 'https://identity.bisync.cloud',
    mobileApi: 'https://mobileapi.bisync.cloud',
  }
}

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days

function stripPrefix(pathname, prefix) {
  const rest = pathname.slice(prefix.length)
  return rest.startsWith('/') ? rest : `/${rest}`
}

async function proxy(request, upstreamOrigin, pathname) {
  const incoming = new URL(request.url)
  const target = new URL(pathname + incoming.search, upstreamOrigin)

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ipcountry')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')
  headers.delete('x-forwarded-proto')
  headers.delete('x-real-ip')
  // Avoid compressed upstream bodies that break when CF rewrites length/encoding.
  headers.delete('accept-encoding')

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  const upstream = await fetch(target.toString(), init)
  const out = new Headers(upstream.headers)
  out.set('access-control-allow-origin', incoming.origin)
  out.set('vary', 'Origin')
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  })
}

function corsPreflight(request) {
  const origin = request.headers.get('Origin') || '*'
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers':
        request.headers.get('Access-Control-Request-Headers') ||
        'authorization, content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  })
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(n)
}

function blank(value) {
  const t = String(value ?? '').trim()
  return t ? escapeHtml(t) : ''
}

function formatDate(value) {
  const t = String(value ?? '').trim()
  if (!t) return ''
  if (/[A-Za-z]/.test(t) && !t.includes('T')) return escapeHtml(t)
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return escapeHtml(t)
  return escapeHtml(
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  )
}

function renderShareHtml(payload) {
  const docTitle = payload.kind === 'sales' ? 'Sales Order' : 'Purchase Order'
  const poLabel =
    payload.poNumber ||
    (payload.orderId != null ? `#${payload.orderId}` : '')
  const invoiceName =
    String(payload.companyName || payload.outletName || '').trim()
  const lines = Array.isArray(payload.lines) ? payload.lines : []
  const computedSub =
    payload.subTotal != null
      ? Number(payload.subTotal)
      : lines.reduce((sum, line) => sum + (Number(line.subtotal) || 0), 0)
  const hasTax =
    payload.tax != null &&
    Number.isFinite(Number(payload.tax)) &&
    Number(payload.tax) !== 0

  const rows = lines
    .map((line, idx) => {
      const amount =
        line.subtotal != null
          ? Number(line.subtotal)
          : line.price != null
            ? Number(line.price) * Number(line.qty || 0)
            : null
      const hasLineTax =
        line.tax != null &&
        Number.isFinite(Number(line.tax)) &&
        Number(line.tax) !== 0
      return `<tr>
        <td>${idx + 1}</td>
        <td>${blank(line.code)}</td>
        <td>${blank(line.name)}</td>
        <td>${line.qty != null ? escapeHtml(line.qty) : ''}</td>
        <td>${blank(line.deliveryUnit)}</td>
        <td>${money(line.price)}</td>
        <td>${hasLineTax ? money(line.tax) : ''}</td>
        <td>${money(amount)}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(docTitle)} ${escapeHtml(poLabel)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: #e8e6e3; color: #1f1a14; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; max-width: 210mm; margin: 0 auto; padding: 16px 16px 8px; }
  .toolbar button { background: #f37021; color: #fff; border: 0; border-radius: 8px; padding: 10px 14px; font: 600 14px/1.2 system-ui,sans-serif; cursor: pointer; }
  .doc { box-sizing: border-box; width: min(210mm, 100%); min-height: 297mm; margin: 0 auto 24px; background: #fff; padding: 14mm 12mm 18mm; box-shadow: 0 8px 28px rgba(0,0,0,.08); }
  h1 { margin: 0 0 12px; color: #1f4d3a; font-size: 28px; }
  h2 { margin: 0 0 8px; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: #1f4d3a; }
  .box { border: 1px solid #cfc8be; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 0; }
  dt { font-size: 11px; color: #6b6258; } dd { margin: 2px 0 0; font-size: 14px; min-height: 1.2em; }
  .meta { margin: 10px 0 14px; }
  .meta div { display: flex; gap: 8px; margin: 4px 0; font-size: 14px; }
  .meta span { color: #6b6258; min-width: 150px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1f4d3a; color: #fff; font: 600 11px/1.2 system-ui,sans-serif; padding: 8px 6px; text-align: left; }
  td { border-bottom: 1px solid #ddd6cb; padding: 8px 6px; font-size: 12px; vertical-align: top; }
  .totals { width: 280px; margin-left: auto; margin-top: 16px; }
  .totals th { background: transparent; color: #1f1a14; text-align: left; font-weight: 600; }
  .totals td { text-align: right; font-variant-numeric: tabular-nums; }
  .grand th, .grand td { font-size: 15px; border-top: 2px solid #1f4d3a; }
  .brand { margin-top: 28px; text-align: right; color: #1f4d3a; font: 700 14px/1 system-ui,sans-serif; }
  .brand span { color: #f37021; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .doc { box-shadow: none; margin: 0; width: 100%; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div>${escapeHtml(docTitle)}</div>
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>
  <article class="doc">
    <h1>${escapeHtml(docTitle)}</h1>
    <section class="box">
      <h2>Vendor</h2>
      <dl>
        <div><dt>Name</dt><dd>${blank(payload.vendorName)}</dd></div>
        <div><dt>Tel</dt><dd>${blank(payload.vendorTel)}</dd></div>
        <div><dt>Email</dt><dd>${blank(payload.vendorEmail)}</dd></div>
        <div><dt>Fax</dt><dd>${blank(payload.vendorFax)}</dd></div>
      </dl>
    </section>
    <div class="meta">
      <div><span>PO No</span><strong>${blank(poLabel)}</strong></div>
      <div><span>PO Date</span><strong>${formatDate(payload.poDate)}</strong></div>
      <div><span>Preferred Delivery Date</span><strong>${formatDate(payload.preferredDeliveryDate || payload.deliveryDate)}</strong></div>
    </div>
    <section class="box">
      <h2>Invoice to</h2>
      <dl>
        <div><dt>Name</dt><dd>${blank(invoiceName)}</dd></div>
        <div><dt>Address</dt><dd>${blank(payload.billingAddress)}</dd></div>
        <div><dt>BRN</dt><dd>${blank(payload.brn)}</dd></div>
        <div><dt>GST No.</dt><dd>${blank(payload.gstNo)}</dd></div>
        <div><dt>Tel</dt><dd>${blank(payload.tel)}</dd></div>
        <div><dt>Email</dt><dd>${blank(payload.email)}</dd></div>
      </dl>
    </section>
    <section class="box">
      <h2>Shipped to</h2>
      <dl>
        <div><dt>Name</dt><dd>${blank(payload.outletName) || blank(invoiceName)}</dd></div>
        <div><dt>Address</dt><dd>${blank(payload.deliveryAddress)}</dd></div>
        <div><dt>Tel</dt><dd>${blank(payload.tel)}</dd></div>
      </dl>
    </section>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Vendor Product ID</th><th>Vendor Product Name</th>
          <th>Qty</th><th>Unit</th><th>Unit price</th><th>Tax</th><th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8">&nbsp;</td></tr>'}
      </tbody>
    </table>
    <section class="box" style="margin-top:14px">
      <h2>Remarks</h2>
      <div>${blank(payload.remarks) || '&nbsp;'}</div>
    </section>
    <table class="totals">
      <tbody>
        <tr><th>Subtotal</th><td>${money(computedSub)}</td></tr>
        <tr><th>Tax</th><td>${hasTax ? money(payload.tax) : ''}</td></tr>
        <tr class="grand"><th>Grand Total</th><td>${money(payload.grandTotal != null ? payload.grandTotal : computedSub)}</td></tr>
      </tbody>
    </table>
    <div class="brand">bisync<span>.cloud</span></div>
  </article>
</body>
</html>`
}

function newShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  let out = ''
  for (const b of bytes) out += b.toString(36).padStart(2, '0')
  return out.slice(0, 14)
}

function isValidPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    payload.v === 1 &&
    Array.isArray(payload.lines)
  )
}

async function handleShareApi(request, env, pathname) {
  if (!env.SHARE_KV) {
    return jsonResponse({ error: 'Share storage unavailable' }, 503)
  }

  if (request.method === 'OPTIONS') return corsPreflight(request)

  if (request.method === 'POST' && (pathname === '/share-api' || pathname === '/share-api/')) {
    let payload
    try {
      payload = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }
    if (!isValidPayload(payload)) {
      return jsonResponse({ error: 'Invalid share payload' }, 400)
    }
    const id = newShareId()
    await env.SHARE_KV.put(`share:${id}`, JSON.stringify(payload), {
      expirationTtl: SHARE_TTL_SECONDS,
    })
    const origin = new URL(request.url).origin
    return jsonResponse({
      id,
      url: `${origin}/s/${id}`,
    })
  }

  const match = pathname.match(/^\/share-api\/([A-Za-z0-9_-]{6,32})$/)
  if (request.method === 'GET' && match) {
    const raw = await env.SHARE_KV.get(`share:${match[1]}`)
    if (!raw) return jsonResponse({ error: 'Share link not found or expired' }, 404)
    return new Response(raw, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=300',
      },
    })
  }

  return jsonResponse({ error: 'Not found' }, 404)
}

async function handleShortShare(request, env, pathname) {
  const match = pathname.match(/^\/s\/([A-Za-z0-9_-]{6,32})$/)
  if (!match) return null
  if (!env.SHARE_KV) {
    return new Response('Share storage unavailable', { status: 503 })
  }
  const raw = await env.SHARE_KV.get(`share:${match[1]}`)
  if (!raw) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px">
        <h1>Document unavailable</h1>
        <p>This purchase order link is missing or expired. Ask the sender to create the PDF link again.</p>
      </body></html>`,
      {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    )
  }
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('Invalid share payload', { status: 500 })
  }
  return new Response(renderShareHtml(payload), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    if (pathname === '/identity' || pathname.startsWith('/identity/')) {
      if (request.method === 'OPTIONS') return corsPreflight(request)
      const { identity } = backendsFor(url.host)
      return proxy(request, identity, stripPrefix(pathname, '/identity'))
    }

    if (pathname === '/mobile-api' || pathname.startsWith('/mobile-api/')) {
      if (request.method === 'OPTIONS') return corsPreflight(request)
      const { mobileApi } = backendsFor(url.host)
      return proxy(request, mobileApi, stripPrefix(pathname, '/mobile-api'))
    }

    if (pathname === '/share-api' || pathname.startsWith('/share-api/')) {
      return handleShareApi(request, env, pathname)
    }

    const shortDoc = await handleShortShare(request, env, pathname)
    if (shortDoc) return shortDoc

    // Static assets + SPA
    let response = await env.ASSETS.fetch(request)
    if (response.status === 404 && request.method === 'GET') {
      const accept = request.headers.get('Accept') || ''
      if (accept.includes('text/html') || accept.includes('*/*') || !accept) {
        const indexRequest = new Request(
          new URL('/index.html', url).toString(),
          request,
        )
        response = await env.ASSETS.fetch(indexRequest)
      }
    }
    return response
  },
}
