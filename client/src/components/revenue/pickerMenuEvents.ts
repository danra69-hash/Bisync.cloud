/** Helpers for portaled picker menus (outside-click + option selection). */

export function eventTargetElement(event: Event): Element | null {
  const target = event.target;
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

export function isEventInsideSelector(event: Event, selector: string): boolean {
  const el = eventTargetElement(event);
  return Boolean(el?.closest(selector));
}

/**
 * Bind option activation on pointerdown (before outside-close) and mousedown
 * (legacy / keyboard-compatible). preventDefault keeps the input from blurring.
 */
export function bindPickerOptionActivate(
  event: { preventDefault(): void; stopPropagation(): void },
  activate: () => void,
) {
  event.preventDefault();
  event.stopPropagation();
  activate();
}
