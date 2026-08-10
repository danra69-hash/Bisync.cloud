/**
 * Deploy simulation: exercise POS catalog / modifier / swap helpers.
 * Run via: npx vite-node --config vite.config.ts scripts/sim-pos-functions.mts
 */
import assert from 'node:assert/strict'
import { isPosDutyCheckInExempt } from '../src/bisync-pos/core/session/posDutyCheckInExempt'
import { mapApiProductsToPosCatalog } from '../src/bisync-pos/core/session/mapPosCatalog'
import {
  resolveRequiredModifierGroups,
  resolveToolbarModifierGroups,
  toPickerGroups,
} from '../src/data/posModifierGroups'
import {
  hasConfiguredVariableComponentSlots,
  parseVariableComponentOptionsJson,
} from '../src/data/productVariableComponent'
import { summarizeSaleDetail } from '../src/bisync-pos/features/register/domain/saleDetail'
import type { Product as ApiProduct } from '../src/api'

function vcJson() {
  return JSON.stringify({
    slots: [{
      slotLabel: 'Base Garlic Mashed Potato',
      baseComponentId: 'SUB-BASEGA-001',
      baseComponentName: 'Base Garlic Mashed Potato',
      baseComponentUom: 'bag',
      baseUnitPrice: 1.47,
      quantity: 1,
      alternatives: [{
        componentId: 'WEIS-A352',
        componentName: 'FRENCH FRIES',
        componentUom: 'g',
        unitPrice: 0.01,
        quantity: 150,
        extraCharge: 6,
        addonRrp: 6,
      }],
    }],
  })
}

const swapProduct = {
  id: 572,
  productId: 'PRD-SIDEDI-001',
  name: 'Side Dish Swap',
  group: 'Component SWAP',
  category: 'Food',
  rrp: 0,
  active: true,
  b2cEnabled: true,
  posEnabled: false,
  isVariableComponent: true,
  isSubProduct: false,
  companyId: 5,
  variableComponentOptionsJson: vcJson(),
} as unknown as ApiProduct

const priced = {
  id: 100,
  productId: 'PRD-STEAK-001',
  name: 'Test Steak',
  group: 'Mains',
  category: 'Food',
  rrp: 42,
  active: true,
  b2cEnabled: true,
  posEnabled: true,
  companyId: 5,
} as unknown as ApiProduct

// 1) VC parse
const cfg = parseVariableComponentOptionsJson(vcJson())
assert.equal(hasConfiguredVariableComponentSlots(cfg), true)

// 2) Catalog includes RRP-0 Variable Component for SWAP
const catalog = mapApiProductsToPosCatalog([swapProduct, priced])
const vc = catalog.find(p => p.name === 'Side Dish Swap')
assert.ok(vc, 'Side Dish Swap must appear in POS catalog for Component SWAP')
assert.equal(vc.isVariableComponent, true)
assert.ok((vc.variableComponentSlots?.length ?? 0) > 0)
assert.ok(catalog.some(p => p.name === 'Test Steak'))

// 3) Required beverage group attached to product prompts like compulsory
const groups = [
  {
    id: 3,
    companyId: 5,
    kind: 'beverage' as const,
    name: 'Glass for Tower',
    sequence: 1,
    required: true,
    minSelect: 0,
    maxSelect: 1,
    affectsStock: false,
    active: true,
    options: [
      { id: 7, label: '2 GLS', sequence: 0, extraChargeCents: 0, active: true },
      { id: 8, label: 'No GLS', sequence: 1, extraChargeCents: 0, active: true },
    ],
    attachments: [
      { id: 1, targetType: 'product' as const, targetProductGroup: '', targetProductId: 124, targetProductName: 'Carlsberg (Tower)' },
    ],
  },
]
const required = resolveRequiredModifierGroups(groups, { id: 124, group: 'Beer' })
assert.equal(required.length, 1)
assert.equal(required[0]?.name, 'Glass for Tower')
const pickers = toPickerGroups(required)
assert.ok(pickers[0]?.options?.length)
assert.ok(pickers[0]!.options.every(o => o.label))

// 4) Toolbar shows only groups attached to the selected product (no company-wide dump)
const teaGroup = {
  id: 4,
  companyId: 5,
  kind: 'beverage' as const,
  name: 'Tea Strength',
  sequence: 2,
  required: false,
  minSelect: 0,
  maxSelect: 1,
  affectsStock: false,
  active: true,
  options: [
    { id: 9, label: 'Strong', sequence: 0, extraChargeCents: 0, active: true },
  ],
  attachments: [
    { id: 2, targetType: 'product' as const, targetProductGroup: '', targetProductId: 99, targetProductName: 'Earl Grey' },
  ],
}
const draughtGroup = {
  ...groups[0]!,
  id: 5,
  name: 'Glass for Tower',
  attachments: [
    {
      id: 3,
      targetType: 'product-group' as const,
      targetProductCategory: '',
      targetProductGroup: 'Draft Beer',
      targetProductId: null,
    },
  ],
}
const beverageAll = [draughtGroup, teaGroup]
const earlGreyToolbar = resolveToolbarModifierGroups(
  beverageAll,
  'beverage',
  { id: 99, group: 'Blue Tea', category: 'Beverage', department: 'Beverage' },
)
assert.equal(earlGreyToolbar.length, 1)
assert.equal(earlGreyToolbar[0]?.name, 'Tea Strength')
const draughtToolbar = resolveToolbarModifierGroups(
  beverageAll,
  'beverage',
  { id: 10, group: 'Draught Beer', category: 'Beverage', department: 'Beverage' },
)
assert.equal(draughtToolbar.length, 1)
assert.equal(draughtToolbar[0]?.name, 'Glass for Tower')
const unattachedToolbar = resolveToolbarModifierGroups(
  beverageAll,
  'beverage',
  { id: 50, group: 'Soft Drink', category: 'Beverage', department: 'Beverage' },
)
assert.equal(unattachedToolbar.length, 0)

// Category attach works when only department is present on the POS product
const chilled = {
  id: 40,
  companyId: 5,
  kind: 'beverage' as const,
  name: 'Chilled',
  sequence: 0,
  required: false,
  minSelect: 0,
  maxSelect: 1,
  affectsStock: false,
  active: true,
  options: [{ id: 15, label: 'Chilled', sequence: 0, extraChargeCents: 0, active: true }],
  attachments: [
    {
      id: 8,
      targetType: 'category' as const,
      targetProductCategory: 'Beverage',
      targetProductGroup: '',
      targetProductId: null,
    },
  ],
}
const deptOnlyToolbar = resolveToolbarModifierGroups(
  [chilled, draughtGroup],
  'beverage',
  { id: 223, group: 'Tea', department: 'Beverage' },
)
assert.equal(deptOnlyToolbar.length, 1)
assert.equal(deptOnlyToolbar[0]?.name, 'Chilled')
assert.ok(deptOnlyToolbar.every(g => g.name !== 'Glass for Tower'))

// Without a product, hard-coded defaults still apply when no API groups exist
const foodDefaults = resolveToolbarModifierGroups([], 'food', null)
assert.ok(foodDefaults.length > 0)
for (const g of foodDefaults) {
  assert.ok(Array.isArray(g.options))
}

// 5) Sale detail summary for swap labels
const summary = summarizeSaleDetail({
  variableMode: 'variableComponent',
  replacementSelections: [{
    baseComponentId: 'SUB-BASEGA-001',
    baseComponentName: 'Base Garlic Mashed Potato',
    chosenComponentId: 'WEIS-A352',
    chosenComponentName: 'FRENCH FRIES',
    componentUom: 'g',
    quantity: 150,
    extraCharge: 6,
  }],
})
assert.match(summary, /Garlic Mashed Potato/)
assert.match(summary, /FRENCH FRIES/)

// 6) Platform account exemption from Team QR Home lock
assert.equal(isPosDutyCheckInExempt('dra@cubevalue.com'), true)
assert.equal(isPosDutyCheckInExempt('DRA@CubeValue.com'), true)
assert.equal(isPosDutyCheckInExempt('ms@cubevalue.com'), false)
assert.equal(isPosDutyCheckInExempt(null), false)

console.log('sim-pos-functions: ok')
