import { Fragment, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api, type B2bCustomer, type Product } from '../../api';
import {
  b2bCustomerToPayload,
  parseB2bCustomerContacts,
  parseB2bPurchaseHistory,
} from '../../data/customerListData';
import {
  collectB2bCustomerTaggableUnits,
  deriveLegacyB2bProductTags,
  groupB2bCustomerTaggableUnits,
  isTaggedB2bProductUnit,
  parseTaggedB2bProductUnits,
  productsMissingSavedAliases,
  toggleTaggedB2bProductUnit,
  type TaggedB2bProductUnit,
} from '../../data/b2bCustomerProductTags';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_STANDARD_CLS } from '../layout/sidePanelShared';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  customer: B2bCustomer;
  companyId: number;
  onClose: () => void;
  onSaved: (customer: B2bCustomer) => void;
};

export function B2bCustomerMyProductsPanel({ customer, companyId, onClose, onSaved }: Props) {
  const { number, cogsPercent } = useCountryFormatters();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [taggedUnits, setTaggedUnits] = useState<TaggedB2bProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.products(companyId)
      .then(rows => {
        const b2bProducts = rows.filter(product => product.b2bEnabled && product.active);
        setCatalogProducts(rows);
        setProducts(b2bProducts);
        setTaggedUnits(parseTaggedB2bProductUnits(customer, b2bProducts, rows));
      })
      .catch(() => {
        setCatalogProducts([]);
        setProducts([]);
        setTaggedUnits(parseTaggedB2bProductUnits(customer, [], []));
      })
      .finally(() => setLoading(false));
  }, [companyId, customer]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const rows = useMemo(
    () => collectB2bCustomerTaggableUnits(products, catalogProducts),
    [products, catalogProducts],
  );
  const groups = useMemo(() => groupB2bCustomerTaggableUnits(rows), [rows]);
  const productsWithoutAliases = useMemo(() => productsMissingSavedAliases(products), [products]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const legacy = deriveLegacyB2bProductTags(taggedUnits);
      const payload = b2bCustomerToPayload(
        customer,
        parseB2bCustomerContacts(customer),
        legacy.taggedProductIds,
        legacy.taggedProductAliasIds,
        parseB2bPurchaseHistory(customer),
        taggedUnits,
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
            <p className="text-xs text-muted-foreground mt-0.5">
              Tag delivery units smallest to largest. Principal and alias tags are mutually exclusive per product.
              Product aliases appear here after they are saved on the Products page.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading B2B products…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No B2B-enabled products with delivery units found for this company.</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <TableHeaderCell>Tag</TableHeaderCell>
                    <TableHeaderCell>Product / Alias</TableHeaderCell>
                    <TableHeaderCell>Delivery Unit</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">RRP</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">COGS</TableHeaderCell>
                    <TableHeaderCell headerAlign="right">COGS %</TableHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => (
                    <Fragment key={group.key}>
                      <tr className="bg-muted/25 border-b border-border/60">
                        <td colSpan={6} className="py-2 px-2">
                          {group.aliasId == null ? (
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                              {group.productName}
                              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                                {' '}· {group.productCode} · Principal
                              </span>
                            </p>
                          ) : (
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary pl-3">
                              ↳ {group.aliasName}
                              <span className="font-normal text-muted-foreground normal-case tracking-normal">
                                {' '}· {group.productName} · Alias
                              </span>
                            </p>
                          )}
                        </td>
                      </tr>
                      {group.units.map(row => {
                        const tagged = isTaggedB2bProductUnit(
                          taggedUnits,
                          row.productId,
                          row.aliasId,
                          row.unitKey,
                        );
                        const unitTag: TaggedB2bProductUnit = {
                          productId: row.productId,
                          aliasId: row.aliasId,
                          unitKey: row.unitKey,
                        };

                        return (
                          <tr key={row.key} className="border-b border-border/50">
                            <td className="py-2 pr-2 align-top">
                              <input
                                type="checkbox"
                                checked={tagged}
                                onChange={() => setTaggedUnits(prev => toggleTaggedB2bProductUnit(prev, unitTag))}
                                aria-label={`Tag ${group.aliasName ?? group.productName} ${row.unitTitle}`}
                              />
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <p className={`font-medium ${group.aliasId != null ? 'pl-3 text-primary' : ''}`}>
                                {group.aliasId != null ? group.aliasName : group.productName}
                              </p>
                              <p className={`text-[10px] text-muted-foreground ${group.aliasId != null ? 'pl-3' : ''}`}>
                                {group.productCode}
                                {group.aliasId != null ? ' · Alias' : ''}
                              </p>
                            </td>
                            <td className="py-2 pr-2 align-top">
                              <p className="font-medium">{row.unitTitle}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{row.deliveryPath}</p>
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums align-top">
                              {row.rrp > 0 ? number(row.rrp) : '—'}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums align-top">
                              {number(row.unitCogs)}
                            </td>
                            <td className="py-2 text-right tabular-nums align-top">
                              {row.rrp > 0 ? cogsPercent(row.unitCogs, row.rrp) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {productsWithoutAliases.length > 0 ? (
                <p className="text-[11px] text-muted-foreground mt-3 border border-dashed border-border rounded-md px-3 py-2">
                  No saved aliases for: {productsWithoutAliases.map(product => product.name).join(', ')}.
                  Add an alias under Products → Pricing, then use Set RRP to configure alias delivery units.
                </p>
              ) : null}
            </>
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
