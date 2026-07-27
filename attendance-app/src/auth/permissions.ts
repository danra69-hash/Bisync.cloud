/**
 * Backend Account permissionNames helpers.
 * Always combine with status / API allow* flags on mutate actions.
 */

export type HasPermission = (name: string) => boolean

function anyOf(has: HasPermission, names: string[]) {
  return names.some((n) => has(n))
}

/** Operator purchase order list / home chips */
export function canViewOperatorOrders(has: HasPermission) {
  return anyOf(has, [
    'CreateOrderView',
    'OrderListView',
    'CreateOrderAddEdit',
    'OrderListAddEdit',
  ])
}

export function canCreateOperatorOrder(has: HasPermission) {
  return has('CreateOrderAddEdit')
}

export function canApproveOperatorOrder(has: HasPermission) {
  return has('EditPendingApprovalOrder')
}

export function canCancelOperatorOrder(has: HasPermission) {
  return anyOf(has, ['CreateOrderAddEdit', 'OrderListAddEdit'])
}

export function canReceiveOperatorOrder(has: HasPermission) {
  return has('ReceiveAddEdit')
}

export function canConsolidateOperatorOrder(has: HasPermission) {
  return anyOf(has, ['ConsolidateAddEdit', 'ReceiveConsolidateAddEdit'])
}

export function canEditProcurementPrice(has: HasPermission) {
  return has('ProcurementPriceView')
}

export function canViewStockHub(has: HasPermission) {
  return (
    canViewWastage(has) || canViewTransfer(has) || canViewInventory(has)
  )
}

export function canViewWastage(has: HasPermission) {
  return anyOf(has, ['WastageView', 'WastageAddEdit'])
}

export function canEditWastage(has: HasPermission) {
  return has('WastageAddEdit')
}

/** Approve/reject pending wastage — account perm; still need API allow* + Pending. */
export function canApproveWastage(has: HasPermission) {
  return anyOf(has, [
    'WastageAddEdit',
    'EditPendingApprovalOrder',
    'WastageView',
  ])
}

export function canViewTransfer(has: HasPermission) {
  return anyOf(has, ['TransferView', 'TransferAddEdit'])
}

export function canEditTransfer(has: HasPermission) {
  return has('TransferAddEdit')
}

export function canDeleteTransfer(has: HasPermission) {
  return has('TransferDelete')
}

export function canViewInventory(has: HasPermission) {
  return anyOf(has, [
    'InventoryIngredientView',
    'InventoryIngredientAddEdit',
  ])
}

export function canEditInventory(has: HasPermission) {
  return has('InventoryIngredientAddEdit')
}

export function canViewVendorOrders(has: HasPermission) {
  return anyOf(has, ['VendorOrderView', 'VendorOrderAddEdit', 'Sales'])
}

export function canEditVendorOrders(has: HasPermission) {
  return has('VendorOrderAddEdit')
}

export function canCreateSalesOrder(has: HasPermission) {
  return has('Sales')
}
