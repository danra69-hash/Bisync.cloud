import { useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { devConsoleApi, type DevUsageResponse } from '../../data/devConsoleApi';
import { MillstoneLoader } from '../shared/MillstoneLoader';

export function TenantRollupsPanel() {
  const [data, setData] = useState<DevUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await devConsoleApi.rollups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rollups');
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setData(await devConsoleApi.refreshRollups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh rollups');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const rows = data?.byCompany ?? [];
  const busy = loading || refreshing;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Database size={14} className="text-muted-foreground" />
            Tenant rollups
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fan-out counts across shared and provisioned company databases.
            {data?.generatedAt ? (
              <> Last generated {new Date(data.generatedAt).toLocaleString()}.</>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12}  />
          Refresh rollup
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">{error}</div>
      )}

      {data && (data.errors?.length ?? 0) > 0 && (
        <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-1">
          <p className="font-medium">Rollup status: {data.status ?? 'partial'}</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {data.errors!.slice(0, 8).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && !data ? (
        <MillstoneLoader size="sm" layout="block" label="Loading tenant rollups…" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 font-medium">Database</th>
                <th className="px-3 py-2 font-medium text-right">Locs</th>
                <th className="px-3 py-2 font-medium text-right">Products</th>
                <th className="px-3 py-2 font-medium text-right">POs</th>
                <th className="px-3 py-2 font-medium text-right">Sales</th>
                <th className="px-3 py-2 font-medium text-right">Moves</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No tenants in rollup yet.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.companyId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.companyName}</span>
                      {!row.active && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-sans tabular-nums">
                      <span className={row.databaseMode === 'provisioned' ? 'text-primary' : 'text-muted-foreground'}>
                        {row.databaseMode ?? 'shared'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-sans text-muted-foreground truncate max-w-[10rem]" title={row.databaseName}>
                      {row.databaseName ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-sans tabular-nums">{row.locations}</td>
                    <td className="px-3 py-2 text-right font-sans tabular-nums">{row.products ?? 0}</td>
                    <td className="px-3 py-2 text-right font-sans tabular-nums">{row.purchaseOrders ?? 0}</td>
                    <td className="px-3 py-2 text-right font-sans tabular-nums">{row.salesOrders ?? 0}</td>
                    <td className="px-3 py-2 text-right font-sans tabular-nums">{row.inventoryMovements ?? 0}</td>
                    <td className="px-3 py-2 text-destructive truncate max-w-[12rem]" title={row.error ?? undefined}>
                      {row.error ?? ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {data && (
            <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>Tenants: {data.tenantCount ?? rows.length}</span>
              <span>Provisioned: {data.provisionedCount ?? '—'}</span>
              <span>Shared: {data.sharedCount ?? '—'}</span>
              <span>Status: {data.status ?? 'ok'}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
