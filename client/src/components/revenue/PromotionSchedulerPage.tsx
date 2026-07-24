import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type Product,
  type ProductManagementSummary,
  type Promotion,
} from '../../api';
import { inputCls } from '../../data/countries';
import { pageShellClass } from '../layout/pageLayout';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

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
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState('');
  const [promotionType, setPromotionType] = useState<PromotionType>('discountPercent');
  const [discountPercent, setDiscountPercent] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [comboPackQty, setComboPackQty] = useState('');
  const [draftByProductId, setDraftByProductId] = useState<Record<number, ProductDraft>>({});
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
        setDraftByProductId(prev => {
          const next = { ...prev };
          for (const p of b2b) {
            if (!next[p.id]) {
              next[p.id] = { selected: false, promoQty: '', knockedDownPrice: '', qtyPerCombo: '' };
            }
          }
          return next;
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
    setStartDate(toDateInputValue(new Date()));
    setEndDate('');
    setPromotionType('discountPercent');
    setDiscountPercent('');
    setComboPrice('');
    setComboPackQty('');
    setDraftByProductId(prev => {
      const next: Record<number, ProductDraft> = {};
      for (const id of Object.keys(prev)) {
        next[Number(id)] = { selected: false, promoQty: '', knockedDownPrice: '', qtyPerCombo: '' };
      }
      return next;
    });
    setSaveError(null);
  };

  const updateDraft = (productId: number, patch: Partial<ProductDraft>) => {
    setDraftByProductId(prev => ({
      ...prev,
      [productId]: {
        selected: prev[productId]?.selected ?? false,
        promoQty: prev[productId]?.promoQty ?? '',
        knockedDownPrice: prev[productId]?.knockedDownPrice ?? '',
        qtyPerCombo: prev[productId]?.qtyPerCombo ?? '',
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaveError(null);
    setSaveOk(null);

    const selectedProducts = products
      .filter(p => draftByProductId[p.id]?.selected)
      .map(p => {
        const draft = draftByProductId[p.id];
        return {
          productId: p.id,
          promoQty: durationMode === 'byQty' && promotionType !== 'combo'
            ? parseFloat(draft?.promoQty ?? '')
            : undefined,
          knockedDownPrice: promotionType === 'knockedDownPrice'
            ? parseFloat(draft?.knockedDownPrice ?? '')
            : undefined,
          qtyPerCombo: promotionType === 'combo'
            ? parseFloat(draft?.qtyPerCombo ?? '')
            : undefined,
        };
      });

    if (!name.trim()) {
      setSaveError('Promotion name is required.');
      return;
    }
    if (!startDate) {
      setSaveError('Promotion start date is required.');
      return;
    }
    if (durationMode === 'byDate' && !endDate) {
      setSaveError('End date is required when duration is By Date.');
      return;
    }
    if (promotionType === 'discountPercent') {
      const pct = parseFloat(discountPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        setSaveError('Enter a discount percentage between 0 and 100.');
        return;
      }
    }
    if (promotionType === 'combo') {
      const price = parseFloat(comboPrice);
      if (!Number.isFinite(price) || price < 0) {
        setSaveError('Enter a combo price.');
        return;
      }
      if (selectedProducts.length < 2) {
        setSaveError('Add at least two products to the combo bucket.');
        return;
      }
      if (selectedProducts.some(p => !Number.isFinite(p.qtyPerCombo) || (p.qtyPerCombo ?? 0) <= 0)) {
        setSaveError('Enter QTY in combo for each selected product.');
        return;
      }
      if (durationMode === 'byQty') {
        const packs = parseFloat(comboPackQty);
        if (!Number.isFinite(packs) || packs <= 0) {
          setSaveError('Enter how many combo packs are available.');
          return;
        }
      }
    } else {
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
        comboPrice: promotionType === 'combo' ? parseFloat(comboPrice) : undefined,
        comboPackQty: promotionType === 'combo' && durationMode === 'byQty'
          ? parseFloat(comboPackQty)
          : undefined,
        products: selectedProducts.map(p => ({
          productId: p.productId,
          promoQty: promotionType !== 'combo' && durationMode === 'byQty' ? p.promoQty : undefined,
          knockedDownPrice: promotionType === 'knockedDownPrice' ? p.knockedDownPrice : undefined,
          qtyPerCombo: promotionType === 'combo' ? p.qtyPerCombo : undefined,
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
      // keep list as-is; surface via reload error if needed
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
                  onChange={() => setPromotionType('discountPercent')}
                />
                By discount %
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={promotionType === 'knockedDownPrice'}
                  onChange={() => setPromotionType('knockedDownPrice')}
                />
                By knocked-down price
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={promotionType === 'combo'}
                  onChange={() => setPromotionType('combo')}
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
            {promotionType === 'combo' && (
              <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Combo price</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={inputCls}
                    value={comboPrice}
                    onChange={e => setComboPrice(e.target.value)}
                    placeholder="0.00"
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
                      value={comboPackQty}
                      onChange={e => setComboPackQty(e.target.value)}
                      placeholder="Packs"
                    />
                  </label>
                )}
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  Add two or more products with QTY in each combo. The combo appears on Sales Orders as one selectable item; selling depletes each product by its QTY × packs sold.
                </p>
              </div>
            )}
          </fieldset>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {promotionType === 'combo' ? 'Combo bucket' : 'B2B products for promotion'}
            </h3>
            {catalogLoading ? (
              <div className="flex justify-center py-8"><MillstoneLoader /></div>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active B2B products for this company.</p>
            ) : (
              <TableScrollContainer>
                <table className="w-full min-w-[680px] text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-semibold border-b border-border w-10" />
                      <th className="px-3 py-2 font-semibold border-b border-border">Product</th>
                      <th className="px-3 py-2 font-semibold border-b border-border">Delivery unit</th>
                      <th className="px-3 py-2 font-semibold border-b border-border">QTY on hand</th>
                      <th className="px-3 py-2 font-semibold border-b border-border">Current RRP</th>
                      {promotionType === 'combo' ? (
                        <th className="px-3 py-2 font-semibold border-b border-border">QTY in combo</th>
                      ) : (
                        <>
                          {durationMode === 'byQty' && (
                            <th className="px-3 py-2 font-semibold border-b border-border">Promo QTY</th>
                          )}
                          {promotionType === 'knockedDownPrice' && (
                            <th className="px-3 py-2 font-semibold border-b border-border">Promo price</th>
                          )}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => {
                      const draft = draftByProductId[product.id] ?? {
                        selected: false,
                        promoQty: '',
                        knockedDownPrice: '',
                        qtyPerCombo: '',
                      };
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
                          {promotionType === 'combo' ? (
                            <td className="px-3 py-2 border-b border-border">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                className={`${inputCls} min-w-[5rem]`}
                                disabled={!draft.selected}
                                value={draft.qtyPerCombo}
                                onChange={e => updateDraft(product.id, { qtyPerCombo: e.target.value })}
                                placeholder="QTY"
                              />
                            </td>
                          ) : (
                            <>
                              {durationMode === 'byQty' && (
                                <td className="px-3 py-2 border-b border-border">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className={`${inputCls} min-w-[5rem]`}
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
                                    className={`${inputCls} min-w-[5rem]`}
                                    disabled={!draft.selected}
                                    value={draft.knockedDownPrice}
                                    onChange={e => updateDraft(product.id, { knockedDownPrice: e.target.value })}
                                  />
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScrollContainer>
            )}
          </div>

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
