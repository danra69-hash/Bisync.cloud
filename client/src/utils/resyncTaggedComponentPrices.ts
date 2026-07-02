import { api } from '../api';
import { resolveDetailConfigForRow } from '../data/componentForm';
import { componentRowToIngredientPayload } from '../data/vendorProductTagging';
import { ingredientToRow } from '../components/revenue/smartIngredientShared';

/** Backfill component recipe prices from tagged vendor products, then recalc product COGS on the API. */
export async function resyncStaleTaggedComponentPrices(): Promise<number> {
  const data = await api.ingredients();
  const rows = data.map(ingredientToRow);
  const stale = rows.filter(row => {
    if (!row.id) return false;
    const detail = resolveDetailConfigForRow(row);
    return detail.taggedVendorProductIds.length > 0 && row.lastPriceRecipe <= 0;
  });

  let synced = 0;
  for (const row of stale) {
    const payload = componentRowToIngredientPayload(row);
    if (payload.lastPriceRecipe <= 0) continue;
    await api.updateIngredient(row.id!, payload);
    synced += 1;
  }

  return synced;
}
