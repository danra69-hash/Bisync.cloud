import { useCallback, useMemo, useState } from 'react';
import { filterSelectCls } from '../../layout/formControls';
import { useCountryFormatters } from '../../../hooks/useCountryFormatters';
import { ReportPageShell, type ReportColumn } from './ReportPageShell';
import { reportApi, reportMoney, useReportData } from './useReportData';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const QUADRANT_COLORS: Record<string, string> = {
  Star: '#0f766e',
  'Cash Cow': '#1d4ed8',
  'Question Mark': '#b45309',
  Dog: '#64748b',
};

const COLUMNS: ReportColumn[] = [
  { key: 'productName', label: 'Product', width: '18%' },
  { key: 'quadrant', label: 'Quadrant', width: '12%' },
  { key: 'category', label: 'Category', width: '12%' },
  { key: 'group', label: 'Group', width: '10%' },
  { key: 'qtySold', label: 'Qty sold', align: 'right', width: '8%' },
  { key: 'sales', label: 'Sales', align: 'right', width: '12%' },
  { key: 'marginAmount', label: 'Margin $', align: 'right', width: '12%' },
  { key: 'marginPercent', label: 'Margin %', align: 'right', width: '10%' },
];

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(value: unknown): string {
  return `${(num(value) * 100).toFixed(1)}%`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function classifyQuadrant(marginPercent: number, sales: number, marginThreshold: number, salesThreshold: number): string {
  const highMargin = marginPercent >= marginThreshold;
  const highSales = sales >= salesThreshold;
  if (highSales && highMargin) return 'Star';
  if (highSales && !highMargin) return 'Cash Cow';
  if (!highSales && highMargin) return 'Question Mark';
  return 'Dog';
}

function BcgMatrixChart({
  rows,
  marginThreshold,
  salesThreshold,
  formatMoney,
}: {
  rows: Record<string, unknown>[];
  marginThreshold: number;
  salesThreshold: number;
  formatMoney: (n: number) => string;
}) {
  const points = useMemo(() => {
    return rows
      .map(row => ({
        name: String(row.productName ?? ''),
        quadrant: String(row.quadrant ?? 'Dog'),
        x: num(row.marginPercent),
        y: Math.max(0, num(row.sales)),
        value: Math.max(0, num(row.sales)),
      }))
      .filter(p => p.name);
  }, [rows]);

  if (points.length === 0) return null;

  const xMin = Math.min(0, ...points.map(p => p.x), marginThreshold);
  const xMax = Math.max(0.2, ...points.map(p => p.x), marginThreshold);
  const yMax = Math.max(...points.map(p => p.y), salesThreshold, 1);
  const yMin = 0;
  const pad = { l: 56, r: 20, t: 28, b: 44 };
  const w = 720;
  const h = 420;
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const xScale = (x: number) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const yScale = (y: number) => pad.t + ((yMax - y) / (yMax - yMin || 1)) * plotH;
  const maxValue = Math.max(...points.map(p => p.value), 1);
  const threshX = xScale(marginThreshold);
  const threshY = yScale(salesThreshold);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">BCG Matrix</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            X = Margin % · Y = Sales · bubble size = sales · axes cross at portfolio medians
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          {Object.entries(QUADRANT_COLORS).map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-4xl h-auto text-foreground" role="img" aria-label="BCG matrix chart of margin versus sales">
          <rect
            x={pad.l}
            y={pad.t}
            width={plotW}
            height={plotH}
            className="fill-muted/20 stroke-border"
          />
          <rect x={threshX} y={pad.t} width={Math.max(0, pad.l + plotW - threshX)} height={Math.max(0, threshY - pad.t)} fill="#0f766e18" />
          <rect x={pad.l} y={pad.t} width={Math.max(0, threshX - pad.l)} height={Math.max(0, threshY - pad.t)} fill="#1d4ed818" />
          <rect x={threshX} y={threshY} width={Math.max(0, pad.l + plotW - threshX)} height={Math.max(0, pad.t + plotH - threshY)} fill="#b4530918" />
          <rect x={pad.l} y={threshY} width={Math.max(0, threshX - pad.l)} height={Math.max(0, pad.t + plotH - threshY)} fill="#64748b18" />

          <line x1={threshX} y1={pad.t} x2={threshX} y2={pad.t + plotH} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" />
          <line x1={pad.l} y1={threshY} x2={pad.l + plotW} y2={threshY} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 3" />

          <text x={threshX + 8} y={pad.t + 16} className="fill-teal-800" fontSize={11} fontWeight={700}>
            Stars
          </text>
          <text x={pad.l + 8} y={pad.t + 16} className="fill-blue-800" fontSize={11} fontWeight={700}>
            Cash cows
          </text>
          <text x={threshX + 8} y={pad.t + plotH - 10} className="fill-amber-800" fontSize={11} fontWeight={700}>
            Question marks
          </text>
          <text x={pad.l + 8} y={pad.t + plotH - 10} className="fill-slate-600" fontSize={11} fontWeight={700}>
            Dogs
          </text>

          {points.map(p => {
            const r = 5 + (p.value / maxValue) * 14;
            return (
              <circle
                key={p.name}
                cx={xScale(Math.min(xMax, Math.max(xMin, p.x)))}
                cy={yScale(Math.min(yMax, Math.max(yMin, p.y)))}
                r={r}
                fill={QUADRANT_COLORS[p.quadrant] ?? QUADRANT_COLORS.Dog}
                fillOpacity={0.88}
                stroke="white"
                strokeWidth={1.25}
              >
                <title>{`${p.name} · ${p.quadrant} · Margin ${(p.x * 100).toFixed(1)}% · Sales ${formatMoney(p.y)}`}</title>
              </circle>
            );
          })}

          <text x={pad.l + plotW / 2} y={h - 8} textAnchor="middle" fontSize={11} className="fill-muted-foreground" fontWeight={600}>
            Margin % →
          </text>
          <text
            x={14}
            y={pad.t + plotH / 2}
            textAnchor="middle"
            fontSize={11}
            className="fill-muted-foreground"
            fontWeight={600}
            transform={`rotate(-90 14 ${pad.t + plotH / 2})`}
          >
            Sales →
          </text>
          <text x={pad.l} y={h - 22} fontSize={9} className="fill-muted-foreground">
            {(xMin * 100).toFixed(0)}%
          </text>
          <text x={pad.l + plotW} y={h - 22} textAnchor="end" fontSize={9} className="fill-muted-foreground">
            {(xMax * 100).toFixed(0)}%
          </text>
          <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fontSize={9} className="fill-muted-foreground">
            {formatMoney(yMax)}
          </text>
          <text x={pad.l - 6} y={pad.t + plotH} textAnchor="end" fontSize={9} className="fill-muted-foreground">
            {formatMoney(0)}
          </text>
        </svg>
      </div>
    </div>
  );
}

export function BcgMatrixReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters();
  const [category, setCategory] = useState('all');
  const [group, setGroup] = useState('all');
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.bcgMatrix(companyId, locationIds, period),
    [],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const categoryOptions = useMemo(() => {
    const fromSummary = Array.isArray(report.summary.categories)
      ? (report.summary.categories as string[])
      : [];
    if (fromSummary.length > 0) return fromSummary;
    return [...new Set(report.rows.map(r => String(r.category ?? '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [report.summary.categories, report.rows]);

  const groupOptions = useMemo(() => {
    const fromSummary = Array.isArray(report.summary.groups)
      ? (report.summary.groups as string[])
      : [];
    if (fromSummary.length > 0) return fromSummary;
    return [...new Set(report.rows.map(r => String(r.group ?? '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [report.summary.groups, report.rows]);

  const filteredBase = useMemo(() => {
    return report.rows.filter(row => {
      const rowCategory = String(row.category ?? '');
      const rowGroup = String(row.group ?? '');
      if (category !== 'all' && rowCategory.toLowerCase() !== category.toLowerCase()) return false;
      if (group !== 'all' && rowGroup.toLowerCase() !== group.toLowerCase()) return false;
      return true;
    });
  }, [report.rows, category, group]);

  const classifiedRows = useMemo(() => {
    const marginThreshold = median(filteredBase.map(r => num(r.marginPercent)));
    const salesThreshold = median(filteredBase.map(r => num(r.sales)));
    return {
      marginThreshold,
      salesThreshold,
      rows: filteredBase.map(row => {
        const marginPercent = num(row.marginPercent);
        const sales = num(row.sales);
        return {
          ...row,
          quadrant: classifyQuadrant(marginPercent, sales, marginThreshold, salesThreshold),
          x: marginPercent,
          y: sales,
        };
      }),
    };
  }, [filteredBase]);

  const quadrantCounts = useMemo(() => {
    const counts = { Star: 0, 'Cash Cow': 0, 'Question Mark': 0, Dog: 0 };
    for (const row of classifiedRows.rows) {
      const q = String(row.quadrant ?? 'Dog') as keyof typeof counts;
      if (q in counts) counts[q] += 1;
    }
    return counts;
  }, [classifiedRows.rows]);

  const columns: ReportColumn[] = COLUMNS.map(col => {
    if (col.key === 'sales' || col.key === 'marginAmount') {
      return { ...col, format: value => reportMoney(value, rm) };
    }
    if (col.key === 'marginPercent') {
      return { ...col, format: value => pct(value) };
    }
    if (col.key === 'quadrant') {
      return {
        ...col,
        format: value => {
          const label = String(value ?? '');
          const color = QUADRANT_COLORS[label] ?? QUADRANT_COLORS.Dog;
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
              {label || '—'}
            </span>
          );
        },
      };
    }
    return col;
  });

  return (
    <ReportPageShell
      title="BCG Matrix"
      description="Chart products by Margin % (X) and Sales (Y). Quadrants split at the median of the filtered portfolio."
      tableId="reports.bcg-matrix"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={classifiedRows.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="bcg-matrix"
      visualFirst
      extraFilters={
        <>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Category
            <select
              className={filterSelectCls}
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={!selectedCompanyId || selectedLocationIds.length === 0}
            >
              <option value="all">All categories</option>
              {categoryOptions.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Group
            <select
              className={filterSelectCls}
              value={group}
              onChange={e => setGroup(e.target.value)}
              disabled={!selectedCompanyId || selectedLocationIds.length === 0}
            >
              <option value="all">All groups</option>
              {groupOptions.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </>
      }
      metrics={[
        { label: 'Stars', value: String(quadrantCounts.Star) },
        { label: 'Cash cows', value: String(quadrantCounts['Cash Cow']) },
        { label: 'Question marks', value: String(quadrantCounts['Question Mark']) },
        { label: 'Dogs', value: String(quadrantCounts.Dog) },
      ]}
      visual={
        !report.loading && classifiedRows.rows.length > 0 ? (
          <BcgMatrixChart
            rows={classifiedRows.rows}
            marginThreshold={classifiedRows.marginThreshold}
            salesThreshold={classifiedRows.salesThreshold}
            formatMoney={rm}
          />
        ) : null
      }
    />
  );
}
