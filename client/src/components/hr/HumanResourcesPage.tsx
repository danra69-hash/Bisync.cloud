import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { probeHrApi } from '../../modules/hr/api';
import { MillstoneLoader } from '../shared/MillstoneLoader';

const HrModule = lazy(() => import('../../modules/hr/HrModule'));

function HrOfflinePanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-6">
      <div className="bg-card border border-border rounded-lg flex flex-col items-center text-center gap-4 p-10 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Users size={22} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Human Resources API is not reachable</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            The HR module is part of Bisync.cloud and uses the same API as the rest of the platform.
            Start the Bisync API, then retry.
          </p>
        </div>
        <div className="w-full text-left bg-muted/40 border border-border rounded-md px-4 py-3 space-y-2">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Local setup</p>
          <code className="block text-[11px] font-sans text-foreground">dotnet run --project src/Bisync.Api</code>
          <p className="text-xs text-muted-foreground">API at http://localhost:5299</p>
        </div>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          <RefreshCw size={12} /> Retry connection
        </button>
      </div>
    </div>
  );
}

export function HumanResourcesPage({ selectedCompanyId }: { selectedCompanyId: number | null }) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const check = useCallback(async () => {
    setStatus('checking');
    setStatus(await probeHrApi() ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (status === 'checking') {
    return <MillstoneLoader layout="block" size="lg" label="Loading Human Resources…" className="flex-1 min-h-0" />;
  }

  if (status === 'offline') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <HrOfflinePanel onRetry={check} />
      </div>
    );
  }

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
