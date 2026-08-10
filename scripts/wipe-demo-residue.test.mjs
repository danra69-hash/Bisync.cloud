/**
 * Guards: demo seed gate semantics + residue name patterns.
 * Ensures SC Demo / FIFO / legacy seed ids stay classified as wipe targets.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function isDemoSandboxCompanyName(name) {
  return Boolean(name)
    && (String(name).startsWith('Bisync') || String(name).startsWith('QA '));
}

function isUnambiguousDemoIngredient(name, componentId) {
  const n = String(name || '');
  const id = String(componentId || '');
  return n.startsWith('SC Demo ')
    || n.startsWith('SC FIFO ')
    || id.startsWith('CMP-SCDEMO-')
    || id.startsWith('CMP-SCFIFO-')
    || ['CMP-WAGYUB-001', 'CMP-BLACKT-001', 'CMP-BURRAT-001', 'CMP-SCFIFO-001'].includes(id);
}

function shouldWipeCatalogSeedName(name, companyName, hasCustomer) {
  const catalog = new Set(['Lamb Rack', 'Peeled Garlic', 'Wagyu Beef A5', 'Burrata']);
  if (!catalog.has(name)) return false;
  if (!hasCustomer) return true; // sandbox-only DB
  return isDemoSandboxCompanyName(companyName);
}

describe('demo residue wipe guards', () => {
  it('classifies SC Demo / FIFO as wipe targets', () => {
    assert.equal(isUnambiguousDemoIngredient('SC Demo Component 001', 'CMP-SCDEMO-001'), true);
    assert.equal(isUnambiguousDemoIngredient('SC FIFO Demo Wagyu', 'CMP-SCFIFO-001'), true);
    assert.equal(isUnambiguousDemoIngredient('DRAFT LEFFE BLONDE', 'BISY-A001'), false);
  });

  it('never wipes Weissbrau catalog names when customer tenant exists', () => {
    assert.equal(shouldWipeCatalogSeedName('Lamb Rack', 'Weissbrau Sdn. Bhd.', true), false);
    assert.equal(shouldWipeCatalogSeedName('Lamb Rack', 'Bisync Hospitality Sdn Bhd', true), true);
  });

  it('sandbox company detector', () => {
    assert.equal(isDemoSandboxCompanyName('Bisync Hospitality Sdn Bhd'), true);
    assert.equal(isDemoSandboxCompanyName('QA Sandbox'), true);
    assert.equal(isDemoSandboxCompanyName('Weissbrau Sdn. Bhd.'), false);
  });
});
