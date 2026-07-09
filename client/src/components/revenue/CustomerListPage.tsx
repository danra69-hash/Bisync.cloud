import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, UserPlus } from 'lucide-react';
import { api, type B2bCustomer, type Company, type PosCustomer } from '../../api';
import {
  formatCustomerAddress,
  getDefaultContact,
  nextB2bCustomerExternalId,
  nextPosCustomerExternalId,
  parseB2bCustomerContacts,
  parsePosCouponSummary,
  parsePosLoyaltySummary,
  parseTaggedProductIds,
} from '../../data/customerListData';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows } from '../../utils/tableSort';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { B2bCustomerPanel } from './B2bCustomerPanel';
import { B2bCustomerMyProductsPanel } from './B2bCustomerMyProductsPanel';
import { B2bCustomerPurchaseHistoryPanel } from './B2bCustomerPurchaseHistoryPanel';
import { PosCustomerPanel } from './PosCustomerPanel';
import { PosCustomerHistoryPanel } from './PosCustomerHistoryPanel';

const CUSTOMER_TABS = [
  { id: 'b2b' as const, label: 'Customer List' },
  { id: 'pos' as const, label: 'POS Customer List' },
] as const;

type B2bSortColumn = 'companyName' | 'contact' | 'address' | 'phone' | 'email' | 'products' | 'action';
type PosSortColumn = 'name' | 'address' | 'phone' | 'email' | 'loyalty' | 'action';

const B2B_COLUMNS: SortableColumnDef<B2bSortColumn>[] = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'contact', label: 'Contact Person' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'products', label: 'Tagged Products' },
  { key: 'action', label: 'Action', align: 'right', sortable: false },
];

const POS_COLUMNS: SortableColumnDef<PosSortColumn>[] = [
  { key: 'name', label: 'Customer Name' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'loyalty', label: 'Points Balance' },
  { key: 'action', label: 'Action', align: 'right', sortable: false },
];

export function CustomerListPage({
  selectedCompanyId,
}: {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
}) {
  const [tab, setTab] = useState<'b2b' | 'pos'>('b2b');
  const activeTabLabel = CUSTOMER_TABS.find(t => t.id === tab)?.label ?? 'Customer List';
  useRevMgmtPageLabel(activeTabLabel);

  const [b2bCustomers, setB2bCustomers] = useState<B2bCustomer[]>([]);
  const [posCustomers, setPosCustomers] = useState<PosCustomer[]>([]);
  const [allB2bCustomers, setAllB2bCustomers] = useState<B2bCustomer[]>([]);
  const [allPosCustomers, setAllPosCustomers] = useState<PosCustomer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [b2bSearch, setB2bSearch] = useState('');
  const [posSearch, setPosSearch] = useState('');

  const [b2bEditTarget, setB2bEditTarget] = useState<B2bCustomer | 'new' | null>(null);
  const [posEditTarget, setPosEditTarget] = useState<PosCustomer | 'new' | null>(null);
  const [myProductsTarget, setMyProductsTarget] = useState<B2bCustomer | null>(null);
  const [purchaseHistoryTarget, setPurchaseHistoryTarget] = useState<B2bCustomer | null>(null);
  const [posHistoryTarget, setPosHistoryTarget] = useState<PosCustomer | null>(null);

  const { sortColumn: b2bSortColumn, sortDirection: b2bSortDirection, toggleSort: toggleB2bSort } =
    useTableSort<B2bSortColumn>();
  const { sortColumn: posSortColumn, sortDirection: posSortDirection, toggleSort: togglePosSort } =
    useTableSort<PosSortColumn>();

  const scrollRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.companies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const countryCode = useMemo(
    () => companies.find(c => c.id === selectedCompanyId)?.countryCode ?? 'MY',
    [companies, selectedCompanyId],
  );

  function reload() {
    if (!selectedCompanyId) {
      setB2bCustomers([]);
      setPosCustomers([]);
      setAllB2bCustomers([]);
      setAllPosCustomers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.b2bCustomers(selectedCompanyId),
      api.posCustomers(selectedCompanyId),
      api.b2bCustomers(),
      api.posCustomers(),
    ])
      .then(([b2b, pos, allB2b, allPos]) => {
        setB2bCustomers(b2b);
        setPosCustomers(pos);
        setAllB2bCustomers(allB2b);
        setAllPosCustomers(allPos);
      })
      .catch(() => {
        setB2bCustomers([]);
        setPosCustomers([]);
        setAllB2bCustomers([]);
        setAllPosCustomers([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [selectedCompanyId]);

  const filteredB2b = useMemo(() => {
    const q = b2bSearch.trim().toLowerCase();
    return b2bCustomers.filter(c => {
      if (!q) return true;
      const contact = getDefaultContact(parseB2bCustomerContacts(c));
      return [
        c.companyName,
        c.externalId,
        c.address,
        c.city,
        c.phone,
        c.email,
        contact?.name,
        contact?.mobile,
      ].some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [b2bCustomers, b2bSearch]);

  const filteredPos = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    return posCustomers.filter(c => {
      if (!q) return true;
      return [c.name, c.externalId, c.address, c.city, c.phone, c.email]
        .some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [posCustomers, posSearch]);

  const b2bSortAccessors = useMemo(() => ({
    companyName: (c: B2bCustomer) => c.companyName,
    contact: (c: B2bCustomer) => getDefaultContact(parseB2bCustomerContacts(c))?.name ?? '',
    address: (c: B2bCustomer) => formatCustomerAddress(c),
    phone: (c: B2bCustomer) => c.phone,
    email: (c: B2bCustomer) => c.email,
    products: (c: B2bCustomer) => parseTaggedProductIds(c).length,
  }), []);

  const posSortAccessors = useMemo(() => ({
    name: (c: PosCustomer) => c.name,
    address: (c: PosCustomer) => formatCustomerAddress(c),
    phone: (c: PosCustomer) => c.phone,
    email: (c: PosCustomer) => c.email,
    loyalty: (c: PosCustomer) => {
      const currentYear = new Date().getFullYear();
      const row = parsePosLoyaltySummary(c).find(s => s.year === currentYear);
      return row?.balance ?? 0;
    },
  }), []);

  const sortedB2b = useMemo(
    () => sortTableRows(filteredB2b, b2bSortColumn, b2bSortDirection, b2bSortAccessors),
    [filteredB2b, b2bSortColumn, b2bSortDirection, b2bSortAccessors],
  );

  const sortedPos = useMemo(
    () => sortTableRows(filteredPos, posSortColumn, posSortDirection, posSortAccessors),
    [filteredPos, posSortColumn, posSortDirection, posSortAccessors],
  );

  const {
    visibleItems: pagedB2b,
    hasMore: b2bHasMore,
    sentinelRef: b2bSentinelRef,
    totalCount: b2bTotalCount,
    visibleCount: b2bVisibleCount,
  } = useInfiniteScrollSlice(sortedB2b, { scrollRootRef });

  const {
    visibleItems: pagedPos,
    hasMore: posHasMore,
    sentinelRef: posSentinelRef,
    totalCount: posTotalCount,
    visibleCount: posVisibleCount,
  } = useInfiniteScrollSlice(sortedPos, { scrollRootRef });

  const nextB2bId = useMemo(() => nextB2bCustomerExternalId(allB2bCustomers), [allB2bCustomers]);
  const nextPosId = useMemo(() => nextPosCustomerExternalId(allPosCustomers), [allPosCustomers]);

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to manage customers.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {CUSTOMER_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'b2b' ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={b2bSearch}
                onChange={e => setB2bSearch(e.target.value)}
                placeholder="Search B2B customers…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background"
              />
            </div>
            <button
              type="button"
              onClick={() => setB2bEditTarget('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <UserPlus size={12} />
              Add Customer
            </button>
          </div>

          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <SortableTableHeaderRow
                  columns={B2B_COLUMNS}
                  sortColumn={b2bSortColumn}
                  sortDirection={b2bSortDirection}
                  onSort={toggleB2bSort}
                  className="border-b border-border"
                />
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : pagedB2b.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No B2B customers yet.</td></tr>
                ) : pagedB2b.map(customer => {
                  const contact = getDefaultContact(parseB2bCustomerContacts(customer));
                  const taggedCount = parseTaggedProductIds(customer).length;
                  return (
                    <tr key={customer.externalId} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{customer.companyName}</td>
                      <td className="py-2 pr-3">{contact?.name || '—'}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{formatCustomerAddress(customer) || '—'}</td>
                      <td className="py-2 pr-3">{customer.phone || '—'}</td>
                      <td className="py-2 pr-3">{customer.email || '—'}</td>
                      <td className="py-2 pr-3">{taggedCount}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setB2bEditTarget(customer)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setMyProductsTarget(customer)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                          >
                            My Product
                          </button>
                          <button
                            type="button"
                            onClick={() => setPurchaseHistoryTarget(customer)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                          >
                            Purchase History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <InfiniteScrollTableSentinel
              colSpan={7}
              hasMore={b2bHasMore}
              sentinelRef={b2bSentinelRef}
              visibleCount={b2bVisibleCount}
              totalCount={b2bTotalCount}
            />
          </TableScrollContainer>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={posSearch}
                onChange={e => setPosSearch(e.target.value)}
                placeholder="Search POS customers…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background"
              />
            </div>
            <button
              type="button"
              onClick={() => setPosEditTarget('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus size={12} />
              Add POS Customer
            </button>
          </div>

          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <SortableTableHeaderRow
                  columns={POS_COLUMNS}
                  sortColumn={posSortColumn}
                  sortDirection={posSortDirection}
                  onSort={togglePosSort}
                  className="border-b border-border"
                />
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : pagedPos.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No POS customers yet.</td></tr>
                ) : pagedPos.map(customer => {
                  const currentYear = new Date().getFullYear();
                  const loyalty = parsePosLoyaltySummary(customer).find(s => s.year === currentYear);
                  const coupons = parsePosCouponSummary(customer).find(s => s.year === currentYear);
                  return (
                    <tr key={customer.externalId} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{customer.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{formatCustomerAddress(customer) || '—'}</td>
                      <td className="py-2 pr-3">{customer.phone || '—'}</td>
                      <td className="py-2 pr-3">{customer.email || '—'}</td>
                      <td className="py-2 pr-3">
                        {loyalty ? `${loyalty.balance.toFixed(0)} pts` : '—'}
                        {coupons ? (
                          <span className="block text-[10px] text-muted-foreground">
                            Coupons: {coupons.used}/{coupons.received} used
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPosEditTarget(customer)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPosHistoryTarget(customer)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <InfiniteScrollTableSentinel
              colSpan={6}
              hasMore={posHasMore}
              sentinelRef={posSentinelRef}
              visibleCount={posVisibleCount}
              totalCount={posTotalCount}
            />
          </TableScrollContainer>
        </>
      )}

      {b2bEditTarget ? (
        <B2bCustomerPanel
          companyId={selectedCompanyId}
          countryCode={countryCode}
          customer={b2bEditTarget === 'new' ? null : b2bEditTarget}
          nextExternalId={nextB2bId}
          onClose={() => setB2bEditTarget(null)}
          onSaved={saved => {
            setB2bCustomers(prev => {
              const exists = prev.some(c => c.externalId === saved.externalId);
              return exists
                ? prev.map(c => c.externalId === saved.externalId ? saved : c)
                : [...prev, saved];
            });
            setAllB2bCustomers(prev => {
              const exists = prev.some(c => c.externalId === saved.externalId);
              return exists
                ? prev.map(c => c.externalId === saved.externalId ? saved : c)
                : [...prev, saved];
            });
            setB2bEditTarget(null);
          }}
        />
      ) : null}

      {posEditTarget ? (
        <PosCustomerPanel
          companyId={selectedCompanyId}
          countryCode={countryCode}
          customer={posEditTarget === 'new' ? null : posEditTarget}
          nextExternalId={nextPosId}
          onClose={() => setPosEditTarget(null)}
          onSaved={saved => {
            setPosCustomers(prev => {
              const exists = prev.some(c => c.externalId === saved.externalId);
              return exists
                ? prev.map(c => c.externalId === saved.externalId ? saved : c)
                : [...prev, saved];
            });
            setAllPosCustomers(prev => {
              const exists = prev.some(c => c.externalId === saved.externalId);
              return exists
                ? prev.map(c => c.externalId === saved.externalId ? saved : c)
                : [...prev, saved];
            });
            setPosEditTarget(null);
          }}
        />
      ) : null}

      {myProductsTarget ? (
        <B2bCustomerMyProductsPanel
          customer={myProductsTarget}
          companyId={selectedCompanyId}
          onClose={() => setMyProductsTarget(null)}
          onSaved={saved => {
            setB2bCustomers(prev => prev.map(c => c.externalId === saved.externalId ? saved : c));
            setMyProductsTarget(saved);
          }}
        />
      ) : null}

      {purchaseHistoryTarget ? (
        <B2bCustomerPurchaseHistoryPanel
          customer={purchaseHistoryTarget}
          onClose={() => setPurchaseHistoryTarget(null)}
        />
      ) : null}

      {posHistoryTarget ? (
        <PosCustomerHistoryPanel
          customer={posHistoryTarget}
          onClose={() => setPosHistoryTarget(null)}
        />
      ) : null}
    </div>
  );
}
