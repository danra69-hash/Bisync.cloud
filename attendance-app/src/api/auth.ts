import { request, ApiError } from './client'
import type { AccountDetail, AuthSession, TokenResponse } from '../types'

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'rms'
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET || ''

const STORAGE_KEY = 'bisync_rms_web_auth'

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<AuthSession> {
  let token: TokenResponse
  try {
    const res = await request<TokenResponse>('connect/token', {
      base: 'token',
      form: {
        client_id: CLIENT_ID,
        grant_type: 'password',
        username,
        password,
        client_secret: CLIENT_SECRET,
      },
      raw: true,
    })
    token = res.data
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ApiError(
        err.message.startsWith('Sign-in')
          ? err.message
          : `Identity token failed: ${err.message}`,
        err.status,
      )
    }
    throw err
  }

  if (!token?.access_token) {
    throw new Error('Login failed: no access token')
  }

  try {
    const account = await fetchAccountDetail(token.access_token)
    const session: AuthSession = { ...token, ...account }
    saveSession(session)
    return session
  } catch (err) {
    // Token worked — still save a minimal session so the app can load.
    const minimal: AuthSession = {
      ...token,
      fullName: username,
      username,
      active: true,
      permissionNames: [],
    }
    saveSession(minimal)
    if (err instanceof ApiError && err.status === 404) {
      // Keep signed in with token; profile fetch can retry later.
      return minimal
    }
    throw err
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const { data } = await request<TokenResponse>('connect/token', {
    base: 'token',
    form: {
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_secret: CLIENT_SECRET,
    },
    raw: true,
  })
  return data
}

export async function fetchAccountDetail(token: string): Promise<AccountDetail> {
  const { data } = await request<AccountDetail>('Account/Detail', { token })
  return data
}

/** Sends a password-reset email via Mobile API (same as Flutter). */
export async function requestResetPassword(username: string): Promise<void> {
  await request('Account/RequestResetPassword', {
    method: 'POST',
    body: {
      username: username.trim(),
      sourceChannel: 'rmsmobile',
      platform: 'web',
    },
  })
}

/**
 * Register FCM / device push token with Mobile API
 * (Flutter: POST account/updateDeviceId?deviceId=…).
 */
export async function updateDeviceId(
  token: string,
  deviceId: string,
): Promise<void> {
  const path = `Account/UpdateDeviceId?deviceId=${encodeURIComponent(deviceId)}`
  await request(path, { method: 'POST', token })
}

/**
 * Identity API — register a biometric access key for the signed-in user
 * (Flutter: POST api/user/RegisterUserAccessKey/biometric).
 */
export async function registerBiometricAccessKey(
  token: string,
): Promise<string> {
  const { data } = await request<{ accessKey?: string } | string>(
    'api/user/RegisterUserAccessKey/biometric',
    {
      method: 'POST',
      base: 'token',
      token,
      raw: true,
    },
  )

  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    const key =
      (data as { accessKey?: string; AccessKey?: string }).accessKey ||
      (data as { AccessKey?: string }).AccessKey
    if (typeof key === 'string' && key.trim()) return key.trim()
    const nested =
      (data as { entity?: { accessKey?: string } }).entity?.accessKey ||
      (data as { Entity?: { accessKey?: string } }).Entity?.accessKey
    if (typeof nested === 'string' && nested.trim()) return nested.trim()
  }
  throw new Error('Biometric access key was empty')
}

/** Login with Identity grant_type=biometric (same as Flutter). */
export async function loginWithBiometric(
  username: string,
  accessKey: string,
): Promise<AuthSession> {
  let token: TokenResponse
  try {
    const res = await request<TokenResponse>('connect/token', {
      base: 'token',
      form: {
        client_id: CLIENT_ID,
        grant_type: 'biometric',
        username,
        accessKey,
        client_secret: CLIENT_SECRET,
      },
      raw: true,
    })
    token = res.data
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ApiError(
        err.message.startsWith('Sign-in')
          ? err.message
          : `Biometric sign-in failed: ${err.message}`,
        err.status,
      )
    }
    throw err
  }

  if (!token?.access_token) {
    throw new Error('Biometric login failed: no access token')
  }

  try {
    const account = await fetchAccountDetail(token.access_token)
    const session: AuthSession = { ...token, ...account }
    saveSession(session)
    return session
  } catch (err) {
    const minimal: AuthSession = {
      ...token,
      fullName: username,
      username,
      active: true,
      permissionNames: [],
    }
    saveSession(minimal)
    if (err instanceof ApiError && err.status === 404) return minimal
    throw err
  }
}
