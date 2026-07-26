export type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
}

export type AccountDetail = {
  fullName?: string
  username?: string
  active?: boolean
  roleName?: string
  userType?: string
  profileImage?: string
  permissionNames?: string[]
  deviceId?: string | number
  currency?: string
  /** Bisync.cloud HR employee directory id */
  employeeId?: number
  employeeCode?: string
  departmentId?: number | null
  department?: string
}

export type AuthSession = TokenResponse & AccountDetail

export type OrderSummary = {
  id: number
  operatorCompanyName?: string
  createdOn?: string
  purchaseOrderNumber?: string
  grandTotal?: number
  total?: number
  status?: string
  orderStatus?: string
  isVirtualVendor?: boolean
  outletName?: string
  vendorName?: string
  operatorOutletName?: string
  noOfProduct?: string
  createdBy?: string
  doImageUrl?: string
}

export type OrderLine = {
  orderDetailId?: number
  ingredientId?: number
  productId?: number
  productCode?: string
  productName?: string
  ingredientName?: string
  productQuantity?: number
  productPrice?: number
  subtotal?: number
  discount?: number
  tax?: number
  productType?: string
  uom?: string
  deliveryPackage?: string
  /** Recipe UOM for Par / On hand (e.g. PCS) */
  recipeUom?: string
  recipeUnit?: string
  parStock?: number
  onHandQuantity?: number
  quantityOnHand?: number
  /** Local flag: added during receive/consolidate (not on original PO). */
  isExtra?: boolean
}

export type OrderDetail = {
  id: number
  poNumber?: string
  poDate?: string
  status?: string
  outletId?: number
  outletName?: string
  vendorId?: number
  vendorName?: string
  operatorCompanyName?: string
  supplier?: string
  outlet?: string
  deliveryAddress?: string
  billingAddress?: string
  deliveryDate?: string
  tel?: string
  email?: string
  vendorTel?: string
  vendorEmail?: string
  vendorFax?: string
  brn?: string
  gstNo?: string
  remarks?: string
  subTotal?: number
  totalDiscount?: number
  tax?: number
  deliveryCharge?: number
  rounding?: number
  grandTotal?: number
  total?: number
  allowApproveOrReject?: boolean
  allowCancel?: boolean
  isVirtualVendor?: boolean
  shippingDate?: string
  preferDeliveryDate?: string
  orderFrom?: string
  orderDetails?: OrderLine[]
  doImageURL?: string
}

export type Outlet = {
  outletId: number
  name?: string
  isDefault?: boolean
  outletAddress?: string
}

export type Address = {
  id?: number
  addressId?: number
  address?: string
  outletName?: string
  isDefault?: boolean
}

export type IngredientTab = {
  id?: number
  parentId?: number
  name?: string
  description?: string
}

export type OrderTemplate = {
  id?: number
  name?: string
}

export type Ingredient = {
  ingredientId?: number
  ingredientName?: string
  productId?: number
  productName?: string
  /** Display name helper (productName || ingredientName) */
  name?: string
  price?: number
  type?: string
  uom?: string
  deliveryPackage?: string
  recipeUom?: string
  recipeUnit?: string
  promotionDetailId?: number
  categoryName?: string
  groupName?: string
  quantityOnHand?: number
  onHandQuantity?: number
  parStock?: number
  vendorId?: number
  vendorName?: string
  cartItemId?: number
  cartQuantity?: number
}

export type CartVendor = {
  vendorId?: number
  vendorName?: string
  cartItems?: CartItem[]
  /** Raw Mobile API field — prefer cartItems after normalize */
  details?: CartItem[]
  deliveryDate?: string
  remarks?: string
  subTotal?: number
  grandTotal?: number
  deliveryCharge?: number
}

export type CartItem = {
  cartItemId?: number
  ingredientId?: number
  productId?: number
  productName?: string
  ingredientName?: string
  quantity?: number
  price?: number
  rrp?: number
  subtotal?: number
  total?: number
  productType?: string
  deliveryPackage?: string
  uom?: string
  recipeUom?: string
  recipeUnit?: string
  parStock?: number
  onHandQuantity?: number
  quantityOnHand?: number
  vendorName?: string
}

export type ApiEnvelope<T = unknown> = {
  success?: boolean
  Success?: boolean
  isSuccess?: boolean
  IsSuccess?: boolean
  entity?: T
  Entity?: T
  data?: T
  Data?: T
  message?: string
  Message?: string
  errorMessage?: string
  ErrorMessage?: string
  recordsCount?: number
  RecordsCount?: number
}
