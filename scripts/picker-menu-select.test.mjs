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

function bindPickerOptionActivate(event, activate) {
  event.preventDefault();
  event.stopPropagation();
  activate();
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

  it('activates option on pointerdown with preventDefault/stopPropagation', () => {
    let activated = 0;
    let prevented = false;
    let stopped = false;
    bindPickerOptionActivate(
      {
        preventDefault() {
          prevented = true;
        },
        stopPropagation() {
          stopped = true;
        },
      },
      () => {
        activated += 1;
      },
    );
    assert.equal(activated, 1);
    assert.equal(prevented, true);
    assert.equal(stopped, true);
  });
});
