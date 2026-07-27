/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_TOKEN_BASE_URL?: string
  readonly VITE_CLIENT_ID?: string
  readonly VITE_CLIENT_SECRET?: string
  readonly VITE_USE_PROXY?: string
  readonly VITE_DEV_BYPASS_AUTH?: string
  readonly VITE_DEV_USERNAME?: string
  readonly VITE_DEV_PASSWORD?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_VAPID_KEY?: string
  /** When true, attendance uses localStorage (offline demo). Default false = live HR API. */
  readonly VITE_ATTENDANCE_MOCK?: string
  /** Bisync.cloud API origin for HR module (dev default http://127.0.0.1:5299). */
  readonly VITE_HR_API_BASE_URL?: string
  /** When true, HR calls use same-origin `/api` (Cloud Run /Attendance/app). */
  readonly VITE_HR_SAME_ORIGIN?: string
  /** Vite public base path (e.g. /Attendance/app/). */
  readonly VITE_BASE_PATH?: string
  /** Clock-only shell (hide RMS nav). Default true when unset in clock builds. */
  readonly VITE_CLOCK_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
