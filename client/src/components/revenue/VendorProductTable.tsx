import { useEffect, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MapPin, Search, X } from 'lucide-react';
import { inputCls, selectCls, type AltUnitEntry } from '../../data/componentForm';
import {
  countVendorProductLocationsInScope,
  filterTaggedVendorProductIdsForLocations,
  isVendorProductTagReady,
  isVendorProductTaggedAtLocations,
} from '../../data/vendorProductTagging';
import {
  calcComponentPrincipalUomPrice,
  calcNettUomPrice,
  calcNettUomQty,
  filterVendorProducts,
  formatDeliveryBreakdown,
  resolveComponentUomQty,
  applyVendorProductOverrides,
  VENDOR_PRODUCT_CATALOG,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { formatCountryCurrency, formatCountryNumber, formatPrincipalUomPrice } from '../../utils/numberFormat';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { tableHeaderCompactCls, TABLE_HEADER_LABEL_CLS } from '../shared/tableHeaderStyles';

export type CompanyLocationOption = {
  externalId: string;
  name: string;
};

type RowHandlers = {
  defaultComponentUom: string;
  principalComponentUom: string;
  altRecipeUnits: AltUnitEntry[];
  componentUomChoices: string[];
  componentUomByProduct: Record<string, string>;
  principalQtyByProduct: Record<string, string>;
  lossYieldByProduct: Record<string, string>;
  locationsByProduct: Record<string, string[]>;
  taggedProductIds: string[];
  activeLocationIds?: string[];
  onPrincipalQtyChange: (productId: string, qty: string) => void;
  onLossYieldChange: (productId: string, loss: string) => void;
  onComponentUomChange: (productId: string, uom: string) => void;
  onToggleTag: (product: VendorProductCatalogItem, tagged: boolean) => void;
  onProductLocationsChange: (productId: string, locationIds: string[]) => void;
};

type Props = RowHandlers & {
  vendorNames: string[];
  vendor: string;
  productSearch: string;
  companyLocations: CompanyLocationOption[];
  hideYieldLoss?: boolean;
  /** When false, tagged products are not rendered here (caller shows them above the section title). */
  showTaggedSection?: boolean;
  onVendorChange: (vendor: string) => void;
  onProductSearchChange: (search: string) => void;
};

export function resolveScopedTaggedVendorProducts(
  taggedProductIds: string[],
  locationsByProduct: Record<string, string[]>,
  activeLocationIds: string[] = [],
): VendorProductCatalogItem[] {
  const scopedTaggedProductIds = filterTaggedVendorProductIdsForLocations(
    taggedProductIds,
    locationsByProduct,
    activeLocationIds,
  );
  return scopedTaggedProductIds
    .map(id => applyVendorProductOverrides().find(p => p.id === id) ?? VENDOR_PRODUCT_CATALOG.find(p => p.id === id))
    .filter((p): p is VendorProductCatalogItem => !!p);
}

export function VendorProductTaggedSection({
  products,
  companyLocations,
  hideYieldLoss = false,
  handlers,
}: {
  products: VendorProductCatalogItem[];
  companyLocations: CompanyLocationOption[];
  hideYieldLoss?: boolean;
  handlers: RowHandlers;
}) {
  if (products.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
        Tagged Vendor Products ({products.length})
      </p>
      <div className="border border-primary/25 rounded-lg overflow-hidden bg-primary/[0.03]">
        <VendorProductTableBody
          products={products}
          showTagColumn
          showLocationColumn
          companyLocations={companyLocations}
          handlers={handlers}
          hideYieldLoss={hideYieldLoss}
        />
      </div>
    </div>
  );
}

/** Platform name-match suggestions — same columns as tagged, conversion fields blank until filled. */
export function VendorProductSuggestedSection({
  products,
  companyLocations,
  hideYieldLoss = false,
  handlers,
  loading = false,
  error = null,
  probabilityByProductId,
}: {
  products: VendorProductCatalogItem[];
  companyLocations: CompanyLocationOption[];
  hideYieldLoss?: boolean;
  handlers: RowHandlers;
  loading?: boolean;
  error?: string | null;
  /** Optional match % shown under the product name. */
  probabilityByProductId?: Record<string, number>;
}) {
  return (
    <div className="space-y-2 mb-4">
      <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
        Suggested Vendor Products{!loading && products.length > 0 ? ` (${products.length})` : ''}
      </p>
      <p className="text-[11px] text-muted-foreground -mt-1">
        From component ↔ vendor product relations. Fill Principal UOM Qty, Component UOM, and Yield Loss %, then tick Tag if the suggestion is correct.
      </p>
      <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading suggestions…</p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-xs text-destructive">{error}</p>
        ) : products.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No suggestions at 50%+ probability for this component name yet.
          </p>
        ) : (
          <VendorProductTableBody
            products={products}
            showTagColumn
            showLocationColumn
            companyLocations={companyLocations}
            handlers={handlers}
            hideYieldLoss={hideYieldLoss}
            blankConversionFields
            probabilityByProductId={probabilityByProductId}
          />
        )}
      </div>
    </div>
  );
}

function formatQty(n: number, countryCode: string): string {
  if (n <= 0) return '—';
  return formatCountryNumber(n, countryCode);
}

function formatPrice(n: number, countryCode: string): string {
  if (n <= 0) return '—';
  return formatCountryCurrency(n, countryCode);
}

function formatPrincipalPrice(n: number, countryCode: string): string {
  if (n <= 0) return '—';
  return formatPrincipalUomPrice(n, countryCode);
}

function VendorProductLocationModal({
  product,
  locations,
  selectedIds,
  onChange,
  onClose,
}: {
  product: VendorProductCatalogItem;
  locations: CompanyLocationOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function toggleLocation(externalId: string) {
    if (selectedIds.includes(externalId)) {
      onChange(selectedIds.filter(id => id !== externalId));
    } else {
      onChange([...selectedIds, externalId]);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} role="presentation" aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[71] w-full max-w-sm bg-card border border-border rounded-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Assign Locations</p>
            <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{product.productName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{product.vendorName} · {product.id}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1">
          {locations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No locations found for this company.</p>
          ) : (
            locations.map(loc => {
              const checked = selectedIds.includes(loc.externalId);
              return (
                <label
                  key={loc.externalId}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLocation(loc.externalId)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs text-foreground">{loc.name}</span>
                </label>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground font-sans">
            {selectedIds.length} of {locations.length} selected
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

export function VendorProductTableBody({
  products,
  showTagColumn,
  showLocationColumn,
  companyLocations,
  handlers,
  hideYieldLoss = false,
  blankConversionFields = false,
  probabilityByProductId,
}: {
  products: VendorProductCatalogItem[];
  showTagColumn: boolean;
  showLocationColumn: boolean;
  companyLocations: CompanyLocationOption[];
  handlers: RowHandlers;
  hideYieldLoss?: boolean;
  /** When true, Principal Qty / Component UOM / Yield Loss stay blank until the user fills them. */
  blankConversionFields?: boolean;
  probabilityByProductId?: Record<string, number>;
}) {
  const countryCode = useOrgCountryCode();
  const [locationModalProductId, setLocationModalProductId] = useState<string | null>(null);
  const {
    defaultComponentUom,
    principalComponentUom,
    altRecipeUnits,
    componentUomChoices,
    componentUomByProduct,
    principalQtyByProduct,
    lossYieldByProduct,
    locationsByProduct,
    taggedProductIds,
    activeLocationIds = [],
    onPrincipalQtyChange,
    onLossYieldChange,
    onComponentUomChange,
    onToggleTag,
    onProductLocationsChange,
  } = handlers;

  const locationModalProduct = locationModalProductId
    ? products.find(p => p.id === locationModalProductId) ?? VENDOR_PRODUCT_CATALOG.find(p => p.id === locationModalProductId)
    : null;

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const colSpan = 9 + (hideYieldLoss ? -1 : 0) + (showLocationColumn ? 1 : 0) + (showTagColumn ? 1 : 0);
  const {
    visibleItems: pagedProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(products, { scrollRootRef });

  return (
    <>
      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
      <table className="w-full text-xs">
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '8%' }} />
          {!hideYieldLoss && <col style={{ width: '7%' }} />}
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          {showLocationColumn && <col style={{ width: '72px' }} />}
          {showTagColumn && <col style={{ width: '88px' }} />}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Vendor Product ID</span></th>
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Vendor Product Name</span></th>
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Delivery Price</span></th>
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Principal UOM Qty</span></th>
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Component Principal UOM Price</span></th>
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Component UOM</span></th>
            {!hideYieldLoss ? (
              <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Yield Loss %</span></th>
            ) : null}
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Nett UOM Qty</span></th>
            <th className={tableHeaderCompactCls('left')}><span className={TABLE_HEADER_LABEL_CLS}>Nett UOM Price</span></th>
            {showLocationColumn && <th className={tableHeaderCompactCls('center')}><span className={TABLE_HEADER_LABEL_CLS}>Loc</span></th>}
            {showTagColumn && <th className={tableHeaderCompactCls('center')}><span className={TABLE_HEADER_LABEL_CLS}>Tag</span></th>}
          </tr>
        </thead>
        <tbody>
          {pagedProducts.map(product => {
            const storedUom = componentUomByProduct[product.id];
            const componentUom = blankConversionFields
              ? (storedUom ?? '')
              : (storedUom ?? defaultComponentUom);
            const resolved = componentUom
              ? resolveComponentUomQty(
                product.delivery,
                principalComponentUom,
                altRecipeUnits,
                componentUom,
              )
              : { qty: null as number | null, auto: false };
            const storedQty = principalQtyByProduct[product.id];
            const qtyInputValue = blankConversionFields
              ? (storedQty ?? '')
              : (storedQty ?? (resolved.qty !== null ? String(resolved.qty) : ''));
            const principalQty = parseFloat(qtyInputValue) || 0;
            const qtyAutoFilled = !blankConversionFields
              && resolved.auto
              && (storedQty === undefined || storedQty === '' || storedQty === String(resolved.qty));

            const lossYield = hideYieldLoss ? 0 : (parseFloat(lossYieldByProduct[product.id] ?? '0') || 0);
            const principalPrice = calcComponentPrincipalUomPrice(product.deliveryPrice, principalQty);
            const nettQty = calcNettUomQty(principalQty, lossYield);
            const nettPrice = calcNettUomPrice(product.deliveryPrice, nettQty);
            const tagged = isVendorProductTaggedAtLocations(
              product.id,
              taggedProductIds,
              locationsByProduct,
              activeLocationIds,
            );
            const assignedLocations = locationsByProduct[product.id] ?? [];
            const scopedLocationCount = countVendorProductLocationsInScope(
              product.id,
              locationsByProduct,
              activeLocationIds,
            );
            const tagReadyLocations = activeLocationIds.length > 0
              ? [...new Set([...assignedLocations, ...activeLocationIds])]
              : assignedLocations;
            const tagReady = blankConversionFields
              ? {
                ready: principalQty > 0 && Boolean(componentUom.trim()) && (
                  companyLocations.length === 0
                  || tagReadyLocations.length > 0
                  || activeLocationIds.length > 0
                ),
                reason: principalQty <= 0
                  ? 'Enter principal UOM qty before tagging.'
                  : !componentUom.trim()
                    ? 'Select component UOM before tagging.'
                    : companyLocations.length > 0 && tagReadyLocations.length === 0 && activeLocationIds.length === 0
                      ? 'Assign at least one location before tagging.'
                      : undefined,
              }
              : isVendorProductTagReady(product, {
                recipeUnit: principalComponentUom,
                altRecipeUnits,
                componentUom,
                principalQty: storedQty,
                productLocationIds: tagReadyLocations,
                companyLocationCount: companyLocations.length,
              });
            const matchPct = probabilityByProductId?.[product.id];

            return (
              <tr
                key={product.id}
                className={`border-b border-border last:border-0 hover:bg-muted/20 align-top ${tagged ? 'bg-primary/5' : ''}`}
              >
                <td className="px-2 py-2.5 font-sans text-xs text-muted-foreground break-all">{product.id}</td>
                <td className="px-2 py-2.5">
                  <p className="font-medium text-foreground leading-snug">{product.productName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{product.vendorName}</p>
                  <p className="text-xs font-sans text-primary mt-1.5">
                    Delivery: {formatDeliveryBreakdown(product.delivery)}
                  </p>
                  {matchPct != null && matchPct > 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {Math.round(matchPct)}% match
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2.5 font-sans">{formatPrice(product.deliveryPrice, countryCode)}</td>
                <td className="px-2 py-2.5">
                  <div className="relative">
                    <input
                      type="number"
                      className={`${inputCls} text-xs py-1`}
                      value={qtyInputValue}
                      onChange={e => onPrincipalQtyChange(product.id, e.target.value)}
                      placeholder={componentUom ? `Qty in ${componentUom}` : 'Enter qty'}
                    />
                    {qtyAutoFilled && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-sans text-primary">auto</span>
                    )}
                  </div>
                  {!blankConversionFields && !resolved.auto && !storedQty && (
                    <p className="text-[11px] text-muted-foreground mt-1">Enter conversion manually</p>
                  )}
                  {blankConversionFields && !storedQty ? (
                    <p className="text-[11px] text-muted-foreground mt-1">Fill before tagging</p>
                  ) : null}
                </td>
                <td className="px-2 py-2.5 font-sans">{formatPrincipalPrice(principalPrice, countryCode)}</td>
                <td className="px-2 py-2.5">
                  <select
                    className={`${selectCls} text-xs py-1 w-full`}
                    value={componentUom}
                    onChange={e => onComponentUomChange(product.id, e.target.value)}
                  >
                    {blankConversionFields ? (
                      <option value="">Select UOM</option>
                    ) : null}
                    {componentUomChoices.map(uom => (
                      <option key={uom} value={uom}>{uom}</option>
                    ))}
                  </select>
                </td>
                {!hideYieldLoss ? (
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      className={`${inputCls} text-xs py-1 w-full`}
                      value={lossYieldByProduct[product.id] ?? ''}
                      onChange={e => onLossYieldChange(product.id, e.target.value)}
                      placeholder={blankConversionFields ? 'Enter %' : '0'}
                      min="0"
                      max="100"
                    />
                  </td>
                ) : null}
                <td className="px-2 py-2.5 font-sans text-muted-foreground">
                  {formatQty(nettQty, countryCode)}
                  {lossYield > 0 && principalQty > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatQty(principalQty, countryCode)} − {lossYield}%
                    </p>
                  )}
                </td>
                <td className="px-2 py-2.5 font-sans font-medium">{formatPrincipalPrice(nettPrice, countryCode)}</td>
                {showLocationColumn && (
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => setLocationModalProductId(product.id)}
                      className="relative inline-flex items-center justify-center p-1.5 rounded-md border border-border hover:bg-muted/60 transition-colors"
                      title={
                        scopedLocationCount > 0
                          ? activeLocationIds.length > 0
                            ? `Assigned at ${scopedLocationCount} selected location(s)`
                            : `Assigned to ${scopedLocationCount} location(s)`
                          : activeLocationIds.length > 0
                            ? 'Not assigned to the selected location(s)'
                            : 'Assign to company locations'
                      }
                    >
                      <MapPin size={13} className={scopedLocationCount > 0 ? 'text-primary' : 'text-muted-foreground'} />
                      {scopedLocationCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-[11px] font-sans text-primary-foreground leading-[14px]">
                          {scopedLocationCount}
                        </span>
                      )}
                    </button>
                  </td>
                )}
                {showTagColumn && (
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={tagged}
                      disabled={!tagged && !tagReady.ready}
                      onChange={e => onToggleTag(product, e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        tagged
                          ? activeLocationIds.length > 0
                            ? 'Untag vendor product for selected location(s)'
                            : 'Untag vendor product'
                          : tagReady.ready
                            ? activeLocationIds.length > 0
                              ? 'Tag vendor product for selected location(s)'
                              : 'Tag vendor product to this component'
                            : tagReady.reason
                      }
                    />
                  </td>
                )}
              </tr>
            );
          })}
          <InfiniteScrollTableSentinel colSpan={colSpan} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
        </tbody>
      </table>
      </TableScrollContainer>

      {locationModalProduct && (
        <VendorProductLocationModal
          product={locationModalProduct}
          locations={companyLocations}
          selectedIds={locationsByProduct[locationModalProduct.id] ?? []}
          onChange={ids => onProductLocationsChange(locationModalProduct.id, ids)}
          onClose={() => setLocationModalProductId(null)}
        />
      )}
    </>
  );
}

export function VendorProductTable({
  vendorNames,
  vendor,
  productSearch,
  taggedProductIds,
  defaultComponentUom,
  principalComponentUom,
  altRecipeUnits,
  componentUomChoices,
  componentUomByProduct,
  principalQtyByProduct,
  lossYieldByProduct,
  locationsByProduct,
  companyLocations,
  activeLocationIds = [],
  onVendorChange,
  onProductSearchChange,
  onPrincipalQtyChange,
  onLossYieldChange,
  onComponentUomChange,
  onToggleTag,
  onProductLocationsChange,
  hideYieldLoss = false,
  showTaggedSection = true,
}: Props) {
  const searchRows = filterVendorProducts(
    applyVendorProductOverrides(),
    productSearch,
    vendor,
    activeLocationIds,
  )
    .filter(product => !taggedProductIds.includes(product.id));
  const showSearchTable = productSearch.trim().length > 0 || !!vendor;
  const taggedProducts = resolveScopedTaggedVendorProducts(
    taggedProductIds,
    locationsByProduct,
    activeLocationIds,
  );

  const rowHandlers: RowHandlers = {
    defaultComponentUom,
    principalComponentUom,
    altRecipeUnits,
    componentUomChoices,
    componentUomByProduct,
    principalQtyByProduct,
    lossYieldByProduct,
    locationsByProduct,
    taggedProductIds,
    activeLocationIds,
    onPrincipalQtyChange,
    onLossYieldChange,
    onComponentUomChange,
    onToggleTag,
    onProductLocationsChange,
  };

  return (
    <div className="space-y-4">
      {showTaggedSection && (
        <VendorProductTaggedSection
          products={taggedProducts}
          companyLocations={companyLocations}
          hideYieldLoss={hideYieldLoss}
          handlers={rowHandlers}
        />
      )}

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Search or filter vendor products. Break down delivery units to principal component UOM, then tick to tag.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Product Search</label>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inputCls} pl-8`}
              value={productSearch}
              onChange={e => onProductSearchChange(e.target.value)}
              placeholder="Search vendor product ID or name…"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Select Vendor</label>
          <select className={selectCls} value={vendor} onChange={e => onVendorChange(e.target.value)}>
            <option value="">— All vendors —</option>
            {vendorNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        </div>

      {showSearchTable && (
        <div className="space-y-2">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Search Results</p>
          {searchRows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
              No vendor products match your search.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <VendorProductTableBody
                products={searchRows}
                showTagColumn
                showLocationColumn={companyLocations.length > 0}
                companyLocations={companyLocations}
                handlers={rowHandlers}
                hideYieldLoss={hideYieldLoss}
              />
            </div>
          )}
        </div>
      )}

      {!showSearchTable && taggedProducts.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
          Enter a product search or select a vendor to find products.
        </p>
      )}

      {!showSearchTable && taggedProducts.length > 0 && (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
          Search for another vendor or product to tag.
        </p>
      )}
      </div>
    </div>
  );
}
