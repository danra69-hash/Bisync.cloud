import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type RevMgmtTitleContextValue = {
  pageLabelOverride: string | null;
  setPageLabel: (label: string | null) => void;
};

const RevMgmtTitleContext = createContext<RevMgmtTitleContextValue | null>(null);

type ProviderProps = {
  revItem: string | null;
  children: ReactNode;
};

export function RevMgmtTitleProvider({ revItem, children }: ProviderProps) {
  const [pageLabelOverride, setPageLabelOverride] = useState<string | null>(null);
  const setPageLabel = useCallback((label: string | null) => setPageLabelOverride(label), []);

  useEffect(() => {
    setPageLabelOverride(null);
  }, [revItem]);

  const value = useMemo(
    () => ({ pageLabelOverride, setPageLabel }),
    [pageLabelOverride, setPageLabel],
  );

  return <RevMgmtTitleContext.Provider value={value}>{children}</RevMgmtTitleContext.Provider>;
}

export function useRevMgmtTitleContext() {
  return useContext(RevMgmtTitleContext);
}

/** Override the page label shown in the shared header (e.g. for in-page sub-tabs). */
export function useRevMgmtPageLabel(label: string) {
  const ctx = useRevMgmtTitleContext();

  useEffect(() => {
    if (!ctx) return;
    ctx.setPageLabel(label);
    return () => ctx.setPageLabel(null);
  }, [label, ctx?.setPageLabel]);
}
