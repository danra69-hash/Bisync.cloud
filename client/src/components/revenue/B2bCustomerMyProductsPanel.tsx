import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api, type B2bCustomer, type Product } from '../../api';
import {
  b2bCustomerToPayload,
  parseB2bCustomerContacts,
  parseB2bPurchaseHistory,
  parseTaggedProductIds,
} from '../../data/customerListData';
import { calcProductCogs, formatCogsPercent } from '../../data/productForm';
import { parseB2bSalesConfigJson, resolvePrincipalB2bRrp } from '../../data/productB2bSales';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_STANDARD_CLS } from '../layout/sidePanelShared';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  customer: B2bCustomer;
  companyId: number;
  onClose: () => void;
  onSaved: (customer: B2bCustomer) => void;
};

type ProductRow = {
  product: Product;
  rrp: number;
  cogs: number;
  cogsPercent: string;
  tagged: boolean;
};

export function B2bCustomerMyProductsPanel({ customer, companyId, onClose, onSaved }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [taggedIds, setTaggedIds] = useState<number[]>(() => parseTaggedProductIds(customer));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTaggedIds(parseTaggedProductIds(customer));
  }, [customer]);

  useEffect(() => {
    setLoading(true);
    api.products(companyId)
      .then(rows => setProducts(rows.filter(p => p.b2bEnabled && p.active)))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const rows = useMemo((): ProductRow[] => {
    return products.map(product => {
      const config = parseB2bSalesConfigJson(product.b2bSalesConfigJson);
      const rrp = resolvePrincipalB2bRrp(config, product.rrp);
      const cogs = calcProductCogs(product.totalCost, product.packagingCost ?? 0, product);
      return {
        product,
        rrp,
        cogs,
        cogsPercent: formatCogsPercent(cogs, rrp),
        tagged: taggedIds.includes(product.id),
      };
    }).sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [products, taggedIds]);

  function toggleProduct(productId: number) {
    setTaggedIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId],
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = b2bCustomerToPayload(
        customer,
        parseB2bCustomerContacts(customer),
        taggedIds,
        parseB2bPurchaseHistory(customer),
      );
      const saved = await api.updateB2bCustomer(customer.externalId, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tagged products.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_STANDARD_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">My Product</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{customer.companyName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tag B2B products supplied to this customer</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading B2B products…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No B2B-enabled products found for this company.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <TableHeaderCell>Tag</TableHeaderCell>
                  <TableHeaderCell>Product</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">COGS</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">COGS %</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.product.id} className="border-b border-border/50">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={row.tagged}
                        onChange={() => toggleProduct(row.product.id)}
                        aria-label={`Tag ${row.product.name}`}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <p className="font-medium">{row.product.name}</p>
                      <p className="text-[10px] text-muted-foreground">{row.product.productId}</p>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.rrp.toFixed(2)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{row.cogs.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{row.cogsPercent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {error ? <p className="text-xs text-destructive mt-3">{error}</p> : null}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">
            Close
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Tags'}
          </button>
        </div>
      </div>
    </>
  );
}
