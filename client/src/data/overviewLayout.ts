export type OverviewSectionId =
  | 'metrics'
  | 'revenue-progress'
  | 'menu-alerts'
  | 'purchase-orders';

export type OverviewLayoutState = {
  order: OverviewSectionId[];
  hidden: OverviewSectionId[];
};

const STORAGE_KEY = 'bisync.overviewLayout.v1';

export const DEFAULT_OVERVIEW_LAYOUT: OverviewLayoutState = {
  order: ['metrics', 'revenue-progress', 'menu-alerts', 'purchase-orders'],
  hidden: [],
};

const ALL_SECTIONS = new Set<OverviewSectionId>(DEFAULT_OVERVIEW_LAYOUT.order);

function normalizeSectionId(value: unknown): OverviewSectionId | null {
  if (typeof value !== 'string') return null;
  return ALL_SECTIONS.has(value as OverviewSectionId) ? (value as OverviewSectionId) : null;
}

export function loadOverviewLayout(): OverviewLayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OVERVIEW_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<OverviewLayoutState>;
    const order = Array.isArray(parsed.order)
      ? parsed.order.map(normalizeSectionId).filter((id): id is OverviewSectionId => id != null)
      : [];
    const hidden = Array.isArray(parsed.hidden)
      ? parsed.hidden.map(normalizeSectionId).filter((id): id is OverviewSectionId => id != null)
      : [];
    const mergedOrder = [
      ...order,
      ...DEFAULT_OVERVIEW_LAYOUT.order.filter(id => !order.includes(id)),
    ];
    return {
      order: mergedOrder,
      hidden: [...new Set(hidden)],
    };
  } catch {
    return DEFAULT_OVERVIEW_LAYOUT;
  }
}

export function saveOverviewLayout(state: OverviewLayoutState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function reorderOverviewSections(
  state: OverviewLayoutState,
  fromId: OverviewSectionId,
  toId: OverviewSectionId,
): OverviewLayoutState {
  if (fromId === toId) return state;
  const order = [...state.order];
  const fromIndex = order.indexOf(fromId);
  const toIndex = order.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0) return state;
  order.splice(fromIndex, 1);
  order.splice(toIndex, 0, fromId);
  return { ...state, order };
}

export function toggleOverviewSectionHidden(
  state: OverviewLayoutState,
  sectionId: OverviewSectionId,
): OverviewLayoutState {
  const hidden = new Set(state.hidden);
  if (hidden.has(sectionId)) hidden.delete(sectionId);
  else hidden.add(sectionId);
  return { ...state, hidden: [...hidden] };
}
