import type { Product } from '../api';

/** Display label for Recipe Card / product type summary. */
export function formatProductTypeLabel(product: {
  isSubProduct?: boolean;
  isVariableProduct?: boolean;
  isVariableComponent?: boolean;
  b2cEnabled?: boolean;
  b2bEnabled?: boolean;
}): string {
  const parts: string[] = [];
  if (product.isSubProduct) parts.push('Sub-Product');
  else if (product.isVariableProduct) parts.push('Variable Product');
  else if (product.isVariableComponent) parts.push('Variable Component');
  else parts.push('Product');

  if (product.b2cEnabled) parts.push('B2C');
  if (product.b2bEnabled) parts.push('B2B Principal');
  return parts.join(' · ');
}

// Keep Product import for documentation / future typing without forcing required flags.
export type ProductTypeSource = Pick<
  Product,
  'isSubProduct' | 'b2cEnabled' | 'b2bEnabled'
> & {
  isVariableProduct?: boolean;
  isVariableComponent?: boolean;
};
