import { useEffect, useState } from 'react';
import { api, type SampleRequestDetail } from '../api';

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

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.sampleRequestByShareToken(token)
      .then(setRequest)
      .catch(err => {
        setRequest(null);
        setError(err instanceof Error ? err.message : 'Unable to load sample request.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3EE]">
        <p className="text-sm text-muted-foreground">Loading sample request…</p>
      </div>
    );
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

  return (
    <div className="min-h-screen bg-[#F7F3EE]">
      <header className="border-b border-border bg-[#2C1A0A] text-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">pasar.ai · Bisync.cloud</p>
          <h1 className="text-lg font-semibold mt-1">Sample Request for Flavours</h1>
          <p className="text-sm text-white/80 mt-0.5">{request.requestNumber}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
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
          {(request.productSamples ?? []).map((sample, index) => (
            <div key={`${sample.name}-${index}`} className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold text-foreground">{sample.name}</p>
              {sample.description ? (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{sample.description}</p>
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
            Qty requested: {request.quantityRequested} {labelOrDash(request.quantityUom)}
          </p>
          <p className="text-sm text-foreground"><span className="text-muted-foreground">Target products:</span> {labelOrDash(request.targetProducts)}</p>
          <p className="text-sm text-foreground"><span className="text-muted-foreground">GMO:</span> {request.gmoStatus}</p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Allergen:</span> {request.allergenStatus}
            {request.allergenStatus === 'free_from' && request.allergenFreeFromDetail
              ? ` — ${request.allergenFreeFromDetail}`
              : ''}
          </p>
          <p className="text-sm text-foreground"><span className="text-muted-foreground">3-MCPD / HVP free:</span> {labelOrDash(request.mcpdHvpFreeDetail)}</p>
          <p className="text-sm text-foreground">
            Halal: certified {yesNo(request.halalCertified)}, compliant accepted {yesNo(request.halalCompliantAccepted)}
          </p>
          <p className="text-sm text-foreground"><span className="text-muted-foreground">R&amp;D country:</span> {labelOrDash(request.countryRdSite)}</p>
          <p className="text-sm text-foreground"><span className="text-muted-foreground">Manufacturing:</span> {labelOrDash(request.countryManufacturing)}</p>
          <p className="text-sm text-foreground"><span className="text-muted-foreground">Country in use:</span> {labelOrDash(request.countryInUse)}</p>
          <p className="text-sm text-foreground">
            Regulatory: {request.regulatoryRequirement}
            {request.regulatoryRequirement === 'yes' && request.regulatoryRequirementDetail
              ? ` — ${request.regulatoryRequirementDetail}`
              : ''}
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Customer deadline:</span> {labelOrDash(request.customerDeadline)}
          </p>
        </section>
      </main>
    </div>
  );
}
