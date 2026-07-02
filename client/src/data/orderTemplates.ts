import type { OrderTemplate } from '../api';
import type { CreateOrderLine } from './createOrder';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayLabelForDate(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()];
}

export function orderTemplateMatchesToday(
  template: OrderTemplate,
  referenceDate = new Date(),
): boolean {
  if (template.scheduleMode === 'weekday') {
    const today = weekdayLabelForDate(referenceDate);
    return template.weekdays.includes(today);
  }

  if (template.scheduleMode === 'monthday') {
    return template.monthDays.includes(referenceDate.getDate());
  }

  return false;
}

export function orderTemplateMatchesLocations(
  template: OrderTemplate,
  selectedLocationIds: string[],
): boolean {
  if (selectedLocationIds.length === 0) return false;
  const templateLocations = template.locationExternalIds ?? [];
  if (templateLocations.length === 0) return true;
  const selected = new Set(selectedLocationIds);
  return templateLocations.some(locationId => selected.has(locationId));
}

export function filterOrderTemplatesForToday(
  templates: OrderTemplate[],
  selectedLocationIds: string[],
  referenceDate = new Date(),
): OrderTemplate[] {
  return templates
    .filter(template => orderTemplateMatchesLocations(template, selectedLocationIds))
    .filter(template => orderTemplateMatchesToday(template, referenceDate))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function describeOrderTemplateSchedule(template: OrderTemplate): string {
  if (template.scheduleMode === 'weekday') {
    return template.weekdays.join(', ');
  }
  if (template.scheduleMode === 'monthday') {
    return template.monthDays.join(', ');
  }
  return 'No schedule';
}

export function findLineKeyForTemplateItem(
  item: OrderTemplate['items'][number],
  lines: CreateOrderLine[],
): string | null {
  const match = lines.find(line => {
    if (line.component.componentId !== item.componentId) return false;
    if (item.vendorProductId) {
      return line.vendorProduct.id === item.vendorProductId;
    }
    return true;
  });

  return match?.key ?? null;
}

export function buildOrderQtyFromTemplate(
  template: OrderTemplate,
  lines: CreateOrderLine[],
): Record<string, string> {
  const updates: Record<string, string> = {};

  for (const item of template.items) {
    const lineKey = findLineKeyForTemplateItem(item, lines);
    if (!lineKey || item.quantity <= 0) continue;
    updates[lineKey] = String(item.quantity);
  }

  return updates;
}

export function countAppliedTemplateItems(
  template: OrderTemplate,
  lines: CreateOrderLine[],
): number {
  return template.items.filter(item => findLineKeyForTemplateItem(item, lines) !== null).length;
}
