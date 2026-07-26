import type { ApiEnvelope } from '../types'

/**
 * Same-origin proxy paths (`/identity`, `/mobile-api`).
 * - Dev: Vite server proxy
 * - Prod: Cloudflare Pages `_worker.js` (needed because Identity has no CORS)
 */
const useProxy = import.meta.env.VITE_USE_PROXY === 'true'

function trimSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export function apiBase(): string {
  if (useProxy) return '/mobile-api'
  return trimSlash(
    import.meta.env.VITE_API_BASE_URL || 'https://uat.mobileapi.bisync.cloud',
  )
}

export function tokenBase(): string {
  if (useProxy) return '/identity'
  return trimSlash(
    import.meta.env.VITE_TOKEN_BASE_URL || 'https://uat.identity.bisync.cloud',
  )
}

export function joinUrl(base: string, path: string): string {
  const b = trimSlash(base)
  const p = path.replace(/^\/+/, '')
  return `${b}/${p}`
}

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Avoid dumping HTML 404 pages into the login form. */
export function friendlyHttpError(
  status: number,
  body: unknown,
  fallback: string,
): string {
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (/^<!DOCTYPE|^<html/i.test(trimmed)) {
      if (status === 404) {
        return 'Sign-in service not found (404). Check identity URL / proxy, or restart the Vite dev server.'
      }
      return `Sign-in failed (HTTP ${status}). The server returned an HTML error page.`
    }
    if (trimmed.length > 280) return trimmed.slice(0, 280) + '…'
    return trimmed || fallback
  }
  const env = (body || {}) as ApiEnvelope
  const oauth =
    body && typeof body === 'object'
      ? (body as { error_description?: string; error?: string })
      : null
  return (
    env.errorMessage ||
    env.ErrorMessage ||
    env.message ||
    env.Message ||
    oauth?.error_description ||
    oauth?.error ||
    fallback
  )
}

type RequestOptions = {
  method?: string
  body?: unknown
  form?: Record<string, string>
  token?: string | null
  base?: 'api' | 'token'
  raw?: boolean
}

let refreshHandler: (() => Promise<string | null>) | null = null

export function setRefreshHandler(handler: (() => Promise<string | null>) | null) {
  refreshHandler = handler
}

function unwrapEnvelope<T>(json: unknown): { data: T; recordsCount?: number } {
  if (json == null || typeof json !== 'object') {
    return { data: json as T }
  }

  const env = json as ApiEnvelope<T>
  const success =
    env.success ?? env.Success ?? env.isSuccess ?? env.IsSuccess

  if (success === false) {
    const msg =
      env.errorMessage ||
      env.ErrorMessage ||
      env.message ||
      env.Message ||
      'Request failed'
    throw new ApiError(msg)
  }

  const data = (env.entity ??
    env.Entity ??
    env.data ??
    env.Data ??
    json) as T

  const recordsCount = env.recordsCount ?? env.RecordsCount
  return { data, recordsCount }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; recordsCount?: number; status: number }> {
  const primaryBase = options.base === 'token' ? tokenBase() : apiBase()
  const headers: Record<string, string> = {}
  let body: string | undefined

  if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(options.form).toString()
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const buildInit = (token?: string | null): RequestInit => {
    const h = { ...headers }
    if (token) h.Authorization = `Bearer ${token}`
    return {
      method: options.method || (body ? 'POST' : 'GET'),
      headers: h,
      body,
    }
  }

  let url = joinUrl(primaryBase, path)
  let res = await fetch(url, buildInit(options.token))

  // Only fall back to absolute URLs in local Vite preview when the proxy
  // route is missing (404 HTML). Never do this in production — Identity has
  // no CORS and the retry becomes "Failed to fetch".
  if (
    import.meta.env.DEV &&
    useProxy &&
    res.status === 404 &&
    (primaryBase === '/identity' || primaryBase === '/mobile-api')
  ) {
    const absolute =
      options.base === 'token'
        ? trimSlash(
            import.meta.env.VITE_TOKEN_BASE_URL ||
              'https://uat.identity.bisync.cloud',
          )
        : trimSlash(
            import.meta.env.VITE_API_BASE_URL ||
              'https://uat.mobileapi.bisync.cloud',
          )
    url = joinUrl(absolute, path)
    res = await fetch(url, buildInit(options.token))
  }

  if (res.status === 401 && options.base !== 'token' && refreshHandler) {
    const newToken = await refreshHandler()
    if (newToken) {
      res = await fetch(url, buildInit(newToken))
    }
  }

  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
  }

  if (!res.ok) {
    throw new ApiError(
      friendlyHttpError(
        res.status,
        json,
        res.statusText || `HTTP ${res.status}`,
      ),
      res.status,
    )
  }

  if (options.raw) {
    return { data: json as T, status: res.status }
  }

  const unwrapped = unwrapEnvelope<T>(json)
  return { ...unwrapped, status: res.status }
}
