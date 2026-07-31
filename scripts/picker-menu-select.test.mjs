/**
 * Guards picker outside-click helpers used by Edit Product menus.
 * Run: node --test scripts/picker-menu-select.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function eventTargetElement(event) {
  const target = event.target;
  if (target && typeof target.closest === 'function') return target;
  if (target && target.parentElement) return target.parentElement;
  return null;
}

function isEventInsideSelector(event, selector) {
  const el = eventTargetElement(event);
  return Boolean(el?.closest?.(selector));
}

describe('picker menu selection helpers', () => {
  it('resolves text-node click targets via parentElement', () => {
    const parent = {
      closest(sel) {
        return sel === '[data-menu]' ? parent : null;
      },
    };
    const textNode = { parentElement: parent };
    const event = { target: textNode };
    assert.equal(isEventInsideSelector(event, '[data-menu]'), true);
  });

  it('treats clicks outside the menu selector as outside', () => {
    const outside = {
      closest() {
        return null;
      },
    };
    assert.equal(isEventInsideSelector({ target: outside }, '[data-menu]'), false);
  });
});
