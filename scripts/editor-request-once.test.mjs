/**
 * Guards Edit Product editorRequest hydration so draft BOM edits are not wiped.
 * Run: node --test scripts/editor-request-once.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function editorRequestKey(request) {
  if (!request) return null;
  return request.mode === 'new' ? 'new' : `edit:${request.id}`;
}

function shouldApplyEditorRequest(appliedKey, request) {
  const key = editorRequestKey(request);
  if (!key) return { apply: false, nextKey: null, consume: false };
  if (appliedKey === key) return { apply: false, nextKey: appliedKey, consume: true };
  return { apply: true, nextKey: key, consume: true };
}

describe('editorRequest one-shot hydrate', () => {
  it('applies the first edit request then ignores identical re-fires', () => {
    let applied = null;
    const first = shouldApplyEditorRequest(applied, { mode: 'edit', id: 42 });
    assert.equal(first.apply, true);
    applied = first.nextKey;

    const second = shouldApplyEditorRequest(applied, { mode: 'edit', id: 42 });
    assert.equal(second.apply, false);
    assert.equal(second.consume, true);
  });

  it('clears when request is null so the same product can open again', () => {
    let applied = 'edit:42';
    const cleared = shouldApplyEditorRequest(null, null);
    assert.equal(cleared.nextKey, null);
    applied = cleared.nextKey;

    const again = shouldApplyEditorRequest(applied, { mode: 'edit', id: 42 });
    assert.equal(again.apply, true);
  });

  it('treats inline object identity churn as the same request key', () => {
    const a = editorRequestKey({ mode: 'edit', id: 7 });
    const b = editorRequestKey({ mode: 'edit', id: 7 });
    assert.equal(a, b);
  });
});
