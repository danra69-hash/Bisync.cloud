import { useMemo, useState } from 'react';
import type { ComponentTagSuggestion, EngageVendorContact, Vendor } from '../../api';
import { api } from '../../api';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  VENDOR_PRODUCT_CATALOG,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { normalizeVendorKind, vendorKindLabel } from '../../data/vendorRating';
import { VendorEngageModal } from './VendorEngageModal';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  componentName: string;
  suggestions: ComponentTagSuggestion[];
  loading: boolean;
  error: string | null;
  taggedProductIds: string[];
  vendors: Vendor[];
  onTagProduct: (product: VendorProductCatalogItem, tagged: boolean) => void;
  onVendorUpdated: (vendor: Vendor) => void;
};

function findCatalogProduct(id: string): VendorProductCatalogItem | undefined {
  return applyVendorProductOverrides().find(p => p.id === id)
    ?? VENDOR_PRODUCT_CATALOG.find(p => p.id === id);
}

function packagingFor(suggestion: ComponentTagSuggestion): string {
  if (suggestion.packaging?.trim()) return suggestion.packaging.trim();
  const product = findCatalogProduct(suggestion.vendorProductId);
  if (!product) return '—';
  const path = formatDeliveryUnitPath(product.delivery);
  return path && path !== '—' ? path : '—';
}

/**
 * Compact Vendor Product suggestion list under Component Name.
 * Engaged → tick adds under Vendor & Pricing.
 * Not engaged → tick opens engage (offline: immediate; online: wait for vendor accept).
 */
export function VendorProductSuggestionBox({
  componentName,
  suggestions,
  loading,
  error,
  taggedProductIds,
  vendors,
  onTagProduct,
  onVendorUpdated,
}: Props) {
  const [engageVendor, setEngageVendor] = useState<Vendor | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<ComponentTagSuggestion | null>(null);
  const [engaging, setEngaging] = useState(false);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const vendorById = useMemo(() => {
    const map = new Map<string, Vendor>();
    for (const v of vendors) map.set(v.externalId, v);
    return map;
  }, [vendors]);

  const rows = useMemo(() => {
    const tagged = new Set(taggedProductIds);
    return suggestions.filter(s => s.vendorProductId && !s.alreadyTagged && !tagged.has(s.vendorProductId));
  }, [suggestions, taggedProductIds]);

  const checkedIds = useMemo(() => new Set(taggedProductIds), [taggedProductIds]);

  if (!componentName.trim()) return null;

  function resolveVendor(suggestion: ComponentTagSuggestion): Vendor | null {
    const existing = vendorById.get(suggestion.vendorExternalId);
    if (existing) return existing;
    if (!suggestion.vendorExternalId) return null;
    return {
      id: 0,
      externalId: suggestion.vendorExternalId,
      name: suggestion.vendorName,
      type: suggestion.vendorType || 'offline',
      brn: '',
      products: '',
      city: '',
      state: '',
      address: '',
      contactPerson: '',
      contactPosition: '',
      mobile: '',
      email: '',
      contactsJson: '[]',
      engaged: suggestion.vendorEngaged,
      engagementStatus: suggestion.engagementStatus || 'none',
    };
  }

  function tagSuggestion(suggestion: ComponentTagSuggestion) {
    const product = findCatalogProduct(suggestion.vendorProductId);
    if (!product) {
      setActionNotice('Vendor product is not in the catalog yet.');
      return;
    }
    setBusyId(suggestion.vendorProductId);
    setActionNotice(null);
    try {
      onTagProduct(product, true);
    } finally {
      setBusyId(null);
    }
  }

  function handleCheck(suggestion: ComponentTagSuggestion, checked: boolean) {
    setActionNotice(null);
    setEngageError(null);
    const product = findCatalogProduct(suggestion.vendorProductId);
    if (!product) {
      setActionNotice('Vendor product is not in the catalog yet.');
      return;
    }

    if (!checked) {
      onTagProduct(product, false);
      return;
    }

    const vendor = resolveVendor(suggestion);
    const engaged = suggestion.vendorEngaged || vendor?.engaged === true;
    if (engaged) {
      tagSuggestion(suggestion);
      return;
    }

    // Not engaged → engage first.
    if (!vendor) {
      setActionNotice('Vendor record not found. Engage the vendor from Vendor List first.');
      return;
    }
    setPendingSuggestion(suggestion);
    setEngageVendor(vendor);
  }

  async function handleConfirmEngage(vendor: Vendor, contacts: EngageVendorContact[]) {
    setEngaging(true);
    setEngageError(null);
    try {
      const updated = await api.engageVendor(vendor.externalId, { contacts });
      onVendorUpdated({ ...vendor, ...updated });
      setEngageVendor(null);

      const kind = normalizeVendorKind(updated.type || vendor.type);
      const fullyEngaged = updated.engaged
        && (kind === 'offline' || (updated.engagementStatus ?? '').toLowerCase() === 'approved');

      if (fullyEngaged && pendingSuggestion) {
        tagSuggestion(pendingSuggestion);
        setActionNotice(
          kind === 'offline'
            ? `${updated.name} engaged. Product added under Vendor & Pricing.`
            : `${updated.name} engaged. Product added under Vendor & Pricing.`,
        );
      } else if (kind === 'online') {
        setActionNotice(
          `Engage request sent to ${updated.name}. Online vendors must accept before their products can be tagged.`,
        );
      } else if (pendingSuggestion) {
        // Offline should be immediate; if API left pending, still try to tag when engaged flag is set.
        if (updated.engaged) tagSuggestion(pendingSuggestion);
        else {
          setActionNotice(`Engage request for ${updated.name} is pending.`);
        }
      }
      setPendingSuggestion(null);
    } catch (err) {
      setEngageError(err instanceof Error ? err.message : 'Failed to engage vendor.');
    } finally {
      setEngaging(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground">
          Vendor Product suggestion
        </p>
        {loading ? <MillstoneLoader size="sm" /> : null}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Matches for “{componentName.trim()}”. Tick engaged vendor products to add under Vendor &amp; Pricing.
        Unticked vendors open Engage — offline products apply immediately; online wait for vendor accept.
      </p>

      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {actionNotice && <p className="text-[11px] text-emerald-800">{actionNotice}</p>}

      {!loading && rows.length === 0 && !error ? (
        <p className="text-[11px] text-muted-foreground py-1">No matching vendor products (≥50% confidence).</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-border border border-border rounded-md overflow-hidden bg-card max-h-48 overflow-y-auto">
          {rows.map(s => {
            const checked = checkedIds.has(s.vendorProductId);
            const vendor = resolveVendor(s);
            const kind = normalizeVendorKind(s.vendorType || vendor?.type);
            const engaged = s.vendorEngaged || vendor?.engaged === true;
            const packaging = packagingFor(s);
            return (
              <li
                key={`${s.vendorProductId}-${s.vendorExternalId}`}
                className="flex items-start gap-2.5 px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-border"
                  checked={checked}
                  disabled={busyId === s.vendorProductId || engaging}
                  onChange={e => handleCheck(s, e.target.checked)}
                  aria-label={`Select ${s.productName}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{s.productName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Packaging: {packaging}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {s.vendorName}
                    <span className={`ml-1 ${engaged ? 'text-emerald-700' : 'text-amber-700'}`}>
                      ({engaged ? 'engaged' : 'not engaged'})
                    </span>
                    <span className="ml-1 text-muted-foreground">· {vendorKindLabel(kind)}</span>
                    {s.probability > 0 ? (
                      <span className="ml-1 tabular-nums">· {Math.round(s.probability)}%</span>
                    ) : null}
                  </p>
                  {!engaged && kind === 'online' ? (
                    <p className="text-[10px] text-amber-700 mt-0.5">
                      Online: tick to send engage request — tag after vendor accepts.
                    </p>
                  ) : null}
                  {!engaged && kind === 'offline' ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Offline: tick to engage — product available immediately from vendor list.
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {engageVendor ? (
        <VendorEngageModal
          key={engageVendor.externalId}
          vendor={engageVendor}
          saving={engaging}
          serverError={engageError}
          onClose={() => {
            if (engaging) return;
            setEngageVendor(null);
            setPendingSuggestion(null);
            setEngageError(null);
          }}
          onConfirm={(v, contacts) => void handleConfirmEngage(v, contacts)}
        />
      ) : null}
    </div>
  );
}
