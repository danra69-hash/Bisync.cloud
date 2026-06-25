import type { Location } from '../api';

export function filterLocations(locations: Location[], selectedIds: string[]): Location[] {
  if (selectedIds.length === 0) return locations;
  return locations.filter(l => selectedIds.includes(l.externalId));
}

export function aggregateLocationMetrics(locations: Location[]) {
  const totalSales = locations.reduce((s, l) => s + l.salesToday, 0);
  const totalSalesPrev = locations.reduce((s, l) => s + l.salesPrevToday, 0);
  const totalCovers = locations.reduce((s, l) => s + l.coversToday, 0);
  const totalCoversPrev = locations.reduce((s, l) => s + l.coversPrevToday, 0);
  const aov = totalCovers > 0 ? totalSales / totalCovers : 0;
  const aovPrev = totalCoversPrev > 0 ? totalSalesPrev / totalCoversPrev : 0;

  return { totalSales, totalSalesPrev, totalCovers, totalCoversPrev, aov, aovPrev };
}
