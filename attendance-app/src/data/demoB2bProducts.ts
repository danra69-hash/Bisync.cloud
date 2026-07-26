import type { Ingredient } from '../types'

/** Demo B2B catalog when UAT VendorOrder/Ingredient returns empty (Product/Create is 500 on UAT). */
export const DEMO_B2B_PRODUCTS: Ingredient[] = [
  {
    ingredientId: -9001,
    productId: -9001,
    productName: 'Demo Jasmine Rice 5kg',
    ingredientName: 'Demo Jasmine Rice 5kg',
    name: 'Demo Jasmine Rice 5kg',
    price: 28.9,
    type: 'Sales',
    deliveryPackage: 'Bag',
    uom: 'Bag',
    quantityOnHand: 120,
    parStock: 40,
  },
  {
    ingredientId: -9002,
    productId: -9002,
    productName: 'Demo Cooking Oil 2L',
    ingredientName: 'Demo Cooking Oil 2L',
    name: 'Demo Cooking Oil 2L',
    price: 18.5,
    type: 'Sales',
    deliveryPackage: 'Bottle',
    uom: 'Bottle',
    quantityOnHand: 80,
    parStock: 24,
  },
  {
    ingredientId: -9003,
    productId: -9003,
    productName: 'Demo Soy Sauce 1L',
    ingredientName: 'Demo Soy Sauce 1L',
    name: 'Demo Soy Sauce 1L',
    price: 9.9,
    type: 'Sales',
    deliveryPackage: 'Bottle',
    uom: 'Bottle',
    quantityOnHand: 200,
    parStock: 48,
  },
  {
    ingredientId: -9004,
    productId: -9004,
    productName: 'Demo Chicken Breast 1kg',
    ingredientName: 'Demo Chicken Breast 1kg',
    name: 'Demo Chicken Breast 1kg',
    price: 22.0,
    type: 'Sales',
    deliveryPackage: 'Pack',
    uom: 'kg',
    quantityOnHand: 45,
    parStock: 20,
  },
  {
    ingredientId: -9005,
    productId: -9005,
    productName: 'Demo Mineral Water 24x500ml',
    ingredientName: 'Demo Mineral Water 24x500ml',
    name: 'Demo Mineral Water 24x500ml',
    price: 14.5,
    type: 'Sales',
    deliveryPackage: 'Carton',
    uom: 'Carton',
    quantityOnHand: 60,
    parStock: 12,
  },
  {
    ingredientId: -9006,
    productId: -9006,
    productName: 'Demo Soft Drink Mix Case',
    ingredientName: 'Demo Soft Drink Mix Case',
    name: 'Demo Soft Drink Mix Case',
    price: 36.0,
    type: 'Sales',
    deliveryPackage: 'Case',
    uom: 'Case',
    quantityOnHand: 30,
    parStock: 10,
  },
]

export function isDemoProduct(item: Ingredient) {
  const id = item.productId ?? item.ingredientId ?? 0
  return id < 0
}

export function filterDemoProducts(keyword: string) {
  const q = keyword.trim().toLowerCase()
  if (!q) return DEMO_B2B_PRODUCTS
  return DEMO_B2B_PRODUCTS.filter((p) =>
    (p.productName || p.name || '').toLowerCase().includes(q),
  )
}
