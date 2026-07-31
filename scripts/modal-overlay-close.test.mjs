/**
 * Guards Edit Product overlay close against ghost-clicks from portaled pickers.
 * Run: node --test scripts/modal-overlay-close.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function createOverlayCloseHandlers(onClose) {
  let pointerDownOnOverlay = false;
  return {
    onPointerDown(event) {
      pointerDownOnOverlay = event.target === event.currentTarget;
    },
    onClick(event) {
      if (pointerDownOnOverlay && event.target === event.currentTarget) {
        onClose();
      }
      pointerDownOnOverlay = false;
    },
  };
}

describe('modal overlay close handlers', () => {
  it('closes when pointerdown and click both land on the overlay', () => {
    let closed = 0;
    const handlers = createOverlayCloseHandlers(() => {
      closed += 1;
    });
    const overlay = {};
    handlers.onPointerDown({ target: overlay, currentTarget: overlay });
    handlers.onClick({ target: overlay, currentTarget: overlay });
    assert.equal(closed, 1);
  });

  it('ignores ghost clicks after a picker option pointerdown (mousedown elsewhere)', () => {
    let closed = 0;
    const handlers = createOverlayCloseHandlers(() => {
      closed += 1;
    });
    const overlay = {};
    const option = {};
    // Gesture started on a picker option, then click retargets to overlay after unmount.
    handlers.onPointerDown({ target: option, currentTarget: overlay });
    handlers.onClick({ target: overlay, currentTarget: overlay });
    assert.equal(closed, 0);
  });
});
