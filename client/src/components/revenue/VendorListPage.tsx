import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { Search, UserPlus } from 'lucide-react';
import { api, type EngageVendorContact, type Vendor } from '../../api';
import { applyVendorProductOverrides } from '../../data/vendorProductCatalog';
import { getDefaultVendorContact } from '../../data/vendorContacts';
import { VendorEngageModal } from './VendorEngageModal';
import { VendorCreatePanel } from './VendorCreatePanel';
import { VendorProductsList } from './VendorProductsList';
import { VendorProductsPanel } from './VendorProductsPanel';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
const thCls = 'text-left px-4 py-3 text-xs font-sans text-muted-foreground uppercase tracking-wider font-normal truncate';

const VENDOR_TABS = [
  { id: 'vendors' as const, label: 'Vendors' },
  { id: 'products' as const, label: 'Vendor Products' },
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

export function VendorListPage({ selectedCompanyId }: { selectedCompanyId: number | null }) {
  const [tab, setTab] = useState<'vendors' | 'products'>('vendors');

  const activeTabLabel = VENDOR_TABS.find(t => t.id === tab)?.label ?? 'Vendors';
  useRevMgmtPageLabel(activeTabLabel);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
  const [engaging, setEngaging] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);

  const catalogProducts = useMemo(
    () => applyVendorProductOverrides(),
    [catalogRefresh],
  );

  useEffect(() => {
    if (!selectedCompanyId) {
      setVendors([]);
      setLoading(false);
      setEngageTarget(null);
      setProductsVendor(null);
      return;
    }
    setLoading(true);
    api.vendors()
      .then(setVendors)
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = vendors.filter(v => {
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
    return sortVendors(rows);
  }, [vendors, search, filter]);

  const nextVendorExternalId = useMemo(() => {
    const max = vendors.reduce((acc, v) => {
      const n = parseInt(v.externalId.replace(/^V/i, ''), 10);
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `V${String(max + 1).padStart(3, '0')}`;
  }, [vendors]);

  const engagedCount = filtered.filter(v => v.engaged).length;
  const availableCount = filtered.length - engagedCount;

  const vendorTableRows = useMemo((): VendorTableRow[] => {
    if (filtered.length === 0) return [];
    if (filter === 'all' && engagedCount > 0 && availableCount > 0) {
      const engaged = filtered.filter(v => v.engaged);
      const available = filtered.filter(v => !v.engaged);
      return [
        { kind: 'header', id: 'hdr-engaged', label: 'Engaged Vendors' },
        ...engaged.map(v => ({ kind: 'vendor' as const, vendor: v })),
        { kind: 'header', id: 'hdr-available', label: 'Available Vendors' },
        ...available.map(v => ({ kind: 'vendor' as const, vendor: v })),
      ];
    }
    return filtered.map(v => ({ kind: 'vendor' as const, vendor: v }));
  }, [filtered, filter, engagedCount, availableCount]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedVendorTableRows,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(vendorTableRows, { scrollRootRef });

  const vendorOptions = useMemo(
    () => [...vendors].sort((a, b) => a.name.localeCompare(b.name)),
    [vendors],
  );

  const groupOptions = useMemo(
    () => [...new Set(catalogProducts.map(p => p.group))].sort((a, b) => a.localeCompare(b)),
    [catalogProducts],
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return catalogProducts.filter(product => {
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
  }, [catalogProducts, productSearch, productVendorFilter, productGroupFilter]);

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
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowCreateVendor(true)}
          disabled={!selectedCompanyId}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
        >
          <UserPlus size={11} />
          Create Vendor
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
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

      {tab === 'vendors' ? (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendors…"
            disabled={!selectedCompanyId}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>
        {(['all', 'engaged', 'available'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            disabled={!selectedCompanyId}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
              filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'engaged' ? 'Engaged' : 'Available'}
          </button>
        ))}
      </div>
      </>
      ) : (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Search products…"
            disabled={!selectedCompanyId}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>
        <select
          value={productVendorFilter}
          onChange={e => setProductVendorFilter(e.target.value)}
          disabled={!selectedCompanyId}
          className={`${filterSelectCls} disabled:opacity-50 min-w-[160px]`}
        >
          <option value="">All vendors</option>
          {vendorOptions.map(v => (
            <option key={v.externalId} value={v.externalId}>{v.name}</option>
          ))}
        </select>
        <select
          value={productGroupFilter}
          onChange={e => setProductGroupFilter(e.target.value)}
          disabled={!selectedCompanyId}
          className={`${filterSelectCls} disabled:opacity-50 min-w-[140px]`}
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
            disabled={!selectedCompanyId}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
              productTagFilter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'tagged' ? 'Tagged' : 'Untagged'}
          </button>
        ))}
      </div>

      {selectedCompanyId && (
        <VendorProductsList
          products={filteredProducts}
          vendors={vendors}
          selectedCompanyId={selectedCompanyId}
          showVendorColumn
          tagFilter={productTagFilter}
          onVendorUpdated={handleVendorUpdated}
          onProductUpdated={() => setCatalogRefresh(key => key + 1)}
        />
      )}
      </>
      )}

      {selectedCompanyId && tab === 'vendors' && (
      <>
      <p className="text-xs font-sans text-muted-foreground">
        {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}
        {filter === 'all' && filtered.length > 0 && (
          <> · {engagedCount} engaged · {availableCount} available</>
        )}
      </p>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading vendors…</p>
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full table-fixed text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={thCls}>Vendor Name</th>
                  <th className={thCls}>Type of Product Supplied</th>
                  <th className={thCls}>Address</th>
                  <th className={thCls}>Phone Number</th>
                  <th className={thCls}>Email</th>
                  <th className={`${thCls} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground font-sans">
                      No vendors match your filters.
                    </td>
                  </tr>
                ) : (
                  pagedVendorTableRows.map(row => {
                    if (row.kind === 'header') {
                      return (
                        <tr key={row.id} className="bg-muted/20">
                          <td colSpan={6} className="px-4 py-2 text-xs font-sans uppercase tracking-widest text-muted-foreground">
                            {row.label}
                          </td>
                        </tr>
                      );
                    }
                    return renderRow(row.vendor);
                  })
                )}
                <InfiniteScrollTableSentinel colSpan={6} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
              </tbody>
            </table>
          </TableScrollContainer>
        )}
      </div>
      </>
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
          onClose={() => setProductsVendor(null)}
          onVendorUpdated={handleVendorUpdated}
        />
      )}

      {showCreateVendor && (
        <VendorCreatePanel
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
    </div>
  );
}
