import { Fragment, useEffect, useState } from 'react';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { api, type QuoteRequestSummary } from '../../api';
import {
  buildVendorRfqShareUrl,
  copyVendorRfqShareLink,
} from '../../data/vendorRfqShare';
import { TableScrollContainer } from '../shared/TableScrollContainer';

type Props = {
  selectedCompanyId: number | null;
  refreshKey?: number;
};

export function RequestForQuoteList({ selectedCompanyId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<QuoteRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedCompanyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.quoteRequests(selectedCompanyId)
      .then(setRows)
      .catch(err => {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Failed to load requests for quote.');
      })
      .finally(() => setLoading(false));
  }, [selectedCompanyId, refreshKey]);

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
        Select a company to view requests for quote.
      </p>
    );
  }

  if (loading) {
    return <p className="p-8 text-center text-xs text-muted-foreground">Loading requests for quote…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive px-4 py-3">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-6 text-center">
        No requests for quote yet. Use <span className="font-semibold">Request For Quote</span> to create one.
      </p>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
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
                    <td className="px-4 py-3 capitalize text-foreground">{row.status}</td>
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
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {vendor.status}
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
        Click an RFQ number to see vendor Delivery Unit and RRP responses.
      </div>
    </div>
  );
}
