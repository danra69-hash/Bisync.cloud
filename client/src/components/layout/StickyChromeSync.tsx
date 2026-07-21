import { useEffect } from 'react';

/**
 * Keeps CSS vars for sticky module bar / page filters in sync with real layout heights.
 * Pair with `[data-app-main]`, `[data-module-bar]`, and `[data-page-filters]` in index.css.
 */
export function StickyChromeSync() {
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('[data-app-main]');
    if (!main) return;

    const root = document.documentElement;

    const sync = () => {
      const moduleBar = main.querySelector<HTMLElement>('[data-module-bar]');
      const filters = main.querySelector<HTMLElement>('[data-page-filters]');
      const moduleH = moduleBar?.offsetHeight ?? 0;
      const filtersH = filters?.offsetHeight ?? 0;
      root.style.setProperty('--app-module-bar-height', `${moduleH}px`);
      root.style.setProperty('--app-page-filters-height', `${filtersH}px`);
      root.style.setProperty('--app-sticky-filters-top', `${moduleH}px`);
      root.style.setProperty('--app-sticky-table-top', `${moduleH + filtersH}px`);
    };

    sync();

    const resizeObserver = new ResizeObserver(() => sync());
    resizeObserver.observe(main);

    const mutationObserver = new MutationObserver(() => {
      const moduleBar = main.querySelector<HTMLElement>('[data-module-bar]');
      const filters = main.querySelector<HTMLElement>('[data-page-filters]');
      if (moduleBar) resizeObserver.observe(moduleBar);
      if (filters) resizeObserver.observe(filters);
      sync();
    });
    mutationObserver.observe(main, { childList: true, subtree: true });

    const moduleBar = main.querySelector<HTMLElement>('[data-module-bar]');
    const filters = main.querySelector<HTMLElement>('[data-page-filters]');
    if (moduleBar) resizeObserver.observe(moduleBar);
    if (filters) resizeObserver.observe(filters);

    window.addEventListener('resize', sync);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, []);

  return null;
}
