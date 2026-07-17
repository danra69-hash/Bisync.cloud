import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ClipboardList, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { api, type B2bCustomer, type B2bSalesOrder } from '../../api';
import {
  canIssueSalesOrderWithoutApproval,
  parseUserAccess,
} from '../../data/userAccess';
import {
  buildSalesOrderShareUrl,
  buildSalesOrderWhatsAppUrl,
  copySalesOrderShareLink,
} from '../../data/salesOrderShare';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { sortTableRows } from '../../utils/tableSort';
import { pageShellClass } from '../layout/pageLayout';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import { CreateB2bSalesOrderPage } from './CreateB2bSalesOrderPage';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

type SortColumn = 'orderNumber' | 'customer' | 'status' | 'items' | 'total' | 'updated' | 'action';

const COLUMNS: SortableColumnDef<SortColumn>[] = [
  { key: 'orderNumber', label: 'SO Number' },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'items', label: 'Items', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'updated', label: 'Updated' },
  { key: 'action', label: 'Action', sortable: false },
];

function orderTotal(order: B2bSalesOrder): number {
  return (order.lines ?? []).reduce((sum, line) => sum + line.quantityOrdered * line.rrp, 0);
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Pending Approval';
    case 'issued':
      return 'Issued';
    case 'confirmed':
      return 'Confirmed';
    case 'fulfilled':
      return 'Fulfilled';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || '—';
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-amber-100 text-amber-800';
    case 'issued':
      return 'bg-sky-100 text-sky-800';
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800';
    case 'fulfilled':
      return 'bg-violet-100 text-violet-800';
    case 'expired':
      return 'bg-muted text-muted-foreground';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function ActiveSalesOrderPage({ selectedCompanyId, selectedLocationIds }: Props) {
  useRevMgmtPageLabel('Sales Order');
  const { rm } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : null),
    [currentUser],
  );
  const canIssue = Boolean(access && canIssueSalesOrderWithoutApproval(access));

  const [orders, setOrders] = useState<B2bSalesOrder[]>([]);
  const [customers, setCustomers] = useState<B2bCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showCreateSalesOrder, setShowCreateSalesOrder] = useState(false);
  const { sortColumn, sortDirection, toggleSort } = useTableSort<SortColumn>();
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const loadOrders = useCallback(async () => {
    if (!selectedCompanyId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await api.b2bSalesOrders(selectedCompanyId);
      const active = rows.filter(o =>
        o.status === 'draft' || o.status === 'issued' || o.status === 'confirmed',
      );
      setOrders(active);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : 'Failed to load sales orders.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  const loadCustomers = useCallback(async () => {
    if (!selectedCompanyId) {
      setCustomers([]);
      return;
    }
    try {
      const rows = await api.b2bCustomers(selectedCompanyId);
      setCustomers(rows);
    } catch {
      setCustomers([]);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const sorted = useMemo(() => {
    return sortTableRows(orders, sortColumn, sortDirection, {
      orderNumber: order => order.orderNumber,
      customer: order => order.customerName,
      status: order => statusLabel(order.status),
      items: order => order.lines?.length ?? 0,
      total: order => orderTotal(order),
      updated: order => order.updatedAt,
    });
  }, [orders, sortColumn, sortDirection]);

  const {
    visibleItems,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sorted, { scrollRootRef });

  async function ensureToken(order: B2bSalesOrder): Promise<string> {
    const existing = order.shareToken?.trim();
    if (existing) return existing;
    const refreshed = await api.ensureB2bSalesOrderShareToken(order.id);
    setOrders(prev => prev.map(row => (row.id === refreshed.id ? refreshed : row)));
    return refreshed.shareToken?.trim() ?? '';
  }

  async function handleIssue(order: B2bSalesOrder) {
    setBusyId(order.id);
    setError(null);
    try {
      const updated = await api.issueB2bSalesOrder(order.id);
      setOrders(prev => prev.map(row => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue sales order.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(order: B2bSalesOrder) {
    setBusyId(order.id);
    try {
      const token = await ensureToken(order);
      if (!token) throw new Error('Share link is not available.');
      await copySalesOrderShareLink(token);
      setCopiedId(order.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy link.');
    } finally {
      setBusyId(null);
    }
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to view sales orders.</p>
      </div>
    );
  }

  if (showCreateSalesOrder) {
    return (
      <CreateB2bSalesOrderPage
        companyId={selectedCompanyId}
        customers={customers}
        selectedLocationIds={selectedLocationIds}
        onClose={() => setShowCreateSalesOrder(false)}
        onSubmitted={() => {
          setShowCreateSalesOrder(false);
          void loadOrders();
        }}
      />
    );
  }

  return (
    <div className={pageShellClass()}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-muted-foreground">
          Draft orders await approval. Issued orders are locked for fulfillment.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateSalesOrder(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800"
          >
            <ClipboardList size={12} />
            Create Sales Order
          </button>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <SortableTableHeaderRow
              columns={COLUMNS}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={toggleSort}
              className="border-b border-border"
            />
          </thead>
          <tbody>
            {loading && orders.length === 0 ? (
              <TableLoadingRow colSpan={7} label="Loading…" />
            ) : visibleItems.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No sales orders.</td></tr>
            ) : visibleItems.map(order => {
              const token = order.shareToken?.trim() ?? '';
              const canShare = (order.status === 'issued' || order.status === 'confirmed') && canIssue;
              return (
                <tr key={order.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{order.orderNumber}</td>
                  <td className="py-2 pr-3">{order.customerName}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${statusBadgeClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{order.lines?.length ?? 0}</td>
                  <td className="py-2 pr-3 text-right font-semibold">{rm(orderTotal(order))}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {order.status === 'draft' && canIssue ? (
                        <button
                          type="button"
                          disabled={busyId === order.id}
                          onClick={() => void handleIssue(order)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          Issue
                        </button>
                      ) : null}
                      {canShare || ((order.status === 'issued' || order.status === 'confirmed') && token) ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void handleCopy(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-border hover:bg-muted disabled:opacity-50"
                          >
                            {copiedId === order.id ? <Check size={11} /> : <Copy size={11} />}
                            {copiedId === order.id ? 'Copied' : 'Copy link'}
                          </button>
                          {token ? (
                            <a
                              href={buildSalesOrderWhatsAppUrl(token, order.orderNumber, order.customerName)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#25D366] text-white hover:bg-[#1ebe57]"
                              title={buildSalesOrderShareUrl(token)}
                            >
                              <ExternalLink size={11} />
                              WhatsApp
                            </a>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            <InfiniteScrollTableSentinel
              colSpan={7}
              hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize}
              sentinelRef={sentinelRef}
              totalCount={totalCount}
              visibleCount={visibleCount}
            />
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
