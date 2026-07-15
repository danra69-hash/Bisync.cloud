import { Fragment, useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { api, type QuoteRequestSummary, type Vendor } from '../../api';
import {
  buildVendorRfqShareUrl,
  copyVendorRfqShareLink,
} from '../../data/vendorRfqShare';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { QuoteComparisonModal } from './QuoteComparisonModal';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  selectedCompanyId: number | null;
  vendors: Vendor[];
  refreshKey?: number;
  onVendorUpdated?: (vendor: Vendor) => void;
};

function rfqStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'All quotes received';
    case 'partial':
      return 'Partially quoted';
    case 'open':
      return 'Awaiting quotes';
    default:
      return status;
  }
}

function rfqStatusClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-[#5A7A2A]/15 text-[#5A7A2A] border-[#5A7A2A]/30';
    case 'partial':
      return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function vendorStatusClass(status: string): string {
  return status === 'submitted'
    ? 'text-[#5A7A2A]'
    : 'text-muted-foreground';
}

export function RequestForQuoteList({
  selectedCompanyId,
  vendors,
  refreshKey = 0,
  onVendorUpdated,
}: Props) {
  const [rows, setRows] = useState<QuoteRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [compareRfq, setCompareRfq] = useState<QuoteRequestSummary | null>(null);

  const loadRows = useCallback(async (silent = false) => {
    if (!selectedCompanyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await api.quoteRequests(selectedCompanyId);
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load sample & quote requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadRows(true);
      }
    }, 15000);

    const onFocus = () => void loadRows(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [selectedCompanyId, loadRows]);

  async function handleCopy(token: string) {
    try {
      await copyVendorRfqShareLink(token);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(current => (current === token ? null : current)), 2000);
    } catch {
      setError('Could not copy link.');
    }
  }

  if (!selectedCompanyId) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-6 text-center">
        Select a company to view sample & quote requests.
      </p>
    );
  }

  if (loading) {
    return <MillstoneLoader size="sm" layout="block" label="Loading sample & quote requests…" />;
  }

  if (error) {
    return <p className="text-sm text-destructive px-4 py-3">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-6 text-center">
        No sample & quote requests yet. Use <span className="font-semibold">Sample & Quote</span> to create one.
      </p>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Status updates when vendors submit pricing via their share link.
        </p>
        <button
          type="button"
          onClick={() => void loadRows(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={10}  />
          Refresh
        </button>
      </div>
      <TableScrollContainer className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 sticky top-0">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 font-semibold">RFQ</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Vendors</th>
              <th className="px-4 py-2.5 font-semibold">Lines</th>
              <th className="px-4 py-2.5 font-semibold">Created</th>
              <th className="px-4 py-2.5 font-semibold">Vendor links</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className="border-b border-border align-top">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {row.rfqNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => setCompareRfq(row)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${rfqStatusClass(row.status)}`}
                          title="Compare vendor quotes"
                        >
                          {rfqStatusLabel(row.status)}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${rfqStatusClass(row.status)}`}
                        >
                          {rfqStatusLabel(row.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {row.submittedCount}/{row.vendorCount} submitted
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.lineCount}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        {row.vendors.map(vendor => (
                          <div key={vendor.id} className="flex items-center gap-2 flex-wrap">
                            <span className="text-foreground">{vendor.vendorName}</span>
                            <span className={`text-[10px] uppercase tracking-wide font-semibold ${vendorStatusClass(vendor.status)}`}>
                              {vendor.status === 'submitted' ? 'Submitted' : 'Pending'}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleCopy(vendor.shareToken)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[11px] font-semibold hover:bg-muted"
                              title={buildVendorRfqShareUrl(vendor.shareToken)}
                            >
                              <Copy size={10} />
                              {copiedToken === vendor.shareToken ? 'Copied' : 'Copy'}
                            </button>
                            <a
                              href={buildVendorRfqShareUrl(vendor.shareToken)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[11px] font-semibold hover:bg-muted"
                            >
                              <ExternalLink size={10} />
                              Open
                            </a>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-border bg-muted/10">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-3">
                          {(row.lines ?? []).map(line => (
                            <div key={line.id} className="rounded-md border border-border bg-card p-3">
                              <p className="font-semibold text-foreground">
                                {line.componentName}
                                {line.kind === 'other' ? (
                                  <span className="ml-2 font-normal text-muted-foreground">· other</span>
                                ) : null}
                              </p>
                              {line.specification ? (
                                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{line.specification}</p>
                              ) : null}
                              <div className="mt-2 space-y-1">
                                {row.vendors.map(vendor => {
                                  const response = line.vendorResponses?.[vendor.vendorExternalId];
                                  return (
                                    <p key={`${line.id}-${vendor.vendorExternalId}`} className="text-muted-foreground">
                                      <span className="text-foreground font-medium">{vendor.vendorName}:</span>{' '}
                                      {response
                                        ? `${response.deliveryUnitText || '—'} · ${response.rrp}`
                                        : 'Awaiting response'}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </TableScrollContainer>
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1">
        <RefreshCw size={10} />
        Click an RFQ number to see vendor responses. Click <span className="font-semibold">All quotes received</span> to compare quotes.
      </div>

      {compareRfq ? (
        <QuoteComparisonModal
          rfq={compareRfq}
          vendors={vendors}
          selectedCompanyId={selectedCompanyId}
          onClose={() => setCompareRfq(null)}
          onVendorUpdated={onVendorUpdated}
        />
      ) : null}
    </div>
  );
}
