import { useEffect, useState } from 'react';
import { api, type SampleRequestDetail } from '../api';
import { formatVendorPolicyLabel } from '../data/vendorPolicyRules';
import { sampleRequestTemplateTitle } from '../data/requestForSample';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';

type Props = {
  token: string;
};

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function labelOrDash(value?: string | null): string {
  return value?.trim() ? value : '—';
}

export function SampleRequestPortalPage({ token }: Props) {
  const [request, setRequest] = useState<SampleRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptedBy, setAcceptedBy] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.sampleRequestByShareToken(token)
      .then(row => {
        setRequest(row);
        setAcceptedBy(row.vendorContactPerson || '');
      })
      .catch(err => {
        setRequest(null);
        setError(err instanceof Error ? err.message : 'Unable to load sample request.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!request) return;
    setAccepting(true);
    setError(null);
    try {
      const updated = await api.acceptSampleRequest(token, acceptedBy.trim() || undefined);
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept sample request.');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return <MillstoneLoader layout="screen" size="lg" label="Loading sample request…" />;
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3EE] px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{error ?? 'This sample request link is invalid.'}</p>
        </div>
      </div>
    );
  }

  const title = sampleRequestTemplateTitle(request.templateType);
  const isSimple = request.templateType === 'sample-request';
  const sample = request.productSamples?.[0];
  const canAccept = request.canAccept !== false && !request.vendorAcceptedAt;

  return (
    <div className="min-h-screen bg-[#F7F3EE]">
      <header className="border-b border-border bg-[#2A2118] text-white px-4 py-4 print:bg-white print:text-black">
        <div className="w-full max-w-none mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 print:text-muted-foreground">pasar.ai · Bisync.cloud</p>
            <h1 className="text-lg font-semibold mt-1">{title}</h1>
            <p className="text-sm text-white/80 mt-0.5 print:text-foreground">{request.requestNumber}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden px-3 py-1.5 rounded-md text-xs font-bold border border-white/30 hover:bg-white/10"
          >
            Print / PDF
          </button>
        </div>
      </header>

      <main className="w-full max-w-none mx-auto px-4 py-6 space-y-5">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {isSimple ? (
          <>
            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Request</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Date:</span> {request.dateRequested}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Requested by:</span> {request.contactPersonName}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Company:</span> {request.companyRequested}</p>
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Status:</span>{' '}
                {request.vendorAcceptedAt ? `Accepted by ${request.vendorAcceptedBy || 'vendor'}` : request.status}
              </p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendor</p>
              <p className="text-sm font-semibold text-foreground">{request.customerName}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Address:</span> {labelOrDash(request.vendorAddress)}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Contact:</span> {labelOrDash(request.vendorContactPerson)}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Mobile:</span> {labelOrDash(request.vendorContactMobile)}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Email:</span> {labelOrDash(request.vendorContactEmail)}</p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Product sample</p>
              <p className="text-sm text-foreground">
                {labelOrDash(request.productCategory)} · {labelOrDash(request.productGroup)}
              </p>
              <p className="text-sm font-semibold text-foreground">{sample?.name || request.projectName}</p>
              {sample?.description ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sample.description}</p>
              ) : null}
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Requested amount:</span>{' '}
                {request.quantityRequested} {request.quantityUom}
              </p>
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Product policy:</span>{' '}
                {request.productPolicyTag
                  ? formatVendorPolicyLabel(request.productPolicyTag as 'halal' | 'muslim-friendly' | 'non-halal')
                  : '—'}
              </p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
              {canAccept ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Vendor acceptance</p>
                  <p className="text-xs text-muted-foreground">
                    Confirm that you can supply this sample as described.
                  </p>
                  <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1" htmlFor="sample-accepted-by">
                    Accepted by
                  </label>
                  <input
                    id="sample-accepted-by"
                    value={acceptedBy}
                    onChange={e => setAcceptedBy(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="Your name"
                  />
                  <button
                    type="button"
                    disabled={accepting}
                    onClick={() => void handleAccept()}
                    className="px-4 py-2 rounded-md text-sm font-bold bg-[#2A2118] text-white disabled:opacity-50"
                  >
                    {accepting ? 'Accepting…' : 'Accept sample request'}
                  </button>
                </>
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-sm font-semibold text-emerald-800">Sample request accepted</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Accepted by {request.vendorAcceptedBy || 'vendor'}
                    {request.vendorAcceptedAt ? ` on ${new Date(request.vendorAcceptedAt).toLocaleString()}` : ''}.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Request</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Date:</span> {request.dateRequested}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Contact:</span> {request.contactPersonName}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Company:</span> {request.companyRequested}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Customer:</span> {request.customerName}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Project:</span> {request.projectName}</p>
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Scope / type:</span>{' '}
                {request.projectScope} · {request.requestType.replace('_', ' ')}
              </p>
              {request.requestType === 'modification' && request.modificationDetails ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.modificationDetails}</p>
              ) : null}
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Commercial</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Delivery unit:</span> {labelOrDash(request.deliveryUnit)}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Expected QTY / year:</span> {request.expectedQtyPerYear}</p>
              <p className="text-sm text-foreground"><span className="text-muted-foreground">Expected price:</span> {formatMoney(request.expectedPrice)}</p>
              <p className="text-sm font-semibold text-foreground">
                Expected sales / year: {formatMoney(request.expectedSalesAmountPerYear)}
              </p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Product samples</p>
              <p className="text-sm text-foreground">
                {labelOrDash(request.productCategory)} · {labelOrDash(request.productGroup)}
              </p>
              {(request.productSamples ?? []).map((row, index) => (
                <div key={`${row.name}-${index}`} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{row.name}</p>
                  {row.description ? (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{row.description}</p>
                  ) : null}
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Specific conditions</p>
              <p className="text-sm text-foreground">
                Solubility: {[request.waterSoluble ? 'Water soluble' : null, request.oilSoluble ? 'Oil soluble' : null].filter(Boolean).join(', ') || '—'}
              </p>
              <p className="text-sm text-foreground">
                Flavour: {[
                  request.flavourNatural ? 'Natural' : null,
                  request.flavourNaturalIdentical ? 'Natural identical' : null,
                  request.flavourArtificial ? 'Artificial' : null,
                ].filter(Boolean).join(', ') || '—'}
              </p>
              <p className="text-sm text-foreground">
                Quantity: {request.quantityRequested} {request.quantityUom}
              </p>
              <p className="text-sm text-foreground">
                Halal: certified {yesNo(request.halalCertified)}, compliant accepted {yesNo(request.halalCompliantAccepted)}
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
