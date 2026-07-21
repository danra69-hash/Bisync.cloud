import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import {
  api,
  type B2bCustomer,
  type B2bSalesOrder,
  type Location,
  type Product,
} from '../../api';
import { collectTaggedB2bCustomerUnits } from '../../data/b2bCustomerProductTags';
import {
  formatCustomerAddress,
  getDefaultContact,
  parseB2bCustomerContacts,
} from '../../data/customerListData';
import { inputCls, selectCls } from '../../data/componentForm';
import type { SalesOrderCartLine } from '../../data/buildSalesOrderPdfData';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { pageShellClass } from '../layout/pageLayout';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { SalesOrderCartModal } from './SalesOrderCartModal';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  companyId: number;
  customers: B2bCustomer[];
  selectedLocationIds: string[];
  initialCustomerExternalId?: string;
  onClose: () => void;
  onSubmitted: (order: B2bSalesOrder, issued: boolean) => void;
};

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';

export function CreateB2bSalesOrderPage({
  companyId,
  customers,
  selectedLocationIds,
  initialCustomerExternalId = '',
  onClose,
  onSubmitted,
}: Props) {
  useRevMgmtPageLabel('Create Sales Order');
  const { rm } = useCountryFormatters();

  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerExternalId, setCustomerExternalId] = useState(initialCustomerExternalId);
  const [locationExternalId, setLocationExternalId] = useState('');
  const [lockPeriodDays, setLockPeriodDays] = useState('7');
  const [qtyByKey, setQtyByKey] = useState<Record<string, string>>({});
  const [priceByKey, setPriceByKey] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.locations(), api.products(companyId)])
      .then(([locs, productRows]) => {
        if (cancelled) return;
        const companyLocs = locs.filter(l => l.companyId === companyId);
        setLocations(companyLocs);
        setProducts(productRows.filter(p => p.active && p.b2bEnabled && !p.isSubProduct));
        const preferred = selectedLocationIds.find(id => companyLocs.some(l => l.externalId === id))
          ?? companyLocs[0]?.externalId
          ?? '';
        setLocationExternalId(preferred);
      })
      .catch(() => {
        if (cancelled) return;
        setLocations([]);
        setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyId, selectedLocationIds]);

  const selectedCustomer = customers.find(c => c.externalId === customerExternalId) ?? null;

  const taggedUnits = useMemo(() => {
    if (!selectedCustomer) return [];
    return collectTaggedB2bCustomerUnits(selectedCustomer, products, products);
  }, [selectedCustomer, products]);

  useEffect(() => {
    if (taggedUnits.length === 0) return;
    const productIds = new Set(taggedUnits.map(u => u.productId));
    const lockDays = [...productIds]
      .map(id => products.find(p => p.id === id)?.orderLockPeriodDays ?? 0)
      .filter(days => days > 0);
    if (lockDays.length === 0) return;
    setLockPeriodDays(String(Math.max(...lockDays)));
  }, [taggedUnits, products]);

  useEffect(() => {
    setQtyByKey({});
    setPriceByKey({});
  }, [customerExternalId]);

  useEffect(() => {
    setPriceByKey(prev => {
      const next = { ...prev };
      for (const unit of taggedUnits) {
        if (next[unit.key] == null || next[unit.key] === '') {
          const selling = unit.sellingRrp > 0 ? unit.sellingRrp : unit.rrp;
          next[unit.key] = selling > 0 ? String(selling) : '';
        }
      }
      return next;
    });
  }, [taggedUnits]);

  const cartLines: SalesOrderCartLine[] = useMemo(() => {
    return taggedUnits
      .map(unit => {
        const qty = parseFloat(qtyByKey[unit.key] ?? '');
        const fallback = unit.sellingRrp > 0 ? unit.sellingRrp : unit.rrp;
        const price = parseFloat(priceByKey[unit.key] ?? String(fallback));
        if (!Number.isFinite(qty) || qty <= 0) return null;
        const displayName = unit.aliasName?.trim() || unit.productName;
        return {
          key: unit.key,
          productId: unit.productId,
          productAliasId: unit.aliasId,
          productName: displayName,
          deliveryUom: (unit.deliveryPath && unit.deliveryPath !== '—')
            ? unit.deliveryPath
            : (unit.unitTitle || 'box'),
          quantity: qty,
          unitPrice: Number.isFinite(price) && price >= 0 ? price : 0,
          locationExternalId,
        } satisfies SalesOrderCartLine;
      })
      .filter((row): row is SalesOrderCartLine => row != null);
  }, [taggedUnits, qtyByKey, priceByKey, locationExternalId]);

  const cartCount = cartLines.length;
  const contact = selectedCustomer
    ? getDefaultContact(parseB2bCustomerContacts(selectedCustomer))
    : null;

  return (
    <div className={pageShellClass()}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to Customer List
        </button>

        <button
          type="button"
          onClick={() => setShowCart(true)}
          disabled={cartCount === 0 || !selectedCustomer}
          className="relative inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border border-emerald-700/30 bg-emerald-700/10 text-emerald-800 hover:bg-emerald-700/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="View shopping cart"
        >
          <ShoppingCart size={16} />
          <span>Shopping Cart</span>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Customer</label>
            <select
              value={customerExternalId}
              onChange={e => setCustomerExternalId(e.target.value)}
              className={selectCls}
            >
              <option value="">Select customer…</option>
              {customers.map(c => (
                <option key={c.externalId} value={c.externalId}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Production location
            </label>
            <select
              value={locationExternalId}
              onChange={e => setLocationExternalId(e.target.value)}
              className={selectCls}
            >
              <option value="">Select location…</option>
              {locations.map(l => (
                <option key={l.externalId} value={l.externalId}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Lock period (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={lockPeriodDays}
              onChange={e => setLockPeriodDays(e.target.value)}
              className={inputCls}
              title="Defaults from B2B Product lock period"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Defaults from B2B Product lock period
            </p>
          </div>
        </div>

        {selectedCustomer ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/60 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Company</p>
              <p className="font-semibold text-foreground mt-0.5">{selectedCustomer.companyName}</p>
              <p className="text-muted-foreground">{selectedCustomer.externalId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="font-medium text-foreground mt-0.5">{contact?.name || '—'}</p>
              <p className="text-muted-foreground">{selectedCustomer.phone || contact?.mobile || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="font-medium text-foreground mt-0.5">{selectedCustomer.email || contact?.email || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Address</p>
              <p className="font-medium text-foreground mt-0.5 whitespace-pre-line">
                {formatCustomerAddress(selectedCustomer) || '—'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
            Select a customer to load tagged products and client details.
          </p>
        )}
      </div>

      {loading ? (
        <MillstoneLoader size="sm" layout="block" label="Loading products…" />
      ) : !selectedCustomer ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-8 text-center">
          Choose a customer to start the sales order.
        </p>
      ) : taggedUnits.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-8 text-center">
          No products are tagged for this customer. Open My Product on the customer to tag units first.
        </p>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <TableScrollContainer className="max-h-[calc(100vh-18rem)] overflow-y-auto">
            <table className="w-full table-fixed">
              <thead className="bg-muted/30">
                <tr className="border-b border-border text-xs">
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-left font-semibold w-[18%]">Delivery UOM</th>
                  <th className="px-3 py-2 text-right font-semibold w-[12%]">QTY Box</th>
                  <th className="px-3 py-2 text-right font-semibold w-[14%]">Unit Price</th>
                  <th className="px-3 py-2 text-right font-semibold w-[14%]">Sub-total</th>
                </tr>
              </thead>
              <tbody>
                {taggedUnits.map(unit => {
                  const qty = parseFloat(qtyByKey[unit.key] ?? '');
                  const fallback = unit.sellingRrp > 0 ? unit.sellingRrp : unit.rrp;
                  const price = parseFloat(priceByKey[unit.key] ?? String(fallback));
                  const subtotal = Number.isFinite(qty) && qty > 0 && Number.isFinite(price)
                    ? qty * price
                    : 0;
                  const displayName = unit.aliasName?.trim() || unit.productName;
                  return (
                    <tr key={unit.key} className="hover:bg-muted/20">
                      <td className={tdCls}>
                        <p className="font-medium text-foreground">{displayName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {unit.productCode}
                          {unit.aliasName ? ` · Alias of ${unit.productName}` : ''}
                        </p>
                      </td>
                      <td className={`${tdCls} text-muted-foreground`}>
                        {(unit.deliveryPath && unit.deliveryPath !== '—')
                          ? unit.deliveryPath
                          : (unit.unitTitle || '—')}
                      </td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={qtyByKey[unit.key] ?? ''}
                          onChange={e => setQtyByKey(prev => ({ ...prev, [unit.key]: e.target.value }))}
                          placeholder="0"
                          className="w-full text-right px-2 py-1.5 text-xs rounded-md border border-border bg-background"
                        />
                      </td>
                      <td className={tdCls}>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={priceByKey[unit.key] ?? ''}
                          onChange={e => setPriceByKey(prev => ({ ...prev, [unit.key]: e.target.value }))}
                          className="w-full text-right px-2 py-1.5 text-xs rounded-md border border-border bg-background"
                        />
                      </td>
                      <td className={`${tdCls} text-right font-semibold`}>
                        {subtotal > 0 ? rm(subtotal) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      )}

      {showCart && selectedCustomer && cartCount > 0 ? (
        <SalesOrderCartModal
          companyId={companyId}
          customer={selectedCustomer}
          lines={cartLines}
          locationExternalId={locationExternalId}
          lockPeriodDays={Math.max(1, parseInt(lockPeriodDays, 10) || 7)}
          onClose={() => setShowCart(false)}
          onSubmitted={(order, issued) => {
            setShowCart(false);
            onSubmitted(order, issued);
          }}
        />
      ) : null}
    </div>
  );
}
