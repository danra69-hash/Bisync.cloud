import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Mail, MessageCircle, RefreshCw, X } from 'lucide-react';
import { api, type SampleRequestDetail, type SampleRequestSummary } from '../../api';
import {
  buildSampleRequestMailtoUrl,
  buildSampleRequestShareUrl,
  buildSampleRequestWhatsAppUrl,
  copySampleRequestShareLink,
  formatSampleProjectScope,
  formatSampleRequestType,
  sampleRequestTemplateTitle,
} from '../../data/requestForSample';
import { formatVendorPolicyLabel } from '../../data/vendorPolicyRules';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

type Props = {
  selectedCompanyId: number | null;
  refreshKey?: number;
};

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function labelOrDash(value?: string | null): string {
  return value?.trim() ? value : '—';
}

function SampleRequestDetailPanel({
  detail,
  onClose,
}: {
  detail: SampleRequestDetail;
  onClose: () => void;
}) {
  const { rm } = useCountryFormatters();
  const formatMoney = (value?: number): string => {
    if (value == null || !Number.isFinite(value)) return '—';
    return rm(value);
  };
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCopy() {
    if (!detail.shareToken) return;
    try {
      await copySampleRequestShareLink(detail.shareToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">Sample & Quote</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{detail.requestNumber}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{sampleRequestTemplateTitle(detail.templateType)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
          {detail.templateType === 'sample-request' ? (
            <>
              <section className="space-y-1.5">
                <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Request</h4>
                <p><span className="text-muted-foreground">Date:</span> {detail.dateRequested}</p>
                <p><span className="text-muted-foreground">Contact:</span> {detail.contactPersonName}</p>
                <p><span className="text-muted-foreground">Company:</span> {detail.companyRequested}</p>
                <p><span className="text-muted-foreground">Status:</span> {detail.status}</p>
                {detail.vendorAcceptedAt ? (
                  <p>
                    <span className="text-muted-foreground">Accepted:</span>{' '}
                    {detail.vendorAcceptedBy || 'vendor'} · {new Date(detail.vendorAcceptedAt).toLocaleString()}
                  </p>
                ) : null}
              </section>
              <section className="space-y-1.5">
                <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Vendor</h4>
                <p className="font-semibold">{detail.customerName}</p>
                <p><span className="text-muted-foreground">Address:</span> {labelOrDash(detail.vendorAddress)}</p>
                <p><span className="text-muted-foreground">Contact:</span> {labelOrDash(detail.vendorContactPerson)}</p>
                <p><span className="text-muted-foreground">Mobile:</span> {labelOrDash(detail.vendorContactMobile)}</p>
                <p><span className="text-muted-foreground">Email:</span> {labelOrDash(detail.vendorContactEmail)}</p>
              </section>
              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Product sample</h4>
                <p>{labelOrDash(detail.productCategory)} · {labelOrDash(detail.productGroup)}</p>
                {(detail.productSamples ?? []).map((sample, index) => (
                  <div key={`${sample.name}-${index}`} className="rounded-md border border-border p-3">
                    <p className="font-semibold text-foreground">{sample.name}</p>
                    {sample.description ? (
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{sample.description}</p>
                    ) : null}
                  </div>
                ))}
                <p>Qty: {detail.quantityRequested} {labelOrDash(detail.quantityUom)}</p>
                <p>
                  Policy:{' '}
                  {detail.productPolicyTag
                    ? formatVendorPolicyLabel(detail.productPolicyTag as 'halal' | 'muslim-friendly' | 'non-halal')
                    : '—'}
                </p>
              </section>
            </>
          ) : (
            <>
          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Request</h4>
            <p><span className="text-muted-foreground">Date:</span> {detail.dateRequested}</p>
            <p><span className="text-muted-foreground">Contact:</span> {detail.contactPersonName}</p>
            <p><span className="text-muted-foreground">Company:</span> {detail.companyRequested}</p>
            <p><span className="text-muted-foreground">Customer:</span> {detail.customerName}</p>
            <p><span className="text-muted-foreground">Project:</span> {detail.projectName}</p>
            <p>
              <span className="text-muted-foreground">Scope / type:</span>{' '}
              {formatSampleProjectScope(detail.projectScope)} · {formatSampleRequestType(detail.requestType)}
            </p>
            {detail.requestType === 'modification' && detail.modificationDetails ? (
              <p className="text-muted-foreground whitespace-pre-wrap">{detail.modificationDetails}</p>
            ) : null}
          </section>

          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Commercial</h4>
            <p><span className="text-muted-foreground">Delivery unit:</span> {labelOrDash(detail.deliveryUnit)}</p>
            <p><span className="text-muted-foreground">Expected QTY / year:</span> {detail.expectedQtyPerYear}</p>
            <p><span className="text-muted-foreground">Expected price:</span> {formatMoney(detail.expectedPrice)}</p>
            <p className="font-semibold">
              Expected sales / year: {formatMoney(detail.expectedSalesAmountPerYear)}
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Product samples</h4>
            <p>{labelOrDash(detail.productCategory)} · {labelOrDash(detail.productGroup)}</p>
            {(detail.productSamples ?? []).map((sample, index) => (
              <div key={`${sample.name}-${index}`} className="rounded-md border border-border p-3">
                <p className="font-semibold text-foreground">{sample.name}</p>
                {sample.description ? (
                  <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{sample.description}</p>
                ) : null}
              </div>
            ))}
          </section>

          <section className="space-y-1.5">
            <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">Specific conditions</h4>
            <p>
              Solubility:{' '}
              {[detail.waterSoluble ? 'Water soluble' : null, detail.oilSoluble ? 'Oil soluble' : null]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
            <p>
              Flavour:{' '}
              {[
                detail.flavourNatural ? 'Natural' : null,
                detail.flavourNaturalIdentical ? 'Natural identical' : null,
                detail.flavourArtificial ? 'Artificial' : null,
              ].filter(Boolean).join(', ') || '—'}
            </p>
            <p>Qty requested: {detail.quantityRequested} {labelOrDash(detail.quantityUom)}</p>
            <p><span className="text-muted-foreground">Target products:</span> {labelOrDash(detail.targetProducts)}</p>
            <p><span className="text-muted-foreground">GMO:</span> {detail.gmoStatus}</p>
            <p>
              <span className="text-muted-foreground">Allergen:</span> {detail.allergenStatus}
              {detail.allergenStatus === 'free_from' && detail.allergenFreeFromDetail
                ? ` — ${detail.allergenFreeFromDetail}`
                : ''}
            </p>
            <p><span className="text-muted-foreground">3-MCPD / HVP free:</span> {labelOrDash(detail.mcpdHvpFreeDetail)}</p>
            <p>
              Halal: certified {yesNo(detail.halalCertified)}, compliant accepted {yesNo(detail.halalCompliantAccepted)}
            </p>
            <p><span className="text-muted-foreground">R&amp;D country:</span> {labelOrDash(detail.countryRdSite)}</p>
            <p><span className="text-muted-foreground">Manufacturing:</span> {labelOrDash(detail.countryManufacturing)}</p>
            <p><span className="text-muted-foreground">Country in use:</span> {labelOrDash(detail.countryInUse)}</p>
            <p>
              Regulatory: {detail.regulatoryRequirement}
              {detail.regulatoryRequirement === 'yes' && detail.regulatoryRequirementDetail
                ? ` — ${detail.regulatoryRequirementDetail}`
                : ''}
            </p>
            <p><span className="text-muted-foreground">Customer deadline:</span> {labelOrDash(detail.customerDeadline)}</p>
          </section>
            </>
          )}

          {detail.shareToken ? (
            <section className="rounded-lg border border-border p-3 space-y-2">
              <p className="font-semibold text-foreground">Share link</p>
              <input
                readOnly
                value={buildSampleRequestShareUrl(detail.shareToken)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-[11px]"
                onFocus={e => e.currentTarget.select()}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
                >
                  <Copy size={11} />
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={buildSampleRequestMailtoUrl(
                    detail.shareToken,
                    detail.requestNumber,
                    detail.customerName,
                    detail.vendorContactEmail,
                    detail.templateType,
                  )}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                >
                  <Mail size={11} />
                  Email
                </a>
                <a
                  href={buildSampleRequestWhatsAppUrl(
                    detail.shareToken,
                    detail.requestNumber,
                    detail.customerName,
                    detail.templateType,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                >
                  <MessageCircle size={11} />
                  WhatsApp
                </a>
              </div>
            </section>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function SampleRequestList({ selectedCompanyId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<SampleRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SampleRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      const data = await api.sampleRequests(selectedCompanyId);
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load sample requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setError(null);
    try {
      const row = await api.sampleRequest(id);
      setDetail(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample request detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  if (!selectedCompanyId) {
    return (
      <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-6 text-center">
        Select a company to view sample requests.
      </p>
    );
  }

  if (loading) {
    return <MillstoneLoader size="sm" layout="block" label="Loading sample requests…" />;
  }

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground">Sample requests</p>
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

        {error ? <p className="text-sm text-destructive px-4 py-3">{error}</p> : null}
        {detailLoading ? (
          <p className="text-xs text-muted-foreground px-4 py-2">Opening detail…</p>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">
            No sample requests yet. Use <span className="font-semibold">Request for Sample</span> to create one.
          </p>
        ) : (
          <TableScrollContainer className="max-h-[40vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2.5 font-semibold">Request #</th>
                  <th className="px-4 py-2.5 font-semibold">Template</th>
                  <th className="px-4 py-2.5 font-semibold">Vendor / Customer</th>
                  <th className="px-4 py-2.5 font-semibold">Product / Project</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(row.id)}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {row.requestNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sampleRequestTemplateTitle(row.templateType)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.customerName}</td>
                    <td className="px-4 py-3 text-foreground">{row.projectName}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{row.status}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        )}

        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          Click a request number to view full detail and share links.
        </div>
      </div>

      {detail ? (
        <SampleRequestDetailPanel detail={detail} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  );
}
