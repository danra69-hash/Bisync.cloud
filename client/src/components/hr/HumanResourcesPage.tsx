import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { HR_BACKEND_DEV_PORT, HR_BACKEND_REPO } from '../../config/hrBackend';
import { probeHrApi } from '../../modules/hr/api';

const HrModule = lazy(() => import('../../modules/hr/HrModule'));

function HrOfflinePanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-6">
      <div className="bg-card border border-border rounded-lg flex flex-col items-center text-center gap-4 p-10 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Users size={22} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Human Resources API is not running</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            The HR module is built into Bisync.cloud and talks to{' '}
            <a href={HR_BACKEND_REPO} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              HrBackend
            </a>
            {' '}for employee data. Start the API, then retry.
          </p>
        </div>
        <div className="w-full text-left bg-muted/40 border border-border rounded-md px-4 py-3 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Local setup</p>
          <code className="block text-[11px] font-mono text-foreground">dotnet run --project src/HrBackend.Api</code>
          <p className="text-[10px] text-muted-foreground">API at http://localhost:{HR_BACKEND_DEV_PORT} · proxied via /hr-api</p>
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

export function HumanResourcesPage() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const check = useCallback(async () => {
    setStatus('checking');
    setStatus(await probeHrApi() ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (status === 'checking') {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-xs text-muted-foreground font-mono">Loading Human Resources…</p>
      </div>
    );
  }

  if (status === 'offline') {
    return <HrOfflinePanel onRetry={check} />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-12">
          <p className="text-xs text-muted-foreground font-mono">Loading HR module…</p>
        </div>
      }
    >
      <HrModule embedded />
    </Suspense>
  );
}
