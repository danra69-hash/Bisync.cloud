import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Tag, UserPlus } from 'lucide-react';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { api, type EngageVendorContact, type Vendor } from '../../api';
import {
  buildComparePriceMatrix,
  comparePriceCellKey,
  formatDeliveryPriceLine,
  formatUomCost,
  findBestUomCostByComponent,
  moveComparePriceCellMapping,
  principalQtyFromUomCost,
  resolveComparePriceCell,
  type ComparePriceCell,
  type ComparePriceSlot,
} from '../../data/comparePrice';
import { resolveDetailConfigForRow, serializeDetailConfig, type ComponentRow } from '../../data/componentForm';
import type { VendorProductCatalogItem } from '../../data/vendorProductCatalog';
import { componentRowToIngredientPayload } from '../../data/vendorProductTagging';
import { ingredientToRow } from './smartIngredientShared';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { VendorEngageModal } from './VendorEngageModal';
import { VendorProductTagModal } from './VendorProductTagModal';

const thCls =
  'text-left px-3 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal border-r border-border last:border-r-0 truncate';
const tdCls = 'px-3 py-2.5 align-top border-r border-b border-border last:border-r-0 min-w-0';

function ComparePriceCellView({
  slot,
  vendor,
  isBest,
  saving,
  onEngage,
  onTag,
  onSaveUomCost,
  onDragStart,
  onDragEnd,
}: {
  slot: ComparePriceSlot;
  vendor: Vendor;
  isBest: boolean;
  saving: boolean;
  onEngage: () => void;
  onTag: () => void;
  onSaveUomCost: (cell: ComparePriceCell, uomCost: number) => Promise<void>;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [draftCost, setDraftCost] = useState('');
  const { product } = slot;
  const cell = slot.pricing;
  const needsManual = cell ? !cell.autoResolvable && cell.principalQty <= 0 : false;

  useEffect(() => {
    setDraftCost('');
  }, [product.id, slot.componentRow.id, cell?.principalQty, cell?.uomCost]);

  async function commitManualCost() {
    if (!cell) return;
    const value = parseFloat(draftCost);
    if (!Number.isFinite(value) || value <= 0) return;
    await onSaveUomCost(cell, value);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title="Drag to another component row"
      className={`space-y-1.5 text-xs leading-snug cursor-grab active:cursor-grabbing ${isBest ? 'text-[#5A7A2A]' : ''}`}
    >
      <p className="font-medium text-foreground line-clamp-2">{product.productName}</p>
      <p className="font-sans text-xs text-muted-foreground">{formatDeliveryPriceLine(product)}</p>

      <div className="pt-0.5 border-t border-border/60">
        {!vendor.engaged ? (
          <button
            type="button"
            onClick={onEngage}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground"
          >
            <UserPlus size={11} />
            Engage
          </button>
        ) : !slot.isTagged ? (
          <button
            type="button"
            onClick={onTag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
          >
            <Tag size={11} />
            Tag
          </button>
        ) : cell && cell.uomCost !== null && cell.uomCost > 0 ? (
          <p className={`font-sans text-[11px] font-semibold ${isBest ? 'text-[#5A7A2A]' : 'text-foreground'}`}>
            {formatUomCost(cell.uomCost, cell.componentUom)}
            {isBest && <span className="ml-1 text-xs font-bold uppercase">Best</span>}
          </p>
        ) : cell && needsManual ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">UOM cost (save once)</p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">$</span>
              <input
                type="number"
                min={0}
                step={0.0001}
                value={draftCost}
                onChange={e => setDraftCost(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void commitManualCost(); }}
                disabled={saving}
                placeholder={`/${cell.componentUom.toLowerCase()}`}
                className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void commitManualCost()}
                disabled={saving || !draftCost}
                className="shrink-0 px-2 py-1 rounded text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-sans">UOM cost unavailable</p>
        )}
      </div>
    </div>
  );
}

export function ComparePricePage({ selectedCompanyId }: { selectedCompanyId: number | null }) {
  const [componentRows, setComponentRows] = useState<ComponentRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'Proteins' | 'Dairy' | 'Produce' | 'Dry Goods' | 'Beverages' | 'Seafood' | 'Spirits'>('all');
  const [vendorFilter, setVendorFilter] = useState<'all' | 'engaged' | 'available'>('all');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [engageVendor, setEngageVendor] = useState<Vendor | null>(null);
  const [pendingTag, setPendingTag] = useState<{
    product: VendorProductCatalogItem;
    componentId: number;
  } | null>(null);
  const [tagRequest, setTagRequest] = useState<{
    product: VendorProductCatalogItem;
    componentId: number;
  } | null>(null);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [engaging, setEngaging] = useState(false);
  const [moveVersion, setMoveVersion] = useState(0);
  const [dragSource, setDragSource] = useState<{
    vendorExternalId: string;
    productId: string;
    sourceComponentId: number;
    group: string;
  } | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);

  const loadData = useCallback(() => {
    if (!selectedCompanyId) {
      setComponentRows([]);
      setVendors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([api.ingredients(), api.vendors()])
      .then(([ings, vends]) => {
        setComponentRows(ings.map(ingredientToRow));
        setVendors(vends);
      })
      .catch(() => {
        setComponentRows([]);
        setVendors([]);
      })
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { components, vendorColumns, slots } = useMemo(
    () => buildComparePriceMatrix(componentRows, vendors),
    [componentRows, vendors, moveVersion],
  );

  const filteredVendorColumns = useMemo(() => {
    if (vendorFilter === 'all') return vendorColumns;
    const engaged = vendorFilter === 'engaged';
    return vendorColumns.filter(v => v.engaged === engaged);
  }, [vendorColumns, vendorFilter]);

  const filteredComponents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return components.filter(c => {
      const matchText =
        !q
        || c.name.toLowerCase().includes(q)
        || c.componentId.toLowerCase().includes(q)
        || c.group.toLowerCase().includes(q);
      const matchGroup =
        groupFilter === 'all'
        || c.group === groupFilter;
      return matchText && matchGroup;
    });
  }, [components, search, groupFilter]);

  const compareColSpan = 1 + filteredVendorColumns.length;
  const {
    visibleItems: pagedFilteredComponents,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(filteredComponents, { scrollRootRef });

  const bestByComponent = useMemo(
    () => findBestUomCostByComponent(filteredComponents, slots),
    [filteredComponents, slots],
  );

  async function handleConfirmEngage(vendor: Vendor, contacts: EngageVendorContact[]) {
    setEngaging(true);
    setEngageError(null);
    try {
      const updated = await api.engageVendor(vendor.externalId, { contacts });
      setVendors(prev => prev.map(v => v.externalId === updated.externalId ? updated : v));
      setEngageVendor(null);
      if (pendingTag) {
        setTagRequest(pendingTag);
        setPendingTag(null);
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

  function handleEngageClick(
    vendor: Vendor,
    product: VendorProductCatalogItem,
    componentId: number,
  ) {
    setEngageError(null);
    setPendingTag({ product, componentId });
    setTagRequest(null);
    setEngageVendor(vendor);
  }

  function handleTagClick(product: VendorProductCatalogItem, componentId: number) {
    setEngageError(null);
    setEngageVendor(null);
    setPendingTag(null);
    setTagRequest({ product, componentId });
  }

  async function handleSaveUomCost(cell: ComparePriceCell, uomCost: number) {
    const row = cell.componentRow;
    if (!row.id) return;

    const key = comparePriceCellKey(cell.product.vendorExternalId, row.id);
    setSavingKey(key);

    const detail = resolveDetailConfigForRow(row);
    const principalQty = principalQtyFromUomCost(
      cell.product.deliveryPrice,
      uomCost,
      cell.lossYield,
    );
    if (!principalQty) {
      setSavingKey(null);
      return;
    }

    const taggedVendorProductIds = detail.taggedVendorProductIds.includes(cell.product.id)
      ? detail.taggedVendorProductIds
      : [...detail.taggedVendorProductIds, cell.product.id];
    const isPrimary = taggedVendorProductIds[0] === cell.product.id;

    const nextDetail = {
      ...detail,
      taggedVendorProductIds,
      vendorProductPrincipalQty: {
        ...detail.vendorProductPrincipalQty,
        [cell.product.id]: principalQty,
      },
      vendorProductComponentUom: {
        ...detail.vendorProductComponentUom,
        [cell.product.id]: cell.componentUom,
      },
      vendor: isPrimary ? cell.product.vendorName : detail.vendor,
      vendorProduct: isPrimary ? cell.product.productName : detail.vendorProduct,
      deliveryUnitPrice: isPrimary ? String(cell.product.deliveryPrice) : detail.deliveryUnitPrice,
    };

    const payload = componentRowToIngredientPayload({
      ...row,
      lastPriceRecipe: isPrimary ? uomCost : row.lastPriceRecipe,
      lastPriceInventory: isPrimary ? cell.product.deliveryPrice : row.lastPriceInventory,
      detailConfig: nextDetail,
      detailConfigJson: serializeDetailConfig(nextDetail),
    });

    try {
      const saved = await api.updateIngredient(row.id, payload);
      setComponentRows(prev => prev.map(r => (r.id === row.id ? ingredientToRow(saved) : r)));
    } finally {
      setSavingKey(null);
    }
  }

  function moveSlotTo(
    vendorExternalId: string,
    productId: string,
    targetComponentId: number,
  ) {
    moveComparePriceCellMapping(vendorExternalId, productId, targetComponentId);
    setMoveVersion(v => v + 1);
  }

  function handleDropOnCell(targetComponent: ComponentRow, vendorExternalId: string) {
    if (!dragSource || !targetComponent.id) return;
    if (dragSource.vendorExternalId !== vendorExternalId) return;
    if (dragSource.group !== targetComponent.group) return;
    if (dragSource.sourceComponentId === targetComponent.id) return;
    moveSlotTo(dragSource.vendorExternalId, dragSource.productId, targetComponent.id);
    setDragSource(null);
  }

  return (
    <div className={pageShellClass()}>
      {!selectedCompanyId ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select a company to compare vendor pricing.
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading compare price data…</p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter smart components…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={groupFilter}
              onChange={e => setGroupFilter(e.target.value as typeof groupFilter)}
              className={`${filterSelectCls} min-w-[140px]`}
            >
              <option value="all">All groups</option>
              <option value="Proteins">Proteins</option>
              <option value="Dairy">Dairy</option>
              <option value="Produce">Produce</option>
              <option value="Dry Goods">Dry Goods</option>
              <option value="Beverages">Beverages</option>
              <option value="Seafood">Seafood</option>
              <option value="Spirits">Spirits</option>
            </select>
            <div className="flex items-center gap-1">
              {(['all', 'engaged', 'available'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setVendorFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    vendorFilter === f
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {f === 'all' ? 'All vendors' : f === 'engaged' ? 'Engaged' : 'Unengaged'}
                </button>
              ))}
            </div>
            <p className="text-xs font-sans text-muted-foreground">
              {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
              {' · '}
              {filteredVendorColumns.length} vendor{filteredVendorColumns.length !== 1 ? 's' : ''}
            </p>
          </div>

          {filteredComponents.length === 0 || filteredVendorColumns.length === 0 ? (
            <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
              No food or beverage components found. Add smart components to populate this spreadsheet.
            </p>
          ) : (
            <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-220px)]">
                <table ref={tableRef} className="w-full text-xs border-collapse table-fixed">
                  <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      <th className={`${thCls} bg-muted/95 w-[14%]`}>Component</th>
                      {filteredVendorColumns.map(vendor => (
                        <th key={vendor.externalId} className={thCls}>
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <p className="text-[11px] font-semibold text-foreground normal-case tracking-normal">
                                {vendor.name}
                              </p>
                              {vendor.engaged && (
                                <span className="text-[11px] font-sans px-1 py-0.5 rounded bg-[#5A7A2A]/15 text-[#5A7A2A]">
                                  Engaged
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-sans text-muted-foreground normal-case">
                              {vendor.externalId}
                            </p>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedFilteredComponents.map(component => {
                      if (!component.id) return null;
                      const best = bestByComponent.get(component.id);
                      return (
                        <tr key={component.id} className="hover:bg-muted/15">
                          <td className={`${tdCls} font-medium`}>
                            <p className="text-foreground leading-snug">{component.name}</p>
                            <p className="text-xs font-sans text-muted-foreground mt-0.5">
                              {component.componentId || '—'}
                              {' · '}
                              {component.group}
                            </p>
                          </td>
                          {filteredVendorColumns.map(vendor => {
                            const key = comparePriceCellKey(vendor.externalId, component.id!);
                            const slot = slots.get(key);
                            if (!slot) {
                              return (
                                <td key={vendor.externalId} className={`${tdCls} text-muted-foreground text-center`}>
                                  —
                                </td>
                              );
                            }

                            const pricing = slot.isTagged
                              ? resolveComparePriceCell(component, slot.product)
                              : slot.pricing;
                            const displaySlot: ComparePriceSlot = {
                              ...slot,
                              componentRow: component,
                              pricing,
                            };
                            const isBest = pricing !== null
                              && pricing.uomCost !== null
                              && pricing.uomCost > 0
                              && best !== undefined
                              && pricing.uomCost === best;
                            const canDropHere = dragSource
                              && dragSource.vendorExternalId === vendor.externalId
                              && dragSource.group === component.group
                              && dragSource.sourceComponentId !== component.id;

                            return (
                              <td
                                key={vendor.externalId}
                                onDragOver={e => {
                                  if (!canDropHere) return;
                                  e.preventDefault();
                                }}
                                onDrop={e => {
                                  e.preventDefault();
                                  handleDropOnCell(component, vendor.externalId);
                                }}
                                className={`${tdCls} ${isBest ? 'bg-[#5A7A2A]/[0.06]' : ''} ${canDropHere ? 'ring-1 ring-primary/40 bg-primary/[0.04]' : ''}`}
                              >
                                <ComparePriceCellView
                                  slot={displaySlot}
                                  vendor={vendor}
                                  isBest={isBest}
                                  saving={savingKey === key}
                                  onEngage={() => handleEngageClick(vendor, slot.product, component.id!)}
                                  onTag={() => handleTagClick(slot.product, component.id!)}
                                  onSaveUomCost={handleSaveUomCost}
                                  onDragStart={() => setDragSource({
                                    vendorExternalId: vendor.externalId,
                                    productId: slot.product.id,
                                    sourceComponentId: component.id!,
                                    group: component.group,
                                  })}
                                  onDragEnd={() => setDragSource(null)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <InfiniteScrollTableSentinel colSpan={compareColSpan} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
                  </tbody>
                </table>
            </TableScrollContainer>
          )}

          {engageVendor && (
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
          )}

          {tagRequest && (
            <VendorProductTagModal
              product={tagRequest.product}
              selectedCompanyId={selectedCompanyId}
              preselectedComponentId={tagRequest.componentId}
              onClose={() => setTagRequest(null)}
              onTagged={loadData}
            />
          )}
        </>
      )}
    </div>
  );
}
