import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchAccountDetail,
  loadSession,
  loginWithBiometric,
  loginWithPassword,
  refreshAccessToken,
  registerBiometricAccessKey,
  saveSession,
} from '../api/auth'
import { setRefreshHandler } from '../api/client'
import type { AuthSession } from '../types'
import {
  assertPlatformCredential,
  clearBiometricEnrollment,
  createPlatformCredential,
  isBiometricEnrolled,
  isWebAuthnPlatformAvailable,
  loadBiometricEnrollment,
  saveBiometricEnrollment,
} from './biometric'
import {
  createDevBypassSession,
  DEV_BYPASS_AUTH,
  DEV_BYPASS_PASSWORD,
  DEV_BYPASS_USERNAME,
  isDevBypassSession,
} from './devBypass'
import { clearIdleActivityStamp, useIdleLogout } from './useIdleLogout'
import { isAttendanceMock } from '../api/attendance'
import {
  findHrEmployeeByLogin,
  HR_STANDARD_PASSWORD,
} from '../api/hr'

export type UsageRole = 'operator' | 'vendor'

const USAGE_KEY = 'bisync_rms_web_usage_role'

type AuthContextValue = {
  session: AuthSession | null
  loading: boolean
  /** Active UI mode (can differ from account userType). */
  usageRole: UsageRole
  setUsageRole: (role: UsageRole) => void
  toggleUsageRole: () => void
  isVendor: boolean
  isOperator: boolean
  /** Account's native userType from API. */
  accountRole: UsageRole | null
  hasPermission: (name: string) => boolean
  login: (username: string, password: string) => Promise<void>
  /** Face ID / fingerprint / Windows Hello using enrolled access key. */
  loginWithBiometrics: () => Promise<void>
  /** Register platform biometrics + Identity access key for current user. */
  enrollBiometrics: () => Promise<void>
  /** Remove local biometric enrollment for this device. */
  resetBiometrics: () => void
  biometricsAvailable: boolean
  biometricsEnrolled: boolean
  /** Clears session. Manual logout; also used by idle timeout. */
  logout: () => void
  token: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function roleFromUserType(userType?: string | null): UsageRole {
  return userType?.toLowerCase() === 'vendor' ? 'vendor' : 'operator'
}

function loadUsageRole(fallback: UsageRole): UsageRole {
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (raw === 'vendor' || raw === 'operator') return raw
  } catch {
    /* ignore */
  }
  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [loading, setLoading] = useState(true)
  const [biometricTick, setBiometricTick] = useState(0)
  const [usageRole, setUsageRoleState] = useState<UsageRole>(() =>
    loadUsageRole(roleFromUserType(loadSession()?.userType)),
  )

  const applySession = useCallback((next: AuthSession | null) => {
    setSession(next)
    saveSession(next)
    if (!next) {
      localStorage.removeItem(USAGE_KEY)
    }
  }, [])

  const setUsageRole = useCallback((role: UsageRole) => {
    setUsageRoleState(role)
    localStorage.setItem(USAGE_KEY, role)
  }, [])

  const toggleUsageRole = useCallback(() => {
    setUsageRoleState((prev) => {
      const next: UsageRole = prev === 'vendor' ? 'operator' : 'vendor'
      localStorage.setItem(USAGE_KEY, next)
      return next
    })
  }, [])

  useEffect(() => {
    setRefreshHandler(async () => {
      const current = loadSession()
      if (!current?.refresh_token) return null
      try {
        const token = await refreshAccessToken(current.refresh_token)
        const merged: AuthSession = { ...current, ...token }
        applySession(merged)
        return token.access_token
      } catch {
        applySession(null)
        return null
      }
    })
    return () => setRefreshHandler(null)
  }, [applySession])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      let current = loadSession()

      // Attendance mock: keep offline session if already signed in; never auto-login.
      if (isAttendanceMock()) {
        if (current?.access_token && isDevBypassSession(current)) {
          if (!cancelled) {
            applySession(current)
            if (!localStorage.getItem(USAGE_KEY)) {
              setUsageRoleState(roleFromUserType(current.userType))
            }
          }
        } else if (!cancelled) {
          applySession(null)
        }
        if (!cancelled) setLoading(false)
        return
      }

      // HR / live mode: restore HR employee session without Identity.
      if (current?.access_token?.startsWith('hr-employee-') && current.employeeId) {
        if (!cancelled) {
          applySession(current)
          if (!localStorage.getItem(USAGE_KEY)) {
            setUsageRoleState('operator')
          }
          setLoading(false)
        }
        return
      }

      // Dev bypass: silent password login so APIs still work with a real token.
      if (DEV_BYPASS_AUTH && (!current?.access_token || isDevBypassSession(current))) {
        try {
          current = await loginWithPassword(DEV_BYPASS_USERNAME, DEV_BYPASS_PASSWORD)
          if (!cancelled) {
            applySession(current)
            if (!localStorage.getItem(USAGE_KEY)) {
              setUsageRoleState(roleFromUserType(current.userType))
            }
          }
        } catch {
          current = createDevBypassSession(loadUsageRole('operator'))
          if (!cancelled) {
            applySession(current)
            if (!localStorage.getItem(USAGE_KEY)) {
              setUsageRoleState(roleFromUserType(current.userType))
            }
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      if (!current?.access_token) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const account = await fetchAccountDetail(current.access_token)
        if (!cancelled) {
          const merged = { ...current, ...account }
          applySession(merged)
          // Only seed usage role if user never chose one
          if (!localStorage.getItem(USAGE_KEY)) {
            setUsageRoleState(roleFromUserType(merged.userType))
          }
        }
      } catch {
        // Stale token: in bypass mode, re-authenticate; otherwise keep cached session.
        if (DEV_BYPASS_AUTH) {
          try {
            const next = await loginWithPassword(
              DEV_BYPASS_USERNAME,
              DEV_BYPASS_PASSWORD,
            )
            if (!cancelled) {
              applySession(next)
              if (!localStorage.getItem(USAGE_KEY)) {
                setUsageRoleState(roleFromUserType(next.userType))
              }
            }
          } catch {
            if (!cancelled) applySession(createDevBypassSession(loadUsageRole('operator')))
          }
        } else if (!cancelled) {
          setSession(current)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [applySession])

  const login = useCallback(
    async (username: string, password: string) => {
      const user = username.trim()
      if (!user) throw new Error('Mobile number is required')
      if (!password) throw new Error('Password is required')

      // Offline demo gate.
      if (isAttendanceMock()) {
        const next = createDevBypassSession('operator', { username: user })
        applySession(next)
        setUsageRoleState('operator')
        localStorage.setItem(USAGE_KEY, 'operator')
        clearIdleActivityStamp()
        return
      }

      // Bisync.cloud HR — employee directory login by mobile number.
      const employee = await findHrEmployeeByLogin(user)
      if (!employee) {
        throw new Error(
          'Employee not found. Use the mobile number from the HR employee directory.',
        )
      }
      if (employee.active === false) {
        throw new Error('This employee account is inactive.')
      }
      // Same gate as Bisync.cloud Employee Portal until dedicated HR auth ships.
      if (password !== HR_STANDARD_PASSWORD && password.length < 8) {
        throw new Error(
          `Incorrect password. Hint: standard password is ${HR_STANDARD_PASSWORD}`,
        )
      }

      const next: AuthSession = {
        access_token: `hr-employee-${employee.id}`,
        token_type: 'Bearer',
        expires_in: 86400,
        fullName: employee.name,
        username: employee.mobile || user,
        userType: 'Operator',
        roleName: employee.position || 'Employee',
        active: true,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        departmentId: employee.departmentId ?? null,
        department: employee.department,
        permissionNames: [],
      }
      applySession(next)
      setUsageRoleState('operator')
      localStorage.setItem(USAGE_KEY, 'operator')
      clearIdleActivityStamp()
    },
    [applySession],
  )

  const loginWithBiometrics = useCallback(async () => {
    const enrolled = loadBiometricEnrollment()
    if (!enrolled) throw new Error('Biometric login is not enrolled on this device')
    await assertPlatformCredential(enrolled.credentialId)
    const next = await loginWithBiometric(enrolled.username, enrolled.accessKey)
    applySession(next)
    const role = roleFromUserType(next.userType)
    setUsageRoleState(role)
    localStorage.setItem(USAGE_KEY, role)
    clearIdleActivityStamp()
  }, [applySession])

  const enrollBiometrics = useCallback(async () => {
    const current = loadSession()
    const username = current?.username?.trim()
    const token = current?.access_token
    if (!username || !token) throw new Error('Sign in first to enroll biometrics')
    if (!isWebAuthnPlatformAvailable()) {
      throw new Error('Biometrics are not supported in this browser')
    }
    const credentialId = await createPlatformCredential(username)
    const accessKey = await registerBiometricAccessKey(token)
    saveBiometricEnrollment({ username, accessKey, credentialId })
    setBiometricTick((n) => n + 1)
  }, [])

  const resetBiometrics = useCallback(() => {
    clearBiometricEnrollment()
    setBiometricTick((n) => n + 1)
  }, [])

  const logout = useCallback(() => {
    clearIdleActivityStamp()
    applySession(null)
    setUsageRoleState('operator')
  }, [applySession])

  // Auto-logout after 15 minutes without interaction.
  useIdleLogout(Boolean(session?.access_token) && !loading, logout)

  const biometricsAvailable = isWebAuthnPlatformAvailable()
  const biometricsEnrolled = isBiometricEnrolled(session?.username)

  const value = useMemo<AuthContextValue>(() => {
    const accountRole = session ? roleFromUserType(session.userType) : null
    return {
      session,
      loading,
      usageRole,
      setUsageRole,
      toggleUsageRole,
      isVendor: usageRole === 'vendor',
      isOperator: usageRole === 'operator',
      accountRole,
      hasPermission: (name: string) =>
        DEV_BYPASS_AUTH ||
        isDevBypassSession(session) ||
        (session?.permissionNames || []).includes(name),
      login,
      loginWithBiometrics,
      enrollBiometrics,
      resetBiometrics,
      biometricsAvailable,
      biometricsEnrolled,
      logout,
      token: session?.access_token || null,
    }
  }, [
    session,
    loading,
    usageRole,
    setUsageRole,
    toggleUsageRole,
    login,
    loginWithBiometrics,
    enrollBiometrics,
    resetBiometrics,
    biometricsAvailable,
    biometricsEnrolled,
    biometricTick,
    logout,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
