import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { api, type PosLocationTodayRow } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import type { DropdownLocation } from '../../utils/orgFilters';

type Props = {
  companyId: number | null;
  locations: DropdownLocation[];
  selectedLocationIds: string[];
};

type RowView = DropdownLocation & {
  salesCents: number;
  covers: number;
  checks: number;
  openChecks: number;
  lastPaidAt: string | null;
  avgCheck: number;
};

function formatAsOf(iso: string | null | undefined, timeZoneId?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZoneId || undefined,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function HomeLocationPosList({ companyId, locations, selectedLocationIds }: Props) {
  const { t } = useAppTranslation();
  const { currency } = useCountryFormatters();
  const [rows, setRows] = useState<PosLocationTodayRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopedLocations = useMemo(() => {
    if (selectedLocationIds.length === 0) return [];
    const selected = new Set(selectedLocationIds);
    return locations
      .filter(loc => selected.has(loc.externalId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, selectedLocationIds]);

  const locationIdsKey = scopedLocations.map(l => l.externalId).join(',');

  const refresh = useCallback(async () => {
    if (!companyId || scopedLocations.length === 0) {
      setRows([]);
      setAsOf(null);
      setBusinessDate(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.posLocationsToday(
        companyId,
        scopedLocations.map(l => l.externalId),
      );
      setRows(data.locations ?? []);
      setAsOf(data.asOf ?? null);
      setBusinessDate(data.businessDate ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('home.locations.loadError'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, scopedLocations, t]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh, locationIdsKey]);

  const views: RowView[] = useMemo(() => {
    const byId = new Map(rows.map(r => [r.locationExternalId, r]));
    return scopedLocations.map(loc => {
      const row = byId.get(loc.externalId);
      const salesCents = row?.salesCents ?? 0;
      const covers = row?.covers ?? 0;
      const checks = row?.checks ?? 0;
      const sales = salesCents / 100;
      const avgCheck = covers > 0 ? sales / covers : checks > 0 ? sales / checks : 0;
      return {
        ...loc,
        salesCents,
        covers,
        checks,
        openChecks: row?.openChecks ?? 0,
        lastPaidAt: row?.lastPaidAt ?? null,
        avgCheck,
      };
    });
  }, [rows, scopedLocations]);

  const listAsOf = useMemo(() => {
    const paidTimes = views.map(v => v.lastPaidAt).filter(Boolean) as string[];
    if (paidTimes.length > 0) {
      return paidTimes.reduce((latest, iso) =>
        new Date(iso).getTime() > new Date(latest).getTime() ? iso : latest,
      );
    }
    return asOf;
  }, [views, asOf]);

  const primaryTz = scopedLocations.find(l => l.timeZoneId)?.timeZoneId;

  if (!companyId) {
    return (
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          {t('home.locations.selectCompany')}
        </div>
      </section>
    );
  }

  if (scopedLocations.length === 0) {
    return (
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <MapPin size={13} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight">{t('home.locations.title')}</h2>
            <p className="text-[11px] text-muted-foreground leading-snug">{t('home.locations.subtitle')}</p>
          </div>
        </div>
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          {t('home.locations.selectLocations')}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/10">
          <MapPin size={13} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">{t('home.locations.title')}</h2>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {businessDate
              ? t('home.locations.asOfLine', {
                  date: businessDate,
                  time: formatAsOf(listAsOf, primaryTz),
                })
              : t('home.locations.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-50"
          title={t('home.locations.refresh')}
          aria-label={t('home.locations.refresh')}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="px-3 py-4 text-center text-xs text-destructive">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">{t('home.locations.colLocation')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('home.locations.colSales')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('home.locations.colCovers')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('home.locations.colCheck')}</th>
                <th className="px-3 py-2 font-semibold text-right whitespace-nowrap">{t('home.locations.colUpdated')}</th>
              </tr>
            </thead>
            <tbody>
              {views.map(row => (
                <tr key={row.externalId} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 align-top">
                    <p className="text-xs font-semibold text-foreground leading-tight">{row.name}</p>
                    {row.openChecks > 0 ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t('home.locations.openChecks', { count: row.openChecks })}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-foreground">
                    {currency(row.salesCents / 100)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">{row.covers}</td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-foreground">
                    {currency(row.avgCheck)}
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      {t('home.locations.checksCount', { count: row.checks })}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatAsOf(row.lastPaidAt ?? asOf, row.timeZoneId || primaryTz)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
