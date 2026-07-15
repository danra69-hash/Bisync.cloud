import { useEffect, useMemo, useState } from 'react';
import { Check, Download } from 'lucide-react';
import {
  api,
  type B2bCustomer,
  type B2bSalesOrder,
  type B2bSalesOrderSharePayload,
  type Company,
} from '../api';
import { buildSalesOrderPdfData } from '../data/buildSalesOrderPdfData';
import {
  createPurchaseOrderPdfBlob,
  downloadPurchaseOrderPdf,
} from '../data/generatePurchaseOrderPdf';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';

type Props = {
  token: string;
  pdfOnly?: boolean;
};

function formatDisplayDate(value?: string | null): string {
  if (!value?.trim()) {
    return new Date().toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toCompany(payload: B2bSalesOrderSharePayload['company'], order: B2bSalesOrder): Company {
  if (payload) {
    return {
      id: payload.id,
      name: payload.name,
      brn: payload.brn,
      gstTin: payload.gstTin,
      countryCode: payload.countryCode || 'MY',
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2,
      city: payload.city,
      stateProvince: payload.stateProvince,
      postcode: payload.postcode,
      phone: payload.phone,
      fax: '',
      email: payload.email,
      active: true,
      businessTypesJson: '[]',
      vendorPolicyTagsJson: '[]',
      modulesJson: '[]',
    };
  }
  return {
    id: order.companyId,
    name: 'Company',
    brn: '',
    gstTin: '',
    countryCode: 'MY',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postcode: '',
    phone: '',
    fax: '',
    email: '',
    active: true,
    businessTypesJson: '[]',
    vendorPolicyTagsJson: '[]',
    modulesJson: '[]',
  };
}

function toCustomer(payload: B2bSalesOrderSharePayload['customer'], order: B2bSalesOrder): B2bCustomer {
  if (payload) {
    return {
      id: 0,
      companyId: order.companyId,
      externalId: order.customerExternalId,
      companyName: payload.companyName || order.customerName,
      brn: payload.brn,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      postcode: payload.postcode,
      phone: payload.phone,
      fax: '',
      email: payload.email,
      contactsJson: payload.contactsJson || '[]',
      taggedProductIdsJson: '[]',
      taggedProductAliasIdsJson: '[]',
      taggedB2bProductUnitsJson: '[]',
      purchaseHistoryJson: '[]',
      active: true,
    };
  }
  return {
    id: 0,
    companyId: order.companyId,
    externalId: order.customerExternalId,
    companyName: order.customerName,
    brn: '',
    address: '',
    city: '',
    state: '',
    postcode: '',
    phone: '',
    fax: '',
    email: '',
    contactsJson: '[]',
    taggedProductIdsJson: '[]',
    taggedProductAliasIdsJson: '[]',
    taggedB2bProductUnitsJson: '[]',
    purchaseHistoryJson: '[]',
    active: true,
  };
}

export function SalesOrderPortalPage({ token }: Props) {
  const [payload, setPayload] = useState<B2bSalesOrderSharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptedBy, setAcceptedBy] = useState('');
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.b2bSalesOrderByShareToken(token)
      .then(row => {
        if (cancelled) return;
        setPayload(row);
        setAcceptedBy(row.customer?.companyName || row.order.customerName || '');
      })
      .catch(err => {
        if (!cancelled) {
          setPayload(null);
          setError(err instanceof Error ? err.message : 'Sales order not found.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const pdfData = useMemo(() => {
    if (!payload?.order) return null;
    const order = payload.order;
    const company = toCompany(payload.company, order);
    const customer = toCustomer(payload.customer, order);
    return buildSalesOrderPdfData({
      soNumber: order.orderNumber,
      company,
      customer,
      productionLocation: null,
      lines: (order.lines ?? []).map(line => ({
        key: String(line.id),
        productId: line.productId,
        productAliasId: line.productAliasId ?? null,
        productName: line.productName,
        deliveryUom: line.uom || '—',
        quantity: line.quantityOrdered,
        unitPrice: line.rrp,
        locationExternalId: line.locationExternalId,
      })),
      orderDateLabel: formatDisplayDate(order.issuedDate || order.createdAt),
      deliveryDateLabel: '—',
      initiatedBy: '—',
      approvedBy: order.status === 'confirmed' || order.status === 'issued' || order.status === 'fulfilled'
        ? (order.customerAcceptedBy || 'Confirmed')
        : 'Pending',
    });
  }, [payload]);

  useEffect(() => {
    if (!pdfData) {
      setPdfObjectUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    void createPurchaseOrderPdfBlob(pdfData)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfObjectUrl(objectUrl);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to generate PDF.');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfData]);

  async function handleDownload() {
    if (!pdfData) return;
    setDownloading(true);
    try {
      await downloadPurchaseOrderPdf(pdfData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const updated = await api.acceptB2bSalesOrderByShareToken(token, acceptedBy.trim());
      setPayload(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept sales order.');
    } finally {
      setAccepting(false);
    }
  }

  const order = payload?.order;
  const canAccept = Boolean(payload?.canAccept);
  const acceptedAt = payload?.customerAcceptedAt ?? order?.customerAcceptedAt;
  const acceptedByName = payload?.customerAcceptedBy ?? order?.customerAcceptedBy;

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col">
      <div className="shrink-0 px-4 py-2 border-b border-white/10 flex items-center justify-between gap-3 bg-black/40">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/50">Sales Order PDF</p>
          <p className="text-sm font-semibold truncate">
            {order?.orderNumber ?? 'Sales order'}
            {order?.customerName ? ` · ${order.customerName}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={!pdfData || downloading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/20 text-xs font-medium hover:bg-white/10 disabled:opacity-50 shrink-0"
        >
          <Download size={12} />
          {downloading ? 'Generating…' : 'Download'}
        </button>
      </div>

      {loading && (
        <MillstoneLoader layout="block" size="lg" label="Preparing PDF…" className="flex-1 text-white/60" />
      )}
      {error && (
        <div className="m-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {!loading && !error && pdfObjectUrl && (
        <iframe
          title={order?.orderNumber ? `Sales Order ${order.orderNumber}` : 'Sales Order PDF'}
          src={pdfObjectUrl}
          className="flex-1 w-full min-h-0 border-0 bg-neutral-800"
        />
      )}

      {!loading && payload && (
        <div className="shrink-0 border-t border-white/10 bg-black/60 px-4 py-3">
          {acceptedAt ? (
            <div className="flex items-start gap-2 text-emerald-300">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Order accepted</p>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Accepted by {acceptedByName || order?.customerName || 'customer'}
                  {` on ${new Date(acceptedAt).toLocaleString()}`}.
                </p>
              </div>
            </div>
          ) : canAccept ? (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Confirm this sales order</p>
                <p className="text-xs text-white/60 mt-0.5">
                  Enter your name and accept to confirm the order with the seller.
                </p>
                <label htmlFor="so-accepted-by" className="sr-only">Your name</label>
                <input
                  id="so-accepted-by"
                  value={acceptedBy}
                  onChange={e => setAcceptedBy(e.target.value)}
                  className="mt-2 w-full max-w-md px-3 py-2 text-sm rounded-md border border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="Your name"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleAccept()}
                disabled={accepting || !acceptedBy.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 shrink-0"
              >
                <Check size={14} />
                {accepting ? 'Accepting…' : 'Accept Order'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/60">
              This sales order cannot be accepted right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
