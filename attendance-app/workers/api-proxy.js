export default {
  async fetch(request) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || '*'

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, request),
      })
    }

    let upstream
    if (url.pathname === '/identity' || url.pathname.startsWith('/identity/')) {
      upstream = 'https://identity.bisync.cloud' + url.pathname.slice('/identity'.length) + url.search
    } else if (url.pathname === '/mobile-api' || url.pathname.startsWith('/mobile-api/')) {
      upstream = 'https://mobileapi.bisync.cloud' + url.pathname.slice('/mobile-api'.length) + url.search
    } else if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'bisync-rms-api-proxy' }, origin)
    } else {
      return json({ error: 'not_found', hint: 'Use /identity/* or /mobile-api/*' }, origin, 404)
    }

    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.delete('cf-connecting-ip')
    headers.delete('cf-ipcountry')
    headers.delete('cf-ray')
    headers.delete('cf-visitor')

    const init = { method: request.method, headers, redirect: 'follow' }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body
      init.duplex = 'half'
    }

    const upstreamRes = await fetch(upstream, init)
    const out = new Headers(upstreamRes.headers)
    out.delete('content-encoding')
    out.delete('content-length')
    for (const [k, v] of Object.entries(corsHeaders(origin, request))) {
      out.set(k, v)
    }
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: out,
    })
  },
}

function corsHeaders(origin, request) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers':
      request.headers.get('Access-Control-Request-Headers') ||
      'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function json(body, origin, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(origin, new Request('https://x')),
    },
  })
}
