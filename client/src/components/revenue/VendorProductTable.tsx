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
  VENDOR_PRODUCT_CATALOG,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
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
  onVendorChange: (vendor: string) => void;
  onProductSearchChange: (search: string) => void;
};

function formatQty(n: number): string {
  if (n <= 0) return '—';
  return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Number(n.toFixed(4)));
}

function formatPrice(n: number): string {
  if (n <= 0) return '—';
  return n < 0.1 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`;
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
}: {
  products: VendorProductCatalogItem[];
  showTagColumn: boolean;
  showLocationColumn: boolean;
  companyLocations: CompanyLocationOption[];
  handlers: RowHandlers;
}) {
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
  const colSpan = 9 + (showLocationColumn ? 1 : 0) + (showTagColumn ? 1 : 0);
  const {
    visibleItems: pagedProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(products, { scrollRootRef });

  return (
    <>
      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
      <table className="w-full text-xs table-fixed">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className={`${tableHeaderCompactCls('left')} w-[9%]`}><span className={TABLE_HEADER_LABEL_CLS}>Vendor Product ID</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[20%]`}><span className={TABLE_HEADER_LABEL_CLS}>Vendor Product Name</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[8%]`}><span className={TABLE_HEADER_LABEL_CLS}>Delivery Price</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[8%]`}><span className={TABLE_HEADER_LABEL_CLS}>Principal UOM Qty</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[9%]`}><span className={TABLE_HEADER_LABEL_CLS}>Component Principal UOM Price</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[7%]`}><span className={TABLE_HEADER_LABEL_CLS}>Component UOM</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[7%]`}><span className={TABLE_HEADER_LABEL_CLS}>Yield Loss %</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[8%]`}><span className={TABLE_HEADER_LABEL_CLS}>Nett UOM Qty</span></th>
            <th className={`${tableHeaderCompactCls('left')} w-[8%]`}><span className={TABLE_HEADER_LABEL_CLS}>Nett UOM Price</span></th>
            {showLocationColumn && <th className={`${tableHeaderCompactCls('center')} w-[5%]`}><span className={TABLE_HEADER_LABEL_CLS}>Loc</span></th>}
            {showTagColumn && <th className={`${tableHeaderCompactCls('center')} w-[5%]`}><span className={TABLE_HEADER_LABEL_CLS}>Tag</span></th>}
          </tr>
        </thead>
        <tbody>
          {pagedProducts.map(product => {
            const componentUom = componentUomByProduct[product.id] ?? defaultComponentUom;
            const resolved = resolveComponentUomQty(
              product.delivery,
              principalComponentUom,
              altRecipeUnits,
              componentUom,
            );
            const storedQty = principalQtyByProduct[product.id];
            const principalQty = parseFloat(
              storedQty !== undefined && storedQty !== ''
                ? storedQty
                : resolved.qty !== null
                  ? String(resolved.qty)
                  : '',
            ) || 0;
            const qtyAutoFilled = resolved.auto
              && (storedQty === undefined || storedQty === '' || storedQty === String(resolved.qty));

            const lossYield = parseFloat(lossYieldByProduct[product.id] ?? '0') || 0;
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
            const tagReady = isVendorProductTagReady(product, {
              recipeUnit: principalComponentUom,
              altRecipeUnits,
              componentUom,
              principalQty: storedQty,
              productLocationIds: tagReadyLocations,
              companyLocationCount: companyLocations.length,
            });

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
                </td>
                <td className="px-2 py-2.5 font-sans">${product.deliveryPrice.toFixed(2)}</td>
                <td className="px-2 py-2.5">
                  <div className="relative">
                    <input
                      type="number"
                      className={`${inputCls} text-xs py-1`}
                      value={storedQty ?? (resolved.qty !== null ? String(resolved.qty) : '')}
                      onChange={e => onPrincipalQtyChange(product.id, e.target.value)}
                      placeholder={`Qty in ${componentUom}`}
                    />
                    {qtyAutoFilled && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] font-sans text-primary">auto</span>
                    )}
                  </div>
                  {!resolved.auto && !storedQty && (
                    <p className="text-[11px] text-muted-foreground mt-1">Enter conversion manually</p>
                  )}
                </td>
                <td className="px-2 py-2.5 font-sans">{formatPrice(principalPrice)}</td>
                <td className="px-2 py-2.5">
                  <select
                    className={`${selectCls} text-xs py-1 w-full`}
                    value={componentUom}
                    onChange={e => onComponentUomChange(product.id, e.target.value)}
                  >
                    {componentUomChoices.map(uom => (
                      <option key={uom} value={uom}>{uom}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2.5">
                  <input
                    type="number"
                    className={`${inputCls} text-xs py-1 w-full`}
                    value={lossYieldByProduct[product.id] ?? ''}
                    onChange={e => onLossYieldChange(product.id, e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </td>
                <td className="px-2 py-2.5 font-sans text-muted-foreground">
                  {formatQty(nettQty)}
                  {lossYield > 0 && principalQty > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatQty(principalQty)} − {lossYield}%
                    </p>
                  )}
                </td>
                <td className="px-2 py-2.5 font-sans font-medium">{formatPrice(nettPrice)}</td>
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
          <InfiniteScrollTableSentinel colSpan={colSpan} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
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
}: Props) {
  const searchRows = filterVendorProducts(VENDOR_PRODUCT_CATALOG, productSearch, vendor)
    .filter(product => !taggedProductIds.includes(product.id));
  const showSearchTable = productSearch.trim().length > 0 || !!vendor;
  const scopedTaggedProductIds = filterTaggedVendorProductIdsForLocations(
    taggedProductIds,
    locationsByProduct,
    activeLocationIds,
  );
  const taggedProducts = scopedTaggedProductIds
    .map(id => VENDOR_PRODUCT_CATALOG.find(p => p.id === id))
    .filter((p): p is VendorProductCatalogItem => !!p);

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
      {taggedProducts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
            Tagged Vendor Products ({taggedProducts.length})
          </p>
          <div className="border border-primary/25 rounded-lg overflow-hidden bg-primary/[0.03]">
            <VendorProductTableBody
              products={taggedProducts}
              showTagColumn
              showLocationColumn
              companyLocations={companyLocations}
              handlers={rowHandlers}
            />
          </div>
        </div>
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
