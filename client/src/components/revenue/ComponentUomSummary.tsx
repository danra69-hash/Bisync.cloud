import type { AltUnitEntry } from '../../data/componentForm';

function formatAltLine(au: AltUnitEntry, targetUom: string): string {
  const from = au.fromQty?.trim() || '1';
  const qty = au.qty?.trim();
  return `${from} ${au.unit} = ${qty || '—'} ${targetUom}`;
}

type Props = {
  recipeUnit: string;
  inventoryUnit: string;
  altRecipeUnits: AltUnitEntry[];
  altInventoryUnits: AltUnitEntry[];
  convertFromInventoryQty?: string;
  convertToRecipeQty?: string;
};

export function ComponentUomSummary({
  recipeUnit,
  inventoryUnit,
  altRecipeUnits,
  altInventoryUnits,
  convertFromInventoryQty,
  convertToRecipeQty,
}: Props) {
  const hasAltRecipe = altRecipeUnits.length > 0;
  const hasAltInventory = altInventoryUnits.length > 0;
  const showInventoryConversion = inventoryUnit !== recipeUnit;

  if (!hasAltRecipe && !hasAltInventory && !showInventoryConversion) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 px-3 py-3">
      {hasAltRecipe && (
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
      )}

      {showInventoryConversion && (
        <div>
          <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-1">
            Principal Conversion Reference
          </p>
          <p className="text-xs font-sans text-foreground">
            {convertFromInventoryQty?.trim() || '1'} {inventoryUnit} = {convertToRecipeQty?.trim() || '—'} {recipeUnit}
          </p>
        </div>
      )}


      {hasAltInventory && (
        <div>
          <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-1">
            Alternate Inventory UOM{altInventoryUnits.length > 1 ? 's' : ''}
          </p>
          <ul className="space-y-1">
            {altInventoryUnits.map((au, i) => (
              <li key={i} className="text-xs font-sans text-foreground">
                {formatAltLine(au, inventoryUnit)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
