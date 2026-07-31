/** Close modal overlays only when the gesture started and ended on the overlay.
 * Prevents ghost-clicks after portaled picker menus unmount from cancelling Edit Product.
 */
export function createOverlayCloseHandlers(onClose: () => void) {
  let pointerDownOnOverlay = false;

  return {
    onPointerDown: (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
      pointerDownOnOverlay = event.target === event.currentTarget;
    },
    onClick: (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
      if (pointerDownOnOverlay && event.target === event.currentTarget) {
        onClose();
      }
      pointerDownOnOverlay = false;
    },
  };
}
