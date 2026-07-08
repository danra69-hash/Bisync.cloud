import { useMemo } from 'react';
import type { Product } from '../../api';
import { formatSubProductBatchPackageUnit } from '../../data/productForm';
import { selectCls } from '../../data/componentForm';

type Props = {
  products: Product[];
  value: string;
  disabled?: boolean;
  onChange: (product: Product | null) => void;
};

export function SubProductPicker({ products, value, disabled = false, onChange }: Props) {
  const options = useMemo(
    () => products
      .filter(product => product.isSubProduct && product.active)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => {
        const next = options.find(product => product.productId === e.target.value) ?? null;
        onChange(next);
      }}
      className={selectCls}
    >
      <option value="">Select sub-product…</option>
      {options.map(product => (
        <option key={product.id} value={product.productId}>
          {product.productId} · {product.name} · {formatSubProductBatchPackageUnit(product)}
        </option>
      ))}
    </select>
  );
}
