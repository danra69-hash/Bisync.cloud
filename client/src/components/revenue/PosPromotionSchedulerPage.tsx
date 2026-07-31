import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type PosPromotion,
  type Product,
} from '../../api';
import { inputCls } from '../../data/countries';
import {
  getSiCategoryFilterOptions,
  getSiGroupFilterOptions,
} from '../../data/revenueManagement';
import {
  calcProductCogs,
  formatCogsPercent,
} from '../../data/productForm';
import {
  productMatchesPosMenu,
  resolvePosMenuRrp,
} from '../../data/posCatalog';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { pageShellClass, TABLE_COL_CHECK, TABLE_COL_TOGGLE } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { useOrgDateInput } from '../../hooks/useOrgDateInput';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

const TABS = [
  { id: 'active', label: 'Active Promotion' },
  { id: 'create', label: 'Create Promotion' },
] as const;

type TabId = (typeof TABS)[number]['id'];
type PromoType = 'discountPercent' | 'discountPrice';
type RepeatMode = 'daily' | 'daysOfWeek';

const WEEKDAYS = [
  { code: 'Mon', label: 'Mon' },
  { code: 'Tue', label: 'Tue' },
  { code: 'Wed', label: 'Wed' },
  { code: 'Thu', label: 'Thu' },
  { code: 'Fri', label: 'Fri' },
  { code: 'Sat', label: 'Sat' },
  { code: 'Sun', label: 'Sun' },
] as const;

type RowDraft = {
  included: boolean;
  discountPercent: string;
  rpp: string;
};


function formatDateLabel(value?: string | null) {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function parsePositiveNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function calcRppFromDiscount(rrp: number, discountPercent: number) {
  return roundMoney(rrp * (1 - discountPercent / 100));
}

function calcDiscountFromRpp(rrp: number, rpp: number) {
  if (rrp <= 0) return 0;
  return roundPercent(((rrp - rpp) / rrp) * 100);
}

function emptyRowDraft(): RowDraft {
  return { included: false, discountPercent: '', rpp: '' };
}

export function PosPromotionSchedulerPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { todayYmd } = useOrgDateInput();
  const { currency, cogsPercent } = useCountryFormatters();
  const [tab, setTab] = useState<TabId>('create');

  const [promotions, setPromotions] = useState<PosPromotion[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Scheduled' | 'Inactive'>('all');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState('');
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [promoType, setPromoType] = useState<PromoType>('discountPercent');
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState('');
  const [draftByProductId, setDraftByProductId] = useState<Record<number, RowDraft>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const loadPromotions = useCallback(async () => {
    if (!selectedCompanyId) {
      setPromotions([]);
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      setPromotions(await api.posPromotions(selectedCompanyId));
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load promotions.');
      setPromotions([]);
    } finally {
      setListLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  useEffect(() => {
    if (!selectedCompanyId || tab !== 'create') return;
    let cancelled = false;
    setCatalogLoading(true);
    api.products(selectedCompanyId)
      .then(rows => {
        if (cancelled) return;
        const posRows = rows
          .filter(p => productMatchesPosMenu(p, selectedCompanyId, selectedLocationIds))
          .sort((a, b) => {
            const cat = (a.category || '').localeCompare(b.category || '');
            if (cat !== 0) return cat;
            const grp = (a.group || '').localeCompare(b.group || '');
            if (grp !== 0) return grp;
            return a.name.localeCompare(b.name);
          });
        setProducts(posRows);
        setDraftByProductId(prev => {
          const next: Record<number, RowDraft> = {};
          for (const p of posRows) next[p.id] = prev[p.id] ?? emptyRowDraft();
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCompanyId, selectedLocationIds, tab]);

  const categoryOptions = useMemo(
    () => getSiCategoryFilterOptions(products.map(p => p.category || '')),
    [products],
  );
  const groupOptions = useMemo(
    () => getSiGroupFilterOptions(products.map(p => p.group || '')),
    [products],
  );

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterCategory !== 'All' && (p.category || '') !== filterCategory) return false;
      if (filterGroup !== 'All' && (p.group || '') !== filterGroup) return false;
      return true;
    });
  }, [products, filterCategory, filterGroup]);

  const filteredPromotions = useMemo(() => {
    if (statusFilter === 'all') return promotions;
    return promotions.filter(p => p.status === statusFilter);
  }, [promotions, statusFilter]);

  const productCogs = useCallback((product: Product) => {
    return calcProductCogs(product.totalCost ?? 0, product.packagingCost ?? 0, product);
  }, []);

  const updateDraft = (productId: number, patch: Partial<RowDraft>) => {
    setDraftByProductId(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? emptyRowDraft()), ...patch },
    }));
  };

  const setDiscountForRow = (product: Product, discountRaw: string) => {
    const rrp = resolvePosMenuRrp(product, products);
    const discount = parsePositiveNumber(discountRaw);
    if (discount == null) {
      updateDraft(product.id, { included: false, discountPercent: discountRaw, rpp: '' });
      return;
    }
    const clamped = Math.min(100, discount);
    const rpp = calcRppFromDiscount(rrp, clamped);
    updateDraft(product.id, {
      included: true,
      // Keep the typed string so partial input (e.g. "1.") stays editable.
      discountPercent: discountRaw,
      rpp: rrp > 0 ? String(rpp) : '',
    });
  };

  const setRppForRow = (product: Product, rppRaw: string) => {
    const rrp = resolvePosMenuRrp(product, products);
    const rpp = parsePositiveNumber(rppRaw);
    if (rpp == null) {
      updateDraft(product.id, { included: false, rpp: rppRaw, discountPercent: '' });
      return;
    }
    const clamped = rrp > 0 ? Math.min(rrp, rpp) : rpp;
    const discount = calcDiscountFromRpp(rrp, clamped);
    updateDraft(product.id, {
      included: true,
      rpp: rppRaw,
      discountPercent: rrp > 0 ? String(discount) : '',
    });
  };

  const applyBulkDiscount = () => {
    const discount = parsePositiveNumber(bulkDiscountPercent);
    if (discount == null) return;
    const clamped = Math.min(100, discount);
    setDraftByProductId(prev => {
      const next = { ...prev };
      for (const product of filteredProducts) {
        const rrp = resolvePosMenuRrp(product, products);
        const rpp = calcRppFromDiscount(rrp, clamped);
        next[product.id] = {
          included: true,
          discountPercent: String(clamped),
          rpp: String(rpp),
        };
      }
      return next;
    });
  };

  const toggleDay = (code: string) => {
    setDaysOfWeek(prev => (
      prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code]
    ));
    setRepeatMode('daysOfWeek');
  };

  const resetCreateForm = () => {
    setName('');
    setStartDate(todayYmd);
    setEndDate('');
    setEndDateOpen(false);
    setStartTime('00:00');
    setEndTime('23:59');
    setRepeatMode('daily');
    setDaysOfWeek([]);
    setFilterCategory('All');
    setFilterGroup('All');
    setPromoType('discountPercent');
    setBulkDiscountPercent('');
    setDraftByProductId(Object.fromEntries(products.map(p => [p.id, emptyRowDraft()])));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaveError(null);
    setSaveOk(null);

    if (!name.trim()) {
      setSaveError('Promotion name is required.');
      return;
    }
    if (!startDate) {
      setSaveError('Date from is required.');
      return;
    }
    if (!endDateOpen && !endDate) {
      setSaveError('Date to is required, or tick End date open.');
      return;
    }
    if (!endDateOpen && endDate < startDate) {
      setSaveError('Date to must be on or after Date from.');
      return;
    }
    if (!startTime || !endTime) {
      setSaveError('Time from and Time to are required.');
      return;
    }
    if (repeatMode === 'daysOfWeek' && daysOfWeek.length === 0) {
      setSaveError('Select at least one day, or choose Repeat Daily.');
      return;
    }

    const lines = filteredProducts
      .map(product => {
        const draft = draftByProductId[product.id] ?? emptyRowDraft();
        if (!draft.included) return null;
        const rrp = resolvePosMenuRrp(product, products);
        const cogs = productCogs(product);
        const discount = parsePositiveNumber(draft.discountPercent);
        const rpp = parsePositiveNumber(draft.rpp);
        if (discount == null || rpp == null || rrp <= 0) return null;
        return {
          productId: product.id,
          rrp: roundMoney(rrp),
          cogs: roundMoney(cogs),
          rpp: roundMoney(rpp),
          discountPercent: roundPercent(Math.min(100, discount)),
        };
      })
      .filter((line): line is NonNullable<typeof line> => line != null);

    if (lines.length === 0) {
      setSaveError('Enter a discount or promotional price for at least one product in the table.');
      return;
    }

    setSaving(true);
    try {
      await api.createPosPromotion({
        companyId: selectedCompanyId,
        name: name.trim(),
        startDate,
        endDate: endDateOpen ? undefined : endDate,
        endDateOpen,
        startTime,
        endTime,
        repeatMode,
        daysOfWeek: repeatMode === 'daily' ? [] : daysOfWeek,
        filterCategory: filterCategory === 'All' ? undefined : filterCategory,
        filterGroup: filterGroup === 'All' ? undefined : filterGroup,
        promoType,
        products: lines,
      });
      setSaveOk(`Saved promotion with ${lines.length} product${lines.length === 1 ? '' : 's'}.`);
      resetCreateForm();
      setTab('active');
      await loadPromotions();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save promotion.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (promotion: PosPromotion, active: boolean) => {
    setTogglingId(promotion.id);
    try {
      await api.setPosPromotionActive(promotion.id, active);
      await loadPromotions();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to update promotion.');
    } finally {
      setTogglingId(null);
    }
  };

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to open Promotion Scheduler.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass({ spacing: 'default' })}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Promotion Scheduler</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule POS promotions with RRP / RPP pricing for menu products.
          </p>
        </div>
      </div>

      <HrConfigTabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'active' ? (
        <div className="space-y-3 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className={`${inputCls} w-auto`}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button
              type="button"
              onClick={() => void loadPromotions()}
              disabled={listLoading}
              className="text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {listError ? (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {listError}
            </p>
          ) : null}

          {listLoading ? (
            <MillstoneLoader label="Loading promotions…" />
          ) : (
            <TableScrollContainer>
              <table className="w-full text-xs">
                <ColGroup widths={['16%', '14%', '10%', '10%', '12%', '8%', '10%', '8%', TABLE_COL_TOGGLE.style.width]} />
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold">Dates</th>
                    <th className="py-2 pr-3 font-semibold">Time</th>
                    <th className="py-2 pr-3 font-semibold">Repeat</th>
                    <th className="py-2 pr-3 font-semibold">Type</th>
                    <th className="py-2 pr-3 font-semibold">Products</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Now</th>
                    <th className="py-2 font-semibold">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromotions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-muted-foreground">
                        No POS promotions yet. Create one on the Create Promotion tab.
                      </td>
                    </tr>
                  ) : (
                    filteredPromotions.map(promo => (
                      <tr key={promo.id} className="border-b border-border/70 align-top">
                        <td className="py-2 pr-3 font-medium text-foreground">{promo.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                          {formatDateLabel(promo.startDate)}
                          {' → '}
                          {promo.endDateOpen ? 'Open' : formatDateLabel(promo.endDate)}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                          {promo.startTime} – {promo.endTime}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {promo.repeatMode === 'daily'
                            ? 'Daily'
                            : (promo.daysOfWeek ?? []).join(', ') || '—'}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {promo.promoType === 'discountPrice' ? 'Discount by Price' : 'Discount by %'}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{promo.products.length}</td>
                        <td className="py-2 pr-3">{promo.status}</td>
                        <td className="py-2 pr-3">
                          {promo.inEffectNow ? (
                            <span className="text-emerald-700 font-semibold">RPP on</span>
                          ) : (
                            <span className="text-muted-foreground">Off</span>
                          )}
                        </td>
                        <td className="py-2">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={promo.active}
                              disabled={togglingId === promo.id}
                              onChange={e => void toggleActive(promo, e.target.checked)}
                            />
                            <span className="text-muted-foreground">{promo.active ? 'On' : 'Off'}</span>
                          </label>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableScrollContainer>
          )}
        </div>
      ) : (
        <div className="space-y-4 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="text-xs font-semibold border border-primary bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
            >
              {saving ? 'Updating…' : 'Update'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={resetCreateForm}
              className="text-xs border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Clear
            </button>
            <p className="text-[11px] text-muted-foreground">
              RRP = Recommended Retail Price · RPP = Recommended Promotional Price
            </p>
          </div>

          {saveError ? (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {saveError}
            </p>
          ) : null}
          {saveOk ? (
            <p className="text-xs text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
              {saveOk}
            </p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="xl:col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Name of Promotion *
              </label>
              <input
                className={`${inputCls} mt-1`}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Lunch Weekday Special"
              />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Date from *
              </label>
              <input
                type="date"
                className={`${inputCls} mt-1`}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                  Date to
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={endDateOpen}
                    onChange={e => {
                      setEndDateOpen(e.target.checked);
                      if (e.target.checked) setEndDate('');
                    }}
                  />
                  End date open
                </label>
              </div>
              <input
                type="date"
                className={`${inputCls} mt-1`}
                value={endDate}
                disabled={endDateOpen}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Time from *
              </label>
              <input
                type="time"
                className={`${inputCls} mt-1`}
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Time to *
              </label>
              <input
                type="time"
                className={`${inputCls} mt-1`}
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
            <div className="xl:col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Repeat
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeatMode === 'daily'}
                    onChange={e => {
                      if (e.target.checked) {
                        setRepeatMode('daily');
                        setDaysOfWeek([]);
                      } else {
                        setRepeatMode('daysOfWeek');
                      }
                    }}
                  />
                  Repeat Daily
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map(day => (
                    <label
                      key={day.code}
                      className={`inline-flex items-center gap-1 px-2 py-1 border text-xs cursor-pointer ${
                        daysOfWeek.includes(day.code)
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={daysOfWeek.includes(day.code)}
                        onChange={() => toggleDay(day.code)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Filter Category
              </label>
              <select
                className={`${inputCls} mt-1`}
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                {categoryOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Filter Group
              </label>
              <select
                className={`${inputCls} mt-1`}
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
              >
                {groupOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="xl:col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Promo Type
              </label>
              <div className="mt-1 flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="pos-promo-type"
                    checked={promoType === 'discountPercent'}
                    onChange={() => setPromoType('discountPercent')}
                  />
                  Discount by %
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="pos-promo-type"
                    checked={promoType === 'discountPrice'}
                    onChange={() => setPromoType('discountPrice')}
                  />
                  Discount by Price (RPP)
                </label>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Edit Discount % or RPP on each row — both stay in sync.
              </p>
              {promoType === 'discountPercent' ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Apply % to filtered products
                    </label>
                    <input
                      className={`${inputCls} mt-1 w-28`}
                      inputMode="decimal"
                      value={bulkDiscountPercent}
                      onChange={e => setBulkDiscountPercent(e.target.value)}
                      placeholder="e.g. 15"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyBulkDiscount}
                    className="text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                  >
                    Apply
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {catalogLoading ? (
            <MillstoneLoader label="Loading POS products…" />
          ) : (
            <TableScrollContainer>
              <table className="w-full text-xs min-w-[1100px]">
                <ColGroup widths={[TABLE_COL_CHECK.style.width, '10%', '22%', '8%', '9%', '8%', '8%', '9%', '8%', '10%']} />
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-semibold">Include</th>
                    <th className="py-2 pr-2 font-semibold">Product Code</th>
                    <th className="py-2 pr-2 font-semibold">Product</th>
                    <th className="py-2 pr-2 font-semibold text-right">RRP</th>
                    <th className="py-2 pr-2 font-semibold text-right">RRP Cogs</th>
                    <th className="py-2 pr-2 font-semibold text-right">RRP Cogs%</th>
                    <th className="py-2 pr-2 font-semibold text-right">RPP</th>
                    <th className="py-2 pr-2 font-semibold text-right">RPP Cogs</th>
                    <th className="py-2 pr-2 font-semibold text-right">RPP Cogs%</th>
                    <th className="py-2 font-semibold text-right">Discount %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-muted-foreground">
                        No POS menu products match the selected category / group filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => {
                      const rrp = resolvePosMenuRrp(product, products);
                      const cogs = productCogs(product);
                      const draft = draftByProductId[product.id] ?? emptyRowDraft();
                      const rppValue = parsePositiveNumber(draft.rpp);
                      const rppCogsPercent = rppValue != null && rppValue > 0
                        ? formatCogsPercent(cogs, rppValue)
                        : '—';
                      return (
                        <tr key={product.id} className="border-b border-border/70">
                          <td className="py-1.5 pr-2">
                            <input
                              type="checkbox"
                              checked={draft.included}
                              onChange={e => {
                                if (!e.target.checked) {
                                  updateDraft(product.id, emptyRowDraft());
                                  return;
                                }
                                if (promoType === 'discountPercent') {
                                  setDiscountForRow(product, draft.discountPercent || '0');
                                } else {
                                  setRppForRow(product, draft.rpp || String(rrp));
                                }
                              }}
                            />
                          </td>
                          <td className="py-1.5 pr-2 font-mono text-muted-foreground whitespace-nowrap">
                            {product.productId || '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-foreground">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {[product.category, product.group].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                            {rrp > 0 ? currency(rrp) : '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                            {currency(cogs)}
                          </td>
                          <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                            {rrp > 0 ? cogsPercent(cogs, rrp) : '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <input
                              className={`${inputCls} w-24 text-right ml-auto`}
                              inputMode="decimal"
                              value={draft.rpp}
                              onChange={e => setRppForRow(product, e.target.value)}
                              onBlur={() => {
                                const parsed = parsePositiveNumber(draft.rpp);
                                if (parsed == null) return;
                                const clamped = rrp > 0 ? Math.min(rrp, parsed) : parsed;
                                setRppForRow(product, String(roundMoney(clamped)));
                              }}
                              placeholder="0.00"
                              aria-label={`RPP for ${product.name}`}
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                            {currency(cogs)}
                          </td>
                          <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                            {rppCogsPercent}
                          </td>
                          <td className="py-1.5 text-right">
                            <input
                              className={`${inputCls} w-20 text-right ml-auto`}
                              inputMode="decimal"
                              value={draft.discountPercent}
                              onChange={e => setDiscountForRow(product, e.target.value)}
                              onBlur={() => {
                                const parsed = parsePositiveNumber(draft.discountPercent);
                                if (parsed == null) return;
                                const clamped = Math.min(100, parsed);
                                setDiscountForRow(product, String(roundPercent(clamped)));
                              }}
                              placeholder="0"
                              aria-label={`Discount percent for ${product.name}`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </TableScrollContainer>
          )}
        </div>
      )}
    </div>
  );
}
