import { lazy, Suspense } from 'react';
import { MillstoneLoader } from '../shared/MillstoneLoader';

const HrModule = lazy(() => import('../../modules/hr/HrModule'));

export function HumanResourcesPage({ selectedCompanyId }: { selectedCompanyId: number | null }) {
  // Do not hard-gate on a probe: a stale POS service worker can false-negative
  // /api probes and make HR look completely broken. Load the module and let
  // individual screens surface API errors.
  return (
    <div className="flex-1 min-h-0 flex flex-col w-full min-w-0">
      <Suspense
        fallback={
          <MillstoneLoader layout="block" size="lg" label="Loading HR module…" className="flex-1" />
        }
      >
        <HrModule embedded selectedCompanyId={selectedCompanyId} />
      </Suspense>
    </div>
  );
}
