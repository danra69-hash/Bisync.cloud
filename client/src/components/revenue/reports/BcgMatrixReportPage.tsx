import { useCallback, useMemo } from 'react';
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
  { key: 'currentValue', label: 'Current value', align: 'right', width: '11%' },
  { key: 'previousValue', label: 'Prior value', align: 'right', width: '11%' },
  { key: 'relativeShare', label: 'Rel. share', align: 'right', width: '9%' },
  { key: 'growthLabel', label: 'Growth', align: 'right', width: '9%' },
];

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(value: unknown): string {
  return `${(num(value) * 100).toFixed(1)}%`;
}

function BcgMatrixChart({
  rows,
  shareThreshold,
  growthThreshold,
}: {
  rows: Record<string, unknown>[];
  shareThreshold: number;
  growthThreshold: number;
}) {
  const points = useMemo(() => {
    return rows
      .map(row => ({
        name: String(row.productName ?? ''),
        quadrant: String(row.quadrant ?? 'Dog'),
        x: Math.max(0, Math.min(1.05, num(row.relativeShare))),
        y: num(row.growthRate),
        value: num(row.currentValue),
      }))
      .filter(p => p.name);
  }, [rows]);

  const yMin = Math.min(-0.2, ...points.map(p => p.y), growthThreshold);
  const yMax = Math.max(0.4, ...points.map(p => p.y), growthThreshold);
  const pad = { l: 48, r: 16, t: 20, b: 36 };
  const w = 640;
  const h = 320;
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const xScale = (x: number) => pad.l + (x / 1.05) * plotW;
  const yScale = (y: number) => pad.t + ((yMax - y) / (yMax - yMin || 1)) * plotH;
  const maxValue = Math.max(...points.map(p => p.value), 1);
  const threshX = xScale(shareThreshold);
  const threshY = yScale(growthThreshold);

  if (points.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Portfolio matrix
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Relative share vs leader (x) · month-over-month growth (y). Bubble size = current value.
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
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-3xl h-auto text-foreground">
          <rect
            x={pad.l}
            y={pad.t}
            width={plotW}
            height={plotH}
            className="fill-muted/20 stroke-border"
          />
          {/* Quadrant fills */}
          <rect x={threshX} y={pad.t} width={pad.l + plotW - threshX} height={threshY - pad.t} fill="#0f766e14" />
          <rect x={threshX} y={threshY} width={pad.l + plotW - threshX} height={pad.t + plotH - threshY} fill="#1d4ed814" />
          <rect x={pad.l} y={pad.t} width={threshX - pad.l} height={threshY - pad.t} fill="#b4530914" />
          <rect x={pad.l} y={threshY} width={threshX - pad.l} height={pad.t + plotH - threshY} fill="#64748b14" />

          <line x1={threshX} y1={pad.t} x2={threshX} y2={pad.t + plotH} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 3" />
          <line x1={pad.l} y1={threshY} x2={pad.l + plotW} y2={threshY} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 3" />

          <text x={threshX + 6} y={pad.t + 14} className="fill-teal-800" fontSize={10} fontWeight={600}>
            Stars
          </text>
          <text x={threshX + 6} y={pad.t + plotH - 8} className="fill-blue-800" fontSize={10} fontWeight={600}>
            Cash cows
          </text>
          <text x={pad.l + 6} y={pad.t + 14} className="fill-amber-800" fontSize={10} fontWeight={600}>
            Question marks
          </text>
          <text x={pad.l + 6} y={pad.t + plotH - 8} className="fill-slate-600" fontSize={10} fontWeight={600}>
            Dogs
          </text>

          {points.map(p => {
            const r = 4 + (p.value / maxValue) * 10;
            return (
              <g key={p.name}>
                <circle
                  cx={xScale(p.x)}
                  cy={yScale(p.y)}
                  r={r}
                  fill={QUADRANT_COLORS[p.quadrant] ?? QUADRANT_COLORS.Dog}
                  fillOpacity={0.85}
                  stroke="white"
                  strokeWidth={1}
                >
                  <title>{`${p.name} · ${p.quadrant}`}</title>
                </circle>
              </g>
            );
          })}

          <text x={pad.l + plotW / 2} y={h - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
            Relative share →
          </text>
          <text
            x={14}
            y={pad.t + plotH / 2}
            textAnchor="middle"
            fontSize={10}
            className="fill-muted-foreground"
            transform={`rotate(-90 14 ${pad.t + plotH / 2})`}
          >
            Growth →
          </text>
          <text x={pad.l} y={h - 18} fontSize={9} className="fill-muted-foreground">
            0
          </text>
          <text x={pad.l + plotW} y={h - 18} textAnchor="end" fontSize={9} className="fill-muted-foreground">
            1.0× leader
          </text>
          <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fontSize={9} className="fill-muted-foreground">
            {(yMax * 100).toFixed(0)}%
          </text>
          <text x={pad.l - 6} y={pad.t + plotH} textAnchor="end" fontSize={9} className="fill-muted-foreground">
            {(yMin * 100).toFixed(0)}%
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
  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      reportApi.bcgMatrix(companyId, locationIds, period),
    [],
  );
  const report = useReportData(selectedCompanyId, selectedLocationIds, loader);

  const columns: ReportColumn[] = COLUMNS.map(col => {
    if (col.key === 'currentValue' || col.key === 'previousValue') {
      return { ...col, format: value => reportMoney(value, rm) };
    }
    if (col.key === 'relativeShare') {
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

  const shareThreshold = num(report.summary.shareThreshold) || 0.5;
  const growthThreshold = num(report.summary.growthThreshold) || 0.1;
  const previousMonth = String(report.summary.previousMonth ?? '');

  return (
    <ReportPageShell
      title="BCG Matrix"
      description={`Product portfolio by relative revenue share vs the period leader and growth vs ${previousMonth || 'prior month'}. High share ≥ ${(shareThreshold * 100).toFixed(0)}% of leader · high growth ≥ ${(growthThreshold * 100).toFixed(0)}% MoM.`}
      tableId="reports.bcg-matrix"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="bcg-matrix"
      metrics={[
        { label: 'Stars', value: String(report.summary.stars ?? 0) },
        { label: 'Cash cows', value: String(report.summary.cashCows ?? 0) },
        { label: 'Question marks', value: String(report.summary.questionMarks ?? 0) },
        { label: 'Dogs', value: String(report.summary.dogs ?? 0) },
      ]}
      visual={
        !report.loading && report.rows.length > 0 ? (
          <BcgMatrixChart
            rows={report.rows}
            shareThreshold={shareThreshold}
            growthThreshold={growthThreshold}
          />
        ) : null
      }
    />
  );
}
