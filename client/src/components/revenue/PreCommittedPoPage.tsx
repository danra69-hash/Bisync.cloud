import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarRange,
  Copy,
  Download,
  ExternalLink,
  Handshake,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls, inlineNumberCls, inlinePriceCls } from '../layout/formControls';
import {
  api,
  type Company,
  type LocationConfig,
  type PurchaseOrder,
  type Vendor,
} from '../../api';
import {
  applyVendorProductOverrides,
  formatDeliveryUnitPath,
  type VendorProductCatalogItem,
} from '../../data/vendorProductCatalog';
import { fromApiUom, resolveDetailConfigForRow } from '../../data/componentForm';
import {
  catalogProductAllowedByOrgPolicy,
  componentMatchesLocations,
  resolveTaggedProductsForComponent,
  resolveVendorsForSelectedLocations,
} from '../../data/createOrder';
import { useOrgVendorPolicy } from '../../hooks/useOrgVendorPolicy';
import { ingredientToRow } from './smartIngredientShared';
import { OrderTemplateVendorProductPickerModal } from './OrderTemplateVendorProductPickerModal';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { ColGroup } from '../shared/SortableTableHead';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { resolvePurchaseOrderSignatories } from '../../data/purchaseOrderSignatories';
import { buildPurchaseOrderPdfData, findVendorForGroup } from '../../data/buildPurchaseOrderPdfData';
import {
  downloadPurchaseOrderPdf,
  openPurchaseOrderPdfInTab,
  type PurchaseOrderPdfData,
} from '../../data/generatePurchaseOrderPdf';
import { PurchaseOrderPdfPreview } from './PurchaseOrderPdfPreview';
import {
  buildVendorOrderShareUrl,
  buildVendorOrderWhatsAppUrl,
  copyVendorOrderShareLink,
} from '../../data/vendorOrderShare';
import { refreshVendorProductPricesFromApi } from '../../data/vendorProductPrices';
import type { OrderCartVendorGroup } from '../../data/createOrder';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
};

type ComponentRow = ReturnType<typeof ingredientToRow>;

type CommitmentLine = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  deliveryUnit: string;
  vendorProductId: string;
  vendorExternalId: string;
  vendorName: string;
  productName: string;
  quantity: string;
  unitPrice: string;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

const fieldCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const labelCls = 'text-xs font-medium text-foreground';
const panelCls = 'rounded-lg border border-border bg-card overflow-hidden flex flex-col min-h-[22rem]';
const tdCls = 'px-3 py-2 align-middle border-r border-b border-border last:border-r-0 text-xs';

export function PreCommittedPoPage({
  selectedCompanyId,
  embedded = false,
}: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [allLocations, setAllLocations] = useState<LocationConfig[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [vendorExternalId, setVendorExternalId] = useState('');
  const [drawdownLocationIds, setDrawdownLocationIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<CommitmentLine[]>([]);
  const [pickerComponent, setPickerComponent] = useState<ComponentRow | null>(null);
  const today = useMemo(() => new Date(), []);
  const [commitmentStart, setCommitmentStart] = useState(() => toDateInputValue(today));
  const [commitmentEnd, setCommitmentEnd] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return toDateInputValue(end);
  });
  const [created, setCreated] = useState<{
    order: PurchaseOrder;
    pdf: PurchaseOrderPdfData;
    shareToken: string;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const companyLocations = useMemo(
    () => allLocations.filter(loc => loc.companyId === selectedCompanyId),
    [allLocations, selectedCompanyId],
  );

  // Catalog scope = drawdown locations (company commitment), not header outlet alone.
  const catalogLocationIds = drawdownLocationIds.length > 0
    ? drawdownLocationIds
    : companyLocations.map(loc => loc.externalId);

  const orgPolicyTags = useOrgVendorPolicy(selectedCompanyId, catalogLocationIds);

  const signatories = useMemo(
    () => (currentUser ? resolvePurchaseOrderSignatories(currentUser) : null),
    [currentUser],
  );

  useEffect(() => {
    void refreshVendorProductPricesFromApi();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompany(null);
      setVendors([]);
      setComponents([]);
      setDrawdownLocationIds([]);
      return;
    }
    setLoading(true);
    Promise.all([
      api.companies(),
      api.locationsConfig(),
      api.vendors(true),
      api.ingredients(),
    ])
      .then(([companies, locations, vendorRows, ingredientRows]) => {
        setCompany(companies.find(c => c.id === selectedCompanyId) ?? null);
        setAllLocations(locations);
        const companyLocs = locations.filter(loc => loc.companyId === selectedCompanyId);
        setDrawdownLocationIds(prev => {
          if (prev.length > 0) {
            const valid = new Set(companyLocs.map(l => l.externalId));
            const kept = prev.filter(id => valid.has(id));
            return kept.length > 0 ? kept : companyLocs.map(l => l.externalId);
          }
          // Default: all company locations may draw down.
          return companyLocs.map(l => l.externalId);
        });
        setVendors(vendorRows);
        setComponents(ingredientRows.map(ingredientToRow));
      })
      .catch(() => {
        setCompany(null);
        setVendors([]);
        setComponents([]);
      })
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  const vendorOptions = useMemo(
    () => resolveVendorsForSelectedLocations(
      components,
      catalogLocationIds,
      vendors,
      orgPolicyTags,
    ),
    [components, catalogLocationIds, vendors, orgPolicyTags],
  );

  const selectedVendor = useMemo(
    () => vendorOptions.find(v => v.externalId === vendorExternalId) ?? null,
    [vendorOptions, vendorExternalId],
  );

  const catalog = useMemo(() => applyVendorProductOverrides(), [components, vendorExternalId]);

  const componentList = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = components
      .filter(c => c.active)
      .filter(c => catalogLocationIds.length === 0 || componentMatchesLocations(c, catalogLocationIds))
      .map(component => {
        const tagged = resolveTaggedProductsForComponent(component, catalog, {
          locationIds: catalogLocationIds,
          vendorExternalId: vendorExternalId || undefined,
        }).filter(product => catalogProductAllowedByOrgPolicy(product, vendors, orgPolicyTags));
        return {
          component,
          taggedProductCount: tagged.length,
          addedProductCount: lines.filter(l => l.componentId === component.componentId).length,
        };
      })
      .filter(item => {
        if (vendorExternalId && item.taggedProductCount === 0) return false;
        if (!query) return true;
        return [
          item.component.componentId,
          item.component.name,
          item.component.category,
        ].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => a.component.name.localeCompare(b.component.name));
    return items;
  }, [
    components,
    catalog,
    catalogLocationIds,
    vendorExternalId,
    vendors,
    orgPolicyTags,
    lines,
    search,
  ]);

  const lineKeys = useMemo(() => new Set(lines.map(l => l.key)), [lines]);

  const grandTotal = useMemo(
    () => lines.reduce((sum, line) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      return sum + qty * price;
    }, 0),
    [lines],
  );

  const drawdownLocations = useMemo(
    () => companyLocations.filter(loc => drawdownLocationIds.includes(loc.externalId)),
    [companyLocations, drawdownLocationIds],
  );

  function toggleDrawdownLocation(externalId: string) {
    setDrawdownLocationIds(prev => (
      prev.includes(externalId)
        ? prev.filter(id => id !== externalId)
        : [...prev, externalId]
    ));
    setError(null);
  }

  function selectAllDrawdownLocations() {
    setDrawdownLocationIds(companyLocations.map(loc => loc.externalId));
    setError(null);
  }

  function clearDrawdownLocations() {
    setDrawdownLocationIds([]);
    setError(null);
  }

  function addProduct(component: ComponentRow, product: VendorProductCatalogItem) {
    const detail = resolveDetailConfigForRow(component);
    const key = `${component.componentId}::${product.id}`;
    if (lineKeys.has(key)) return;
    if (!vendorExternalId) {
      setVendorExternalId(product.vendorExternalId);
    }
    setLines(prev => [...prev, {
      key,
      componentId: component.componentId,
      componentName: component.name,
      componentUom: detail.vendorProductComponentUom[product.id]
        || fromApiUom(component.recipeUOM)
        || component.inventoryUOM,
      deliveryUnit: formatDeliveryUnitPath(product.delivery),
      vendorProductId: product.id,
      vendorExternalId: product.vendorExternalId,
      vendorName: product.vendorName,
      productName: product.productName,
      quantity: '1',
      unitPrice: String(product.deliveryPrice ?? 0),
    }]);
    setPickerComponent(null);
    setError(null);
  }

  function updateLine(key: string, patch: Partial<CommitmentLine>) {
    setLines(prev => prev.map(line => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines(prev => prev.filter(line => line.key !== key));
  }

  async function handleCreate() {
    if (!selectedCompanyId || !company) {
      setError('Select a company in the header. Pre-committed POs are issued at company level.');
      return;
    }
    if (drawdownLocationIds.length === 0) {
      setError('Select at least one location that may draw down this commitment.');
      return;
    }
    if (!selectedVendor) {
      setError('Select a vendor for this Pre-committed PO.');
      return;
    }
    if (!commitmentStart || !commitmentEnd) {
      setError('Choose Commitment Date from and to.');
      return;
    }
    if (commitmentEnd < commitmentStart) {
      setError('Commitment end date must be on or after the start date.');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one component / vendor product line.');
      return;
    }
    if (!signatories) {
      setError('No logged-in user found. Open the sidebar to select your account.');
      return;
    }

    const items = [];
    for (const line of lines) {
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Quantity must be greater than zero for ${line.productName}.`);
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setError(`Enter a valid bulk unit price for ${line.productName}.`);
        return;
      }
      if (line.vendorExternalId !== selectedVendor.externalId) {
        setError(`All lines must belong to vendor ${selectedVendor.name}.`);
        return;
      }
      items.push({
        componentId: line.componentId,
        componentName: line.componentName,
        vendorProductId: line.vendorProductId,
        name: line.productName,
        quantity: qty,
        unitPrice: price,
        unit: line.deliveryUnit,
        componentUom: line.componentUom,
        deliveryPackage: line.deliveryUnit,
      });
    }

    setSaving(true);
    setError(null);
    try {
      const orderDate = toDateInputValue(new Date());
      const createdOrders = await api.createPurchaseOrders({
        companyId: selectedCompanyId,
        locationExternalIds: drawdownLocationIds,
        initiatedBy: signatories.initiatedBy,
        approvedBy: signatories.approvedBy,
        orders: [{
          vendorName: selectedVendor.name,
          vendorExternalId: selectedVendor.externalId,
          documentType: 'PO',
          orderDate,
          deliveryDate: commitmentEnd,
          status: 'Committed',
          isPreCommitted: true,
          commitmentStartDate: commitmentStart,
          commitmentEndDate: commitmentEnd,
          items,
        }],
      });

      const po = createdOrders[0];
      if (!po) throw new Error('Failed to create Pre-committed PO.');

      const group: OrderCartVendorGroup = {
        vendorExternalId: selectedVendor.externalId,
        vendorName: selectedVendor.name,
        subtotal: grandTotal,
        items: lines.map(line => ({
          lineKey: line.key,
          componentId: line.componentId,
          componentName: line.componentName,
          componentUom: line.componentUom,
          vendorProductId: line.vendorProductId,
          vendorExternalId: line.vendorExternalId,
          vendorName: line.vendorName,
          productName: line.productName,
          deliveryUnitLabel: line.deliveryUnit,
          deliveryPrice: parseFloat(line.unitPrice) || 0,
          quantity: parseFloat(line.quantity) || 0,
          lineTotal: (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0),
        })),
      };

      const startDate = new Date(`${commitmentStart}T00:00:00`);
      const endDate = new Date(`${commitmentEnd}T00:00:00`);
      const pdf = buildPurchaseOrderPdfData({
        poNumber: po.poNumber,
        group,
        company,
        deliveryLocations: drawdownLocations,
        vendor: findVendorForGroup(vendors, group),
        orderDateLabel: formatDisplayDate(new Date()),
        deliveryDateLabel: `${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}`,
        deliveryDateHeading: 'Commitment Date',
        initiatedBy: signatories.initiatedBy,
        approvedBy: signatories.approvedBy,
        documentKind: 'purchase_order',
      });

      let token = po.vendorShareToken?.trim() ?? '';
      if (!token) {
        try {
          const refreshed = await api.purchaseOrder(po.id);
          token = refreshed.vendorShareToken?.trim() ?? '';
        } catch {
          token = '';
        }
      }

      setCreated({ order: po, pdf, shareToken: token });
      setLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Pre-committed PO.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass({ embedded })}>
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-10 text-center">
          Select a company in the header. Pre-committed POs are issued at company level (not a single outlet).
        </p>
      </div>
    );
  }

  if (created) {
    return createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
        <div className="w-full max-w-5xl bg-card border border-border rounded-xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Pre-committed PO</p>
              <h3 className="text-sm font-semibold mt-0.5">Commitment created · {created.order.poNumber}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Company-level commitment. Drawdown locations are listed on the PO.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="p-1 rounded-md hover:bg-muted"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <div className="border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-semibold">{created.order.vendorName}</p>
                {created.shareToken ? (
                  <a
                    href={buildVendorOrderShareUrl(created.shareToken)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary mt-0.5 truncate hover:underline block"
                  >
                    {buildVendorOrderShareUrl(created.shareToken)}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Share link generating…</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!created.shareToken}
                  onClick={() => {
                    void copyVendorOrderShareLink(created.shareToken).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1600);
                    });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs hover:bg-muted disabled:opacity-50"
                >
                  <Copy size={11} />
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                {created.shareToken ? (
                  <a
                    href={buildVendorOrderWhatsAppUrl(
                      created.shareToken,
                      created.order.poNumber,
                      created.order.vendorName,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#25D366] text-white text-xs"
                  >
                    WhatsApp
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => {
                    setDownloading(true);
                    void openPurchaseOrderPdfInTab(created.pdf).finally(() => setDownloading(false));
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs hover:bg-muted disabled:opacity-50"
                >
                  <ExternalLink size={11} />
                  Open
                </button>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => {
                    setDownloading(true);
                    void downloadPurchaseOrderPdf(created.pdf).finally(() => setDownloading(false));
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50"
                >
                  <Download size={11} />
                  Download PDF
                </button>
              </div>
            </div>
            <PurchaseOrderPdfPreview pdf={created.pdf} className="h-[52vh] min-h-[360px]" />
          </div>
          <div className="px-5 py-4 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="text-xs border border-border rounded-md px-4 py-2 hover:bg-muted"
            >
              Done
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className={pageShellClass({ embedded })}>
      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Handshake size={16} className="text-primary" />
              <h2 className="text-sm font-semibold">Pre-committed PO</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Company-level commitment at a bulk/special price. Choose which locations may draw down,
              then add component / vendor product lines with committed quantity and price.
            </p>
          </div>
          <div className="text-right text-xs shrink-0">
            <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Company</p>
            <p className="font-medium mt-0.5">{company?.name ?? '—'}</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="precommit-vendor">Vendor</label>
              <select
                id="precommit-vendor"
                value={vendorExternalId}
                onChange={e => {
                  setVendorExternalId(e.target.value);
                  setLines([]);
                  setError(null);
                }}
                className={filterSelectCls}
              >
                <option value="">Select vendor…</option>
                {vendorOptions.map(vendor => (
                  <option key={vendor.externalId} value={vendor.externalId}>{vendor.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="commitment-from">
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange size={12} />
                    Commitment Date from
                  </span>
                </label>
                <input
                  id="commitment-from"
                  type="date"
                  value={commitmentStart}
                  onChange={e => setCommitmentStart(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls} htmlFor="commitment-to">Commitment Date to</label>
                <input
                  id="commitment-to"
                  type="date"
                  value={commitmentEnd}
                  min={commitmentStart || undefined}
                  onChange={e => setCommitmentEnd(e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className={`${labelCls} inline-flex items-center gap-1.5`}>
                  <MapPin size={12} />
                  Locations that may draw down
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  This PO is issued under the company. Selected outlets can later order against this commitment.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllDrawdownLocations}
                  className="text-[11px] text-primary hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearDrawdownLocations}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            {companyLocations.length === 0 ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-4 text-center">
                No locations found for this company.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {companyLocations.map(loc => {
                  const selected = drawdownLocationIds.includes(loc.externalId);
                  return (
                    <label
                      key={loc.externalId}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] cursor-pointer ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary"
                        checked={selected}
                        onChange={() => toggleDrawdownLocation(loc.externalId)}
                      />
                      {loc.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-border pt-3">
            <div>
              <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Initiated by</p>
              <p className="mt-1 font-medium">
                {userLoading ? '…' : signatories?.initiatedBy ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase tracking-wide text-[10px]">Approved by</p>
              <p className="mt-1 font-medium">
                {userLoading ? '…' : signatories?.approvedBy ?? '—'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <MillstoneLoader size="sm" layout="block" label="Loading components…" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search component…"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {vendorExternalId
                ? `Showing components tagged to ${selectedVendor?.name ?? 'vendor'} at drawdown locations`
                : 'Select a vendor, then choose component / vendor products'}
            </p>
          </div>

          {pickerComponent && (
            <OrderTemplateVendorProductPickerModal
              component={pickerComponent}
              locationIds={catalogLocationIds}
              vendorExternalId={vendorExternalId}
              addedLineKeys={lineKeys}
              onClose={() => setPickerComponent(null)}
              onSelect={product => addProduct(pickerComponent, product)}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <section className={panelCls}>
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold">Components</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Choose a component, then pick a tagged vendor product
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
                {!vendorExternalId ? (
                  <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                    Select a vendor above to list tagged components.
                  </p>
                ) : componentList.length === 0 ? (
                  <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                    No tagged components for this vendor at the selected drawdown locations.
                  </p>
                ) : (
                  componentList.map(item => {
                    const allAdded = item.taggedProductCount > 0
                      && item.addedProductCount >= item.taggedProductCount;
                    const noTagged = item.taggedProductCount === 0;
                    return (
                      <button
                        key={item.component.componentId}
                        type="button"
                        disabled={allAdded || noTagged}
                        onClick={() => setPickerComponent(item.component)}
                        className={`w-full text-left px-4 py-3 text-xs transition-colors ${
                          allAdded || noTagged
                            ? 'bg-muted/30 text-muted-foreground cursor-default'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{item.component.name}</p>
                            <p className="text-muted-foreground truncate">{item.component.componentId}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {item.taggedProductCount} tagged vendor product{item.taggedProductCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {noTagged ? 'No tags' : allAdded ? 'Added' : 'Choose'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className={panelCls}>
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Commitment lines</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Edit committed qty and bulk / special unit price
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {lines.length} line{lines.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {lines.length === 0 ? (
                  <p className="px-4 py-8 text-xs text-muted-foreground text-center">
                    Add vendor products from the list. Bulk price may differ from small-purchase price.
                  </p>
                ) : (
                  <table className="w-full">
                    <ColGroup widths={['40%', '15%', '15%', '15%', 88]} />
                    <thead className="bg-muted/20 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">Product</th>
                        <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-normal w-[8.5rem]">Qty</th>
                        <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-normal w-[8.5rem]">Bulk price</th>
                        <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground font-normal w-[8.5rem]">Line</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map(line => {
                        const qty = parseFloat(line.quantity) || 0;
                        const price = parseFloat(line.unitPrice) || 0;
                        return (
                          <tr key={line.key}>
                            <td className={tdCls}>
                              <p className="font-medium truncate">{line.productName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {line.componentName} · {line.deliveryUnit}
                              </p>
                            </td>
                            <td className={tdCls}>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={line.quantity}
                                onChange={e => updateLine(line.key, { quantity: e.target.value })}
                                className={inlineNumberCls}
                              />
                            </td>
                            <td className={tdCls}>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.unitPrice}
                                onChange={e => updateLine(line.key, { unitPrice: e.target.value })}
                                className={inlinePriceCls}
                              />
                            </td>
                            <td className={`${tdCls} text-right font-sans tabular-nums`}>
                              {rm(qty * price)}
                            </td>
                            <td className={tdCls}>
                              <button
                                type="button"
                                onClick={() => removeLine(line.key)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground"
                                aria-label={`Remove ${line.productName}`}
                              >
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Commitment value</span>
                <span className="text-sm font-semibold font-sans">{rm(grandTotal)}</span>
              </div>
            </section>
          </div>
        </>
      )}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={saving || loading || userLoading}
          onClick={() => void handleCreate()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
        >
          <Handshake size={14} />
          {saving ? 'Creating…' : 'Confirm & Create Pre-committed PO'}
        </button>
      </div>
    </div>
  );
}
