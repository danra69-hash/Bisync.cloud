import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Plus, X } from 'lucide-react'
import { filterSelectCls } from '../../layout/formControls'
import { useCountryFormatters } from '../../../hooks/useCountryFormatters'
import { currentStockCardMonth, formatStockCardMonthLabel } from '../stockCardPeriod'
import { ReportPageShell, type ReportColumn } from './ReportPageShell'
import { reportMoney, useReportData } from './useReportData'
import { api } from '../../../api'

type Props = {
  selectedCompanyId: number | null
  selectedLocationIds: string[]
}

type PeriodMode = 'week' | 'month'

type FilterChip = { kind: 'category' | 'group'; value: string }

function isoWeekKey(date = new Date()): string {
  // ISO week: Thursday-based year, Monday start.
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function lastNWeekOptions(count = 26): string[] {
  const options: string[] = []
  const cursor = new Date()
  for (let i = 0; i < count; i++) {
    options.push(isoWeekKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }
  return [...new Set(options)]
}

function lastNMonthOptions(count = 24): string[] {
  const now = new Date()
  const options: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return options
}

function formatWeekLabel(weekKey: string): string {
  const match = /^(\d{4})-W(\d{1,2})$/i.exec(weekKey.trim())
  if (!match) return weekKey
  const year = Number(match[1])
  const week = Number(match[2])
  // Approximate Monday of ISO week.
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const day = simple.getUTCDay()
  const monday = new Date(simple)
  const diff = day <= 4 ? 1 - day : 8 - day
  monday.setUTCDate(simple.getUTCDate() + diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `W${String(week).padStart(2, '0')} ${year} (${fmt(monday)} – ${fmt(sunday)})`
}

function TrendCell({ trend }: { trend: unknown }) {
  const value = String(trend ?? 'flat')
  if (value === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Up vs previous period">
        <ArrowUp size={14} />
        Up
      </span>
    )
  }
  if (value === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400" title="Down vs previous period">
        <ArrowDown size={14} />
        Down
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" title="Flat vs previous period">
      <Minus size={14} />
      Flat
    </span>
  )
}

const COLUMNS: ReportColumn[] = [
  { key: 'category', label: 'Category', width: '9%' },
  { key: 'group', label: 'Group', width: '9%' },
  { key: 'component', label: 'Component', width: '12%' },
  { key: 'openingStockQty', label: 'Opening Stock QTY', align: 'right', width: '7%' },
  { key: 'outboundSalesQty', label: 'Outbound Total (sales)', align: 'right', width: '8%' },
  { key: 'closingStockQty', label: 'Closing Stock', align: 'right', width: '7%' },
  { key: 'totalConsumptionQty', label: 'Total consumption QTY', align: 'right', width: '8%' },
  { key: 'totalCovers', label: 'Total Covers', align: 'right', width: '6%' },
  { key: 'qtyPerCover', label: 'QTY / Cover', align: 'right', width: '6%' },
  { key: 'valuePerCover', label: 'Value / Cover', align: 'right', width: '7%' },
  { key: 'totalChecks', label: 'Total Checks', align: 'right', width: '6%' },
  { key: 'qtyPerCheck', label: 'QTY / Check', align: 'right', width: '6%' },
  { key: 'valuePerCheck', label: 'Value / Check', align: 'right', width: '7%' },
  { key: 'trend', label: 'Trend', width: '6%' },
]

export function OpsExpensesAnalysisReportPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { rm } = useCountryFormatters()
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [draftCategory, setDraftCategory] = useState('Ops Expenses')
  const [draftGroup, setDraftGroup] = useState('')
  const [chips, setChips] = useState<FilterChip[]>([
    { kind: 'category', value: 'Ops Expenses' },
  ])

  const weekOptions = useMemo(() => lastNWeekOptions(26), [])
  const monthOptions = useMemo(() => lastNMonthOptions(24), [])

  const categoriesCsv = useMemo(
    () => chips.filter(c => c.kind === 'category').map(c => c.value).join(','),
    [chips],
  )
  const groupsCsv = useMemo(
    () => chips.filter(c => c.kind === 'group').map(c => c.value).join(','),
    [chips],
  )

  const loader = useCallback(
    (companyId: number, locationIds: string[], period: string) =>
      api.reportOpsExpensesAnalysis(companyId, locationIds, period, {
        categories: categoriesCsv || undefined,
        groups: groupsCsv || undefined,
      }),
    [categoriesCsv, groupsCsv],
  )

  const report = useReportData(selectedCompanyId, selectedLocationIds, loader)

  // When switching mode, snap period to a valid key for that mode.
  function setMode(mode: PeriodMode) {
    setPeriodMode(mode)
    if (mode === 'week') {
      const current = isoWeekKey()
      report.setPeriod(weekOptions.includes(report.period) ? report.period : current)
    } else {
      const current = currentStockCardMonth()
      report.setPeriod(monthOptions.includes(report.period) ? report.period : current)
    }
  }

  const filterOptions = (report.summary.filterOptions ?? {}) as {
    categories?: string[]
    groups?: string[]
  }
  const categoryOptions = useMemo(() => {
    const fromApi = filterOptions.categories ?? []
    const set = new Set(['Ops Expenses', ...fromApi, ...chips.filter(c => c.kind === 'category').map(c => c.value)])
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [filterOptions.categories, chips])
  const groupOptions = useMemo(() => {
    const fromApi = filterOptions.groups ?? []
    const set = new Set([...fromApi, ...chips.filter(c => c.kind === 'group').map(c => c.value)])
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [filterOptions.groups, chips])

  function addChip() {
    const next: FilterChip[] = []
    if (draftCategory.trim()) {
      next.push({ kind: 'category', value: draftCategory.trim() })
    }
    if (draftGroup.trim()) {
      next.push({ kind: 'group', value: draftGroup.trim() })
    }
    if (next.length === 0) return
    setChips(prev => {
      const merged = [...prev]
      for (const chip of next) {
        if (merged.some(c => c.kind === chip.kind && c.value.toLowerCase() === chip.value.toLowerCase())) {
          continue
        }
        merged.push(chip)
      }
      return merged
    })
  }

  function removeChip(chip: FilterChip) {
    setChips(prev =>
      prev.filter(c => !(c.kind === chip.kind && c.value.toLowerCase() === chip.value.toLowerCase())),
    )
  }

  const columns: ReportColumn[] = COLUMNS.map(col => {
    if (col.key === 'trend') {
      return { ...col, format: value => <TrendCell trend={value} /> }
    }
    if (col.key === 'valuePerCover' || col.key === 'valuePerCheck') {
      return { ...col, format: value => reportMoney(value, rm) }
    }
    return col
  })

  return (
    <ReportPageShell
      title="Ops Expenses Analysis"
      description="Component consumption for ops expenses vs covers and checks. Trend compares to the previous week or month."
      tableId="reports.ops-expenses-analysis"
      selectedCompanyId={selectedCompanyId}
      selectedLocationIds={selectedLocationIds}
      columns={columns}
      rows={report.rows}
      loading={report.loading}
      error={report.error}
      period={report.period}
      onPeriodChange={report.setPeriod}
      onRefresh={() => void report.refresh()}
      csvFilename="ops-expenses-analysis"
      showPeriodSelect={false}
      metrics={[
        { label: 'Components', value: String(report.summary.itemCount ?? 0) },
        { label: 'Total covers', value: String(report.summary.totalCovers ?? 0) },
        { label: 'Total checks', value: String(report.summary.totalChecks ?? 0) },
        {
          label: 'Consumption value',
          value: reportMoney(report.summary.totalConsumptionValue, rm),
        },
      ]}
      extraFilters={
        <>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Range
            <select
              className={filterSelectCls}
              value={periodMode}
              onChange={e => setMode(e.target.value as PeriodMode)}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {periodMode === 'week' ? 'Week' : 'Month'}
            <select
              className={filterSelectCls}
              value={report.period}
              onChange={e => report.setPeriod(e.target.value)}
            >
              {(periodMode === 'week' ? weekOptions : monthOptions).map(key => (
                <option key={key} value={key}>
                  {periodMode === 'week'
                    ? formatWeekLabel(key)
                    : formatStockCardMonthLabel(key, key === currentStockCardMonth())}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Category
            <select
              className={filterSelectCls}
              value={draftCategory}
              onChange={e => setDraftCategory(e.target.value)}
            >
              <option value="">Any</option>
              {categoryOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Group
            <select
              className={filterSelectCls}
              value={draftGroup}
              onChange={e => setDraftGroup(e.target.value)}
            >
              <option value="">Any</option>
              {groupOptions.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-card text-xs font-semibold"
            onClick={addChip}
            title="Add selected category/group to the filter"
          >
            <Plus size={14} />
            Add
          </button>
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 max-w-md">
              {chips.map(chip => (
                <span
                  key={`${chip.kind}:${chip.value}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
                >
                  <span className="text-muted-foreground uppercase">{chip.kind === 'category' ? 'Cat' : 'Grp'}</span>
                  {chip.value}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeChip(chip)}
                    aria-label={`Remove ${chip.value}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground self-end pb-1">
              No chips — defaults to Ops Expenses
            </span>
          )}
        </>
      }
    />
  )
}
