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
