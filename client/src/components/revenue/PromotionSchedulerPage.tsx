import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  api,
  type Product,
  type ProductManagementSummary,
  type Promotion,
} from '../../api';
import { inputCls } from '../../data/countries';
import { pageShellClass, TABLE_COL_ACTION, TABLE_COL_CHECK } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
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
type DurationMode = 'byDate' | 'byQty';
type PromotionType = 'discountPercent' | 'knockedDownPrice' | 'combo';

type ProductDraft = {
  selected: boolean;
  promoQty: string;
  knockedDownPrice: string;
  qtyPerCombo: string;
};

type ComboDraft = {
  id: string;
  name: string;
  comboPrice: string;
  comboPackQty: string;
  draftByProductId: Record<number, ProductDraft>;
};

function emptyProductDraft(): ProductDraft {
  return { selected: false, promoQty: '', knockedDownPrice: '', qtyPerCombo: '' };
}

function createEmptyComboDraft(productIds: number[] = []): ComboDraft {
  const draftByProductId: Record<number, ProductDraft> = {};
  for (const id of productIds) {
    draftByProductId[id] = emptyProductDraft();
  }
  return {
    id: `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    comboPrice: '',
    comboPackQty: '',
    draftByProductId,
  };
}

function seedProductDrafts(
  productIds: number[],
  existing?: Record<number, ProductDraft>,
): Record<number, ProductDraft> {
  const next: Record<number, ProductDraft> = {};
  for (const id of productIds) {
    next[id] = existing?.[id] ?? emptyProductDraft();
  }
  return next;
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

function durationLabel(mode: string) {
  return mode === 'byQty' ? 'By QTY' : 'By Date';
}

function typeLabel(type: string, discountPercent?: number | null, comboPrice?: number | null) {
  if (type === 'combo') return comboPrice != null ? `Combo (${comboPrice})` : 'Combo';
  if (type === 'knockedDownPrice') return 'Knocked-down price';
  const pct = discountPercent != null ? ` (${discountPercent}%)` : '';
  return `Discount %${pct}`;
}

export function PromotionSchedulerPage({
  selectedCompanyId,
  selectedLocationIds,
}: Props) {
  const { todayYmd } = useOrgDateInput();
  const [tab, setTab] = useState<TabId>('active');
  const activeTabLabel = TABS.find(t => t.id === tab)?.label ?? 'Active Promotion';
  useRevMgmtPageLabel(activeTabLabel);
  const { rm } = useCountryFormatters();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<number, number>>({});
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [name, setName] = useState('');
  const [durationMode, setDurationMode] = useState<DurationMode>('byDate');
  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState('');
  const [promotionType, setPromotionType] = useState<PromotionType>('discountPercent');
  const [discountPercent, setDiscountPercent] = useState('');
  const [draftByProductId, setDraftByProductId] = useState<Record<number, ProductDraft>>({});
  const [comboDrafts, setComboDrafts] = useState<ComboDraft[]>([createEmptyComboDraft()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const productIds = useMemo(() => products.map(p => p.id), [products]);

  const loadPromotions = useCallback(async () => {
    if (!selectedCompanyId) {
      setPromotions([]);
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      const rows = await api.promotions(selectedCompanyId);
      setPromotions(rows);
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
    const stockPromise = selectedLocationIds.length > 0
      ? api.productManagement(selectedCompanyId, selectedLocationIds, 'b2b')
      : Promise.resolve([] as ProductManagementSummary[]);

    Promise.all([api.products(selectedCompanyId), stockPromise])
      .then(([productRows, stockRows]) => {
        if (cancelled) return;
        const b2b = productRows.filter(p => p.active && p.b2bEnabled && !p.isSubProduct);
        setProducts(b2b);
        const ids = b2b.map(p => p.id);
        const stockMap: Record<number, number> = {};
        for (const row of stockRows) {
          if (row.isSummaryRow) {
            stockMap[row.productId] = row.inStock ?? 0;
          }
        }
        if (Object.keys(stockMap).length === 0) {
          for (const row of stockRows) {
            stockMap[row.productId] = Math.max(stockMap[row.productId] ?? 0, row.inStock ?? 0);
          }
        }
        setStockByProduct(stockMap);
        setDraftByProductId(prev => seedProductDrafts(ids, prev));
        setComboDrafts(prev => {
          const base = prev.length > 0 ? prev : [createEmptyComboDraft(ids)];
          return base.map(combo => ({
            ...combo,
            draftByProductId: seedProductDrafts(ids, combo.draftByProductId),
          }));
        });
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setStockByProduct({});
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedCompanyId, selectedLocationIds, tab]);

  const filteredPromotions = useMemo(() => {
    if (statusFilter === 'all') return promotions;
    return promotions.filter(p => p.status === statusFilter);
  }, [promotions, statusFilter]);

  const resetCreateForm = () => {
    setName('');
    setDurationMode('byDate');
    setStartDate(todayYmd);
    setEndDate('');
    setPromotionType('discountPercent');
    setDiscountPercent('');
    setDraftByProductId(seedProductDrafts(productIds));
    setComboDrafts([createEmptyComboDraft(productIds)]);
    setSaveError(null);
  };

  const updateDraft = (productId: number, patch: Partial<ProductDraft>) => {
    setDraftByProductId(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? emptyProductDraft()),
        ...patch,
      },
    }));
  };

  const updateComboDraft = (comboId: string, patch: Partial<Pick<ComboDraft, 'name' | 'comboPrice' | 'comboPackQty'>>) => {
    setComboDrafts(prev => prev.map(c => (c.id === comboId ? { ...c, ...patch } : c)));
  };

  const updateComboProductDraft = (
    comboId: string,
    productId: number,
    patch: Partial<ProductDraft>,
  ) => {
    setComboDrafts(prev => prev.map(c => {
      if (c.id !== comboId) return c;
      return {
        ...c,
        draftByProductId: {
          ...c.draftByProductId,
          [productId]: {
            ...(c.draftByProductId[productId] ?? emptyProductDraft()),
            ...patch,
          },
        },
      };
    }));
  };

  const addComboDraft = () => {
    setComboDrafts(prev => [...prev, createEmptyComboDraft(productIds)]);
  };

  const removeComboDraft = (comboId: string) => {
    setComboDrafts(prev => (prev.length <= 1 ? prev : prev.filter(c => c.id !== comboId)));
  };

  const selectPromotionType = (next: PromotionType) => {
    setPromotionType(next);
    if (next === 'combo' && comboDrafts.length === 0) {
      setComboDrafts([createEmptyComboDraft(productIds)]);
    }
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaveError(null);
    setSaveOk(null);

    if (!startDate) {
      setSaveError('Promotion start date is required.');
      return;
    }
    if (durationMode === 'byDate' && !endDate) {
      setSaveError('End date is required when duration is By Date.');
      return;
    }

    if (promotionType === 'combo') {
      for (let i = 0; i < comboDrafts.length; i += 1) {
        const combo = comboDrafts[i];
        const label = `Combo ${i + 1}`;
        if (!combo.name.trim()) {
          setSaveError(`${label}: enter a name for this combo product.`);
          return;
        }
        const price = parseFloat(combo.comboPrice);
        if (!Number.isFinite(price) || price < 0) {
          setSaveError(`${label}: enter a combo price.`);
          return;
        }
        const selected = products
          .filter(p => combo.draftByProductId[p.id]?.selected)
          .map(p => ({
            productId: p.id,
            qtyPerCombo: parseFloat(combo.draftByProductId[p.id]?.qtyPerCombo ?? ''),
          }));
        if (selected.length < 2) {
          setSaveError(`${label}: add at least two products to the combo bucket.`);
          return;
        }
        if (selected.some(p => !Number.isFinite(p.qtyPerCombo) || p.qtyPerCombo <= 0)) {
          setSaveError(`${label}: enter QTY in combo for each selected product.`);
          return;
        }
        if (durationMode === 'byQty') {
          const packs = parseFloat(combo.comboPackQty);
          if (!Number.isFinite(packs) || packs <= 0) {
            setSaveError(`${label}: enter how many combo packs are available.`);
            return;
          }
        }
      }

      setSaving(true);
      try {
        for (const combo of comboDrafts) {
          const selected = products
            .filter(p => combo.draftByProductId[p.id]?.selected)
            .map(p => ({
              productId: p.id,
              qtyPerCombo: parseFloat(combo.draftByProductId[p.id]?.qtyPerCombo ?? ''),
            }));
          await api.createPromotion({
            companyId: selectedCompanyId,
            name: combo.name.trim(),
            durationMode,
            startDate,
            endDate: durationMode === 'byDate' ? endDate : undefined,
            promotionType: 'combo',
            comboPrice: parseFloat(combo.comboPrice),
            comboPackQty: durationMode === 'byQty' ? parseFloat(combo.comboPackQty) : undefined,
            products: selected,
          });
        }
        setSaveOk(
          comboDrafts.length === 1
            ? 'Combo product saved.'
            : `${comboDrafts.length} combo products saved.`,
        );
        resetCreateForm();
        await loadPromotions();
        setTab('active');
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save combo products.');
      } finally {
        setSaving(false);
      }
      return;
    }

    const selectedProducts = products
      .filter(p => draftByProductId[p.id]?.selected)
      .map(p => {
        const draft = draftByProductId[p.id];
        return {
          productId: p.id,
          promoQty: durationMode === 'byQty' ? parseFloat(draft?.promoQty ?? '') : undefined,
          knockedDownPrice: promotionType === 'knockedDownPrice'
            ? parseFloat(draft?.knockedDownPrice ?? '')
            : undefined,
        };
      });

    if (!name.trim()) {
      setSaveError('Promotion name is required.');
      return;
    }
    if (promotionType === 'discountPercent') {
      const pct = parseFloat(discountPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        setSaveError('Enter a discount percentage between 0 and 100.');
        return;
      }
    }
    if (selectedProducts.length === 0) {
      setSaveError('Tick at least one product for this promotion.');
      return;
    }
    if (durationMode === 'byQty' && selectedProducts.some(p => !Number.isFinite(p.promoQty) || (p.promoQty ?? 0) <= 0)) {
      setSaveError('Enter Promo QTY for each selected product.');
      return;
    }
    if (promotionType === 'knockedDownPrice'
      && selectedProducts.some(p => !Number.isFinite(p.knockedDownPrice) || (p.knockedDownPrice ?? 0) < 0)) {
      setSaveError('Enter a knocked-down price for each selected product.');
      return;
    }

    setSaving(true);
    try {
      await api.createPromotion({
        companyId: selectedCompanyId,
        name: name.trim(),
        durationMode,
        startDate,
        endDate: durationMode === 'byDate' ? endDate : undefined,
        promotionType,
        discountPercent: promotionType === 'discountPercent' ? parseFloat(discountPercent) : undefined,
        products: selectedProducts.map(p => ({
          productId: p.productId,
          promoQty: durationMode === 'byQty' ? p.promoQty : undefined,
          knockedDownPrice: promotionType === 'knockedDownPrice' ? p.knockedDownPrice : undefined,
        })),
      });
      setSaveOk('Promotion saved.');
      resetCreateForm();
      await loadPromotions();
      setTab('active');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save promotion.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (promo: Promotion) => {
    setTogglingId(promo.id);
    try {
      await api.setPromotionActive(promo.id, !promo.active);
      await loadPromotions();
    } catch {
      // keep list as-is
    } finally {
      setTogglingId(null);
    }
  };

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to manage promotions.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <div data-page-filters className="bg-background/95 backdrop-blur-sm border-b border-border/60">
        <HrConfigTabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'active' ? (
        <div className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className={`${inputCls} w-auto min-w-[8rem]`}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button
              type="button"
              className="text-xs text-primary hover:underline ml-auto"
              onClick={() => void loadPromotions()}
            >
              Refresh
            </button>
          </div>

          {listError && <p className="text-sm text-destructive">{listError}</p>}
          {listLoading ? (
            <div className="flex justify-center py-10"><MillstoneLoader /></div>
          ) : filteredPromotions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No promotions found.</p>
          ) : (
            <TableScrollContainer>
              <table className="w-full min-w-[720px] text-left border-collapse">
                <ColGroup widths={['16%', '12%', '12%', '10%', '14%', '10%', '10%', TABLE_COL_ACTION.style.width]} />
                <thead>
                  <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold border-b border-border">Name</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">Duration</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">Type</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">Start</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">End / Remaining</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">Products</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">Status</th>
                    <th className="px-3 py-2 font-semibold border-b border-border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPromotions.map(promo => {
                    const isCombo = promo.promotionType === 'combo';
                    const remaining = promo.durationMode === 'byQty'
                      ? (isCombo
                        ? (promo.comboPackRemaining ?? 0)
                        : promo.products.reduce((sum, p) => sum + (p.remainingQty ?? 0), 0))
                      : null;
                    return (
                      <tr key={promo.id} className="text-xs hover:bg-muted/20">
                        <td className="px-3 py-2.5 border-b border-border font-medium">{promo.name}</td>
                        <td className="px-3 py-2.5 border-b border-border">{durationLabel(promo.durationMode)}</td>
                        <td className="px-3 py-2.5 border-b border-border">
                          {typeLabel(promo.promotionType, promo.discountPercent, promo.comboPrice)}
                        </td>
                        <td className="px-3 py-2.5 border-b border-border">{formatDateLabel(promo.startDate)}</td>
                        <td className="px-3 py-2.5 border-b border-border">
                          {promo.durationMode === 'byDate'
                            ? formatDateLabel(promo.endDate)
                            : `${remaining ?? 0} ${isCombo ? 'packs' : ''} left`.trim()}
                        </td>
                        <td className="px-3 py-2.5 border-b border-border">
                          {isCombo
                            ? promo.products
                              .map(p => `${p.productName} ×${p.qtyPerCombo ?? 0}`)
                              .join(', ')
                            : promo.products.length}
                        </td>
                        <td className="px-3 py-2.5 border-b border-border">
                          <span
                            className={
                              promo.status === 'Active'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-muted-foreground font-semibold'
                            }
                          >
                            {promo.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 border-b border-border">
                          <button
                            type="button"
                            disabled={togglingId === promo.id}
                            className="text-primary hover:underline disabled:opacity-50"
                            onClick={() => void toggleActive(promo)}
                          >
                            {promo.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScrollContainer>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-3 max-w-5xl">
          {promotionType !== 'combo' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">Name of Promotion</span>
                <input
                  className={inputCls}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Summer Bundle"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-foreground">Promotion start date</span>
                <input
                  type="date"
                  className={inputCls}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </label>
            </div>
          )}

          {promotionType === 'combo' && (
            <label className="block space-y-1 max-w-xs">
              <span className="text-xs font-medium text-foreground">Promotion start date</span>
              <input
                type="date"
                className={inputCls}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </label>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-foreground">Duration of promotion</legend>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={durationMode === 'byDate'}
                  onChange={() => setDurationMode('byDate')}
                />
                By Date
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={durationMode === 'byQty'}
                  onChange={() => setDurationMode('byQty')}
                />
                By QTY
              </label>
            </div>
            {durationMode === 'byDate' && (
              <label className="block space-y-1 max-w-xs">
                <span className="text-xs text-muted-foreground">Promotion ends</span>
                <input
                  type="date"
                  className={inputCls}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => setEndDate(e.target.value)}
                />
              </label>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-foreground">Promotion type</legend>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={promotionType === 'discountPercent'}
                  onChange={() => selectPromotionType('discountPercent')}
                />
                By discount %
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={promotionType === 'knockedDownPrice'}
                  onChange={() => selectPromotionType('knockedDownPrice')}
                />
                By knocked-down price
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={promotionType === 'combo'}
                  onChange={() => selectPromotionType('combo')}
                />
                Combo
              </label>
            </div>
            {promotionType === 'discountPercent' && (
              <label className="block space-y-1 max-w-[10rem]">
                <span className="text-xs text-muted-foreground">Discount %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className={inputCls}
                  value={discountPercent}
                  onChange={e => setDiscountPercent(e.target.value)}
                  placeholder="10"
                />
              </label>
            )}
            {promotionType === 'discountPercent' && (
              <p className="text-[11px] text-muted-foreground">
                Tick product lines below to include them in this discount promotion.
              </p>
            )}
            {promotionType === 'knockedDownPrice' && (
              <p className="text-[11px] text-muted-foreground">
                Tick products and enter the promo price for each selected line.
              </p>
            )}
          </fieldset>

          {promotionType === 'combo' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Combo products
                </h3>
                <button
                  type="button"
                  disabled={saving}
                  onClick={addComboDraft}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add combo product
                </button>
              </div>

              {comboDrafts.map((combo, index) => (
                <div
                  key={combo.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      Combo product {index + 1}
                    </p>
                    {comboDrafts.length > 1 && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => removeComboDraft(combo.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title="Remove this combo product"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-foreground">Name of this combo product</span>
                    <input
                      className={inputCls}
                      value={combo.name}
                      onChange={e => updateComboDraft(combo.id, { name: e.target.value })}
                      placeholder="e.g. Breakfast Pack"
                      disabled={saving}
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
                    <label className="block space-y-1">
                      <span className="text-xs text-muted-foreground">Combo price</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={inputCls}
                        value={combo.comboPrice}
                        onChange={e => updateComboDraft(combo.id, { comboPrice: e.target.value })}
                        placeholder="0.00"
                        disabled={saving}
                      />
                    </label>
                    {durationMode === 'byQty' && (
                      <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">Combo packs available</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className={inputCls}
                          value={combo.comboPackQty}
                          onChange={e => updateComboDraft(combo.id, { comboPackQty: e.target.value })}
                          placeholder="Packs"
                          disabled={saving}
                        />
                      </label>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Tick two or more products and set QTY included in this combo. It appears on Sales Orders under this name.
                  </p>

                  {catalogLoading ? (
                    <div className="flex justify-center py-6"><MillstoneLoader /></div>
                  ) : products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active B2B products for this company.</p>
                  ) : (
                    <TableScrollContainer>
                      <table className="w-full min-w-[680px] text-left border-collapse">
                        <ColGroup widths={[TABLE_COL_CHECK.style.width, '32%', '18%', '14%', '16%', '14%']} />
                        <thead>
                          <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2 font-semibold border-b border-border" />
                            <th className="px-3 py-2 font-semibold border-b border-border">Product</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">Delivery unit</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">QTY on hand</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">Current RRP</th>
                            <th className="px-3 py-2 font-semibold border-b border-border">QTY in combo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map(product => {
                            const draft = combo.draftByProductId[product.id] ?? emptyProductDraft();
                            return (
                              <tr key={product.id} className="text-xs hover:bg-muted/20">
                                <td className="px-3 py-2 border-b border-border">
                                  <input
                                    type="checkbox"
                                    checked={draft.selected}
                                    disabled={saving}
                                    onChange={e => updateComboProductDraft(combo.id, product.id, {
                                      selected: e.target.checked,
                                    })}
                                  />
                                </td>
                                <td className="px-3 py-2 border-b border-border font-medium">{product.name}</td>
                                <td className="px-3 py-2 border-b border-border">
                                  {product.b2bPackageUnit?.trim() || 'pcs'}
                                </td>
                                <td className="px-3 py-2 border-b border-border">
                                  {stockByProduct[product.id] ?? 0}
                                </td>
                                <td className="px-3 py-2 border-b border-border">
                                  {rm(product.rrp ?? 0)}
                                </td>
                                <td className="px-3 py-2 border-b border-border">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className={`${inputCls} min-w-[8.5rem] w-[8.5rem] max-w-[10rem] tabular-nums text-right`}
                                    disabled={saving || !draft.selected}
                                    value={draft.qtyPerCombo}
                                    onChange={e => updateComboProductDraft(combo.id, product.id, {
                                      qtyPerCombo: e.target.value,
                                    })}
                                    placeholder="QTY"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </TableScrollContainer>
                  )}
                </div>
              ))}

              <button
                type="button"
                disabled={saving}
                onClick={addComboDraft}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30 disabled:opacity-50"
              >
                <Plus size={14} />
                Add another combo product
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                B2B products for promotion
              </h3>
              {catalogLoading ? (
                <div className="flex justify-center py-8"><MillstoneLoader /></div>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active B2B products for this company.</p>
              ) : (
                <TableScrollContainer>
                  <table className="w-full min-w-[680px] text-left border-collapse">
                    <ColGroup
                      widths={[
                        TABLE_COL_CHECK.style.width,
                        '32%',
                        '18%',
                        '14%',
                        '16%',
                        ...(durationMode === 'byQty' ? ['12%' as const] : []),
                        ...(promotionType === 'knockedDownPrice' ? ['12%' as const] : []),
                      ]}
                    />
                    <thead>
                      <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-semibold border-b border-border" />
                        <th className="px-3 py-2 font-semibold border-b border-border">Product</th>
                        <th className="px-3 py-2 font-semibold border-b border-border">Delivery unit</th>
                        <th className="px-3 py-2 font-semibold border-b border-border">QTY on hand</th>
                        <th className="px-3 py-2 font-semibold border-b border-border">Current RRP</th>
                        {durationMode === 'byQty' && (
                          <th className="px-3 py-2 font-semibold border-b border-border">Promo QTY</th>
                        )}
                        {promotionType === 'knockedDownPrice' && (
                          <th className="px-3 py-2 font-semibold border-b border-border">Promo price</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => {
                        const draft = draftByProductId[product.id] ?? emptyProductDraft();
                        return (
                          <tr key={product.id} className="text-xs hover:bg-muted/20">
                            <td className="px-3 py-2 border-b border-border">
                              <input
                                type="checkbox"
                                checked={draft.selected}
                                onChange={e => updateDraft(product.id, { selected: e.target.checked })}
                              />
                            </td>
                            <td className="px-3 py-2 border-b border-border font-medium">{product.name}</td>
                            <td className="px-3 py-2 border-b border-border">
                              {product.b2bPackageUnit?.trim() || 'pcs'}
                            </td>
                            <td className="px-3 py-2 border-b border-border">
                              {stockByProduct[product.id] ?? 0}
                            </td>
                            <td className="px-3 py-2 border-b border-border">
                              {rm(product.rrp ?? 0)}
                            </td>
                            {durationMode === 'byQty' && (
                              <td className="px-3 py-2 border-b border-border">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className={`${inputCls} min-w-[8.5rem] w-[8.5rem] max-w-[10rem] tabular-nums text-right`}
                                  disabled={!draft.selected}
                                  value={draft.promoQty}
                                  onChange={e => updateDraft(product.id, { promoQty: e.target.value })}
                                />
                              </td>
                            )}
                            {promotionType === 'knockedDownPrice' && (
                              <td className="px-3 py-2 border-b border-border">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className={`${inputCls} min-w-[8.5rem] w-[8.5rem] max-w-[10rem] tabular-nums text-right`}
                                  disabled={!draft.selected}
                                  value={draft.knockedDownPrice}
                                  onChange={e => updateDraft(product.id, { knockedDownPrice: e.target.value })}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScrollContainer>
              )}
            </div>
          )}

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          {saveOk && <p className="text-sm text-emerald-700">{saveOk}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={resetCreateForm}
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
