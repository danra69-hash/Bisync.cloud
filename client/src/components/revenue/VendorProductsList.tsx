import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { createPortal } from 'react-dom';
import { Tag, UserPlus } from 'lucide-react';
import { api, type EngageVendorContact, type Vendor } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import type { ComponentRow } from '../../data/componentForm';
import {
  formatDeliveryUnitPath,
  persistVendorProductUpdate,
  resolveCatalogVendor,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import type { CompanyVendorPolicyTag } from '../../data/vendorPolicyRules';
import {
  componentRowTagsVendorProduct,
  findComponentRowForTaggedProduct,
} from '../../data/vendorProductTagging';
import { ComponentEditPanel } from './ComponentEditPanel';
import { ingredientToRow, mergeSavedRow, rowToIngredient } from './smartIngredientShared';
import { VendorEngageModal } from './VendorEngageModal';
import { VendorProductDetailPanel } from './VendorProductDetailPanel';
import { VendorProductImageLightbox } from './VendorProductImageLightbox';
import { VendorProductTagModal } from './VendorProductTagModal';
import { VendorProductThumbnail } from './VendorProductThumbnail';
import { resyncStaleTaggedComponentPrices } from '../../utils/resyncTaggedComponentPrices';

type VendorProductSortColumn =
  | 'productName'
  | 'photo'
  | 'id'
  | 'group'
  | 'specification'
  | 'deliveryUnit'
  | 'deliveryPrice'
  | 'vendor'
  | 'tag';

function vendorProductColumns(showVendorColumn: boolean): SortableColumnDef<VendorProductSortColumn>[] {
  const cols: SortableColumnDef<VendorProductSortColumn>[] = [
    { key: 'productName', label: 'Vendor Product Name' },
    { key: 'photo', label: 'Photo', sortable: false, className: 'w-12' },
    { key: 'id', label: 'Vendor Product ID' },
    { key: 'group', label: 'Group' },
    { key: 'specification', label: 'Product Specification' },
    { key: 'deliveryUnit', label: 'Delivery Unit' },
    { key: 'deliveryPrice', label: 'Delivery Price', align: 'right' },
  ];
  if (showVendorColumn) cols.push({ key: 'vendor', label: 'Vendor' });
  cols.push({ key: 'tag', label: 'Tag', sortable: false });
  return cols;
}

type Props = {
  products: VendorProductCatalogItem[];
  vendors: Vendor[];
  selectedCompanyId: number | null;
  selectedLocationIds?: string[];
  orgPolicyTags?: CompanyVendorPolicyTag[];
  showVendorColumn?: boolean;
  tagFilter?: 'all' | 'tagged' | 'untagged';
  onVendorUpdated?: (vendor: Vendor) => void;
  onProductUpdated?: () => void;
  engageVendorRequest?: Vendor | null;
  onEngageVendorRequestHandled?: () => void;
};

export function VendorProductsList({
  products,
  vendors,
  selectedCompanyId,
  selectedLocationIds = [],
  showVendorColumn = false,
  tagFilter = 'all',
  onVendorUpdated,
  onProductUpdated,
  engageVendorRequest,
  onEngageVendorRequestHandled,
}: Props) {
  const { rm } = useCountryFormatters();
  const [vendorMap, setVendorMap] = useState(() => new Map(vendors.map(v => [v.externalId, v])));
  const [engageVendor, setEngageVendor] = useState<Vendor | null>(null);
  const [engaging, setEngaging] = useState(false);
  const [tagProduct, setTagProduct] = useState<VendorProductCatalogItem | null>(null);
  const [pendingTagProduct, setPendingTagProduct] = useState<VendorProductCatalogItem | null>(null);
  const [previewImage, setPreviewImage] = useState<VendorProductCatalogItem | null>(null);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [detailProduct, setDetailProduct] = useState<VendorProductCatalogItem | null>(null);
  const [detailIsNew, setDetailIsNew] = useState(false);
  const [detailRow, setDetailRow] = useState<ComponentRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [componentRows, setComponentRows] = useState<ComponentRow[]>([]);
  const [taggedProductIds, setTaggedProductIds] = useState<Set<string>>(new Set());
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<VendorProductSortColumn>();

  useEffect(() => {
    resetSort();
  }, [products, tagFilter, resetSort]);

  useEffect(() => {
    setVendorMap(new Map(vendors.map(v => [v.externalId, v])));
  }, [vendors]);

  useEffect(() => {
    if (!engageVendorRequest) return;
    setEngageVendor(engageVendorRequest);
    onEngageVendorRequestHandled?.();
  }, [engageVendorRequest]);

  const productIds = useMemo(() => products.map(p => p.id).join(','), [products]);

  function loadTaggedState() {
    const catalogIds = new Set(products.map(p => p.id));
    return api.ingredients()
      .then(data => {
        const rows = data.map(ingredientToRow);
        const ids = new Set<string>();
        rows.forEach(row => {
          catalogIds.forEach(id => {
            if (componentRowTagsVendorProduct(row, id)) {
              ids.add(id);
            }
          });
        });
        setComponentRows(rows);
        setTaggedProductIds(ids);
      })
      .catch(() => {
        setComponentRows([]);
        setTaggedProductIds(new Set());
      });
  }

  useEffect(() => {
    if (!selectedCompanyId) {
      setComponentRows([]);
      setTaggedProductIds(new Set());
      return;
    }
    void resyncStaleTaggedComponentPrices().finally(() => {
      void loadTaggedState();
    });
  }, [selectedCompanyId, productIds, products]);

  function getVendorForProduct(product: VendorProductCatalogItem): Vendor {
    return resolveCatalogVendor(product, vendorMap);
  }

  async function handleConfirmEngage(vendor: Vendor, contacts: EngageVendorContact[]) {
    setEngaging(true);
    setEngageError(null);
    try {
      const updated = await api.engageVendor(vendor.externalId, { contacts, requestedBy: undefined });
      setVendorMap(prev => new Map(prev).set(updated.externalId, { ...vendor, ...updated }));
      onVendorUpdated?.({ ...vendor, ...updated });
      setEngageVendor(null);
      if (pendingTagProduct) {
        setTagProduct(pendingTagProduct);
        setPendingTagProduct(null);
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

  function refreshTaggedProducts() {
    void loadTaggedState();
  }

  async function handleSaveComponent(updated: Partial<ComponentRow>) {
    if (!detailRow?.id) return;
    setSaveError(null);
    const merged = { ...detailRow, ...updated };
    try {
      const saved = await api.updateIngredient(detailRow.id, rowToIngredient(merged, {}));
      const savedRow = mergeSavedRow(saved, merged);
      setComponentRows(prev => prev.map(r => r.id === detailRow.id ? savedRow : r));
      setDetailRow(null);
      refreshTaggedProducts();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save component.');
    }
  }

  function handleTaggedClick(e: React.MouseEvent, product: VendorProductCatalogItem) {
    e.stopPropagation();
    const row = findComponentRowForTaggedProduct(componentRows, product.id);
    if (row) {
      setSaveError(null);
      setDetailRow(row);
    }
  }

  function handleTagClick(e: React.MouseEvent, product: VendorProductCatalogItem) {
    e.stopPropagation();
    setEngageError(null);
    setPreviewImage(null);
    const vendor = getVendorForProduct(product);
    if (!vendor.engaged) {
      setPendingTagProduct(product);
      setTagProduct(null);
      setEngageVendor(vendor);
      return;
    }
    setEngageVendor(null);
    setPendingTagProduct(null);
    setTagProduct(product);
  }

  function handleProductNameClick(e: React.MouseEvent, product: VendorProductCatalogItem) {
    e.stopPropagation();
    setSaveError(null);
    setDetailIsNew(false);
    setDetailProduct(product);
  }

  function handleSaveVendorProduct(updated: VendorProductCatalogItem) {
    void persistVendorProductUpdate(updated).then(() => {
      setDetailProduct(null);
      setDetailIsNew(false);
      onProductUpdated?.();
    });
  }

  function handleEngageVendorClick(e: React.MouseEvent, vendor: Vendor) {
    e.stopPropagation();
    setEngageError(null);
    setPreviewImage(null);
    setPendingTagProduct(null);
    setTagProduct(null);
    setEngageVendor(vendor);
  }

  const taggedCount = useMemo(
    () => products.filter(p => taggedProductIds.has(p.id)).length,
    [products, taggedProductIds],
  );

  const visibleProducts = useMemo(() => {
    if (tagFilter === 'all') return products;
    if (tagFilter === 'tagged') return products.filter(p => taggedProductIds.has(p.id));
    return products.filter(p => !taggedProductIds.has(p.id));
  }, [products, tagFilter, taggedProductIds]);

  const sortedVisibleProducts = useMemo(
    () =>
      sortTableRows(
        visibleProducts,
        sortColumn,
        sortDirection,
        {
          productName: p => p.productName,
          id: p => p.id,
          group: p => p.group,
          specification: p => p.specification,
          deliveryUnit: p => formatDeliveryUnitPath(p.delivery),
          deliveryPrice: p => p.deliveryPrice,
          vendor: p => p.vendorName,
        },
        { tieBreaker: (a, b) => compareSortValues(a.productName, b.productName) },
      ),
    [visibleProducts, sortColumn, sortDirection],
  );

  const tableColumns = useMemo(
    () => vendorProductColumns(showVendorColumn),
    [showVendorColumn],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const productColSpan = showVendorColumn ? 9 : 8;
  const {
    visibleItems: pagedVisibleProducts,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedVisibleProducts, { scrollRootRef });

  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  const modals = (
    <>
      {engageVendor && (
        <VendorEngageModal
          key={engageVendor.externalId}
          vendor={engageVendor}
          saving={engaging}
          serverError={engageError}
          onClose={() => {
            if (!engaging) {
              setEngageVendor(null);
              setPendingTagProduct(null);
              setEngageError(null);
            }
          }}
          onConfirm={handleConfirmEngage}
        />
      )}

      {previewImage?.imageUrl && (
        <VendorProductImageLightbox
          productName={previewImage.productName}
          imageUrl={previewImage.imageUrl}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {tagProduct && (
        <VendorProductTagModal
          product={tagProduct}
          selectedCompanyId={selectedCompanyId}
          onClose={() => setTagProduct(null)}
          onTagged={refreshTaggedProducts}
        />
      )}

      {detailProduct && (
        <VendorProductDetailPanel
          product={detailProduct}
          isNew={detailIsNew}
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          elevated
          onClose={() => {
            setDetailProduct(null);
            setDetailIsNew(false);
          }}
          onSave={handleSaveVendorProduct}
        />
      )}

      {modalRoot && detailRow && createPortal(
        <ComponentEditPanel
          row={detailRow}
          existingComponents={componentRows}
          selectedCompanyId={selectedCompanyId}
          saveError={saveError}
          elevated
          onClose={() => { setDetailRow(null); setSaveError(null); }}
          onSave={handleSaveComponent}
        />,
        modalRoot,
      )}
    </>
  );

  if (visibleProducts.length === 0) {
    return (
      <>
        <p className="text-xs text-muted-foreground text-center py-12 border border-dashed border-border rounded-lg">
          No vendor products match your filters.
        </p>
        {modals}
      </>
    );
  }

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
        <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs border-collapse">
            <thead className="bg-muted/40">
              <SortableTableHeaderRow
                columns={tableColumns}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className="border-b border-border"
              />
            </thead>
            <tbody>
              {pagedVisibleProducts.map(product => {
                const deliveryUnit = formatDeliveryUnitPath(product.delivery);
                const isTagged = taggedProductIds.has(product.id);
                const vendor = getVendorForProduct(product);
                const isEngaged = vendor.engaged;
                return (
                  <tr key={product.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${isTagged ? 'bg-primary/[0.03]' : ''}`}>
                    <td className="px-3 py-2.5 border-r border-border ">
                      <button
                        type="button"
                        onClick={e => handleProductNameClick(e, product)}
                        title="View vendor product details"
                        className="text-left font-medium text-foreground hover:text-primary hover:underline transition-colors"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {product.productName}
                          {product.isPrivate && (
                            <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 uppercase tracking-wide">
                              Private
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 border-r border-border">
                      <VendorProductThumbnail
                        productName={product.productName}
                        imageUrl={product.imageUrl}
                        onImageClick={product.imageUrl ? () => setPreviewImage(product) : undefined}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-sans text-xs text-muted-foreground border-r border-border">{product.id}</td>
                    <td className="px-3 py-2.5 text-foreground border-r border-border">{product.group}</td>
                    <td className="px-3 py-2.5 text-muted-foreground border-r border-border  leading-snug">
                      {product.specification}
                    </td>
                    <td className="px-3 py-2.5 font-sans text-foreground border-r border-border whitespace-nowrap">
                      {deliveryUnit}
                    </td>
                    <td className="px-3 py-2.5 font-sans font-medium text-foreground border-r border-border">{rm(product.deliveryPrice)}</td>
                    {showVendorColumn && (
                      <td className="px-3 py-2.5 border-r border-border ">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground leading-snug">{product.vendorName}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-sans text-muted-foreground">{product.vendorExternalId}</span>
                            {isEngaged ? (
                              <span className="text-xs font-sans px-1.5 py-0.5 rounded bg-[#5A7A2A]/15 text-[#5A7A2A]">Engaged</span>
                            ) : (
                              <button
                                type="button"
                                onClick={e => handleEngageVendorClick(e, vendor)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
                              >
                                <UserPlus size={10} />
                                Engage
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {isTagged ? (
                        <button
                          type="button"
                          onClick={e => handleTaggedClick(e, product)}
                          title="View tagged smart component"
                          className="text-xs font-sans text-[#5A7A2A] hover:underline"
                        >
                          Tagged
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={e => handleTagClick(e, product)}
                          title={isEngaged ? 'Tag to smart component' : 'Engage vendor to enable tagging'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                        >
                          <Tag size={11} />
                          Tag
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <InfiniteScrollTableSentinel colSpan={productColSpan} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
        </TableScrollContainer>
      </div>

      <p className="text-xs font-sans text-muted-foreground mt-3">
        {visibleProducts.length} product{visibleProducts.length !== 1 ? 's' : ''}
        {taggedCount > 0 && <> · {taggedCount} tagged to component{taggedCount !== 1 ? 's' : ''}</>}
      </p>

      {modals}
    </>
  );
}
