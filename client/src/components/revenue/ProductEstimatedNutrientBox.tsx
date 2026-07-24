import { useEffect, useState } from 'react';
import { api, type ProductNutrientEstimate } from '../../api';
import { formatNutritionValue } from '../../data/productProductionMethod';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  productId: number;
  yieldQuantity?: number;
  productName?: string;
};

export function ProductEstimatedNutrientBox({
  productId,
  yieldQuantity = 1,
  productName,
}: Props) {
  const countryCode = useOrgCountryCode();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ProductNutrientEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId || productId <= 0) {
      setResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    api.productNutrients(productId)
      .then(data => {
        if (cancelled) return;
        setResult(data);
      })
      .catch(err => {
        if (cancelled) return;
        setResult(null);
        setError(err instanceof Error ? err.message : 'Failed to load nutrient estimate.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  const coverageLabel = (() => {
    if (!result) return '';
    if (result.totalCount === 0) return 'No recipe components to estimate.';
    return `${result.matchedCount} of ${result.totalCount} components matched to USDA FoodData Central`;
  })();

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <h3 className="text-sm font-semibold">Estimated Nutrient Value</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Calculated from recipe smart components using USDA Foundation Foods + SR Legacy
          {productName ? ` for ${productName}` : ''}.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <MillstoneLoader size="sm" />
        </div>
      ) : error ? (
        <p className="text-xs text-muted-foreground px-4 py-8 text-center">{error}</p>
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
              Unmatched or non-gram components are omitted from the total.
            </p>
            <p className="text-[10px] leading-relaxed">
              Source: {result.sourceLabel}. {result.basisLabel}.
              {result.libraryVersion ? ` Library ${result.libraryVersion}.` : ''}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
