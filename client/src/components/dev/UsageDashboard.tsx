import { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, MapPin, RefreshCw, Users } from 'lucide-react';
import { devConsoleApi, type DevUsageResponse } from '../../data/devConsoleApi';
import { MillstoneLoader } from '../shared/MillstoneLoader';

function BarChart({
  rows,
  valueKey,
  labelKey,
  maxBars = 8,
}: {
  rows: Record<string, string | number | boolean | null>[];
  valueKey: string;
  labelKey: string;
  maxBars?: number;
}) {
  const sliced = rows.slice(0, maxBars);
  const max = Math.max(1, ...sliced.map(r => Number(r[valueKey]) || 0));

  if (sliced.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">No data yet.</p>;
  }

  return (
    <div className="space-y-2">
      {sliced.map((row, idx) => {
        const value = Number(row[valueKey]) || 0;
        const label = String(row[labelKey] ?? '');
        const width = `${Math.max(4, (value / max) * 100)}%`;
        return (
          <div key={`${label}-${idx}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] gap-2 items-center">
            <span className="text-[11px] text-muted-foreground truncate" title={label}>{label}</span>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width }} />
            </div>
            <span className="text-[11px] font-sans tabular-nums text-foreground w-12 text-right">{value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ points }: { points: { date: string; apiCalls: number }[] }) {
  const max = Math.max(1, ...points.map(p => p.apiCalls));
  return (
    <div className="flex items-end gap-1.5 h-28">
      {points.map(p => (
        <div key={p.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
            style={{ height: `${Math.max(6, (p.apiCalls / max) * 100)}%` }}
            title={`${p.date}: ${p.apiCalls}`}
          />
          <span className="text-[9px] text-muted-foreground font-sans">{p.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans">{label}</p>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <p className="text-xl font-semibold tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

export function UsageDashboard() {
  const [data, setData] = useState<DevUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await devConsoleApi.usage());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const companyRows = useMemo(
    () => (data?.byCompany ?? []).map(c => ({ ...c, label: c.companyName })),
    [data],
  );
  const locationRows = useMemo(
    () => (data?.byLocation ?? []).map(l => ({ ...l, label: l.locationName })),
    [data],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">System usage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.sourceNote ?? 'Overall and per company / location activity.'}
            {typeof data?.provisionedCount === 'number' || typeof data?.sharedCount === 'number' ? (
              <>
                {' '}
                ({data.provisionedCount ?? 0} provisioned · {data.sharedCount ?? 0} shared)
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12}  /> Refresh
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">{error}</div>
      )}

      {loading && !data ? (
        <MillstoneLoader size="sm" layout="block" label="Loading usage…" />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="API calls (30d)" value={data.overall?.apiCalls30d ?? 0} icon={Activity} />
            <StatCard
              label="Companies"
              value={`${data.overall?.activeCompanies ?? 0}/${data.overall?.companies ?? 0}`}
              icon={Building2}
            />
            <StatCard label="Locations" value={data.overall?.locations ?? 0} icon={MapPin} />
            <StatCard label="Active users" value={data.overall?.activeUsers ?? 0} icon={Users} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4 lg:col-span-1">
              <h3 className="text-xs font-medium mb-3">14-day trend</h3>
              <TrendChart points={data.trend14d ?? []} />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-medium mb-3">By company (inventory movements)</h3>
              <BarChart
                rows={companyRows}
                valueKey={companyRows.some(r => Number(r.inventoryMovements) > 0) ? 'inventoryMovements' : 'apiCalls30d'}
                labelKey="label"
              />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-medium mb-3">By location</h3>
              <BarChart
                rows={locationRows}
                valueKey={locationRows.some(r => Number(r.inventoryMovements) > 0) ? 'inventoryMovements' : 'apiCalls30d'}
                labelKey="label"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Source: {data.source}
            {data.source === 'tenant-fanout-rollup' ? ' (fan-out)' : ''}
            {' · '}Generated {new Date(data.generatedAt).toLocaleString()}
            {data.status ? ` · ${data.status}` : ''}
          </p>
        </>
      ) : null}
    </section>
  );
}
