/**
 * Variable Component SWAP form helpers.
 * Run: node --test scripts/variable-component-form.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function getPrimary(config) {
  return config.slots[0] ?? {
    baseComponentId: '',
    baseComponentUom: '',
    quantity: 0,
    alternatives: [],
  };
}

function validateVariableComponentConfig(config) {
  const slot = getPrimary(config);
  if (!slot.baseComponentId.trim()) return 'Select the original component.';
  if (!slot.baseComponentUom.trim()) return 'Enter a UOM for the original component.';
  if (!(slot.quantity > 0)) return 'Enter a quantity greater than zero for the original component.';
  const alts = slot.alternatives.filter(a => a.componentId.trim());
  if (alts.length === 0) return 'Add at least one alternate component that can replace the original.';
  for (const alt of alts) {
    if (!alt.componentUom.trim()) return `Enter a UOM for alternate “${alt.componentName || alt.componentId}”.`;
    if (!(alt.quantity > 0)) return `Enter a quantity greater than zero for alternate “${alt.componentName || alt.componentId}”.`;
  }
  return null;
}

function hasConfigured(config) {
  const slot = getPrimary(config);
  return Boolean(
    slot.baseComponentId.trim()
    && slot.quantity > 0
    && slot.alternatives.some(a => a.componentId.trim() && a.quantity > 0),
  );
}

function parseAddonRrp(raw) {
  const data = JSON.parse(raw);
  const alt = data.slots[0].alternatives[0];
  return Math.max(0, Number(alt.addonRrp ?? alt.extraCharge) || 0);
}

describe('variable component SWAP form', () => {
  it('requires original component, UOM, QTY and an alternate', () => {
    assert.match(validateVariableComponentConfig({ slots: [] }) ?? '', /original/i);
    assert.equal(hasConfigured({ slots: [] }), false);
  });

  it('accepts original + alternate with Addon RRP', () => {
    const config = {
      slots: [{
        baseComponentId: 'BISY-A001',
        baseComponentName: 'Whole Milk',
        baseComponentUom: 'ml',
        quantity: 200,
        alternatives: [{
          componentId: 'BISY-A002',
          componentName: 'Oat Milk',
          componentUom: 'ml',
          quantity: 200,
          extraCharge: 1.5,
        }],
      }],
    };
    assert.equal(validateVariableComponentConfig(config), null);
    assert.equal(hasConfigured(config), true);
  });

  it('reads addonRrp from stored JSON', () => {
    assert.equal(parseAddonRrp(JSON.stringify({
      slots: [{
        alternatives: [{ addonRrp: 2.25 }],
      }],
    })), 2.25);
  });
});
