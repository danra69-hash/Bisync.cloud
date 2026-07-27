/** Bisync.cloud Human Resources API (dev: http://127.0.0.1:5299). */

const useProxy = import.meta.env.VITE_USE_PROXY === 'true'

function trimSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export function hrApiBase(): string {
  if (useProxy) return '/hr-api'
  // Same-origin when hosted on Bisync.cloud (e.g. /Attendance/app → /api/...).
  if (import.meta.env.VITE_HR_SAME_ORIGIN === 'true') return ''
  const configured = import.meta.env.VITE_HR_API_BASE_URL
  if (configured !== undefined && String(configured).trim() !== '') {
    return trimSlash(String(configured))
  }
  return 'http://127.0.0.1:5299'
}

export class HrApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'HrApiError'
    this.status = status
  }
}

export async function hrRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const base = hrApiBase()
  const url = `${base}/api/${path.replace(/^\/+/, '')}`
  const headers: Record<string, string> = {}
  let body: string | undefined
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: options.method || (body ? 'POST' : 'GET'),
      headers,
      body,
    })
  } catch {
    throw new HrApiError(
      'Cannot reach Bisync.cloud HR API. Start the API on port 5299 (or set VITE_HR_API_BASE_URL).',
    )
  }

  if (!res.ok) {
    const text = await res.text()
    let message = text || `${res.status} ${res.statusText}`
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new HrApiError(
        'Bisync.cloud HR API is not running (502). Start it with: cd Bisync.cloud; docker compose up -d; cd src/Bisync.Api; dotnet run',
        res.status,
      )
    }
    try {
      const json = JSON.parse(text) as { title?: string; detail?: string; message?: string }
      message = json.detail || json.title || json.message || message
    } catch {
      /* raw text */
    }
    if (/^<!DOCTYPE|^<html/i.test(message.trim())) {
      message = `HR API error (HTTP ${res.status}). Is Bisync.cloud running on port 5299?`
    }
    if (message.length > 280) message = message.slice(0, 280) + '…'
    throw new HrApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
