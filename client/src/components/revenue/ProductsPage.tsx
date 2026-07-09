import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { createPortal } from 'react-dom';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, type Product } from '../../api';
import { blankComponentRow, fromApiUom, toApiUom, type AltUnitEntry } from '../../data/componentForm';
import { loadExtraGroups, removeExtraGroup, saveExtraGroups, getKnownRecipeUnits } from '../../data/componentCatalogConfig';
import {
  convertProductParStockQty,
  formatProductParStock,
  productParStockUomOptions,
  resolveDefaultProductParStockUom,
  serializeProductParStockUom,
} from '../../data/productParStock';
import { componentMatchesLocations, formatRm } from '../../data/createOrder';
import {
  blankProductAlias,
  blankProductLine,
  calcLineSubtotal,
  calcProductCogs,
  calcSubProductUnitCost,
  calcTotalCost,
  formatCogsPercent,
  generateProductId,
  isProductLineFilled,
  productLineFromComponent,
  productLineFromSubProduct,
  type ProductAliasLine,
  type ProductLine,
} from '../../data/productForm';
import {
  findSubProductForLine,
  resolveProductLineUomOptions,
  subProductComponentUomOptions,
  withCurrentProductLineUomOption,
} from '../../data/productComponentUomOptions';
import {
  blankB2bSalesConfig,
  b2bDeliveryResolvesToYieldUom,
  buildB2bConfigForSave,
  describeB2bDeliveryYieldResolution,
  isB2bAlternateLineActive,
  parseB2bSalesConfigJson,
  resolveLinkedSubProduct,
  resolvePrincipalB2bRrp,
  seedB2bSalesFromSubProduct,
  serializeB2bSalesConfig,
  type B2bSalesConfig,
} from '../../data/productB2bSales';
import { formatDeliveryUnitPath } from '../../data/vendorProductCatalog';
import { B2bSalesBox } from './B2bSalesBox';
import { siCategories, siGroups } from '../../data/revenueManagement';
import { configLocationToDropdown } from '../../utils/orgFilters';
import { ComponentEditPanel } from './ComponentEditPanel';
import { GroupEditPanel, type GroupRow } from './GroupEditPanel';
import { ProductGroupSelect } from './ProductGroupSelect';
import { DeleteProductGroupModal } from './DeleteProductGroupModal';
import {
  findProductsUsingGroup,
  groupsMatch,
  productToUpsertPayload,
} from '../../data/productGroupCatalog';
import { ProductionMethodModal } from './ProductionMethodModal';
import { productKeyFromParts } from '../../data/productProductionMethod';
import { ingredientToRow, mergeSavedRow, rowToIngredient } from './smartIngredientShared';
import { SmartComponentPicker } from './SmartComponentPicker';
import { ProductComponentPicker } from './ProductComponentPicker';
import {
  loadYieldAltUnitsFromProduct,
  refreshBatchAdditionalUoms,
  serializeYieldAltUnits,
} from '../../data/productBatchUom';
import {
  createDefaultBatchAdditionalEntry,
  SubProductBatchAdditionalUoms,
} from './SubProductBatchUomSection';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
  editorRequest?: { mode: 'new' } | { mode: 'edit'; id: number } | null;
  onEditorRequestConsumed?: () => void;
  onClose?: () => void;
};

const fieldCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const labelCls = 'text-xs font-medium text-foreground';
const tdCls = 'px-3 py-2 text-xs border-b border-border align-middle';
const addBtnCls =
  'shrink-0 inline-flex items-center justify-center h-[34px] w-[34px] rounded-md border border-border bg-background hover:bg-muted/40 text-muted-foreground';

type BomLineSortColumn = 'component' | 'uom' | 'price' | 'qty' | 'subtotal' | 'action';

const BOM_LINE_TABLE_COLUMNS: SortableColumnDef<BomLineSortColumn>[] = [
  { key: 'component', label: 'Smart component' },
  { key: 'uom', label: 'Smart component UOM' },
  { key: 'price', label: 'Smart component UOM price', sortable: false },
  { key: 'qty', label: 'Qty', sortable: false },
  { key: 'subtotal', label: 'Subtotal', align: 'right' },
  { key: 'action', label: '', sortable: false, className: 'w-10' },
];

const categoryOptions = siCategories.filter(c => c !== 'All');

type ComponentRow = ReturnType<typeof ingredientToRow>;

type ComponentLinesSectionProps = {
  title: string;
  description: string;
  lines: ProductLine[];
  totalCost: number;
  totalLabel: string;
  availableComponents: ComponentRow[];
  includeSubProducts?: boolean;
  availableSubProducts?: Product[];
  subProductCatalog?: Product[];
  onUpdateLine: (key: string, patch: Partial<ProductLine>) => void;
  onComponentSelect: (key: string, component: ComponentRow | null) => void;
  onSubProductSelect?: (key: string, product: Product | null) => void;
  onRemoveLine: (key: string) => void;
  onAddLine: () => void;
  onOpenAddComponent: (lineKey: string) => void;
  onOpenProductionMethod?: () => void;
};

function ComponentLinesSection({
  title,
  description,
  lines,
  totalCost,
  totalLabel,
  availableComponents,
  includeSubProducts = false,
  availableSubProducts = [],
  subProductCatalog = [],
  onUpdateLine,
  onComponentSelect,
  onSubProductSelect,
  onRemoveLine,
  onAddLine,
  onOpenAddComponent,
  onOpenProductionMethod,
}: ComponentLinesSectionProps) {
  const columns = includeSubProducts
    ? BOM_LINE_TABLE_COLUMNS.map(column => (
      column.key === 'component'
        ? { ...column, label: 'Component' }
        : column
    ))
    : BOM_LINE_TABLE_COLUMNS;
  const showAddRow = lines.length > 0 && isProductLineFilled(lines[lines.length - 1]);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const { sortColumn, sortDirection, toggleSort } = useTableSort<BomLineSortColumn>();
  const [enrichedSubProducts, setEnrichedSubProducts] = useState<Record<number, Product>>({});

  const resolvedSubProductCatalog = useMemo(() => {
    const merged = new Map<number, Product>();
    for (const product of subProductCatalog) {
      if (product.isSubProduct) merged.set(product.id, product);
    }
    for (const product of Object.values(enrichedSubProducts)) {
      if (product.isSubProduct) merged.set(product.id, product);
    }
    return [...merged.values()];
  }, [subProductCatalog, enrichedSubProducts]);

  useEffect(() => {
    if (!includeSubProducts) return;

    for (const line of lines) {
      const subProduct = findSubProductForLine(line, resolvedSubProductCatalog);
      if (!subProduct) continue;
      if (subProductComponentUomOptions(subProduct).length > 1) continue;
      if (enrichedSubProducts[subProduct.id]) continue;

      void api.product(subProduct.id)
        .then(fresh => {
          setEnrichedSubProducts(prev => ({ ...prev, [fresh.id]: fresh }));
        })
        .catch(() => undefined);
    }
  }, [includeSubProducts, lines, resolvedSubProductCatalog, enrichedSubProducts]);

  const sortedLines = useMemo(
    () =>
      sortTableRows(
        lines,
        sortColumn,
        sortDirection,
        {
          component: line => line.componentName || line.componentId || '',
          uom: line => line.componentUom || '',
          subtotal: line => calcLineSubtotal(line.quantity, line.componentUomPrice),
        },
        { tieBreaker: (a, b) => compareSortValues(a.componentName, b.componentName) },
      ),
    [lines, sortColumn, sortDirection],
  );

  const lineUomOptionsByKey = useMemo(() => {
    const map = new Map<string, ReturnType<typeof withCurrentProductLineUomOption>>();
    for (const line of lines) {
      map.set(
        line.key,
        withCurrentProductLineUomOption(
          resolveProductLineUomOptions(line, availableComponents, resolvedSubProductCatalog),
          line,
        ),
      );
    }
    return map;
  }, [lines, availableComponents, resolvedSubProductCatalog]);

  const {
    visibleItems: pagedLines,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedLines, { scrollRootRef });

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
        {onOpenProductionMethod ? (
          <button
            type="button"
            onClick={onOpenProductionMethod}
            className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-muted/40"
          >
            Production Method
          </button>
        ) : null}
      </div>

      <TableScrollContainer ref={scrollRootRef} className={TABLE_SCROLL_CLS}>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <SortableTableHeaderRow
              columns={columns}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
              className="border-b border-border bg-muted/20"
            />
          </thead>
          <tbody>
            {pagedLines.map(line => {
              const subtotal = calcLineSubtotal(line.quantity, line.componentUomPrice);
              const uomOptions = lineUomOptionsByKey.get(line.key) ?? [];
              return (
                <tr key={line.key}>
                  <td className={tdCls}>
                    <div className="flex gap-1.5 items-center">
                      <div className="flex-1 min-w-0">
                        {includeSubProducts ? (
                          <ProductComponentPicker
                            components={availableComponents}
                            subProducts={availableSubProducts}
                            value={line.componentId}
                            onComponentSelect={component => onComponentSelect(line.key, component)}
                            onSubProductSelect={product => onSubProductSelect?.(line.key, product)}
                          />
                        ) : (
                          <SmartComponentPicker
                            components={availableComponents}
                            value={line.componentId}
                            onChange={component => onComponentSelect(line.key, component)}
                          />
                        )}
                      </div>
                      <button
                          type="button"
                          onClick={() => onOpenAddComponent(line.key)}
                          className={addBtnCls}
                          title="Create new smart component"
                          aria-label="Create new smart component"
                        >
                          <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td className={tdCls}>
                    {uomOptions.length > 1 ? (
                      <select
                        value={line.componentUom}
                        onChange={e => {
                          const selected = uomOptions.find(option => option.label === e.target.value);
                          if (!selected) return;
                          onUpdateLine(line.key, {
                            componentUom: selected.label,
                            componentUomPrice: selected.price > 0 ? String(selected.price) : '',
                          });
                        }}
                        className={`${fieldCls} min-w-[6rem] max-w-full`}
                      >
                        {uomOptions.map(option => (
                          <option key={option.label} value={option.label}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block min-w-[4rem]">{line.componentUom || '—'}</span>
                    )}
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1 min-w-[8rem]">
                      <span className="text-muted-foreground">RM</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.componentUomPrice}
                        onChange={e => onUpdateLine(line.key, { componentUomPrice: e.target.value })}
                        className={`${fieldCls} max-w-[8rem]`}
                      />
                    </div>
                  </td>
                  <td className={tdCls}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      onChange={e => onUpdateLine(line.key, { quantity: e.target.value })}
                      className={`${fieldCls} max-w-[6rem]`}
                    />
                  </td>
                  <td className={`${tdCls} font-medium`}>{formatRm(subtotal)}</td>
                  <td className={tdCls}>
                    <button
                      type="button"
                      onClick={() => onRemoveLine(line.key)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      aria-label="Remove row"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {showAddRow ? (
              <tr>
                <td colSpan={6} className="px-3 py-2 border-b border-border">
                  <button
                    type="button"
                    onClick={onAddLine}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-border text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    <Plus size={14} />
                    Add smart component
                  </button>
                </td>
              </tr>
            ) : null}
            <InfiniteScrollTableSentinel colSpan={6} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
          </tbody>
        </table>
      </TableScrollContainer>

      <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
        <span className="text-sm font-semibold">{formatRm(totalCost)}</span>
      </div>
    </section>
  );
}

function mapProductItemsToLines(
  items: Product['items'] | undefined,
  subProducts: Product[],
): ProductLine[] {
  const mapped = (items ?? []).map(item => {
    const linkedSubProduct = subProducts.find(product =>
      product.isSubProduct
      && product.productId.trim().toLowerCase() === item.componentId.trim().toLowerCase(),
    );
    return {
      key: item.id ? `saved-${item.id}` : `line-${item.componentId}`,
      componentId: item.componentId,
      componentName: item.componentName,
      componentUom: item.componentUom,
      componentUomPrice: String(item.componentUomPrice),
      quantity: String(item.quantity),
      sourceProductId: linkedSubProduct?.id,
    };
  });
  return mapped.length > 0 ? mapped : [blankProductLine()];
}

function mapProductLinesToComponentItems(lines: ProductLine[]): Product['items'] {
  return lines
    .filter(isProductLineFilled)
    .map((line, index) => {
      const quantity = parseFloat(line.quantity) || 0;
      const componentUomPrice = parseFloat(line.componentUomPrice) || 0;
      return {
        componentId: line.componentId,
        componentName: line.componentName,
        componentUom: line.componentUom,
        componentUomPrice,
        quantity,
        subtotal: calcLineSubtotal(line.quantity, line.componentUomPrice),
        sortOrder: index + 1,
      };
    });
}

export function ProductsPage({
  selectedCompanyId,
  selectedLocationIds,
  embedded = false,
  editorRequest = null,
  onEditorRequestConsumed,
  onClose,
}: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [name, setName] = useState('');
  const [isSubProduct, setIsSubProduct] = useState(false);
  const [productId, setProductId] = useState('');
  const [category, setCategory] = useState('');
  const [group, setGroup] = useState('');
  const [b2cEnabled, setB2cEnabled] = useState(true);
  const [b2bEnabled, setB2bEnabled] = useState(false);
  const [rrp, setRrp] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('');
  const [yieldUom, setYieldUom] = useState('');
  const [yieldAltUnits, setYieldAltUnits] = useState<AltUnitEntry[]>([]);
  const [expiryPeriodDays, setExpiryPeriodDays] = useState('');
  const [activationPeriodHours, setActivationPeriodHours] = useState('');
  const [parStock, setParStock] = useState('');
  const [parStockUom, setParStockUom] = useState('');
  const [productLocationIds, setProductLocationIds] = useState<string[]>([]);
  const [aliases, setAliases] = useState<ProductAliasLine[]>([]);
  const [locations, setLocations] = useState<{ externalId: string; name: string }[]>([]);
  const [lines, setLines] = useState<ProductLine[]>([blankProductLine()]);
  const [packagingLines, setPackagingLines] = useState<ProductLine[]>([blankProductLine()]);
  const [b2bSalesConfig, setB2bSalesConfig] = useState<B2bSalesConfig>(() => blankB2bSalesConfig());

  const [components, setComponents] = useState<ReturnType<typeof ingredientToRow>[]>([]);
  const [extraGroups, setExtraGroups] = useState<string[]>(() => loadExtraGroups());
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  const [deletingGroupError, setDeletingGroupError] = useState<string | null>(null);
  const [deletingGroupSaving, setDeletingGroupSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupRow | null>(null);
  const [isNewGroup, setIsNewGroup] = useState(false);
  const [componentEditorLineKey, setComponentEditorLineKey] = useState<string | null>(null);
  const [componentEditorTarget, setComponentEditorTarget] = useState<'product' | 'packaging'>('product');
  const [productionMethodOpen, setProductionMethodOpen] = useState(false);
  const [editComponentRow, setEditComponentRow] = useState<ReturnType<typeof ingredientToRow> | null>(null);
  const [isNewComponent, setIsNewComponent] = useState(false);
  const [componentSaveError, setComponentSaveError] = useState<string | null>(null);
  const saveErrorRef = useRef<HTMLDivElement>(null);

  function showSaveError(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      saveErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  const groupOptions = useMemo(() => {
    const fromComponents = components.map(c => c.group).filter(Boolean);
    const fromProducts = savedProducts.map(product => product.group).filter(Boolean);
    const merged = new Set([
      ...siGroups.filter(g => g !== 'All'),
      ...extraGroups,
      ...fromComponents,
      ...fromProducts,
      ...(group ? [group] : []),
    ]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [components, extraGroups, group, savedProducts]);

  const loadComponents = useCallback(() => {
    if (!orgReady) {
      setComponents([]);
      return Promise.resolve();
    }
    setLoading(true);
    return api.ingredients()
      .then(rows => setComponents(rows.map(ingredientToRow)))
      .catch(() => setComponents([]))
      .finally(() => setLoading(false));
  }, [orgReady]);

  const loadSavedProducts = useCallback(() => {
    if (!selectedCompanyId) {
      setSavedProducts([]);
      return;
    }
    api.products(selectedCompanyId)
      .then(setSavedProducts)
      .catch(() => setSavedProducts([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    loadSavedProducts();
  }, [loadSavedProducts]);

  useEffect(() => {
    void loadComponents();
  }, [loadComponents]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLocations([]);
      return;
    }
    api.locationsConfig()
      .then(rows => setLocations(
        rows
          .filter(loc => loc.companyId === selectedCompanyId)
          .map(configLocationToDropdown),
      ))
      .catch(() => setLocations([]));
  }, [selectedCompanyId]);

  useEffect(() => {
    if (selectedProductId) return;
    setProductLocationIds(selectedLocationIds.length > 0 ? [...selectedLocationIds] : []);
  }, [selectedLocationIds, selectedProductId]);

  useEffect(() => {
    if (!editorRequest) return;
    if (editorRequest.mode === 'new') {
      resetEditor();
      onEditorRequestConsumed?.();
      return;
    }
    const product = savedProducts.find(p => p.id === editorRequest.id);
    if (!product) return;
    loadProduct(product);
    setIsEditing(editorRequest.mode === 'edit');
    onEditorRequestConsumed?.();
  }, [editorRequest, savedProducts, onEditorRequestConsumed]);

  const availableComponents = useMemo(
    () => components.filter(c => c.active && componentMatchesLocations(c, selectedLocationIds)),
    [components, selectedLocationIds],
  );

  const availableSubProducts = useMemo(
    () => savedProducts.filter(product =>
      product.isSubProduct
      && product.active
      && (!product.locationExternalIds?.length
        || product.locationExternalIds.some(id => selectedLocationIds.includes(id))),
    ),
    [savedProducts, selectedLocationIds],
  );

  const productComponentSubProducts = useMemo(
    () => availableSubProducts.filter(product =>
      !selectedProductId || product.id !== Number(selectedProductId),
    ),
    [availableSubProducts, selectedProductId],
  );

  const subProductCatalog = useMemo(
    () => savedProducts.filter(product => product.isSubProduct),
    [savedProducts],
  );

  const linkedSubProduct = useMemo(
    () => resolveLinkedSubProduct(lines, savedProducts),
    [lines, savedProducts],
  );

  const existingProductIds = useMemo(
    () => savedProducts.map(p => p.productId),
    [savedProducts],
  );

  useEffect(() => {
    if (selectedProductId) return;
    if (!name.trim()) {
      setProductId('');
      return;
    }
    const kind = isSubProduct ? 'subproduct' : 'product';
    setProductId(generateProductId(name, kind, existingProductIds.filter(id => id !== productId)));
  }, [name, isSubProduct, existingProductIds, selectedProductId, productId]);

  const totalCost = useMemo(() => calcTotalCost(lines), [lines]);
  const totalPackagingCost = useMemo(() => calcTotalCost(packagingLines), [packagingLines]);
  const effectiveProductCogs = useMemo(
    () => calcProductCogs(totalCost, totalPackagingCost, {
      isSubProduct,
      b2bEnabled,
      b2cEnabled,
    }),
    [totalCost, totalPackagingCost, isSubProduct, b2bEnabled, b2cEnabled],
  );
  const rrpValue = useMemo(() => {
    const parsed = parseFloat(rrp);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [rrp]);
  const principalCogsPercent = formatCogsPercent(effectiveProductCogs, rrpValue);
  const subProductUnitCost = useMemo(
    () => calcSubProductUnitCost(effectiveProductCogs, yieldQuantity),
    [effectiveProductCogs, yieldQuantity],
  );

  const supportsBatchAdditionalUom = isSubProduct || b2bEnabled;

  const batchUomForAdditional = useMemo(() => {
    if (isSubProduct) return yieldUom.trim();
    if (!b2bEnabled) return '';
    return formatDeliveryUnitPath(b2bSalesConfig.principal.delivery).trim();
  }, [isSubProduct, b2bEnabled, yieldUom, b2bSalesConfig]);

  const batchQtyForAdditional = isSubProduct
    ? (parseFloat(yieldQuantity) || 0)
    : 1;

  const parStockUomOptionList = useMemo(
    () => productParStockUomOptions(
      getKnownRecipeUnits(),
      parStockUom,
      [
        yieldUom,
        resolveDefaultProductParStockUom({
          isSubProduct,
          yieldUom,
          b2bEnabled,
          b2bSalesConfig,
        }),
        ...(b2bEnabled ? [formatDeliveryUnitPath(b2bSalesConfig.principal.delivery)] : []),
      ],
    ),
    [parStockUom, yieldUom, isSubProduct, b2bEnabled, b2bSalesConfig],
  );

  useEffect(() => {
    if (!isSubProduct || !yieldUom.trim()) return;
    setParStockUom(yieldUom);
  }, [isSubProduct, yieldUom]);

  useEffect(() => {
    if (!supportsBatchAdditionalUom || !batchUomForAdditional) return;
    setYieldAltUnits(prev => refreshBatchAdditionalUoms(prev, batchQtyForAdditional, batchUomForAdditional));
  }, [supportsBatchAdditionalUom, batchQtyForAdditional, batchUomForAdditional]);

  useEffect(() => {
    if (parStockUom.trim()) return;
    if (isSubProduct) return;
    const defaultUom = resolveDefaultProductParStockUom({
      isSubProduct,
      yieldUom,
      b2bEnabled,
      b2bSalesConfig,
    });
    if (defaultUom) setParStockUom(defaultUom);
  }, [isSubProduct, yieldUom, b2bEnabled, b2bSalesConfig, parStockUom]);

  function handleParStockUomChange(nextUom: string) {
    const currentQty = parseFloat(parStock) || 0;
    if (currentQty > 0 && parStockUom && nextUom && nextUom !== parStockUom) {
      const converted = convertProductParStockQty(currentQty, parStockUom, nextUom);
      if (converted !== null) {
        setParStock(String(Number(converted.toFixed(4))));
      }
    }
    setParStockUom(nextUom);
  }

  function toggleParStockUomBasis() {
    const options = parStockUomOptionList;
    if (options.length < 2) return;
    const currentIndex = Math.max(0, options.indexOf(parStockUom));
    const nextUom = options[(currentIndex + 1) % options.length];
    handleParStockUomChange(nextUom);
  }

  function setProductType(subProduct: boolean) {
    setIsSubProduct(subProduct);
    if (subProduct) {
      setB2cEnabled(false);
      setB2bEnabled(false);
      setRrp('');
      setAliases([]);
    } else {
      setB2cEnabled(true);
      setB2bEnabled(false);
      setYieldQuantity('');
      setYieldUom('');
    setYieldAltUnits([]);
      setActivationPeriodHours('');
    }
  }

  function resetEditor() {
    setSelectedProductId('');
    setName('');
    setIsSubProduct(false);
    setProductId('');
    setCategory('');
    setGroup('');
    setB2cEnabled(true);
    setB2bEnabled(false);
    setRrp('');
    setYieldQuantity('');
    setYieldUom('');
    setYieldAltUnits([]);
    setExpiryPeriodDays('');
    setActivationPeriodHours('');
    setParStock('');
    setParStockUom('');
    setProductLocationIds(selectedLocationIds.length > 0 ? [...selectedLocationIds] : []);
    setAliases([]);
    setLines([blankProductLine()]);
    setPackagingLines([blankProductLine()]);
    setB2bSalesConfig(blankB2bSalesConfig());
    setIsEditing(true);
    setError(null);
  }

  function loadProduct(product: Product) {
    setSelectedProductId(String(product.id));
    setName(product.name);
    setIsSubProduct(product.isSubProduct);
    setProductId(product.productId);
    setCategory(product.category);
    setGroup(product.group);
    setB2cEnabled(product.b2cEnabled);
    setB2bEnabled(product.b2bEnabled);
    setRrp(product.rrp > 0 ? String(product.rrp) : '');
    setYieldQuantity(product.yieldQuantity > 0 ? String(product.yieldQuantity) : '');
    setYieldUom(product.yieldUom ? fromApiUom(product.yieldUom) : '');
    const loadedYieldUom = product.yieldUom ? fromApiUom(product.yieldUom) : '';
    const parsedB2bSales = parseB2bSalesConfigJson(product.b2bSalesConfigJson);
    const loadedBatchUom = product.isSubProduct
      ? loadedYieldUom
      : (product.b2bEnabled
        ? (product.b2bPackageUnit?.trim()
          || formatDeliveryUnitPath(parsedB2bSales.principal.delivery).trim())
        : '');
    const loadedBatchQty = product.isSubProduct ? product.yieldQuantity : 1;
    setYieldAltUnits(refreshBatchAdditionalUoms(
      loadYieldAltUnitsFromProduct(product.yieldAltUnitsJson, loadedBatchUom),
      loadedBatchQty,
      loadedBatchUom,
    ));
    setExpiryPeriodDays(product.expiryPeriodDays > 0 ? String(product.expiryPeriodDays) : '');
    setActivationPeriodHours(product.activationPeriodHours > 0 ? String(product.activationPeriodHours) : '');
    setParStock((product.parStock ?? 0) > 0 ? String(product.parStock) : '');
    setParStockUom(product.parStockUom ? fromApiUom(product.parStockUom) : '');
    setProductLocationIds(product.locationExternalIds?.length
      ? [...product.locationExternalIds]
      : selectedLocationIds.length > 0 ? [...selectedLocationIds] : []);
    setAliases((product.aliases ?? []).map(alias => ({
      key: alias.id ? `saved-alias-${alias.id}` : `alias-${alias.name}`,
      id: alias.id,
      name: alias.name,
      rrp: alias.rrp > 0 ? String(alias.rrp) : '',
    })));
    setLines(mapProductItemsToLines(product.items, subProductCatalog));
    setPackagingLines(mapProductItemsToLines(product.packagingItems, subProductCatalog));
    if (product.b2bEnabled && !product.isSubProduct && !parsedB2bSales.principal.rrp && product.rrp > 0) {
      parsedB2bSales.principal.rrp = String(product.rrp);
    }
    setB2bSalesConfig(parsedB2bSales);
    setError(null);
  }

  function updateLine(key: string, patch: Partial<ProductLine>) {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function handleSubProductSelect(key: string, product: Product | null) {
    if (!product) {
      updateLine(key, {
        componentId: '',
        componentName: '',
        componentUom: '',
        componentUomPrice: '',
        sourceProductId: undefined,
      });
      return;
    }

    let resolved = savedProducts.find(item => item.id === product.id) ?? product;
    try {
      resolved = await api.product(product.id);
      setSavedProducts(prev => prev.map(item => (item.id === resolved.id ? resolved : item)));
    } catch {
      // Use the list copy when the detail fetch fails.
    }

    const next = productLineFromSubProduct(resolved);
    updateLine(key, {
      componentId: next.componentId,
      componentName: next.componentName,
      componentUom: next.componentUom,
      componentUomPrice: next.componentUomPrice,
      quantity: next.quantity,
      sourceProductId: resolved.id,
    });
    if (b2bEnabled && !isSubProduct) {
      setB2bSalesConfig(prev => seedB2bSalesFromSubProduct(prev, resolved));
    }
  }

  function handleComponentSelect(key: string, component: ReturnType<typeof ingredientToRow> | null) {
    if (!component) {
      updateLine(key, {
        componentId: '',
        componentName: '',
        componentUom: '',
        componentUomPrice: '',
      });
      return;
    }
    const next = productLineFromComponent(component);
    updateLine(key, {
      componentId: next.componentId,
      componentName: next.componentName,
      componentUom: next.componentUom,
      componentUomPrice: next.componentUomPrice,
      sourceProductId: undefined,
    });
  }

  function openAddGroup() {
    const nextId = Date.now();
    setEditingGroup({
      id: nextId,
      name: '',
      category: category || 'Food',
      items: 0,
    });
    setIsNewGroup(true);
  }

  function saveGroup(updated: GroupRow) {
    const name = updated.name.trim();
    if (!name) return;

    setExtraGroups(prev => {
      const next = prev.includes(name) ? prev : [...prev, name];
      saveExtraGroups(next);
      return next;
    });
    setGroup(name);
    if (category !== updated.category) setCategory(updated.category);
    setEditingGroup(null);
    setIsNewGroup(false);
  }

  async function confirmDeleteGroup(reassignTo: string) {
    if (!deletingGroup) return;
    const affected = findProductsUsingGroup(savedProducts, deletingGroup);
    const draftUsesGroup = Boolean(group) && groupsMatch(group, deletingGroup);
    const needsReassignment = affected.length > 0 || draftUsesGroup;

    if (needsReassignment && !reassignTo.trim()) {
      setDeletingGroupError('Select a group to reassign affected products.');
      return;
    }

    setDeletingGroupSaving(true);
    setDeletingGroupError(null);
    try {
      for (const product of affected) {
        const updated = await api.updateProduct(
          product.id,
          productToUpsertPayload(product, { group: reassignTo }),
        );
        setSavedProducts(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      }

      if (draftUsesGroup) {
        setGroup(reassignTo);
      } else if (groupsMatch(group, deletingGroup)) {
        setGroup('');
      }

      setExtraGroups(removeExtraGroup(deletingGroup));
      setDeletingGroup(null);
    } catch (err) {
      setDeletingGroupError(err instanceof Error ? err.message : 'Failed to delete group.');
    } finally {
      setDeletingGroupSaving(false);
    }
  }

  function openAddComponent(lineKey: string, target: 'product' | 'packaging' = 'product') {
    setComponentSaveError(null);
    setComponentEditorTarget(target);
    setComponentEditorLineKey(lineKey);
    setIsNewComponent(true);
    setEditComponentRow({
      ...blankComponentRow,
      category: category || blankComponentRow.category,
      group: group || blankComponentRow.group,
      locations: selectedLocationIds.length > 0 ? [...selectedLocationIds] : blankComponentRow.locations,
    });
  }

  async function handleSaveComponent(updated: Partial<ReturnType<typeof ingredientToRow>>) {
    if (!editComponentRow || !componentEditorLineKey) return;
    setComponentSaveError(null);

    const newRow = { ...blankComponentRow, ...editComponentRow, ...updated };
    try {
      const created = await api.createIngredient(rowToIngredient(newRow, {}));
      const savedRow = mergeSavedRow(created, newRow);
      setComponents(prev => [savedRow, ...prev.filter(r => r.id !== savedRow.id)]);
      if (componentEditorTarget === 'packaging') {
        handlePackagingComponentSelect(componentEditorLineKey, savedRow);
      } else {
        handleComponentSelect(componentEditorLineKey, savedRow);
      }
      setEditComponentRow(null);
      setComponentEditorLineKey(null);
      setIsNewComponent(false);
    } catch (err) {
      setComponentSaveError(err instanceof Error ? err.message : 'Failed to save component.');
    }
  }

  function addLine() {
    setLines(prev => [...prev, blankProductLine()]);
  }

  function removeLine(key: string) {
    setLines(prev => {
      const next = prev.filter(line => line.key !== key);
      return next.length > 0 ? next : [blankProductLine()];
    });
  }

  function updatePackagingLine(key: string, patch: Partial<ProductLine>) {
    setPackagingLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handlePackagingComponentSelect(key: string, component: ReturnType<typeof ingredientToRow> | null) {
    if (!component) {
      updatePackagingLine(key, {
        componentId: '',
        componentName: '',
        componentUom: '',
        componentUomPrice: '',
      });
      return;
    }
    const next = productLineFromComponent(component);
    updatePackagingLine(key, {
      componentId: next.componentId,
      componentName: next.componentName,
      componentUom: next.componentUom,
      componentUomPrice: next.componentUomPrice,
    });
  }

  function addPackagingLine() {
    setPackagingLines(prev => [...prev, blankProductLine()]);
  }

  function removePackagingLine(key: string) {
    setPackagingLines(prev => {
      const next = prev.filter(line => line.key !== key);
      return next.length > 0 ? next : [blankProductLine()];
    });
  }

  function addAlias() {
    setAliases(prev => [...prev, blankProductAlias()]);
  }

  function updateAlias(key: string, patch: Partial<ProductAliasLine>) {
    setAliases(prev => prev.map(alias => (alias.key === key ? { ...alias, ...patch } : alias)));
  }

  function removeAlias(key: string) {
    setAliases(prev => prev.filter(alias => alias.key !== key));
  }

  function toggleProductLocation(externalId: string) {
    setProductLocationIds(prev => (
      prev.includes(externalId)
        ? prev.filter(id => id !== externalId)
        : [...prev, externalId]
    ));
  }

  function handleB2cEnabledChange(checked: boolean) {
    if (!checked) {
      setB2cEnabled(false);
      return;
    }
    setB2cEnabled(true);
    setB2bEnabled(false);
    setB2bSalesConfig(blankB2bSalesConfig());
  }

  function handleB2bEnabledChange(checked: boolean) {
    if (!checked) {
      setB2bEnabled(false);
      setB2bSalesConfig(blankB2bSalesConfig());
      return;
    }
    setB2bEnabled(true);
    setB2cEnabled(false);
    if (rrp.trim()) {
      setB2bSalesConfig(prev => ({
        ...prev,
        principal: prev.principal.rrp.trim()
          ? prev.principal
          : { ...prev.principal, rrp },
      }));
    }
  }

  async function handleSave() {
    if (!orgReady || !selectedCompanyId) {
      showSaveError('Select a company and at least one location in the header.');
      return;
    }
    if (!name.trim()) {
      showSaveError(isSubProduct
        ? 'Enter a sub-product name to generate the product ID.'
        : 'Enter a principal product name to generate the product ID.');
      return;
    }
    if (!category) {
      showSaveError('Category is required.');
      return;
    }
    if (!group) {
      showSaveError('Group is required.');
      return;
    }
    if (!isSubProduct && !b2cEnabled && !b2bEnabled) {
      showSaveError('Select a product type: B2C or B2B.');
      return;
    }
    if (!isSubProduct && b2cEnabled && b2bEnabled) {
      showSaveError('A product must be either B2C or B2B, not both.');
      return;
    }

    const b2bConfigForSave = !isSubProduct && b2bEnabled
      ? buildB2bConfigForSave(b2bSalesConfig, rrpValue)
      : b2bSalesConfig;

    if (isSubProduct) {
      const yieldQty = parseFloat(yieldQuantity) || 0;
      if (yieldQty <= 0) {
        showSaveError('Enter a yield quantity greater than zero.');
        return;
      }
      if (!yieldUom) {
        showSaveError('Select a UOM for this sub-product.');
        return;
      }
      const expiryDays = parseInt(expiryPeriodDays, 10);
      if (!Number.isFinite(expiryDays) || expiryDays <= 0) {
        showSaveError('Enter an expiry period (days) greater than zero.');
        return;
      }
      const activationHours = parseInt(activationPeriodHours, 10);
      if (!Number.isFinite(activationHours) || activationHours < 0) {
        showSaveError('Enter incubation hours as zero or greater.');
        return;
      }
    } else if (b2bEnabled) {
      const expiryDays = parseInt(expiryPeriodDays, 10);
      if (!Number.isFinite(expiryDays) || expiryDays <= 0) {
        showSaveError('Enter an expiry period (days) greater than zero for B2B products.');
        return;
      }
      const activationHours = parseInt(activationPeriodHours, 10);
      if (!Number.isFinite(activationHours) || activationHours < 0) {
        showSaveError('Enter incubation hours as zero or greater.');
        return;
      }
      const linked = resolveLinkedSubProduct(lines, savedProducts);
      if (!linked) {
        showSaveError('Select a sub-product in Product Component for B2B sales COGS.');
        return;
      }
      const principalRrp = resolvePrincipalB2bRrp(b2bConfigForSave, rrpValue);
      if (principalRrp <= 0) {
        showSaveError(b2cEnabled
          ? 'Enter an RRP for the product or the principal B2B delivery unit.'
          : 'Enter an RRP for the principal B2B delivery unit.');
        return;
      }
      if (!b2bDeliveryResolvesToYieldUom(b2bConfigForSave.principal.delivery, linked)) {
        const hint = describeB2bDeliveryYieldResolution(b2bConfigForSave.principal.delivery, linked);
        showSaveError(hint.message || 'Principal delivery unit must break down to the sub-product batch UOM.');
        return;
      }
      if (b2bConfigForSave.alternates.some(line => (
        isB2bAlternateLineActive(line)
        && !b2bDeliveryResolvesToYieldUom(line.delivery, linked)
      ))) {
        showSaveError('Each alternate delivery unit with an RRP must break down to the sub-product batch UOM.');
        return;
      }
      if (b2bConfigForSave.alternates.some(line => isB2bAlternateLineActive(line) && (parseFloat(line.rrp) || 0) <= 0)) {
        showSaveError('Each alternate delivery unit with an RRP needs a value greater than zero.');
        return;
      }
    }

    const payloadItems = lines
      .filter(line => line.componentId)
      .map(line => ({
        componentId: line.componentId,
        componentName: line.componentName,
        componentUom: line.componentUom,
        componentUomPrice: parseFloat(line.componentUomPrice) || 0,
        quantity: parseFloat(line.quantity) || 0,
      }));

    if (payloadItems.length === 0) {
      showSaveError(b2bEnabled && !isSubProduct
        ? 'Add at least one component or sub-product line.'
        : 'Add at least one smart component or sub-product line.');
      return;
    }
    if (payloadItems.some(item => item.quantity <= 0)) {
      showSaveError('Each line requires a quantity greater than zero.');
      return;
    }

    const payloadPackagingItems = packagingLines
      .filter(line => line.componentId)
      .map(line => ({
        componentId: line.componentId,
        componentName: line.componentName,
        componentUom: line.componentUom,
        componentUomPrice: parseFloat(line.componentUomPrice) || 0,
        quantity: parseFloat(line.quantity) || 0,
      }));

    if (payloadPackagingItems.some(item => item.quantity <= 0)) {
      showSaveError('Each packaging line requires a quantity greater than zero.');
      return;
    }

    const payloadAliases = aliases
      .filter(alias => alias.name.trim())
      .map(alias => ({
        id: alias.id,
        name: alias.name.trim(),
        rrp: parseFloat(alias.rrp) || 0,
      }));

    const effectiveRrp = isSubProduct
      ? 0
      : b2bEnabled
        ? resolvePrincipalB2bRrp(b2bConfigForSave, rrpValue)
        : rrpValue;

    const payload = {
      productId: productId || undefined,
      name: name.trim(),
      category,
      group,
      isSubProduct,
      b2cEnabled: isSubProduct ? false : b2cEnabled,
      b2bEnabled: isSubProduct ? false : b2bEnabled,
      b2bPackageUnit: isSubProduct || !b2bEnabled
        ? undefined
        : formatDeliveryUnitPath(b2bConfigForSave.principal.delivery),
      b2bSalesConfigJson: isSubProduct || !b2bEnabled
        ? undefined
        : serializeB2bSalesConfig(b2bConfigForSave),
      rrp: effectiveRrp,
      yieldQuantity: isSubProduct ? parseFloat(yieldQuantity) || 0 : undefined,
      yieldUom: isSubProduct ? toApiUom(yieldUom) : undefined,
      yieldAltUnitsJson: supportsBatchAdditionalUom ? serializeYieldAltUnits(yieldAltUnits) : undefined,
      expiryPeriodDays: (isSubProduct || b2bEnabled) ? parseInt(expiryPeriodDays, 10) || 0 : undefined,
      activationPeriodHours: supportsBatchAdditionalUom
        ? parseInt(activationPeriodHours, 10) || 0
        : undefined,
      parStock: parseFloat(parStock) || 0,
      parStockUom: (parseFloat(parStock) || 0) > 0
        ? serializeProductParStockUom(isSubProduct
          ? (yieldUom || parStockUom)
          : (parStockUom || resolveDefaultProductParStockUom({
            isSubProduct,
            yieldUom,
            b2bEnabled,
            b2bSalesConfig,
          })))
        : undefined,
      active: true,
      companyId: selectedCompanyId,
      locationExternalIds: productLocationIds,
      aliases: isSubProduct ? [] : payloadAliases,
      items: payloadItems,
      packagingItems: payloadPackagingItems,
    };

    setSaving(true);
    setError(null);

    try {
      const saved = selectedProductId
        ? await api.updateProduct(Number(selectedProductId), payload)
        : await api.createProduct(payload);
      setSelectedProductId(String(saved.id));
      setProductId(saved.productId);
      loadProduct(saved);
      if (!isSubProduct && b2bEnabled) {
        setB2bSalesConfig(b2bConfigForSave);
      }
      setIsEditing(false);
      loadSavedProducts();
    } catch (err) {
      showSaveError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={pageShellClass({ embedded, spacing: 'loose' })}>
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
            <h2 className="text-lg font-semibold mt-0.5">Product</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Build a product or sub-product recipe from smart components and track total cost.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetEditor}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted/40"
            >
              <Plus size={14} />
              New
            </button>
            {savedProducts.length > 0 ? (
              <select
                value={selectedProductId}
                onChange={e => {
                  const id = e.target.value;
                  if (!id) {
                    resetEditor();
                    return;
                  }
                  const product = savedProducts.find(p => String(p.id) === id);
                  if (product) {
                    loadProduct(product);
                    setIsEditing(false);
                  }
                }}
                className={`${filterSelectCls} min-w-[220px]`}
              >
                <option value="">Load saved product…</option>
                {savedProducts.map(product => (
                  <option key={product.id} value={String(product.id)}>
                    {product.productId} · {product.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetEditor}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted/40"
          >
            <Plus size={14} />
            New
          </button>
          {savedProducts.length > 0 ? (
            <select
              value={selectedProductId}
              onChange={e => {
                const id = e.target.value;
                if (!id) {
                  resetEditor();
                  return;
                }
                const product = savedProducts.find(p => String(p.id) === id);
                if (product) {
                  loadProduct(product);
                  setIsEditing(false);
                }
              }}
              className={`${filterSelectCls} min-w-[220px]`}
            >
              <option value="">Load saved product…</option>
              {savedProducts.map(product => (
                <option key={product.id} value={String(product.id)}>
                  {product.productId} · {product.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      )}

      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select a company and at least one location in the header to build products.
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading components…</p>
      ) : (
        <>
          <fieldset disabled={!isEditing || saving} className="space-y-5 border-0 p-0 m-0 min-w-0 disabled:opacity-90">
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className={labelCls}>Type</p>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isSubProduct}
                      onChange={() => setProductType(false)}
                      className="rounded border-border"
                    />
                    Product
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSubProduct}
                      onChange={() => setProductType(true)}
                      className="rounded border-border"
                    />
                    Sub-Product
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <p className={labelCls}>Type</p>
                <div
                  className={`flex flex-wrap gap-4 rounded-md border px-3 py-2 ${
                    isSubProduct ? 'border-border bg-muted/30 opacity-70' : 'border-transparent'
                  }`}
                  title={isSubProduct ? 'Sub-products are prep items used inside a B2C or B2B product.' : undefined}
                >
                  <label className={`inline-flex items-center gap-2 text-xs ${isSubProduct ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="product-type"
                      checked={b2cEnabled}
                      disabled={isSubProduct}
                      onChange={() => handleB2cEnabledChange(true)}
                      className="border-border disabled:cursor-not-allowed"
                    />
                    B2C
                  </label>
                  <label className={`inline-flex items-center gap-2 text-xs ${isSubProduct ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="product-type"
                      checked={b2bEnabled}
                      disabled={isSubProduct}
                      onChange={() => handleB2bEnabledChange(true)}
                      className="border-border disabled:cursor-not-allowed"
                    />
                    B2B
                  </label>
                </div>
                {isSubProduct ? (
                  <p className="text-[10px] text-muted-foreground">
                    Sub-products are made or prepped as part of a B2C or B2B product — they are not sold directly on a channel.
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    A product is either B2C (POS / takeaway / online retail) or B2B (wholesale sales orders).
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-id">Product ID</label>
                <input
                  id="product-id"
                  type="text"
                  value={productId}
                  readOnly
                  placeholder="Auto-generated"
                  className={`${fieldCls} bg-muted/30`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-category">Category</label>
                <select
                  id="product-category"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">Select category…</option>
                  {categoryOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="product-group">Group</label>
                <div className="flex gap-1.5 items-center">
                  <ProductGroupSelect
                    value={group}
                    options={groupOptions}
                    onChange={setGroup}
                    onDeleteRequest={name => {
                      setDeletingGroupError(null);
                      setDeletingGroup(name);
                    }}
                    className="flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={openAddGroup}
                    className={addBtnCls}
                    title="Add new group"
                    aria-label="Add new group"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">
              {isSubProduct ? 'Batch Production & Location' : 'Pricing, Par Stock & Location'}
            </h3>
            <p className="text-[11px] text-muted-foreground -mt-2">
              {isSubProduct
                ? 'Sub-products are made or prepped in batches. Enter the yield quantity and UOM to calculate unit COGS.'
                : 'Principal product name and aliases share the same smart components; aliases can be sold at different prices for different clients.'}
            </p>

            {isSubProduct ? (
              <>
                <div className="space-y-1.5">
                  <label className={labelCls} htmlFor="sub-product-name">Sub-Product Name</label>
                  <input
                    id="sub-product-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Burger Patty Prep, Espresso Base"
                    className={fieldCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelCls} htmlFor="yield-quantity">Quantity</label>
                    <input
                      id="yield-quantity"
                      type="number"
                      min="0"
                      step="any"
                      value={yieldQuantity}
                      onChange={e => setYieldQuantity(e.target.value)}
                      placeholder="e.g. 10"
                      className={fieldCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls} htmlFor="yield-uom">UOM</label>
                    <div className="flex gap-1.5 items-center">
                      <select
                        id="yield-uom"
                        value={yieldUom}
                        onChange={e => setYieldUom(e.target.value)}
                        className={`${fieldCls} flex-1`}
                      >
                        <option value="">Select UOM…</option>
                        {getKnownRecipeUnits().map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setYieldAltUnits(prev => createDefaultBatchAdditionalEntry(prev, yieldQuantity, yieldUom))}
                        disabled={!yieldUom}
                        className={addBtnCls}
                        title="Add additional UOM"
                        aria-label="Add additional UOM"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS</p>
                    <p className="text-sm font-semibold mt-1">
                      {yieldUom && (parseFloat(yieldQuantity) || 0) > 0
                        ? `${formatRm(subProductUnitCost)} / ${yieldUom}`
                        : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Product COGS {formatRm(effectiveProductCogs)} ÷ {yieldQuantity || '—'}
                    </p>
                  </div>
                </div>
                <SubProductBatchAdditionalUoms
                  yieldQuantity={yieldQuantity}
                  yieldUom={yieldUom}
                  altUnits={yieldAltUnits}
                  onAltUnitsChange={setYieldAltUnits}
                />
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex gap-1.5 items-end">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <label className={labelCls} htmlFor="principal-product-name">Principal Product Name</label>
                      <input
                        id="principal-product-name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Wagyu Burger, Espresso Latte"
                        className={fieldCls}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addAlias}
                      className={addBtnCls}
                      title="Add product alias"
                      aria-label="Add product alias"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {aliases.length > 0 ? (
                    <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Product aliases
                        </p>
                        <button
                          type="button"
                          onClick={addAlias}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border text-[10px] font-medium text-primary hover:bg-primary/5"
                        >
                          <Plus size={12} />
                          Add alias
                        </button>
                      </div>
                      {aliases.map(alias => {
                        const aliasRrp = parseFloat(alias.rrp) || 0;
                        return (
                          <div key={alias.key} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_5rem_auto] gap-2 items-center">
                            <input
                              type="text"
                              value={alias.name}
                              onChange={e => updateAlias(alias.key, { name: e.target.value })}
                              placeholder="Client-specific alias name"
                              className={fieldCls}
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground shrink-0">RM</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={alias.rrp}
                                onChange={e => updateAlias(alias.key, { rrp: e.target.value })}
                                placeholder="RRP"
                                className={fieldCls}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatCogsPercent(effectiveProductCogs, aliasRrp)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAlias(alias.key)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground justify-self-end"
                              aria-label="Remove alias"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Product COGS</p>
                    <p className="text-sm font-semibold mt-1">{formatRm(effectiveProductCogs)}</p>
                    {!isSubProduct && b2cEnabled && !b2bEnabled && totalPackagingCost > 0 ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        B2C dine-in excludes packaging; takeaway adds {formatRm(totalPackagingCost)} at POS.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP</p>
                    {b2bEnabled && !b2cEnabled ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Set RRP per delivery unit in B2B Sales below.
                      </p>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">RM</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rrp}
                          onChange={e => setRrp(e.target.value)}
                          placeholder="0.00"
                          className={fieldCls}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS %</p>
                    <p className="text-sm font-semibold mt-1">{principalCogsPercent}</p>
                  </div>
                </div>
              </>
            )}

            {(isSubProduct || b2bEnabled) ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 max-w-2xl">
                <div className="space-y-1.5">
                  <label className={labelCls} htmlFor="expiry-period-days">Expiry period (days)</label>
                  <input
                    id="expiry-period-days"
                    type="number"
                    min="1"
                    step="1"
                    value={expiryPeriodDays}
                    onChange={e => setExpiryPeriodDays(e.target.value)}
                    placeholder="e.g. 7"
                    className={fieldCls}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Each production batch expires this many days after its production date.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls} htmlFor="incubation-period-hours">Incubation (hours)</label>
                  <input
                    id="incubation-period-hours"
                    type="number"
                    min="0"
                    step="1"
                    value={activationPeriodHours}
                    onChange={e => setActivationPeriodHours(e.target.value)}
                    placeholder="e.g. 24"
                    className={fieldCls}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Hours after production before the batch can be sold. Use 0 if sellable immediately.
                  </p>
                </div>
              </div>
            ) : null}

            {isSubProduct ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                <div className="space-y-1.5">
                  <label className={labelCls} htmlFor="par-stock-qty">Par Stock</label>
                  <input
                    id="par-stock-qty"
                    type="number"
                    min="0"
                    step="any"
                    value={parStock}
                    onChange={e => setParStock(e.target.value)}
                    placeholder="0"
                    className={fieldCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>UOM</label>
                  <p className={fieldCls}>{yieldUom || '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Follows batch UOM.</p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="par-stock-qty">Par Stock</label>
                <input
                  id="par-stock-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={parStock}
                  onChange={e => setParStock(e.target.value)}
                  placeholder="0"
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="par-stock-uom">UOM</label>
                <select
                  id="par-stock-uom"
                  value={parStockUom}
                  onChange={e => handleParStockUomChange(e.target.value)}
                  className={fieldCls}
                >
                  <option value="">Select UOM…</option>
                  {parStockUomOptionList.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Base Par Stock</p>
                <button
                  type="button"
                  onClick={toggleParStockUomBasis}
                  className={`${fieldCls} text-left mt-1 cursor-pointer hover:border-primary/60 transition-colors`}
                  title="Click to recalculate par stock in the next UOM"
                >
                  {formatProductParStock(parseFloat(parStock) || 0, parStockUom || '—')}
                </button>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Click to switch UOM and recalculate quantity.
                </p>
              </div>
            </div>
            )}

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Location
              </p>
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">No locations available for this company.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {locations.map(loc => {
                    const checked = productLocationIds.includes(loc.externalId);
                    return (
                      <label
                        key={loc.externalId}
                        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-background hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProductLocation(loc.externalId)}
                          className="rounded border-border"
                          aria-label={`Location ${loc.name}`}
                        />
                        {loc.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {!isSubProduct && b2bEnabled ? (
            <B2bSalesBox
              config={b2bSalesConfig}
              linkedSubProduct={linkedSubProduct}
              disabled={!isEditing || saving}
              onChange={setB2bSalesConfig}
            />
          ) : null}

          {!isSubProduct && b2bEnabled ? (
            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Additional UOM</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Alternate units for the principal B2B delivery unit
                  {batchUomForAdditional ? ` (${batchUomForAdditional})` : ''}.
                </p>
              </div>
              {batchUomForAdditional ? (
                <>
                  <div className="flex gap-1.5 items-center max-w-md">
                    <p className={`${fieldCls} flex-1`}>{batchUomForAdditional}</p>
                    <button
                      type="button"
                      onClick={() => setYieldAltUnits(prev => createDefaultBatchAdditionalEntry(
                        prev,
                        String(batchQtyForAdditional),
                        batchUomForAdditional,
                      ))}
                      disabled={!isEditing || saving}
                      className={addBtnCls}
                      title="Add additional UOM"
                      aria-label="Add additional UOM"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <SubProductBatchAdditionalUoms
                    yieldQuantity={String(batchQtyForAdditional)}
                    yieldUom={batchUomForAdditional}
                    altUnits={yieldAltUnits}
                    onAltUnitsChange={setYieldAltUnits}
                  />
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Configure the principal delivery unit in B2B Sales to add alternate units.
                </p>
              )}
            </section>
          ) : null}

          <ComponentLinesSection
            title="Product Component"
            description={!isSubProduct && b2bEnabled
              ? 'Add smart components or sub-products. Include at least one sub-product for B2B sales COGS.'
              : 'Add smart components, sub-products, and quantities to calculate product cost'}
            lines={lines}
            totalCost={totalCost}
            totalLabel="Total cost"
            availableComponents={availableComponents}
            includeSubProducts
            availableSubProducts={productComponentSubProducts}
            subProductCatalog={subProductCatalog}
            onUpdateLine={updateLine}
            onComponentSelect={handleComponentSelect}
            onSubProductSelect={handleSubProductSelect}
            onRemoveLine={removeLine}
            onAddLine={addLine}
            onOpenAddComponent={lineKey => openAddComponent(lineKey, 'product')}
            onOpenProductionMethod={() => setProductionMethodOpen(true)}
          />

          <ComponentLinesSection
            title="Packaging Cost"
            description="Add packaging smart components and quantities to calculate packaging cost"
            lines={packagingLines}
            totalCost={totalPackagingCost}
            totalLabel="Total packaging cost"
            availableComponents={availableComponents}
            onUpdateLine={updatePackagingLine}
            onComponentSelect={handlePackagingComponentSelect}
            onRemoveLine={removePackagingLine}
            onAddLine={addPackagingLine}
            onOpenAddComponent={lineKey => openAddComponent(lineKey, 'packaging')}
          />
          </fieldset>

          {error ? (
            <div
              ref={saveErrorRef}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {selectedProductId ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedProductId) return;
                  if (!window.confirm('Delete this product?')) return;
                  void api.deleteProduct(Number(selectedProductId))
                    .then(() => {
                      resetEditor();
                      loadSavedProducts();
                    })
                    .catch(err => setError(err instanceof Error ? err.message : 'Failed to delete product.'));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-red-500/30 text-xs font-semibold text-red-600 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted/40"
                >
                  <X size={14} />
                  Close
                </button>
              ) : null}
              {isEditing ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  <Check size={14} />
                  {saving ? 'Saving…' : selectedProductId ? 'Update product' : 'Save product'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#5A7A2A] text-white text-xs font-semibold cursor-default"
                  >
                    <Check size={14} />
                    Saved
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-xs font-semibold hover:bg-muted/40"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {editingGroup ? (
            <GroupEditPanel
              group={editingGroup}
              isNew={isNewGroup}
              onClose={() => {
                setEditingGroup(null);
                setIsNewGroup(false);
              }}
              onSave={saveGroup}
            />
          ) : null}

          {deletingGroup ? (
            <DeleteProductGroupModal
              groupName={deletingGroup}
              affectedProducts={findProductsUsingGroup(savedProducts, deletingGroup)}
              groupOptions={groupOptions}
              draftUsesGroup={Boolean(group) && groupsMatch(group, deletingGroup)}
              saving={deletingGroupSaving}
              error={deletingGroupError}
              onClose={() => {
                if (deletingGroupSaving) return;
                setDeletingGroup(null);
                setDeletingGroupError(null);
              }}
              onConfirm={reassignTo => void confirmDeleteGroup(reassignTo)}
            />
          ) : null}

          {editComponentRow && selectedCompanyId ? createPortal(
            <ComponentEditPanel
              row={editComponentRow}
              isNew={isNewComponent}
              existingComponents={components}
              selectedCompanyId={selectedCompanyId}
              selectedLocationIds={selectedLocationIds}
              saveError={componentSaveError}
              elevated
              onClose={() => {
                setEditComponentRow(null);
                setComponentEditorLineKey(null);
                setIsNewComponent(false);
                setComponentSaveError(null);
              }}
              onSave={updated => void handleSaveComponent(updated)}
            />,
            document.body,
          ) : null}

          {productionMethodOpen ? (
            <ProductionMethodModal
              category={category}
              group={group}
              productName={name.trim() || 'Product'}
              productKey={productKeyFromParts(
                selectedProductId ? Number(selectedProductId) : null,
                productId,
              )}
              components={mapProductLinesToComponentItems(lines)}
              yieldQuantity={parseFloat(yieldQuantity) || 1}
              onClose={() => setProductionMethodOpen(false)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
