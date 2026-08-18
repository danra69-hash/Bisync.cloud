import type { AltUnitEntry } from '../../data/componentForm';

function formatAltLine(au: AltUnitEntry, targetUom: string): string {
  const from = au.fromQty?.trim() || '1';
  const qty = au.qty?.trim();
  return `${from} ${au.unit} = ${qty || '—'} ${targetUom}`;
}

type Props = {
  recipeUnit: string;
  altRecipeUnits: AltUnitEntry[];
  /** @deprecated Ignored — inventory UOM was folded into alternate component UOMs. */
  inventoryUnit?: string;
  /** @deprecated Ignored — inventory UOM was folded into alternate component UOMs. */
  altInventoryUnits?: AltUnitEntry[];
  convertFromInventoryQty?: string;
  convertToRecipeQty?: string;
};

export function ComponentUomSummary({
  recipeUnit,
  altRecipeUnits,
}: Props) {
  if (altRecipeUnits.length === 0) return null;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 px-3 py-3">
      <div>
        <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-1">
          Alternate Component UOM{altRecipeUnits.length > 1 ? 's' : ''}
        </p>
        <ul className="space-y-1">
          {altRecipeUnits.map((au, i) => (
            <li key={i} className="text-xs font-sans text-foreground">
              {formatAltLine(au, recipeUnit)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
