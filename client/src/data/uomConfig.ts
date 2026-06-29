import { getConversion } from './componentForm';

export type ConversionRow = {
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  factor: number;
  category?: string;
};

export const METRIC_MASS_UNITS = [
  { code: 'Mg', label: 'Milligram (mg)' },
  { code: 'Gr', label: 'Gram (g)' },
  { code: 'Kg', label: 'Kilogram (kg)' },
  { code: 'Tonne', label: 'Tonne (t)' },
] as const;

export const METRIC_VOLUME_UNITS = [
  { code: 'Ml', label: 'Millilitre (ml)' },
  { code: 'Cl', label: 'Centilitre (cl)' },
  { code: 'Ltr', label: 'Litre (L)' },
] as const;

export const METRIC_IMPERIAL_PAIRS: ConversionRow[] = [
  { from: 'Gr', fromLabel: 'Gram (g)', to: 'Oz', toLabel: 'Ounce (oz)', factor: 0.035274 },
  { from: 'Oz', fromLabel: 'Ounce (oz)', to: 'Gr', toLabel: 'Gram (g)', factor: 28.3495 },
  { from: 'Kg', fromLabel: 'Kilogram (kg)', to: 'Lb', toLabel: 'Pound (lb)', factor: 2.20462 },
  { from: 'Lb', fromLabel: 'Pound (lb)', to: 'Kg', toLabel: 'Kilogram (kg)', factor: 0.453592 },
  { from: 'Tonne', fromLabel: 'Tonne (t)', to: 'Lb', toLabel: 'Pound (lb)', factor: 2204.62 },
  { from: 'Lb', fromLabel: 'Pound (lb)', to: 'Tonne', toLabel: 'Tonne (t)', factor: 0.000453592 },
  { from: 'Ml', fromLabel: 'Millilitre (ml)', to: 'FlOz', toLabel: 'Fluid Ounce (fl oz)', factor: 0.033814 },
  { from: 'FlOz', fromLabel: 'Fluid Ounce (fl oz)', to: 'Ml', toLabel: 'Millilitre (ml)', factor: 29.5735 },
  { from: 'Ltr', fromLabel: 'Litre (L)', to: 'FlOz', toLabel: 'Fluid Ounce (fl oz)', factor: 33.814 },
  { from: 'FlOz', fromLabel: 'Fluid Ounce (fl oz)', to: 'Ltr', toLabel: 'Litre (L)', factor: 0.0295735 },
  { from: 'Ltr', fromLabel: 'Litre (L)', to: 'Gal', toLabel: 'US Gallon (gal)', factor: 0.264172 },
  { from: 'Gal', fromLabel: 'US Gallon (gal)', to: 'Ltr', toLabel: 'Litre (L)', factor: 3.78541 },
];

function buildScaleChart(
  units: readonly { code: string; label: string }[],
  category: string,
): ConversionRow[] {
  const codes = units.map(u => u.code);
  const labelOf = (code: string) => units.find(u => u.code === code)?.label ?? code;
  const rows: ConversionRow[] = [];

  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const from = codes[i];
      const to = codes[j];
      const factor = getConversion(from, to);
      const reverse = getConversion(to, from);
      if (factor !== null) {
        rows.push({ from, fromLabel: labelOf(from), to, toLabel: labelOf(to), factor, category });
      }
      if (reverse !== null) {
        rows.push({ from: to, fromLabel: labelOf(to), to: from, toLabel: labelOf(from), factor: reverse, category });
      }
    }
  }

  return rows;
}

export const METRIC_MASS_CHART = buildScaleChart(METRIC_MASS_UNITS, 'Mass');
export const METRIC_VOLUME_CHART = buildScaleChart(METRIC_VOLUME_UNITS, 'Volume');
export const METRIC_FB_CHART = [...METRIC_MASS_CHART, ...METRIC_VOLUME_CHART];

export function formatFactor(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 6 }).replace(/\.?0+$/, '');
  const s = n.toPrecision(6);
  return s.includes('e') ? n.toExponential(4) : s.replace(/\.?0+$/, '');
}

export function exampleText(row: ConversionRow): string {
  const fromWord = row.fromLabel.split(' ')[0];
  const toWord = row.toLabel.split(' ')[0];
  if (row.factor >= 1) {
    return `1 ${fromWord} = ${formatFactor(row.factor)} ${toWord}`;
  }
  const inverse = 1 / row.factor;
  return `${formatFactor(inverse)} ${fromWord} = 1 ${toWord}`;
}
