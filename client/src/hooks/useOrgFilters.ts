import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Company, type Location, type LocationConfig } from '../api';

const MAX_RETRIES = 12;
const RETRY_MS = 2000;

export function useOrgFilters() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [configLocations, setConfigLocations] = useState<LocationConfig[]>([]);
  const [metricsLocations, setMetricsLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshOrgFilters = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setLoading(true);

    const [companyResult, configResult, metricsResult] = await Promise.allSettled([
      api.companies(),
      api.locationsConfig(),
      api.locations(),
    ]);

    const failures: string[] = [];

    if (companyResult.status === 'fulfilled') {
      setCompanies(companyResult.value);
    } else {
      failures.push('companies');
    }

    if (configResult.status === 'fulfilled') {
      setConfigLocations(configResult.value);
    } else {
      failures.push('locations');
    }

    if (metricsResult.status === 'fulfilled') {
      setMetricsLocations(metricsResult.value);
    }

    if (failures.length > 0) {
      setError(`Could not load ${failures.join(' and ')} from HR Config. Is the API running on port 5299?`);

      if (retryRef.current < MAX_RETRIES) {
        retryRef.current += 1;
        timerRef.current = setTimeout(() => {
          void refreshOrgFilters();
        }, RETRY_MS);
      }
    } else {
      retryRef.current = 0;
      setError(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshOrgFilters();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refreshOrgFilters]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && (companies.length === 0 || configLocations.length === 0)) {
        retryRef.current = 0;
        void refreshOrgFilters();
      }
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshOrgFilters, companies.length, configLocations.length]);

  return {
    companies,
    configLocations,
    metricsLocations,
    loading,
    error,
    refreshOrgFilters,
  };
}
