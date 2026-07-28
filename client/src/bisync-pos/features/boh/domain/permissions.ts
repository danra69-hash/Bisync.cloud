export type PermissionAction =
  | 'refund'
  | 'void-large'
  | 'comp'
  | 'open-drawer'
  | 'apply-discount'
  | 'edit-tips'

export type StaffRole = 'server' | 'cashier' | 'cook' | 'manager'

export const ROLE_PERMISSIONS: Record<StaffRole, PermissionAction[]> = {
  server: ['apply-discount'],
  cashier: ['apply-discount', 'open-drawer', 'edit-tips'],
  cook: [],
  manager: [
    'refund',
    'void-large',
    'comp',
    'open-drawer',
    'apply-discount',
    'edit-tips',
  ],
}

export const PERMISSION_LABEL: Record<PermissionAction, string> = {
  refund: 'Issue refunds',
  'void-large': 'Void large checks',
  comp: 'Issue comps',
  'open-drawer': 'Open cash drawer',
  'apply-discount': 'Apply discounts',
  'edit-tips': 'Edit tips / auto-gratuity',
}
