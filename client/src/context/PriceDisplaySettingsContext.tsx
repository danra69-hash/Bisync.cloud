import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type PlatformPriceDisplaySettings } from '../api';
import { setPriceDisplayDecimals } from '../utils/numberFormat';

type PriceDisplaySettingsContextValue = {
  settings: PlatformPriceDisplaySettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (next: {
    principalUomPriceDecimals: number;
    alternateUomPriceDecimals: number;
    vendorDeliveryPriceDecimals: number;
  }) => Promise<PlatformPriceDisplaySettings>;
};

const PriceDisplaySettingsContext = createContext<PriceDisplaySettingsContextValue | null>(null);

const FALLBACK: PlatformPriceDisplaySettings = {
  principalUomPriceDecimals: 4,
  alternateUomPriceDecimals: 2,
  vendorDeliveryPriceDecimals: 2,
  updatedAt: null,
  updatedByEmail: '',
  canEdit: false,
  defaults: {
    principalUomPriceDecimals: 4,
    alternateUomPriceDecimals: 2,
    vendorDeliveryPriceDecimals: 2,
  },
};

export function PriceDisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformPriceDisplaySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((next: PlatformPriceDisplaySettings) => {
    setSettings(next);
    setPriceDisplayDecimals(next);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.platformPriceDisplay();
      apply(next);
    } catch {
      apply(FALLBACK);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const save = useCallback(async (next: {
    principalUomPriceDecimals: number;
    alternateUomPriceDecimals: number;
    vendorDeliveryPriceDecimals: number;
  }) => {
    const saved = await api.updatePlatformPriceDisplay(next);
    apply(saved);
    return saved;
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ settings, loading, refresh, save }),
    [settings, loading, refresh, save],
  );

  return (
    <PriceDisplaySettingsContext.Provider value={value}>
      {children}
    </PriceDisplaySettingsContext.Provider>
  );
}

export function usePriceDisplaySettings(): PriceDisplaySettingsContextValue {
  const ctx = useContext(PriceDisplaySettingsContext);
  if (!ctx) {
    return {
      settings: FALLBACK,
      loading: false,
      refresh: async () => {},
      save: async () => FALLBACK,
    };
  }
  return ctx;
}
