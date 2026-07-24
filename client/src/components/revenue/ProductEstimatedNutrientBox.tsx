import { useEffect, useMemo, useState } from 'react';
import type { ProductComponentItem } from '../../api';
import {
  estimateProductNutrientsFromFndds,
  formatNutritionValue,
  loadFnddsNutrientCatalog,
  type EstimatedNutrientResult,
} from '../../data/fnddsNutrientCatalog';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  components: ProductComponentItem[];
  yieldQuantity?: number;
  productName?: string;
};

export function ProductEstimatedNutrientBox({
  components,
  yieldQuantity = 1,
  productName,
}: Props) {
  const countryCode = useOrgCountryCode();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<EstimatedNutrientResult | null>(null);

  const componentsKey = useMemo(
    () => components.map(c => `${c.componentId}|${c.componentName}|${c.componentUom}|${c.quantity}`).join(';'),
    [components],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadFnddsNutrientCatalog()
      .then(catalog => {
        if (cancelled) return;
        setResult(estimateProductNutrientsFromFndds(components, { yieldQuantity, catalog }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // componentsKey captures recipe line identity; yieldQuantity scales the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentsKey, yieldQuantity]);

  const coverageLabel = useMemo(() => {
    if (!result) return '';
    if (result.totalCount === 0) return 'No recipe components to estimate.';
    return `${result.matchedCount} of ${result.totalCount} components matched to USDA FNDDS`;
  }, [result]);

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <h3 className="text-sm font-semibold">Estimated Nutrient Value</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Calculated from recipe smart components using USDA FNDDS 2021–2023
          {productName ? ` for ${productName}` : ''}.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <MillstoneLoader size="sm" />
        </div>
      ) : !result || result.totalCount === 0 ? (
        <p className="text-xs text-muted-foreground px-4 py-8 text-center">
          Add recipe components to estimate nutrient values.
        </p>
      ) : (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.rows.map(row => (
              <div
                key={row.factor}
                className="rounded-md border border-border/70 bg-muted/10 px-3 py-2"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  {row.factor}
                </p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                  {formatNutritionValue(row.perRecipe, row.unit, countryCode)}
                  <span className="text-[11px] font-medium text-muted-foreground ml-1">{row.unit}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1 border-t border-border/60 pt-3">
            <p>{coverageLabel}</p>
            <p>
              Values are per {yieldQuantity > 1 ? `yield unit (÷${yieldQuantity})` : 'full recipe batch'}.
              Unmatched or non-gram components use a kitchen heuristic fallback.
            </p>
            <p className="text-[10px] leading-relaxed">
              Source: {result.sourceLabel}. {result.basisLabel}.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
