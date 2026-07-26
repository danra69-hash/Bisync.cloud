import type { AuthSession } from '../types'

/** True when Vite env asks to skip the login screen in local/dev builds. */
export const DEV_BYPASS_AUTH =
  import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export const DEV_BYPASS_USERNAME =
  (import.meta.env.VITE_DEV_USERNAME as string | undefined)?.trim() ||
  'ms@cubevalue.com'

export const DEV_BYPASS_PASSWORD =
  (import.meta.env.VITE_DEV_PASSWORD as string | undefined) || '12345678'

/** UAT vendor test account — use for manual vendor login (not dev bypass). */
export const DEV_VENDOR_USERNAME =
  (import.meta.env.VITE_DEV_VENDOR_USERNAME as string | undefined)?.trim() ||
  'vendor@cubevalue.com'

export const DEV_VENDOR_PASSWORD =
  (import.meta.env.VITE_DEV_VENDOR_PASSWORD as string | undefined) || '1234'

const DEV_TOKEN = 'dev-bypass-token'

export function isDevBypassSession(session: AuthSession | null | undefined) {
  return !!session && session.access_token === DEV_TOKEN
}

/** Offline / local Clock session (no Identity API). */
export function createDevBypassSession(
  usage: 'operator' | 'vendor' = 'operator',
  opts?: { username?: string; fullName?: string },
): AuthSession {
  const username = opts?.username?.trim() || DEV_BYPASS_USERNAME
  return {
    access_token: DEV_TOKEN,
    token_type: 'Bearer',
    expires_in: 86400,
    fullName:
      opts?.fullName?.trim() ||
      (usage === 'vendor' ? 'Dev Vendor' : username.split('@')[0] || 'Staff'),
    username,
    userType: usage === 'vendor' ? 'Vendor' : 'Operator',
    roleName: usage === 'vendor' ? 'Vendor' : 'Operator',
    active: true,
    permissionNames: [
      'CreateOrderAddEdit',
      'Sales',
      'ViewOrder',
      'ApproveOrder',
      'CancelOrder',
      'ReceiveAddEdit',
      'ConsolidateAddEdit',
      'ReceiveConsolidateAddEdit',
      'ProcurementPriceView',
      'TransferView',
      'TransferAddEdit',
      'TransferDelete',
      'WastageView',
      'WastageAddEdit',
      'InventoryIngredientView',
      'InventoryIngredientAddEdit',
    ],
  }
}
