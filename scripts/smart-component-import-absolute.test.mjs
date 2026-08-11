/**
 * Absolute My Component CSV import rules.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function mergeDraftWithExisting(draft, existing) {
  const blank = draft.blankFields ?? {};
  return {
    ...draft,
    category: blank.category || !draft.category?.trim() ? existing.category : draft.category,
    group: blank.group || !draft.group?.trim() ? existing.group : draft.group,
    storage: blank.storage || !(draft.storage?.length) ? [...(existing.storage ?? [])] : draft.storage,
    area: blank.area || !draft.area?.trim() ? (existing.area || '') : draft.area.trim(),
    active: blank.active ? existing.active : draft.active,
    name: draft.name,
    componentId: draft.componentId,
    blankFields: undefined,
  };
}

function finalizeCreateDraft(draft) {
  const blank = draft.blankFields ?? {};
  return {
    ...draft,
    category: blank.category || !draft.category?.trim() ? 'Food' : draft.category.trim(),
    group: blank.group || !draft.group?.trim() ? 'Dry Goods' : draft.group.trim(),
    area: blank.area ? '' : (draft.area || '').trim(),
    storage: blank.storage ? [] : (draft.storage || []),
    active: blank.active ? true : draft.active,
    blankFields: undefined,
  };
}

function buildPlan(drafts, existingRows) {
  const byId = new Map(
    existingRows.filter(r => r.componentId).map(r => [r.componentId.toUpperCase(), r]),
  );
  const plan = { creates: [], updates: [], unchanged: [], deactivations: [], errors: [] };
  const seenIds = new Set();
  const matched = new Set();

  for (const raw of drafts) {
    const id = (raw.componentId || '').trim().toUpperCase();
    if (id) seenIds.add(id);
    const existing = id ? byId.get(id) : undefined;
    if (existing) {
      matched.add(existing.id);
      const draft = mergeDraftWithExisting(raw, existing);
      plan.updates.push({ existing, draft });
      continue;
    }
    plan.creates.push(finalizeCreateDraft(raw));
  }

  for (const row of existingRows) {
    if (!row.active) continue;
    if (matched.has(row.id)) continue;
    const id = (row.componentId || '').toUpperCase();
    if (id && seenIds.has(id)) continue;
    plan.deactivations.push({ existing: row, reason: 'Not present in uploaded template' });
  }
  return plan;
}

describe('absolute component CSV import plan', () => {
  const existing = [
    { id: 1, componentId: 'COMP-A001', name: 'Flour', category: 'Dry Goods', group: 'Baking', storage: ['Dry Store'], area: 'Kitchen', active: true },
    { id: 2, componentId: 'COMP-A002', name: 'Butter', category: 'Dairy', group: 'Fats', storage: ['Chiller'], area: 'Kitchen', active: true },
    { id: 3, componentId: 'COMP-A003', name: 'Old Spice', category: 'Spices', group: 'Seasoning', storage: ['Dry Store'], area: 'Kitchen', active: true },
  ];

  it('updates by Component ID with absolute field changes', () => {
    const plan = buildPlan(
      [{ componentId: 'COMP-A001', name: 'Flour Strong', category: 'Dry Goods', group: 'Baking', storage: ['Freezer'], area: 'Bar', active: true }],
      existing,
    );
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].draft.name, 'Flour Strong');
    assert.deepEqual(plan.updates[0].draft.storage, ['Freezer']);
    assert.equal(plan.updates[0].draft.area, 'Bar');
  });

  it('creates when Component ID is empty', () => {
    const plan = buildPlan(
      [{ componentId: '', name: 'New Yeast', category: 'Dry Goods', group: 'Baking', storage: ['Dry Store'], area: 'Kitchen', active: true }],
      existing,
    );
    assert.equal(plan.creates.length, 1);
    assert.equal(plan.creates[0].name, 'New Yeast');
    assert.equal(plan.creates[0].category, 'Dry Goods');
  });

  it('preserves storage and area when blank on update', () => {
    const plan = buildPlan(
      [{
        componentId: 'COMP-A001',
        name: 'Flour',
        category: 'Dry Goods',
        group: 'Baking',
        storage: [],
        area: '',
        active: true,
        blankFields: { storage: true, area: true },
      }],
      existing,
    );
    assert.deepEqual(plan.updates[0].draft.storage, ['Dry Store']);
    assert.equal(plan.updates[0].draft.area, 'Kitchen');
  });

  it('deactivates active rows missing from the template', () => {
    const plan = buildPlan(
      [{ componentId: 'COMP-A001', name: 'Flour', category: 'Dry Goods', group: 'Baking', storage: ['Dry Store'], area: 'Kitchen', active: true }],
      existing,
    );
    const deactivated = plan.deactivations.map(d => d.existing.componentId).sort();
    assert.deepEqual(deactivated, ['COMP-A002', 'COMP-A003']);
  });

  it('create defaults category/group when blank, leaves storage blank', () => {
    const draft = finalizeCreateDraft({
      componentId: '',
      name: 'Mystery',
      category: '',
      group: '',
      storage: [],
      area: '',
      active: true,
      blankFields: { category: true, group: true, storage: true, area: true },
    });
    assert.equal(draft.category, 'Food');
    assert.equal(draft.group, 'Dry Goods');
    assert.deepEqual(draft.storage, []);
    assert.equal(draft.area, '');
  });
});
