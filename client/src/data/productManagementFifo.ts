export type ProductBatchFifoInput = {
  batchLogId: number | null;
  batchQty: number | null;
  productionDate: string | null;
};

export type FifoBatchAllocation = {
  batchLogId: number;
  remainingQty: number;
};

export function compareProductBatchesOldestFirst(
  a: ProductBatchFifoInput,
  b: ProductBatchFifoInput,
): number {
  const dateA = a.productionDate?.trim() || '';
  const dateB = b.productionDate?.trim() || '';
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return (a.batchLogId ?? 0) - (b.batchLogId ?? 0);
}

/** Allocate on-hand quantity across produced batches using FIFO depletion. */
export function allocateFifoRemainingBatches(
  batches: ProductBatchFifoInput[],
  onHandQty: number,
): FifoBatchAllocation[] {
  const onHand = Math.max(0, onHandQty);
  const sorted = [...batches].sort(compareProductBatchesOldestFirst);
  const totalProduced = sorted.reduce(
    (sum, batch) => sum + Math.max(0, batch.batchQty ?? 0),
    0,
  );
  let depleted = Math.max(0, totalProduced - onHand);
  const allocations: FifoBatchAllocation[] = [];

  for (const batch of sorted) {
    const qty = Math.max(0, batch.batchQty ?? 0);
    if (qty <= 0 || batch.batchLogId == null) continue;

    if (depleted >= qty) {
      depleted -= qty;
      continue;
    }

    const remaining = qty - depleted;
    depleted = 0;
    if (remaining > 0) {
      allocations.push({ batchLogId: batch.batchLogId, remainingQty: remaining });
    }
  }

  return allocations;
}
