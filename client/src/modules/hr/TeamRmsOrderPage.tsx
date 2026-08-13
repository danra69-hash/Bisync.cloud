import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { api, setApiTenantCompanyId, type Company, type Location, type Vendor } from '../../api';
import { ingredientToRow } from '../../components/revenue/smartIngredientShared';
import {
  buildCreateOrderLines,
  combineReturnableDepositLines,
  formatRm,
  groupCartByVendor,
  resolveVendorsForSelectedLocations,
  type CreateOrderLine,
  type OrderCartItem,
} from '../../data/createOrder';
import { refreshVendorProductCatalog } from '../../data/vendorProductCatalog';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';

type Props = {
  employeeName: string;
};

type CartQty = Record<string, number>;
type CartPrice = Record<string, number>;

function formatInv(value: number | null | undefined, uom: string): string {
  if (value == null || !Number.isFinite(value)) return `— ${uom}`.trim();
  const n = Math.round(value * 1000) / 1000;
  return `${n} ${uom}`.trim();
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultDeliveryDateValue(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return toDateInputValue(date);
}

function buildCartItemsFromEntries(
  entries: { line: CreateOrderLine; qty: number; price: number }[],
): OrderCartItem[] {
  const expanded = entries.flatMap(({ line, qty, price }) => {
    if (qty <= 0) return [];
    const productLine: OrderCartItem = {
      lineKey: line.key,
      componentId: line.component.componentId,
      componentName: line.component.name,
      componentUom: line.component.inventoryUOM,
      vendorProductId: line.vendorProduct.id,
      vendorExternalId: line.vendorProduct.vendorExternalId,
      vendorName: line.vendorProduct.vendorName,
      productName: line.vendorProduct.productName,
      deliveryUnitLabel: line.deliveryUnitLabel,
      deliveryPrice: price,
      quantity: qty,
      lineTotal: qty * price,
    };

    const vp = line.vendorProduct;
    const depositName = (vp.returnableItemName ?? '').trim();
    const depositUom = (vp.returnableUom ?? '').trim();
    const depositAmount = Number(vp.returnableDepositAmount ?? 0);
    if (
      vp.returnableDeposit
      && depositName
      && depositUom
      && Number.isFinite(depositAmount)
      && depositAmount >= 0
    ) {
      return [
        productLine,
        {
          lineKey: `${line.key}::returnable`,
          componentId: '',
          componentName: depositName,
          componentUom: depositUom,
          vendorProductId: vp.id,
          vendorExternalId: vp.vendorExternalId,
          vendorName: vp.vendorName,
          productName: depositName,
          deliveryUnitLabel: depositUom,
          deliveryPrice: depositAmount,
          quantity: qty,
          lineTotal: qty * depositAmount,
          isReturnableDeposit: true,
          returnableItemName: depositName,
        },
      ];
    }

    return [productLine];
  });

  return combineReturnableDepositLines(expanded);
}

export function TeamRmsOrderPage({ employeeName }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [components, setComponents] = useState<ReturnType<typeof ingredientToRow>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [groupFilter, setGroupFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [cartQty, setCartQty] = useState<CartQty>({});
  const [cartPrice, setCartPrice] = useState<CartPrice>({});
  const [cartLinesByKey, setCartLinesByKey] = useState<Record<string, CreateOrderLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDateValue);
  const [creating, setCreating] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [createdPoNumbers, setCreatedPoNumbers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await Promise.all([
          refreshVendorProductCatalog().catch(() => []),
          refreshVendorProductPricesFromApi().catch(() => undefined),
        ]);
        const [cos, locs] = await Promise.all([
          api.companies(),
          api.locations(),
        ]);
        if (cancelled) return;
        setCompanies(Array.isArray(cos) ? cos : []);
        setLocations(Array.isArray(locs) ? locs : []);
        const stored = Number(localStorage.getItem('bisync.selectedCompanyId') || 0);
        const pick = (Array.isArray(cos) ? cos : []).find(c => c.id === stored)
          ?? (Array.isArray(cos) ? cos[0] : null);
        if (pick) {
          setCompanyId(pick.id);
          setApiTenantCompanyId(pick.id);
          const locForCo = (Array.isArray(locs) ? locs : [])
            .filter(l => l.companyId == null || l.companyId === pick.id);
          setLocationIds(locForCo.map(l => l.externalId).filter(Boolean));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load order catalog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!companyId) {
      setVendors([]);
      setComponents([]);
      return;
    }
    setApiTenantCompanyId(companyId);
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [vList, ingredients] = await Promise.all([
          api.vendors(true, companyId),
          api.ingredients(companyId, locationIds.length > 0 ? locationIds : undefined),
        ]);
        if (cancelled) return;
        setVendors(Array.isArray(vList) ? vList : []);
        setComponents((Array.isArray(ingredients) ? ingredients : []).map(ingredientToRow));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load products.');
          setVendors([]);
          setComponents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, locationIds]);

  const categoryOptions = useMemo(() => {
    const set = new Set(components.map(c => c.category).filter(Boolean));
    return ['All', ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [components]);

  const groupOptions = useMemo(() => {
    const source = categoryFilter !== 'All'
      ? components.filter(c =>
        (c.category ?? '').trim().toLowerCase() === categoryFilter.trim().toLowerCase())
      : components;
    const set = new Set(source.map(c => c.group).filter(Boolean));
    return ['All', ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [components, categoryFilter]);

  const vendorOptions = useMemo(
    () => resolveVendorsForSelectedLocations(components, locationIds, vendors, [], companyId),
    [components, locationIds, vendors, companyId],
  );

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendorOptions;
    return vendorOptions.filter(v =>
      v.name.toLowerCase().includes(q)
      || (v.externalId || '').toLowerCase().includes(q),
    );
  }, [vendorOptions, vendorSearch]);

  const filterReady = categoryFilter !== 'All' || groupFilter !== 'All' || Boolean(vendorFilter);

  const lines = useMemo(() => {
    if (!filterReady || locationIds.length === 0) return [] as CreateOrderLine[];
    const built = buildCreateOrderLines(
      components,
      locationIds,
      vendorFilter,
      categoryFilter,
      search,
      vendors,
      [],
    );
    return built
      .filter(line => groupFilter === 'All' || line.component.group === groupFilter)
      .map(line => ({
        ...line,
        stockOnHand: Number.isFinite(line.component.onHandQty) ? Number(line.component.onHandQty) : null,
        parStock: (line.component.parStock && line.component.parStock > 0)
          ? line.component.parStock
          : line.parStock,
        parStockUom: line.component.parStockUom
          || line.component.inventoryUOM
          || line.parStockUom,
      }));
  }, [
    filterReady,
    components,
    locationIds,
    vendorFilter,
    categoryFilter,
    groupFilter,
    search,
    vendors,
  ]);

  const cartCount = useMemo(
    () => Object.values(cartQty).filter(q => q > 0).length,
    [cartQty],
  );

  const cartEntries = useMemo(() => {
    return Object.entries(cartQty)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const line = cartLinesByKey[key] ?? lines.find(l => l.key === key);
        if (!line) return null;
        const price = cartPrice[key] ?? line.deliveryPrice;
        return { line, qty, price };
      })
      .filter((row): row is { line: CreateOrderLine; qty: number; price: number } => Boolean(row));
  }, [cartQty, cartPrice, cartLinesByKey, lines]);

  const cartGroups = useMemo(
    () => groupCartByVendor(buildCartItemsFromEntries(cartEntries)),
    [cartEntries],
  );

  const cartGrandTotal = useMemo(
    () => cartGroups.reduce((sum, g) => sum + g.subtotal, 0),
    [cartGroups],
  );

  function clearCart() {
    setCartQty({});
    setCartPrice({});
    setCartLinesByKey({});
  }

  function setQty(line: CreateOrderLine, next: number) {
    const qty = Math.max(0, Math.round(next));
    const key = line.key;
    setCartQty(prev => {
      if (qty <= 0) {
        if (!(key in prev)) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: qty };
    });
    setCartLinesByKey(prev => {
      if (qty <= 0) {
        if (!(key in prev)) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: line };
    });
    setCartPrice(prev => {
      if (qty <= 0) {
        if (!(key in prev)) return prev;
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      if (key in prev) return prev;
      return { ...prev, [key]: line.deliveryPrice };
    });
  }

  function setReviewQty(key: string, next: number) {
    const line = cartLinesByKey[key];
    if (!line) return;
    setQty(line, next);
  }

  function setReviewPrice(key: string, raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const value = Number(cleaned);
    if (!Number.isFinite(value) || value < 0) {
      setCartPrice(prev => ({ ...prev, [key]: 0 }));
      return;
    }
    setCartPrice(prev => ({ ...prev, [key]: value }));
  }

  async function handleCreatePo() {
    if (!companyId) {
      setCartError('Select a company before creating a PO.');
      return;
    }
    if (locationIds.length === 0) {
      setCartError('Select at least one location before creating a PO.');
      return;
    }
    if (cartEntries.length === 0) {
      setCartError('Add vendor products to the cart first.');
      return;
    }
    if (!deliveryDate) {
      setCartError('Choose a preferred delivery date.');
      return;
    }
    const delivery = new Date(`${deliveryDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(delivery.getTime()) || delivery < today) {
      setCartError('Preferred delivery date cannot be in the past.');
      return;
    }

    const items = buildCartItemsFromEntries(cartEntries);
    const groups = groupCartByVendor(items);
    if (groups.length === 0) {
      setCartError('Nothing to submit.');
      return;
    }

    const initiatedBy = (employeeName || 'Team').trim() || 'Team';
    const orderDateStr = toDateInputValue(new Date());

    setCreating(true);
    setCartError(null);
    try {
      const created = await api.createPurchaseOrders({
        companyId,
        locationExternalIds: locationIds,
        initiatedBy,
        approvedBy: '',
        orders: groups.map(group => ({
          vendorName: group.vendorName,
          vendorExternalId: group.vendorExternalId,
          documentType: 'PR',
          orderDate: orderDateStr,
          deliveryDate,
          status: 'Pending Approval',
          items: group.items.map(item => ({
            componentId: item.componentId,
            componentName: item.componentName,
            vendorProductId: item.vendorProductId,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.deliveryPrice,
            unit: item.deliveryUnitLabel,
            componentUom: item.componentUom,
            deliveryPackage: item.deliveryUnitLabel,
            isReturnableDeposit: item.isReturnableDeposit || undefined,
            returnableItemName: item.isReturnableDeposit
              ? (item.returnableItemName || item.productName)
              : undefined,
          })),
        })),
      });

      if (!Array.isArray(created) || created.length === 0) {
        throw new Error('Failed to create purchase order.');
      }

      setCreatedPoNumbers(created.map(po => po.poNumber || `PO-${po.id}`));
      clearCart();
    } catch (err) {
      setCartError(err instanceof Error ? err.message : 'Failed to create purchase order.');
    } finally {
      setCreating(false);
    }
  }

  const selectedVendorName = vendorOptions.find(v => v.externalId === vendorFilter)?.name ?? '';

  const companyLocations = useMemo(
    () => locations.filter(l => companyId == null || l.companyId == null || l.companyId === companyId),
    [locations, companyId],
  );

  return (
    <section className="team-card team-rms-order">
      <header className="team-rms-order-head">
        <div>
          <h3>Order</h3>
          <p className="team-muted" style={{ margin: 0, fontSize: 11 }}>
            {employeeName ? `Ordering as ${employeeName}` : 'Vendor product ordering'}
          </p>
        </div>
        <button
          type="button"
          className="team-rms-cart-btn"
          onClick={() => {
            setCartError(null);
            setCreatedPoNumbers([]);
            setCartOpen(true);
          }}
          aria-label={`Cart · ${cartCount} products`}
        >
          <ShoppingCart size={18} />
          <span className="team-rms-cart-count">{cartCount}</span>
        </button>
      </header>

      {companies.length > 1 ? (
        <label className="team-field" style={{ marginBottom: 8 }}>
          <span>Company</span>
          <select
            value={companyId ?? ''}
            onChange={e => {
              const id = Number(e.target.value) || null;
              setCompanyId(id);
              if (id) setApiTenantCompanyId(id);
              const locForCo = locations.filter(l => l.companyId == null || l.companyId === id);
              setLocationIds(locForCo.map(l => l.externalId).filter(Boolean));
              clearCart();
            }}
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {companyLocations.length > 1 ? (
        <label className="team-field" style={{ marginBottom: 8 }}>
          <span>Location</span>
          <select
            value={locationIds[0] ?? ''}
            onChange={e => {
              const id = e.target.value;
              setLocationIds(id ? [id] : companyLocations.map(l => l.externalId));
              clearCart();
            }}
          >
            <option value="">All locations</option>
            {companyLocations.map(l => (
              <option key={l.externalId} value={l.externalId}>{l.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="team-rms-filters">
        <label className="team-field">
          <span>Category</span>
          <select
            value={categoryFilter}
            onChange={e => {
              setCategoryFilter(e.target.value);
              setGroupFilter('All');
            }}
          >
            {categoryOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <label className="team-field">
          <span>Group</span>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
            {groupOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="team-field team-rms-search">
        <span>Search</span>
        <div className="team-rms-search-wrap">
          <Search size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Component or product name…"
          />
        </div>
      </label>

      <div className="team-rms-vendor-filter">
        <button
          type="button"
          className={`team-rms-vendor-btn${vendorFilter ? ' is-set' : ''}`}
          onClick={() => {
            setVendorSearch('');
            setVendorPickerOpen(true);
          }}
        >
          <span>Vendor</span>
          <strong>{vendorFilter ? selectedVendorName : 'All vendors'}</strong>
        </button>
        {vendorFilter ? (
          <button
            type="button"
            className="team-btn-ghost"
            aria-label="Clear vendor"
            onClick={() => setVendorFilter('')}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {loading ? <p className="team-muted">Loading catalog…</p> : null}
      {error ? <p className="team-inline-error">{error}</p> : null}

      {!loading && !filterReady ? (
        <p className="team-muted" style={{ textAlign: 'center', margin: '16px 0 0' }}>
          Select a category, group, or vendor to list products.
        </p>
      ) : null}

      {!loading && filterReady && lines.length === 0 ? (
        <p className="team-muted" style={{ textAlign: 'center', margin: '16px 0 0' }}>
          No vendor products match this filter.
        </p>
      ) : null}

      <ul className="team-rms-product-list">
        {lines.map(line => {
          const qty = cartQty[line.key] ?? 0;
          const uom = line.parStockUom || line.component.inventoryUOM || '';
          return (
            <li key={line.key} className="team-rms-product">
              <div className="team-rms-product-main">
                <div className="team-rms-product-title">
                  <strong>{line.vendorProduct.productName}</strong>
                  <span className="team-muted">{line.vendorProduct.id}</span>
                </div>
                <div className="team-rms-product-meta">
                  <span>{line.deliveryUnitLabel || '—'}</span>
                  <span>{formatRm(line.deliveryPrice)}</span>
                </div>
                <div className="team-rms-qty">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQty(line, qty - 1)}
                    disabled={qty <= 0}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    inputMode="numeric"
                    value={qty > 0 ? String(qty) : ''}
                    placeholder="0"
                    onChange={e => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      setQty(line, raw ? Number(raw) : 0);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQty(line, qty + 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="team-rms-product-stats">
                <span>
                  <em>On hand</em>
                  {formatInv(line.stockOnHand, uom)}
                </span>
                <span>
                  <em>AVG usage</em>
                  {formatInv(line.component.dailyUsage, `${uom}/day`)}
                </span>
                <span>
                  <em>Parstock</em>
                  {formatInv(line.parStock, uom)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {vendorPickerOpen ? (
        <div className="team-modal-backdrop" role="presentation" onClick={() => setVendorPickerOpen(false)}>
          <div className="team-modal team-rms-vendor-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>Vendor filter</h3>
              <button type="button" className="team-btn-ghost" onClick={() => setVendorPickerOpen(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="team-rms-search-wrap" style={{ marginTop: 10 }}>
              <Search size={14} />
              <input
                autoFocus
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                placeholder="Search vendors…"
              />
            </div>
            <ul className="team-rms-vendor-list">
              <li>
                <button
                  type="button"
                  className={!vendorFilter ? 'is-active' : ''}
                  onClick={() => {
                    setVendorFilter('');
                    setVendorPickerOpen(false);
                  }}
                >
                  All vendors
                </button>
              </li>
              {filteredVendors.map(v => (
                <li key={v.externalId}>
                  <button
                    type="button"
                    className={vendorFilter === v.externalId ? 'is-active' : ''}
                    onClick={() => {
                      setVendorFilter(v.externalId);
                      setVendorPickerOpen(false);
                    }}
                  >
                    <strong>{v.name}</strong>
                    <span className="team-muted">{v.externalId}</span>
                  </button>
                </li>
              ))}
              {filteredVendors.length === 0 ? (
                <li className="team-muted" style={{ padding: 10, textAlign: 'center' }}>No vendors found.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      {cartOpen ? (
        <div
          className="team-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!creating) setCartOpen(false);
          }}
        >
          <div
            className="team-modal team-rms-cart-modal"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0 }}>
                {createdPoNumbers.length > 0 ? 'PO created' : `Review order · ${cartCount}`}
              </h3>
              <button
                type="button"
                className="team-btn-ghost"
                disabled={creating}
                onClick={() => setCartOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {createdPoNumbers.length > 0 ? (
              <>
                <p className="team-muted" style={{ margin: '10px 0 0' }}>
                  Purchase request{createdPoNumbers.length === 1 ? '' : 's'} submitted for approval,
                  split by vendor.
                </p>
                <ul className="team-rm-list" style={{ marginTop: 10 }}>
                  {createdPoNumbers.map(num => (
                    <li key={num} className="team-rm-list-item">
                      <div>
                        <strong>{num}</strong>
                        <span className="team-muted">Pending Approval</span>
                      </div>
                      <span className="team-rm-status is-warn">PR</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="team-btn team-btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setCreatedPoNumbers([]);
                    setCartOpen(false);
                  }}
                >
                  Done
                </button>
              </>
            ) : cartCount === 0 ? (
              <p className="team-muted" style={{ margin: '12px 0 0', textAlign: 'center' }}>
                No vendor products added yet. Adjust QTY on a product to add it.
              </p>
            ) : (
              <>
                <label className="team-field" style={{ marginTop: 10 }}>
                  <span>Preferred delivery date</span>
                  <input
                    type="date"
                    value={deliveryDate}
                    min={toDateInputValue(new Date())}
                    onChange={e => setDeliveryDate(e.target.value)}
                  />
                </label>

                <div className="team-rms-cart-groups">
                  {cartGroups.map(group => (
                    <div key={group.vendorExternalId || group.vendorName} className="team-rms-cart-group">
                      <header>
                        <strong>{group.vendorName}</strong>
                        <span>{formatRm(group.subtotal)}</span>
                      </header>
                      <ul>
                        {group.items.filter(item => !item.isReturnableDeposit).map(item => {
                          const key = item.lineKey;
                          const qty = cartQty[key] ?? item.quantity;
                          const price = cartPrice[key] ?? item.deliveryPrice;
                          return (
                            <li key={key}>
                              <div className="team-rms-cart-line-head">
                                <strong>{item.productName}</strong>
                                <span className="team-muted">
                                  {item.vendorProductId}
                                  {' · '}
                                  {item.deliveryUnitLabel}
                                </span>
                              </div>
                              <div className="team-rms-cart-edit">
                                <label>
                                  <span>QTY</span>
                                  <div className="team-rms-qty">
                                    <button
                                      type="button"
                                      aria-label="Decrease quantity"
                                      onClick={() => setReviewQty(key, qty - 1)}
                                      disabled={qty <= 0 || creating}
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <input
                                      inputMode="numeric"
                                      value={String(qty)}
                                      disabled={creating}
                                      onChange={e => {
                                        const raw = e.target.value.replace(/[^\d]/g, '');
                                        setReviewQty(key, raw ? Number(raw) : 0);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      aria-label="Increase quantity"
                                      disabled={creating}
                                      onClick={() => setReviewQty(key, qty + 1)}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </label>
                                <label>
                                  <span>Price</span>
                                  <input
                                    className="team-rms-price-input"
                                    inputMode="decimal"
                                    value={String(price)}
                                    disabled={creating}
                                    onChange={e => setReviewPrice(key, e.target.value)}
                                  />
                                </label>
                                <div className="team-rms-cart-line-total">
                                  <span>Line</span>
                                  <strong>{formatRm(qty * price)}</strong>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="team-rms-cart-footer">
                  <div>
                    <span className="team-muted">Grand total</span>
                    <strong>{formatRm(cartGrandTotal)}</strong>
                  </div>
                  <p className="team-muted" style={{ margin: 0, fontSize: 10 }}>
                    Creates one PR per vendor from the products in this cart.
                  </p>
                </div>

                {cartError ? <p className="team-inline-error">{cartError}</p> : null}

                <div className="team-modal-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="team-btn team-btn-secondary"
                    disabled={creating}
                    onClick={() => setCartOpen(false)}
                  >
                    Keep shopping
                  </button>
                  <button
                    type="button"
                    className="team-btn team-btn-primary"
                    disabled={creating || cartCount === 0}
                    onClick={() => void handleCreatePo()}
                  >
                    {creating ? 'Creating…' : 'Create PO'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
