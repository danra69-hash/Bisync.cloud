/**
 * Production cost attribution for B2B Principal / Sub-Product + Bi-Product outputs.
 *
 * Batch total B = baseUnitCost × totalQty.
 *
 * Equal split (every attributionPct === 100):
 *   share_j = B / nOutputs, unit_j = share_j / qty_j
 *
 * Weighted bi attribution (normal):
 *   unit_bi_i = baseUnitCost × (attributionPct_i / 100)
 *   share_bi_i = unit_bi_i × qty_i
 *   share_primary = B − Σ share_bi  (≥ 0)
 *   unit_primary = share_primary / primaryQty
 *
 * Locked example: base 10, total 20, primary 10, bi 10 @ 50%
 *   → bi unit 5, primary unit 15.
 */

export type AttributionOutputLine = {
  key: string;
  quantity: number;
  attributionPct: number;
};

export type AttributionResult = {
  batchTotalCost: number;
  primaryQty: number;
  primaryUnitCost: number;
  primaryShare: number;
  biLines: {
    key: string;
    quantity: number;
    attributionPct: number;
    unitCost: number;
    share: number;
  }[];
};

export function allocateProductionCost(input: {
  baseUnitCost: number;
  totalQty: number;
  primaryQty: number;
  biLines: AttributionOutputLine[];
}): AttributionResult {
  const baseUnitCost = Number.isFinite(input.baseUnitCost) ? Math.max(0, input.baseUnitCost) : 0;
  const totalQty = Number.isFinite(input.totalQty) ? Math.max(0, input.totalQty) : 0;
  const primaryQty = Number.isFinite(input.primaryQty) ? Math.max(0, input.primaryQty) : 0;
  const biLines = (input.biLines ?? []).filter(line => line.quantity > 0);
  const batchTotalCost = baseUnitCost * totalQty;

  if (totalQty <= 0 || batchTotalCost < 0) {
    return {
      batchTotalCost: 0,
      primaryQty,
      primaryUnitCost: 0,
      primaryShare: 0,
      biLines: biLines.map(line => ({
        key: line.key,
        quantity: line.quantity,
        attributionPct: line.attributionPct,
        unitCost: 0,
        share: 0,
      })),
    };
  }

  const allHundred = biLines.length > 0
    && biLines.every(line => Math.abs(line.attributionPct - 100) < 0.0001);

  if (allHundred) {
    const outputs = [
      { key: 'primary', quantity: primaryQty },
      ...biLines.map(line => ({ key: line.key, quantity: line.quantity })),
    ].filter(line => line.quantity > 0);
    const n = outputs.length || 1;
    const shareEach = batchTotalCost / n;
    const primaryShare = primaryQty > 0 ? shareEach : 0;
    return {
      batchTotalCost,
      primaryQty,
      primaryUnitCost: primaryQty > 0 ? primaryShare / primaryQty : 0,
      primaryShare,
      biLines: biLines.map(line => {
        const share = line.quantity > 0 ? shareEach : 0;
        return {
          key: line.key,
          quantity: line.quantity,
          attributionPct: line.attributionPct,
          unitCost: line.quantity > 0 ? share / line.quantity : 0,
          share,
        };
      }),
    };
  }

  const attributedBi = biLines.map(line => {
    const pct = Number.isFinite(line.attributionPct) ? Math.max(0, line.attributionPct) : 0;
    const unitCost = baseUnitCost * (pct / 100);
    const share = unitCost * line.quantity;
    return {
      key: line.key,
      quantity: line.quantity,
      attributionPct: pct,
      unitCost,
      share,
    };
  });
  const biShareTotal = attributedBi.reduce((sum, line) => sum + line.share, 0);
  const primaryShare = Math.max(0, batchTotalCost - biShareTotal);
  const primaryUnitCost = primaryQty > 0 ? primaryShare / primaryQty : 0;

  return {
    batchTotalCost,
    primaryQty,
    primaryUnitCost,
    primaryShare,
    biLines: attributedBi,
  };
}
