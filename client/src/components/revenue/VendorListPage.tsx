import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows, compareSortValues } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { FileText, PackageOpen, Search, UserPlus } from 'lucide-react';
import { api, type Company, type EngageVendorContact, type LocationConfig, type Vendor } from '../../api';
import {
  applyVendorProductOverrides,
  filterVendorProductsByLocationVisibility,
  vendorProductPolicyTag,
} from '../../data/vendorProductCatalog';
import {
  formatVendorPolicyLabel,
  inferVendorPolicyTag,
  orgAllowsAllVendorProducts,
  productMatchesOrgPolicy,
  resolveOrgVendorPolicyTags,
  vendorMatchesOrgPolicy,
  type CompanyVendorPolicyTag,
} from '../../data/vendorPolicyRules';
import { getDefaultVendorContact } from '../../data/vendorContacts';
import { VendorEngageModal } from './VendorEngageModal';
import { VendorCreatePanel } from './VendorCreatePanel';
import { VendorProductsList } from './VendorProductsList';
import { VendorProductsPanel } from './VendorProductsPanel';
import { RequestForQuotePanel } from './RequestForQuotePanel';
import { RequestForQuoteList } from './RequestForQuoteList';
import { RequestForSamplePanel } from './RequestForSamplePanel';
import { SampleRequestPanel } from './SampleRequestPanel';
import { SampleQuoteTemplatesPanel } from './SampleQuoteTemplatesPanel';
import { SampleRequestList } from './SampleRequestList';
import type { SampleQuoteTemplateId } from '../../data/requestForSample';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type VendorSortColumn = 'name' | 'products' | 'policy' | 'address' | 'phone' | 'email' | 'action';

const VENDOR_TABLE_COLUMNS: SortableColumnDef<VendorSortColumn>[] = [
  { key: 'name', label: 'Vendor Name' },
  { key: 'products', label: 'Type of Product Supplied' },
  { key: 'policy', label: 'Product Policy' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email' },
  { key: 'action', label: 'Action', align: 'right', sortable: false },
];

const VENDOR_TABS = [
  { id: 'vendors' as const, label: 'Vendors' },
  { id: 'products' as const, label: 'Vendor Products' },
  { id: 'rfq' as const, label: 'Sample & Quote' },
] as const;

type VendorTableRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'vendor'; vendor: Vendor };

function sortVendors(vendors: Vendor[]): Vendor[] {
  return [...vendors].sort((a, b) => {
    if (a.engaged !== b.engaged) return a.engaged ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function VendorListPage({
  selectedCompanyId,
  selectedLocationIds,
}: {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
}) {
  const [tab, setTab] = useState<'vendors' | 'products' | 'rfq'>('vendors');

  const activeTabLabel = VENDOR_TABS.find(t => t.id === tab)?.label ?? 'Vendors';
  useRevMgmtPageLabel(activeTabLabel);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [configLocations, setConfigLocations] = useState<LocationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'engaged' | 'available'>('all');
  const [productSearch, setProductSearch] = useState('');
  const [productVendorFilter, setProductVendorFilter] = useState('');
  const [productGroupFilter, setProductGroupFilter] = useState('');
  const [productTagFilter, setProductTagFilter] = useState<'all' | 'tagged' | 'untagged'>('all');
  const [engageTarget, setEngageTarget] = useState<Vendor | null>(null);
  const [engageError, setEngageError] = useState<string | null>(null);
  const [productsVendor, setProductsVendor] = useState<Vendor | null>(null);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [rfqRefresh, setRfqRefresh] = useState(0);
  const [sampleRefresh, setSampleRefresh] = useState(0);
  const [engaging, setEngaging] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [showRfqPanel, setShowRfqPanel] = useState(false);
  const [showSamplePanel, setShowSamplePanel] = useState(false);
  const [showSimpleSamplePanel, setShowSimpleSamplePanel] = useState(false);
  const [showSampleQuoteTemplates, setShowSampleQuoteTemplates] = useState(false);
  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<VendorSortColumn>();

  const catalogProducts = useMemo(
    () => applyVendorProductOverrides(),
    [catalogRefresh],
  );

  useEffect(() => {
    const onCatalogChanged = () => setCatalogRefresh(key => key + 1);
    window.addEventListener('bisync:vendorProductCatalogChanged', onCatalogChanged);
    return () => window.removeEventListener('bisync:vendorProductCatalogChanged', onCatalogChanged);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.vendors(), api.companies(), api.locationsConfig()])
      .then(([vendorRows, companyRows, locationRows]) => {
        setVendors(vendorRows);
        setCompanies(companyRows);
        setConfigLocations(locationRows);
      })
      .catch(() => {
        setVendors([]);
        setCompanies([]);
        setConfigLocations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const orgPolicyTags = useMemo<CompanyVendorPolicyTag[]>(() => {
    const company = companies.find(c => c.id === selectedCompanyId) ?? null;
    return resolveOrgVendorPolicyTags(company, configLocations, selectedLocationIds);
  }, [companies, configLocations, selectedCompanyId, selectedLocationIds]);

  const selectedCompany = useMemo(
    () => companies.find(c => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const countryCode = useMemo(
    () => selectedCompany?.countryCode ?? 'MY',
    [selectedCompany],
  );

  useEffect(() => {
    if (!selectedCompanyId) {
      setEngageTarget(null);
      setProductsVendor(null);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    resetSort();
  }, [search, filter, resetSort]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vendors.filter(v => {
      if (!vendorMatchesOrgPolicy(v.productPolicyTag, orgPolicyTags, v)) return false;
      const matchSearch = !query || [
        v.name,
        v.products,
        v.address,
        v.city,
        v.mobile,
        v.email,
      ].some(value => value.toLowerCase().includes(query));
      const matchFilter = filter === 'all' || (filter === 'engaged' ? v.engaged : !v.engaged);
      return matchSearch && matchFilter;
    });
  }, [vendors, search, filter, orgPolicyTags]);

  const vendorSortAccessors = useMemo(
    () => ({
      name: (v: Vendor) => v.name,
      products: (v: Vendor) => v.products || '',
      policy: (v: Vendor) => formatVendorPolicyLabel(inferVendorPolicyTag(v)),
      address: (v: Vendor) => v.address || [v.city, v.state].filter(Boolean).join(', '),
      phone: (v: Vendor) => getDefaultVendorContact(v)?.mobile || v.mobile || '',
      email: (v: Vendor) => getDefaultVendorContact(v)?.email || v.email || '',
    }),
    [],
  );

  const sortedFiltered = useMemo(() => {
    if (!sortColumn) return sortVendors(filtered);
    return sortTableRows(filtered, sortColumn, sortDirection, vendorSortAccessors, {
      tieBreaker: (a, b) => compareSortValues(a.name, b.name),
    });
  }, [filtered, sortColumn, sortDirection, vendorSortAccessors]);

  const nextVendorExternalId = useMemo(() => {
    const max = vendors.reduce((acc, v) => {
      const n = parseInt(v.externalId.replace(/^V/i, ''), 10);
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `V${String(max + 1).padStart(3, '0')}`;
  }, [vendors]);

  const engagedCount = sortedFiltered.filter(v => v.engaged).length;
  const availableCount = sortedFiltered.length - engagedCount;

  const vendorTableRows = useMemo((): VendorTableRow[] => {
    if (sortedFiltered.length === 0) return [];
    if (filter === 'all' && engagedCount > 0 && availableCount > 0) {
      const engaged = sortedFiltered.filter(v => v.engaged);
      const available = sortedFiltered.filter(v => !v.engaged);
      return [
        { kind: 'header', id: 'hdr-engaged', label: 'Engaged Vendors' },
        ...engaged.map(v => ({ kind: 'vendor' as const, vendor: v })),
        { kind: 'header', id: 'hdr-available', label: 'Available Vendors' },
        ...available.map(v => ({ kind: 'vendor' as const, vendor: v })),
      ];
    }
    return sortedFiltered.map(v => ({ kind: 'vendor' as const, vendor: v }));
  }, [sortedFiltered, filter, engagedCount, availableCount]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVendorTableRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(vendorTableRows, { scrollRootRef });

  const vendorOptions = useMemo(
    () => [...vendors]
      .filter(v => vendorMatchesOrgPolicy(v.productPolicyTag, orgPolicyTags, v))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [vendors, orgPolicyTags],
  );

  const groupOptions = useMemo(
    () => [...new Set(catalogProducts.map(p => p.group))].sort((a, b) => a.localeCompare(b)),
    [catalogProducts],
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    const vendorsByExternalId = new Map(vendors.map(v => [v.externalId, v]));
    const locationScoped = filterVendorProductsByLocationVisibility(catalogProducts, selectedLocationIds);
    return locationScoped.filter(product => {
      const vendor = vendorsByExternalId.get(product.vendorExternalId);
      if (vendor && !vendorMatchesOrgPolicy(vendor.productPolicyTag, orgPolicyTags, vendor)) return false;
      const productTag = vendorProductPolicyTag(product, vendorsByExternalId);
      if (!productMatchesOrgPolicy(productTag, vendor?.productPolicyTag, orgPolicyTags, product.group)) return false;
      const matchVendor = !productVendorFilter || product.vendorExternalId === productVendorFilter;
      const matchGroup = !productGroupFilter || product.group === productGroupFilter;
      const matchSearch = !query || [
        product.id,
        product.productName,
        product.vendorName,
        product.vendorExternalId,
        product.group,
        product.specification,
        product.delivery.orderUnit,
      ].some(value => value.toLowerCase().includes(query));
      return matchVendor && matchGroup && matchSearch;
    }).sort((a, b) => {
      const vendorCmp = a.vendorName.localeCompare(b.vendorName);
      if (vendorCmp !== 0) return vendorCmp;
      return a.productName.localeCompare(b.productName);
    });
  }, [catalogProducts, productSearch, productVendorFilter, productGroupFilter, vendors, orgPolicyTags, selectedLocationIds]);

  async function handleConfirmEngage(vendor: Vendor, contacts: EngageVendorContact[]) {
    setEngaging(true);
    setEngageError(null);
    try {
      const updated = await api.engageVendor(vendor.externalId, { contacts });
      setVendors(prev => prev.map(v => v.externalId === vendor.externalId ? updated : v));
      setEngageTarget(null);
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

  function handleVendorUpdated(updated: Vendor) {
    setVendors(prev => prev.map(v => v.externalId === updated.externalId ? updated : v));
    if (productsVendor?.externalId === updated.externalId) {
      setProductsVendor(updated);
    }
  }

  function renderRow(v: Vendor) {
    const defaultContact = getDefaultVendorContact(v);
    const displayMobile = defaultContact?.mobile || v.mobile || '—';
    const displayEmail = defaultContact?.email || v.email;
    return (
      <tr
        key={v.id}
        className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${v.engaged ? 'bg-[#5A7A2A]/[0.04]' : ''}`}
      >
        <td className="px-4 py-3">
          <div className="flex items-start gap-2 min-w-[160px]">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setProductsVendor(v)}
                className="text-left group"
              >
                <p className="font-medium text-foreground leading-snug group-hover:text-primary group-hover:underline transition-colors">{v.name}</p>
              </button>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">{v.externalId}</p>
            </div>
            {v.engaged && (
              <span className="shrink-0 text-xs font-sans px-1.5 py-0.5 rounded bg-[#5A7A2A]/15 text-[#5A7A2A]">
                Engaged
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-foreground ">{v.products || '—'}</td>
        <td className="px-4 py-3 text-foreground whitespace-nowrap">{formatVendorPolicyLabel(inferVendorPolicyTag(v))}</td>
        <td className="px-4 py-3 text-muted-foreground ">
          {v.address || [v.city, v.state].filter(Boolean).join(', ') || '—'}
        </td>
        <td className="px-4 py-3 font-sans text-foreground whitespace-nowrap">{displayMobile}</td>
        <td className="px-4 py-3 text-foreground ">
          {displayEmail ? (
            <a href={`mailto:${displayEmail}`} className="hover:text-primary hover:underline break-all">
              {displayEmail}
            </a>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {!v.engaged && (
            <button
              onClick={() => {
                setEngageError(null);
                setEngageTarget(v);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <UserPlus size={11} />
              Engage
            </button>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className={pageShellClass()}>
      {!selectedCompanyId && (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3">
          Select a company in the header to create vendors, engage suppliers, or tag products. Vendor data below is still visible.
        </p>
      )}

      {selectedCompanyId && !orgAllowsAllVendorProducts(orgPolicyTags) && (
        <p className="text-sm text-muted-foreground border border-border rounded-lg px-4 py-3 bg-muted/20">
          Vendor visibility follows your company/location product policy ({orgPolicyTags.map(formatVendorPolicyLabel).join(', ')}).
          Non-halal vendors and products are hidden.
        </p>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap border-b border-border">
        <div className="flex gap-1">
          {VENDOR_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowCreateVendor(true)}
            disabled={!selectedCompanyId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
          >
            <UserPlus size={11} />
            Create Vendor
          </button>
          <button
            type="button"
            onClick={() => setShowSampleQuoteTemplates(true)}
            disabled={!selectedCompanyId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <FileText size={11} />
            Sample & Quote
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedCompanyId) return;
              setShowSampleQuoteTemplates(false);
              setShowSimpleSamplePanel(false);
              setShowSamplePanel(true);
            }}
            disabled={!selectedCompanyId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <PackageOpen size={11} />
            Request for Sample
          </button>
        </div>
      </div>

      {tab === 'vendors' ? (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {(['all', 'engaged', 'available'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'engaged' ? 'Engaged' : 'Available'}
          </button>
        ))}
      </div>

      <p className="text-xs font-sans text-muted-foreground">
        {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}
        {filter === 'all' && filtered.length > 0 && (
          <> · {engagedCount} engaged · {availableCount} available</>
        )}
      </p>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <MillstoneLoader size="sm" layout="block" label="Loading vendors…" />
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-muted/30">
                <SortableTableHeaderRow
                  columns={VENDOR_TABLE_COLUMNS}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  className="border-b border-border"
                />
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground font-sans">
                      No vendors match your filters.
                    </td>
                  </tr>
                ) : (
                  pagedVendorTableRows.map(row => {
                    if (row.kind === 'header') {
                      return (
                        <tr key={row.id} className="bg-muted/20">
                          <td colSpan={7} className="px-4 py-2 text-xs font-sans uppercase tracking-widest text-muted-foreground">
                            {row.label}
                          </td>
                        </tr>
                      );
                    }
                    return renderRow(row.vendor);
                  })
                )}
                <InfiniteScrollTableSentinel colSpan={7} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>
      </>
      ) : tab === 'products' ? (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={productVendorFilter}
          onChange={e => setProductVendorFilter(e.target.value)}
          className={`${filterSelectCls} min-w-[160px]`}
        >
          <option value="">All vendors</option>
          {vendorOptions.map(v => (
            <option key={v.externalId} value={v.externalId}>{v.name}</option>
          ))}
        </select>
        <select
          value={productGroupFilter}
          onChange={e => setProductGroupFilter(e.target.value)}
          className={`${filterSelectCls} min-w-[140px]`}
        >
          <option value="">All groups</option>
          {groupOptions.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
        {(['all', 'tagged', 'untagged'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setProductTagFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              productTagFilter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'tagged' ? 'Tagged' : 'Untagged'}
          </button>
        ))}
      </div>

      <VendorProductsList
        products={filteredProducts}
        vendors={vendors}
        selectedCompanyId={selectedCompanyId}
        selectedLocationIds={selectedLocationIds}
        orgPolicyTags={orgPolicyTags}
        showVendorColumn
        tagFilter={productTagFilter}
        onVendorUpdated={handleVendorUpdated}
        onProductUpdated={() => setCatalogRefresh(key => key + 1)}
      />
      </>
      ) : (
        <div className="space-y-4">
          <SampleRequestList selectedCompanyId={selectedCompanyId} refreshKey={sampleRefresh} />
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-2 px-0.5">Vendor quote requests</p>
            <RequestForQuoteList
              selectedCompanyId={selectedCompanyId}
              vendors={vendors}
              refreshKey={rfqRefresh}
              onVendorUpdated={handleVendorUpdated}
            />
          </div>
        </div>
      )}

      {engageTarget && (
        <VendorEngageModal
          key={engageTarget.externalId}
          vendor={engageTarget}
          saving={engaging}
          serverError={engageError}
          onClose={() => {
            if (!engaging) {
              setEngageTarget(null);
              setEngageError(null);
            }
          }}
          onConfirm={handleConfirmEngage}
        />
      )}

      {productsVendor && selectedCompanyId && (
        <VendorProductsPanel
          vendor={productsVendor}
          selectedCompanyId={selectedCompanyId}
          selectedLocationIds={selectedLocationIds}
          countryCode={countryCode}
          onClose={() => setProductsVendor(null)}
          onVendorUpdated={handleVendorUpdated}
        />
      )}

      {showCreateVendor && (
        <VendorCreatePanel
          countryCode={countryCode}
          nextExternalId={nextVendorExternalId}
          existingVendors={vendors}
          onClose={() => setShowCreateVendor(false)}
          onProductsImported={() => setCatalogRefresh(key => key + 1)}
          onCreated={vendor => {
            setVendors(prev => sortVendors([...prev, vendor]));
            setShowCreateVendor(false);
          }}
        />
      )}

      {showSampleQuoteTemplates && (
        <SampleQuoteTemplatesPanel
          onClose={() => setShowSampleQuoteTemplates(false)}
          onSelectTemplate={(templateId: SampleQuoteTemplateId) => {
            setShowSampleQuoteTemplates(false);
            if (templateId === 'sample-request-flavours') {
              window.setTimeout(() => setShowSamplePanel(true), 0);
            } else if (templateId === 'sample-request') {
              window.setTimeout(() => setShowSimpleSamplePanel(true), 0);
            }
          }}
        />
      )}

      {showRfqPanel && selectedCompany && (
        <RequestForQuotePanel
          company={selectedCompany}
          locations={configLocations}
          selectedLocationIds={selectedLocationIds}
          vendors={vendors}
          onClose={() => setShowRfqPanel(false)}
          onCreated={(rfq, createdVendors) => {
            if (createdVendors.length > 0) {
              setVendors(prev => sortVendors([
                ...prev,
                ...createdVendors.filter(nv => !prev.some(v => v.externalId === nv.externalId)),
              ]));
            }
            setRfqRefresh(key => key + 1);
            setTab('rfq');
            void rfq;
          }}
        />
      )}

      {showSamplePanel && selectedCompany ? (
        <RequestForSamplePanel
          company={selectedCompany}
          onClose={() => setShowSamplePanel(false)}
          onCreated={() => {
            setSampleRefresh(key => key + 1);
            setTab('rfq');
          }}
        />
      ) : null}

      {showSimpleSamplePanel && selectedCompany ? (
        <SampleRequestPanel
          company={selectedCompany}
          vendors={vendors}
          orgPolicyTags={orgPolicyTags}
          countryCode={countryCode}
          nextVendorExternalId={nextVendorExternalId}
          onClose={() => setShowSimpleSamplePanel(false)}
          onVendorCreated={vendor => {
            setVendors(prev => sortVendors([
              ...prev.filter(v => v.externalId !== vendor.externalId),
              vendor,
            ]));
          }}
          onCreated={() => {
            setSampleRefresh(key => key + 1);
            setTab('rfq');
          }}
        />
      ) : null}

      {(showSamplePanel || showSimpleSamplePanel) && !selectedCompany && selectedCompanyId ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
          <div className="max-w-sm rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Company not loaded</p>
            <p className="text-xs text-muted-foreground">
              Select a company again, then retry Sample & Quote.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSamplePanel(false);
                setShowSimpleSamplePanel(false);
              }}
              className="px-3 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
