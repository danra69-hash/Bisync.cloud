import { ArrowDown, ArrowUp } from 'lucide-react';
import type { StockCardOnHandLayer } from '../../api';
import { formatRm } from '../../data/createOrder';

export function computeOnHandAverageCogs(layers: StockCardOnHandLayer[]): number {
  const active = layers.filter(layer => layer.quantity > 0);
  if (active.length === 0) return 0;

  const totalQty = active.reduce((sum, layer) => sum + layer.quantity, 0);
  if (totalQty <= 0) return 0;

  const totalValue = active.reduce((sum, layer) => sum + layer.quantity * layer.unitPrice, 0);
  return Math.round((totalValue / totalQty) * 100) / 100;
}

export function OnHandCogsTrendIcon({ onHand, outbound }: { onHand: number; outbound: number }) {
  if (onHand <= 0 || outbound <= 0 || onHand === outbound) return null;
  const isUp = onHand > outbound;
  return (
    <span
      className={`inline-flex items-center ml-1 ${isUp ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
      title={isUp ? 'Avg COGS is higher than avg outbound COGS' : 'Avg COGS is lower than avg outbound COGS'}
    >
      {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    </span>
  );
}

export function AvgCogsWithTrend({ onHand, outbound }: { onHand: number; outbound: number }) {
  if (onHand <= 0) return <>—</>;
  return (
    <span className="inline-flex items-center justify-end">
      {formatRm(onHand)}
      <OnHandCogsTrendIcon onHand={onHand} outbound={outbound} />
    </span>
  );
}
