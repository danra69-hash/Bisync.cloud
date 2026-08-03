import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type PosPromotion,
  type Product,
} from '../../api';
import { inputCls } from '../../data/countries';
import {
  getSiCategoryFilterOptions,
} from '../../data/revenueManagement';
import {
  calcProductCogs,
  formatCogsPercent,
} from '../../data/productForm';
import {
  normalizePosGroupLabel,
  productMatchesPosGroupFilter,
  productMatchesPosMenu,
  resolvePosMenuRrp,
} from '../../data/posCatalog';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { pageShellClass, TABLE_COL_CHECK, TABLE_COL_TOGGLE } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';

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
type PromotionKind = 'timeBase' | 'prepaid';
type ValidityUnit = 'days' | 'months';
type DepletionMethod = 'weight' | 'salesUnit';

const DEFAULT_DEPLETION_UNITS = [
  { code: 'glass', label: 'Glass', qtyPerUnit: 1 },
  { code: 'pint', label: 'Pint', qtyPerUnit: 2 },
  { code: 'tower', label: 'Tower', qtyPerUnit: 5 },
];

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

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  const [promotionKind, setPromotionKind] = useState<PromotionKind>('timeBase');
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
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
  const [validityPeriodValue, setValidityPeriodValue] = useState('30');
  const [validityPeriodUnit, setValidityPeriodUnit] = useState<ValidityUnit>('days');
  const [packageQty, setPackageQty] = useState('1');
  const [packageUom, setPackageUom] = useState('Bottle');
  const [packageRrp, setPackageRrp] = useState('');
  const [packageTotalValue, setPackageTotalValue] = useState('');
  const [packageRpp, setPackageRpp] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [depletionMethod, setDepletionMethod] = useState<DepletionMethod>('salesUnit');
  const [depletionUnits, setDepletionUnits] = useState(DEFAULT_DEPLETION_UNITS);
  const [selectedPrepaidProductId, setSelectedPrepaidProductId] = useState<number | null>(null);
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
  // POS groups only (normalized): "BEER DRAFT" and "Draught Beer" collapse together.
  const groupOptions = useMemo(() => {
    const source = filterCategory === 'All'
      ? products
      : products.filter(p => (p.category || '') === filterCategory);
    const labels = Array.from(new Set(
      source.map(p => normalizePosGroupLabel(p.group || '')).filter(Boolean),
    )).sort((a, b) => a.localeCompare(b));
    return ['All', ...labels];
  }, [products, filterCategory]);

  useEffect(() => {
    if (filterGroup === 'All') return;
    const normalized = normalizePosGroupLabel(filterGroup);
    if (!groupOptions.includes(normalized) && !groupOptions.includes(filterGroup)) {
      setFilterGroup('All');
      return;
    }
    if (normalized !== filterGroup && groupOptions.includes(normalized)) {
      setFilterGroup(normalized);
    }
  }, [filterGroup, groupOptions]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterCategory !== 'All' && (p.category || '') !== filterCategory) return false;
      if (!productMatchesPosGroupFilter(p.group || '', filterGroup)) return false;
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
    setPromotionKind('timeBase');
    setStartDate(toDateInputValue(new Date()));
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
    setValidityPeriodValue('30');
    setValidityPeriodUnit('days');
    setPackageQty('1');
    setPackageUom('Bottle');
    setPackageRrp('');
    setPackageTotalValue('');
    setPackageRpp('');
    setDiscountAmount('');
    setDepletionMethod('salesUnit');
    setDepletionUnits(DEFAULT_DEPLETION_UNITS);
    setSelectedPrepaidProductId(null);
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

    if (promotionKind === 'timeBase') {
      if (!startTime || !endTime) {
        setSaveError('Time from and Time to are required for Time Base promotions.');
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
          promotionKind: 'timeBase',
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
        setSaveOk(`Saved Time Base promotion with ${lines.length} product${lines.length === 1 ? '' : 's'}.`);
        resetCreateForm();
        setTab('active');
        await loadPromotions();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save promotion.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Pre-paid promotion
    const validity = Number.parseInt(validityPeriodValue, 10);
    if (!Number.isFinite(validity) || validity <= 0) {
      setSaveError('Validity period must be a positive number.');
      return;
    }
    const qty = parsePositiveNumber(packageQty);
    const rrp = parsePositiveNumber(packageRrp);
    const total = parsePositiveNumber(packageTotalValue);
    const rpp = parsePositiveNumber(packageRpp);
    const discount = parsePositiveNumber(discountAmount) ?? 0;
    if (qty == null || qty <= 0) {
      setSaveError('Package QTY is required.');
      return;
    }
    if (!packageUom.trim()) {
      setSaveError('UOM is required.');
      return;
    }
    if (rrp == null || rrp < 0 || rpp == null || rpp < 0) {
      setSaveError('RRP and RPP are required.');
      return;
    }
    if (!selectedPrepaidProductId) {
      setSaveError('Select a POS product for this Pre-paid promotion.');
      return;
    }
    const product = filteredProducts.find(p => p.id === selectedPrepaidProductId)
      ?? products.find(p => p.id === selectedPrepaidProductId);
    if (!product) {
      setSaveError('Selected product was not found.');
      return;
    }
    const totalValue = total ?? roundMoney(rrp * qty);
    const computedDiscount = discount > 0 ? discount : roundMoney(Math.max(0, totalValue - rpp));
    const cogs = productCogs(product);
    const discountPercent = totalValue > 0
      ? roundPercent(Math.min(100, (computedDiscount / totalValue) * 100))
      : 0;

    setSaving(true);
    try {
      await api.createPosPromotion({
        companyId: selectedCompanyId,
        name: name.trim(),
        promotionKind: 'prepaid',
        startDate,
        endDate: endDateOpen ? undefined : endDate,
        endDateOpen,
        startTime: '00:00',
        endTime: '23:59',
        repeatMode: 'daily',
        daysOfWeek: [],
        filterCategory: filterCategory === 'All' ? undefined : filterCategory,
        filterGroup: filterGroup === 'All' ? undefined : filterGroup,
        promoType: 'discountPrice',
        validityPeriodValue: validity,
        validityPeriodUnit,
        packageQty: qty,
        packageUom: packageUom.trim(),
        packageRrp: roundMoney(rrp),
        packageTotalValue: totalValue,
        packageRpp: roundMoney(rpp),
        discountAmount: computedDiscount,
        depletionMethod,
        depletionUnits: depletionMethod === 'salesUnit' ? depletionUnits : [],
        products: [{
          productId: product.id,
          rrp: roundMoney(rrp),
          cogs: roundMoney(cogs),
          rpp: roundMoney(rpp),
          discountPercent,
        }],
      });
      setSaveOk('Saved Pre-paid promotion.');
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
                          {promo.promotionKind === 'prepaid'
                            ? 'Pre-paid'
                            : promo.promoType === 'discountPrice'
                              ? 'Time Base · Price'
                              : 'Time Base · %'}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{promo.products.length}</td>
                        <td className="py-2 pr-3">{promo.status}</td>
                        <td className="py-2 pr-3">
                          {promo.promotionKind === 'prepaid' ? (
                            <span className="text-muted-foreground">Pre-paid</span>
                          ) : promo.inEffectNow ? (
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
            <div className="xl:col-span-4 flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Promotion class *
              </span>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={promotionKind === 'timeBase'}
                  onChange={e => {
                    if (e.target.checked) setPromotionKind('timeBase');
                  }}
                />
                Time Base Promotion
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={promotionKind === 'prepaid'}
                  onChange={e => {
                    if (e.target.checked) setPromotionKind('prepaid');
                  }}
                />
                Pre-paid Promotion
              </label>
              <p className="text-[11px] text-muted-foreground">
                {promotionKind === 'timeBase'
                  ? 'Happy Hour and other scheduled RPP windows.'
                  : 'Bulk purchase (bottle / keg) depleted over visits.'}
              </p>
            </div>
            <div className="xl:col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Name of Promotion *
              </label>
              <input
                className={`${inputCls} mt-1`}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={promotionKind === 'prepaid' ? 'e.g. House Whiskey Bottle Club' : 'e.g. Lunch Weekday Special'}
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
                Time from {promotionKind === 'timeBase' ? '*' : ''}
              </label>
              <input
                type="time"
                className={`${inputCls} mt-1`}
                value={startTime}
                disabled={promotionKind === 'prepaid'}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Time to {promotionKind === 'timeBase' ? '*' : ''}
              </label>
              <input
                type="time"
                className={`${inputCls} mt-1`}
                value={endTime}
                disabled={promotionKind === 'prepaid'}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
            <div className="xl:col-span-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                Repeat
              </label>
              <div className={`mt-1 flex flex-wrap items-center gap-3 ${promotionKind === 'prepaid' ? 'opacity-45 pointer-events-none' : ''}`}>
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
            {promotionKind === 'timeBase' ? (
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
            ) : (
              <>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Validity period *
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      className={`${inputCls} w-24`}
                      inputMode="numeric"
                      value={validityPeriodValue}
                      onChange={e => setValidityPeriodValue(e.target.value)}
                    />
                    <select
                      className={`${inputCls} w-auto`}
                      value={validityPeriodUnit}
                      onChange={e => setValidityPeriodUnit(e.target.value as ValidityUnit)}
                    >
                      <option value="days">Days from purchase</option>
                      <option value="months">Months from purchase</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    POS Product *
                  </label>
                  <select
                    className={`${inputCls} mt-1`}
                    value={selectedPrepaidProductId ?? ''}
                    onChange={e => {
                      const id = Number(e.target.value) || null;
                      setSelectedPrepaidProductId(id);
                      const product = filteredProducts.find(p => p.id === id) ?? products.find(p => p.id === id);
                      if (product) {
                        const rrp = resolvePosMenuRrp(product, products);
                        setPackageRrp(String(rrp || ''));
                        const qty = parsePositiveNumber(packageQty) ?? 1;
                        const total = roundMoney(rrp * qty);
                        setPackageTotalValue(String(total));
                        if (!packageRpp) setPackageRpp(String(total));
                        setDiscountAmount('0');
                      }
                    }}
                  >
                    <option value="">Select product…</option>
                    {filteredProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.group ? ` · ${normalizePosGroupLabel(p.group)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    QTY *
                  </label>
                  <input
                    className={`${inputCls} mt-1`}
                    inputMode="decimal"
                    value={packageQty}
                    onChange={e => {
                      setPackageQty(e.target.value);
                      const qty = parsePositiveNumber(e.target.value);
                      const rrp = parsePositiveNumber(packageRrp);
                      if (qty != null && rrp != null) {
                        const total = roundMoney(rrp * qty);
                        setPackageTotalValue(String(total));
                        const rpp = parsePositiveNumber(packageRpp);
                        if (rpp != null) setDiscountAmount(String(roundMoney(Math.max(0, total - rpp))));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    UOM *
                  </label>
                  <input
                    className={`${inputCls} mt-1`}
                    value={packageUom}
                    onChange={e => setPackageUom(e.target.value)}
                    placeholder="Bottle / Keg / Liter"
                  />
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    RRP *
                  </label>
                  <input
                    className={`${inputCls} mt-1`}
                    inputMode="decimal"
                    value={packageRrp}
                    onChange={e => {
                      setPackageRrp(e.target.value);
                      const rrp = parsePositiveNumber(e.target.value);
                      const qty = parsePositiveNumber(packageQty) ?? 1;
                      if (rrp != null) {
                        const total = roundMoney(rrp * qty);
                        setPackageTotalValue(String(total));
                        const rpp = parsePositiveNumber(packageRpp);
                        if (rpp != null) setDiscountAmount(String(roundMoney(Math.max(0, total - rpp))));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Total Value
                  </label>
                  <input
                    className={`${inputCls} mt-1`}
                    inputMode="decimal"
                    value={packageTotalValue}
                    onChange={e => {
                      setPackageTotalValue(e.target.value);
                      const total = parsePositiveNumber(e.target.value);
                      const rpp = parsePositiveNumber(packageRpp);
                      if (total != null && rpp != null) {
                        setDiscountAmount(String(roundMoney(Math.max(0, total - rpp))));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    RPP (prepaid price) *
                  </label>
                  <input
                    className={`${inputCls} mt-1`}
                    inputMode="decimal"
                    value={packageRpp}
                    onChange={e => {
                      setPackageRpp(e.target.value);
                      const rpp = parsePositiveNumber(e.target.value);
                      const total = parsePositiveNumber(packageTotalValue);
                      if (rpp != null && total != null) {
                        setDiscountAmount(String(roundMoney(Math.max(0, total - rpp))));
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Discount Amount
                  </label>
                  <input
                    className={`${inputCls} mt-1`}
                    inputMode="decimal"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                  />
                </div>
                <div className="xl:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Depletion Method *
                  </label>
                  <div className="mt-1 flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="depletion-method"
                        checked={depletionMethod === 'salesUnit'}
                        onChange={() => setDepletionMethod('salesUnit')}
                      />
                      By sales unit (Glass / Pint / Tower)
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="depletion-method"
                        checked={depletionMethod === 'weight'}
                        onChange={() => setDepletionMethod('weight')}
                      />
                      By weight
                    </label>
                  </div>
                </div>
                {depletionMethod === 'salesUnit' ? (
                  <div className="xl:col-span-4">
                    <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                      Sales units (qty depleted from package balance per serve)
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {depletionUnits.map((unit, idx) => (
                        <div key={unit.code} className="flex items-center gap-2 border border-border rounded-md px-2 py-1.5">
                          <span className="text-xs font-semibold w-14">{unit.label}</span>
                          <input
                            className={`${inputCls} py-1`}
                            inputMode="decimal"
                            value={String(unit.qtyPerUnit)}
                            onChange={e => {
                              const n = Number(e.target.value);
                              setDepletionUnits(prev => prev.map((u, i) => (
                                i === idx
                                  ? { ...u, qtyPerUnit: Number.isFinite(n) && n > 0 ? n : u.qtyPerUnit }
                                  : u
                              )));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {promotionKind === 'timeBase' ? (
            catalogLoading ? (
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
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
