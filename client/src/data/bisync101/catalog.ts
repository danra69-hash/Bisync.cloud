import type { Bisync101Module, Bisync101Task } from './types';
import { gettingStartedModule } from './modules/gettingStarted';
import { systemConfigModule } from './modules/systemConfig';
import { rmsOrdersModule } from './modules/rmsOrders';
import { rmsInventoryModule } from './modules/rmsInventory';
import { rmsCatalogModule } from './modules/rmsCatalog';
import { posModule } from './modules/pos';
import { hrModule } from './modules/hr';
import { accountingModule } from './modules/accounting';

export const BISYNC101_MODULES: Bisync101Module[] = [
  gettingStartedModule,
  systemConfigModule,
  rmsOrdersModule,
  rmsInventoryModule,
  rmsCatalogModule,
  posModule,
  hrModule,
  accountingModule,
];

export function findBisync101Task(
  moduleId: string,
  taskId: string,
): { module: Bisync101Module; task: Bisync101Task } | null {
  const module = BISYNC101_MODULES.find(m => m.id === moduleId);
  if (!module) return null;
  const task = module.tasks.find(t => t.id === taskId);
  if (!task) return null;
  return { module, task };
}

export function bisync101ClipUrl(task: Bisync101Task): string | null {
  const file = (task.clipFile ?? '').trim();
  if (!file) return null;
  return `/bisync101/clips/${file.replace(/^\/+/, '')}`;
}

export function parseBisync101Hash(hash: string): { moduleId: string; taskId: string } | null {
  const raw = hash.replace(/^#/, '').trim();
  if (!raw.startsWith('bisync101')) return null;
  const parts = raw.split('/').filter(Boolean);
  // bisync101 | bisync101/:moduleId | bisync101/:moduleId/:taskId
  if (parts[0] !== 'bisync101') return null;
  return {
    moduleId: parts[1] ?? BISYNC101_MODULES[0]?.id ?? 'getting-started',
    taskId: parts[2] ?? '',
  };
}

export function bisync101Hash(moduleId: string, taskId?: string): string {
  return taskId ? `#bisync101/${moduleId}/${taskId}` : `#bisync101/${moduleId}`;
}
