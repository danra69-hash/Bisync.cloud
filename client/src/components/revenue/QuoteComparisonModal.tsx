import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, UserPlus, X } from 'lucide-react';
import { api, type EngageVendorContact, type QuoteRequestSummary, type Vendor } from '../../api';
import {
  parseDeliveryUnitPath,
  persistVendorProductUpdate,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { VendorEngageModal } from './VendorEngageModal';
import { VendorProductTagModal } from './VendorProductTagModal';

type Props = {
  rfq: QuoteRequestSummary;
  vendors: Vendor[];
  selectedCompanyId: number | null;
  onClose: () => void;
  onVendorUpdated?: (vendor: Vendor) => void;
};

type QuoteLine = NonNullable<QuoteRequestSummary['lines']>[number];
type QuoteVendor = QuoteRequestSummary['vendors'][number];

function formatRrp(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lowestRrpForLine(line: QuoteLine, vendors: QuoteVendor[]): number | null {
  const rrps = vendors
    .map(v => line.vendorResponses?.[v.vendorExternalId]?.rrp)
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r) && r >= 0);
  if (rrps.length === 0) return null;
  return Math.min(...rrps);
}

function fallbackDelivery(principalUom: string, deliveryUnitText: string) {
  const unit = (principalUom || deliveryUnitText || 'Each').trim() || 'Each';
  return {
    orderUnit: unit,
    orderQty: 1,
    packUnit: unit,
    packQty: 1,
    unitUnit: unit,
    unitQty: 1,
  };
}

function buildCatalogItemFromQuote(
  rfq: QuoteRequestSummary,
  line: QuoteLine,
  vendor: QuoteVendor,
): VendorProductCatalogItem | null {
  const response = line.vendorResponses?.[vendor.vendorExternalId];
  if (!response) return null;

  const deliveryText = response.deliveryUnitText?.trim() || '';
  const delivery = parseDeliveryUnitPath(deliveryText)
    ?? fallbackDelivery(line.principalUom, deliveryText);

  return {
    id: `VP-RFQ${rfq.id}-L${line.id}-${vendor.vendorExternalId}`.toUpperCase(),
    group: 'Dry Goods',
    vendorExternalId: vendor.vendorExternalId,
    vendorName: vendor.vendorName,
    productName: line.componentName,
    specification: [line.specification, response.notes].filter(Boolean).join('\n').trim(),
    deliveryPrice: response.rrp,
    delivery,
  };
}

export function QuoteComparisonModal({
  rfq,
  vendors: companyVendors,
  selectedCompanyId,
  onClose,
  onVendorUpdated,
}: Props) {
  const lines = rfq.lines ?? [];
  const quoteVendors = rfq.vendors.filter(v => v.status === 'submitted');

  const [localVendors, setLocalVendors] = useState(companyVendors);
  const [tagProduct, setTagProduct] = useState<VendorProductCatalogItem | null>(null);
  const [preselectedComponentId, setPreselectedComponentId] = useState<number | null>(null);
  const [engageVendor, setEngageVendor] = useState<Vendor | null>(null);
  const [pendingTag, setPendingTag] = useState<{
    product: VendorProductCatalogItem;
    componentId?: number | null;
  } | null>(null);
  const [engaging, setEngaging] = useState(false);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preparingTag, setPreparingTag] = useState(false);

  useEffect(() => {
    setLocalVendors(companyVendors);
  }, [companyVendors]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !engaging && !tagProduct && !engageVendor) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, engaging, tagProduct, engageVendor]);

  const vendorsByExternalId = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const vendor of localVendors) {
      map.set(vendor.externalId, vendor);
    }
    return map;
  }, [localVendors]);

  const vendorTotals = quoteVendors.map(vendor => {
    let total = 0;
    let hasAny = false;
    for (const line of lines) {
      const rrp = line.vendorResponses?.[vendor.vendorExternalId]?.rrp;
      if (typeof rrp === 'number' && Number.isFinite(rrp)) {
        total += rrp;
        hasAny = true;
      }
    }
    return { vendor, total, hasAny };
  });

  const lowestTotal = vendorTotals
    .filter(v => v.hasAny)
    .reduce<number | null>((min, row) => (min === null || row.total < min ? row.total : min), null);

  function resolveCompanyVendor(quoteVendor: QuoteVendor): Vendor | null {
    return vendorsByExternalId.get(quoteVendor.vendorExternalId) ?? null;
  }

  async function openTagForQuote(line: QuoteLine, quoteVendor: QuoteVendor) {
    setActionError(null);
    const product = buildCatalogItemFromQuote(rfq, line, quoteVendor);
    if (!product) {
      setActionError('No quote response available to tag.');
      return;
    }

    const companyVendor = resolveCompanyVendor(quoteVendor);
    if (!companyVendor) {
      setActionError(`Vendor ${quoteVendor.vendorName} was not found in the vendor list.`);
      return;
    }

    if (!companyVendor.engaged) {
      setPendingTag({ product, componentId: line.componentId });
      setTagProduct(null);
      setEngageError(null);
      setEngageVendor(companyVendor);
      return;
    }

    setPreparingTag(true);
    try {
      await persistVendorProductUpdate(product);
      setPreselectedComponentId(line.componentId ?? null);
      setTagProduct(product);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to prepare product for tagging.');
    } finally {
      setPreparingTag(false);
    }
  }

  function handleEngageClick(quoteVendor: QuoteVendor) {
    setActionError(null);
    setEngageError(null);
    const companyVendor = resolveCompanyVendor(quoteVendor);
    if (!companyVendor) {
      setActionError(`Vendor ${quoteVendor.vendorName} was not found in the vendor list.`);
      return;
    }
    setPendingTag(null);
    setTagProduct(null);
    setEngageVendor(companyVendor);
  }

  async function handleConfirmEngage(vendor: Vendor, contacts: EngageVendorContact[]) {
    setEngaging(true);
    setEngageError(null);
    try {
      const updated = await api.engageVendor(vendor.externalId, { contacts });
      setLocalVendors(prev => prev.map(v => (v.externalId === updated.externalId ? { ...v, ...updated } : v)));
      onVendorUpdated?.({ ...vendor, ...updated });
      setEngageVendor(null);

      if (pendingTag) {
        const next = pendingTag;
        setPendingTag(null);
        setPreparingTag(true);
        try {
          await persistVendorProductUpdate(next.product);
          setPreselectedComponentId(next.componentId ?? null);
          setTagProduct(next.product);
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Failed to prepare product for tagging.');
        } finally {
          setPreparingTag(false);
        }
      }
    } catch (err) {
      setEngageError(
        err instanceof Error
          ? err.message
          : 'Failed to engage vendor. Restart the API if this is a newly added vendor.',
      );
    } finally {
      setEngaging(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div
        className={`${MODAL_SHELL_CLS} w-full max-w-5xl bg-card border border-border rounded-lg shadow-xl max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-comparison-title"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Sample & Quote</p>
            <h3 id="quote-comparison-title" className="text-sm font-semibold text-foreground mt-0.5">
              Quote comparison — {rfq.rfqNumber}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare delivery unit and RRP from each vendor. Tag a quote to a smart component, or engage a vendor first if needed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {(actionError || preparingTag) ? (
          <div className="px-5 py-2 border-b border-border">
            {actionError ? (
              <p className="text-xs text-destructive">{actionError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Preparing product for tagging…</p>
            )}
          </div>
        ) : null}

        <TableScrollContainer className="flex-1 overflow-auto px-5 py-4">
          {lines.length === 0 || quoteVendors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No quote data to compare.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-semibold text-foreground sticky left-0 bg-card z-10 min-w-[160px]">
                    Component
                  </th>
                  {quoteVendors.map(vendor => {
                    const companyVendor = resolveCompanyVendor(vendor);
                    const engaged = companyVendor?.engaged === true;
                    return (
                      <th key={vendor.id} className="px-3 py-2 font-semibold text-foreground min-w-[160px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{vendor.vendorName}</span>
                            {engaged ? (
                              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-[#5A7A2A]/15 text-[#5A7A2A]">
                                Engaged
                              </span>
                            ) : (
                              <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                                Not engaged
                              </span>
                            )}
                          </div>
                          {!engaged && companyVendor ? (
                            <button
                              type="button"
                              onClick={() => handleEngageClick(vendor)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary text-primary text-[10px] font-semibold hover:bg-primary/10"
                            >
                              <UserPlus size={10} />
                              Engage
                            </button>
                          ) : null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const lowest = lowestRrpForLine(line, quoteVendors);
                  return (
                    <tr key={line.id} className="border-b border-border align-top">
                      <td className="px-3 py-3 sticky left-0 bg-card z-10">
                        <p className="font-semibold text-foreground">{line.componentName}</p>
                        {line.kind === 'other' ? (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Other</span>
                        ) : null}
                        {line.specification ? (
                          <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{line.specification}</p>
                        ) : null}
                      </td>
                      {quoteVendors.map(vendor => {
                        const response = line.vendorResponses?.[vendor.vendorExternalId];
                        const isLowest = response && lowest !== null && response.rrp === lowest;
                        return (
                          <td
                            key={vendor.id}
                            className={`px-3 py-3 ${isLowest ? 'bg-[#5A7A2A]/10' : ''}`}
                          >
                            {response ? (
                              <div className="space-y-1.5">
                                <p className="text-foreground">
                                  <span className="text-muted-foreground">Unit:</span>{' '}
                                  {response.deliveryUnitText || '—'}
                                </p>
                                <p className={`font-semibold ${isLowest ? 'text-[#5A7A2A]' : 'text-foreground'}`}>
                                  RRP {formatRrp(response.rrp)}
                                  {isLowest ? (
                                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wide">Lowest</span>
                                  ) : null}
                                </p>
                                {response.notes ? (
                                  <p className="text-muted-foreground text-[11px] whitespace-pre-wrap">{response.notes}</p>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void openTagForQuote(line, vendor)}
                                  disabled={preparingTag}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[10px] font-semibold hover:bg-muted disabled:opacity-50"
                                >
                                  <Tag size={10} />
                                  Tag
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20">
                  <td className="px-3 py-3 font-semibold text-foreground sticky left-0 bg-muted/20 z-10">
                    Total RRP
                  </td>
                  {vendorTotals.map(({ vendor, total, hasAny }) => {
                    const isLowestTotal = hasAny && lowestTotal !== null && total === lowestTotal;
                    return (
                      <td
                        key={vendor.id}
                        className={`px-3 py-3 font-semibold ${isLowestTotal ? 'text-[#5A7A2A] bg-[#5A7A2A]/10' : 'text-foreground'}`}
                      >
                        {hasAny ? formatRrp(total) : '—'}
                        {isLowestTotal ? (
                          <span className="ml-1 text-[10px] font-bold uppercase tracking-wide">Lowest</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          )}
        </TableScrollContainer>

        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>

      {engageVendor ? (
        <VendorEngageModal
          key={engageVendor.externalId}
          vendor={engageVendor}
          saving={engaging}
          serverError={engageError}
          onClose={() => {
            if (!engaging) {
              setEngageVendor(null);
              setPendingTag(null);
              setEngageError(null);
            }
          }}
          onConfirm={handleConfirmEngage}
        />
      ) : null}

      {tagProduct ? (
        <VendorProductTagModal
          product={tagProduct}
          selectedCompanyId={selectedCompanyId}
          preselectedComponentId={preselectedComponentId}
          onClose={() => {
            setTagProduct(null);
            setPreselectedComponentId(null);
          }}
          onTagged={() => {
            setTagProduct(null);
            setPreselectedComponentId(null);
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
