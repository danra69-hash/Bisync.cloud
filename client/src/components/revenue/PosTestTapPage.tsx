import { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type TableStatus = {
  name: string;
  count: number;
  purpose: string;
};

type StatusResponse = {
  ready: boolean;
  message?: string;
  companyId?: number | null;
  locationExternalId?: string;
  openBlocksEod?: boolean;
  tables?: TableStatus[];
};

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

export function PosTestTapPage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { t } = useAppTranslation();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const locationExternalId = selectedLocationIds[0] ?? '';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedCompanyId) {
        setStatus({
          ready: false,
          message: t('pos.testTap.selectCompany'),
          tables: [],
        });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          companyId: String(selectedCompanyId),
        });
        if (locationExternalId) qs.set('locationExternalId', locationExternalId);
        const data = await apiFetch<StatusResponse>(`/api/pos/test-tap/status?${qs}`);
        if (!cancelled) setStatus(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, locationExternalId, t]);

  return (
    <div className="p-3 sm:p-4 w-full min-w-0 space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight">{t('pos.testTap.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          {t('pos.testTap.subtitle')}
        </p>
      </header>

      {loading && (
        <p className="text-sm text-muted-foreground">{t('pos.testTap.loading')}</p>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {status && !status.ready && (
        <p className="text-sm text-muted-foreground">{status.message}</p>
      )}

      {status?.ready && (
        <>
          {status.openBlocksEod ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {t('pos.testTap.openBillsBanner')}
            </div>
          ) : (
            <div className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">
              {t('pos.testTap.noOpenBills')}
            </div>
          )}

          <section className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/40">
              <h3 className="text-sm font-semibold">{t('pos.testTap.tablesHeading')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="px-3 py-2 font-medium">{t('pos.testTap.colTable')}</th>
                    <th className="px-3 py-2 font-medium">{t('pos.testTap.colPurpose')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('pos.testTap.colRows')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(status.tables ?? []).map(row => (
                    <tr key={row.name} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.purpose}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground max-w-3xl">
            {t('pos.testTap.wireHint')}
          </p>
        </>
      )}
    </div>
  );
}
