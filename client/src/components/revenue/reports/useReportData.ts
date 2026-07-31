import { useCallback, useEffect, useState } from 'react';
import { api, type ReportPayload } from '../../../api';
import { currentStockCardMonth } from '../stockCardPeriod';

type Loader = (
  companyId: number,
  locationIds: string[],
  period: string,
) => Promise<ReportPayload>;

export function useReportData(
  selectedCompanyId: number | null,
  selectedLocationIds: string[],
  loader: Loader,
) {
  const [period, setPeriod] = useState(currentStockCardMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReportPayload | null>(null);

  const refresh = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await loader(selectedCompanyId, selectedLocationIds, period);
      setPayload(next);
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : 'Could not load report.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, period, loader]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    period,
    setPeriod,
    loading,
    error,
    payload,
    refresh,
    rows: (payload?.rows ?? []) as Record<string, unknown>[],
    summary: payload?.summary ?? {},
    extra: payload?.extra ?? {},
  };
}

export function reportMoney(value: unknown, format: (n: number) => string): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return format(n);
}

export const reportApi = {
  itemizedSales: (companyId: number, locationIds: string[], month: string) =>
    api.reportItemizedSalesSummary(companyId, locationIds, month),
  inventory: (companyId: number, locationIds: string[], period: string, itemType?: string) =>
    api.reportInventorySummary(companyId, locationIds, period, itemType),
  purchase: (companyId: number, locationIds: string[], month: string) =>
    api.reportDetailedPurchaseSummary(companyId, locationIds, month),
  production: (companyId: number, locationIds: string[], month: string) =>
    api.reportProduction(companyId, locationIds, month),
  wastage: (companyId: number, locationIds: string[], month: string) =>
    api.reportWastage(companyId, locationIds, month),
};
