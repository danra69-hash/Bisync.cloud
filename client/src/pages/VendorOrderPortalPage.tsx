import { useEffect, useMemo, useState } from 'react';
import { Check, Download, FileText } from 'lucide-react';
import { api, type VendorOrderPortal } from '../api';
import { buildPurchaseOrderPdfDataFromPortal } from '../data/buildPurchaseOrderPdfDataFromPortal';
import { downloadPurchaseOrderPdf } from '../data/generatePurchaseOrderPdf';
import { formatRm } from '../data/createOrder';
import { PurchaseOrderPdfPreview } from '../components/revenue/PurchaseOrderPdfPreview';

type Props = {
  token: string;
};

export function VendorOrderPortalPage({ token }: Props) {
  const [portal, setPortal] = useState<VendorOrderPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedBy, setAcceptedBy] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.vendorOrderPortal(token)
      .then(data => {
        setPortal(data);
        setAcceptedBy(data.vendor.contactPerson || data.vendorName);
      })
      .catch(err => {
        setPortal(null);
        setError(err instanceof Error ? err.message : 'Unable to load purchase order.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const pdfData = useMemo(
    () => (portal ? buildPurchaseOrderPdfDataFromPortal(portal) : null),
    [portal],
  );

  const totalAmount = useMemo(() => {
    if (!portal) return 0;
    return portal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [portal]);

  async function handleAccept() {
    if (!portal?.canAccept) return;
    setAccepting(true);
    setError(null);
    try {
      const updated = await api.acceptVendorOrder(token, acceptedBy.trim() || portal.vendorName);
      setPortal(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept purchase order.');
    } finally {
      setAccepting(false);
    }
  }

  async function handleDownload() {
    if (!pdfData) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadPurchaseOrderPdf(pdfData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Bisync.cloud Vendor Portal</p>
            <h1 className="text-lg font-semibold mt-0.5">
              {portal?.documentKind === 'purchase_request' ? 'Purchase Request' : 'Purchase Order'}
            </h1>
          </div>
          {portal && (
            <span className={`text-xs font-sans px-2 py-1 rounded ${
              portal.vendorAcceptedAt
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
            }`}>
              {portal.vendorAcceptedAt ? 'Accepted' : portal.status}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-4">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-16">Loading purchase order…</p>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && portal && pdfData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Number</p>
                <p className="text-sm font-semibold mt-1">{portal.poNumber}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Vendor</p>
                <p className="text-sm font-semibold mt-1">{portal.vendorName}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-sm font-semibold mt-1">{formatRm(totalAmount)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText size={16} className="text-primary" />
                  Document Preview
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  <Download size={12} />
                  {downloading ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
              <div className="p-4">
                <PurchaseOrderPdfPreview pdf={pdfData} className="h-[70vh] min-h-[420px]" />
              </div>
            </div>

            {portal.vendorAcceptedAt ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 flex items-start gap-3">
                <Check size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Order accepted</p>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                    Accepted by {portal.vendorAcceptedBy || portal.vendorName}
                    {portal.vendorAcceptedAt && ` on ${new Date(portal.vendorAcceptedAt).toLocaleString()}`}.
                  </p>
                </div>
              </div>
            ) : portal.canAccept ? (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Accept this order</p>
                <p className="text-xs text-muted-foreground">
                  Confirm that you accept this {portal.documentKind === 'purchase_request' ? 'purchase request' : 'purchase order'}.
                  The buyer will be notified in Bisync.cloud.
                </p>
                <div>
                  <label htmlFor="accepted-by" className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                    Your name
                  </label>
                  <input
                    id="accepted-by"
                    value={acceptedBy}
                    onChange={e => setAcceptedBy(e.target.value)}
                    className="mt-1.5 w-full max-w-md px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Contact name"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  <Check size={14} />
                  {accepting ? 'Accepting…' : 'Accept Order'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
