import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Cloud, HardDrive } from 'lucide-react';
import {
  api,
  type Vendor,
  type VendorRatingDetail,
  type VendorRatingLevel,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import {
  formatOverallRating,
  ratingLevelLabel,
  vendorKindHint,
  vendorKindLabel,
  VENDOR_RATING_LEVELS,
} from '../../data/vendorRating';

type Props = {
  vendor: Vendor;
  selectedCompanyId: number | null;
  onBack: () => void;
};

function LevelPicker({
  label,
  description,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  description?: string;
  value: VendorRatingLevel | '';
  onChange: (next: VendorRatingLevel) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {description ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {VENDOR_RATING_LEVELS.map(level => {
          const active = value === level.id;
          return (
            <button
              key={level.id}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(level.id)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              } ${readOnly ? 'cursor-default opacity-90' : ''}`}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCount({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-foreground">{label}</span>
      <span className="text-xs font-sans tabular-nums text-muted-foreground">
        {count} <span className="text-[10px]">({pct}%)</span>
      </span>
    </div>
  );
}

export function VendorRatingDetailPage({ vendor, selectedCompanyId, onBack }: Props) {
  const [detail, setDetail] = useState<VendorRatingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [delivery, setDelivery] = useState<VendorRatingLevel | ''>('');
  const [productAccuracy, setProductAccuracy] = useState<VendorRatingLevel | ''>('');
  const [productQuality, setProductQuality] = useState<VendorRatingLevel | ''>('');
  const [hygiene, setHygiene] = useState<VendorRatingLevel | ''>('');
  const [notes, setNotes] = useState('');

  const isOnline = (detail?.vendorType ?? vendor.type)?.toLowerCase() === 'online';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.vendorRating(vendor.externalId)
      .then(row => {
        if (cancelled) return;
        setDetail(row);
        setDelivery((row.delivery as VendorRatingLevel) || '');
        setProductAccuracy((row.productAccuracy as VendorRatingLevel) || '');
        setProductQuality((row.productQuality as VendorRatingLevel) || '');
        setHygiene((row.hygieneCleanliness as VendorRatingLevel) || '');
        setNotes(row.notes || '');
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load vendor rating');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [vendor.externalId]);

  const canSaveOffline = useMemo(() => {
    if (isOnline) return false;
    return Boolean(delivery && productAccuracy && productQuality && hygiene);
  }, [isOnline, delivery, productAccuracy, productQuality, hygiene]);

  async function handleSave() {
    if (!canSaveOffline || !delivery || !productAccuracy || !productQuality || !hygiene) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.upsertVendorRating(vendor.externalId, {
        delivery,
        productAccuracy,
        productQuality,
        hygieneCleanliness: hygiene,
        notes,
        updatedBy: 'Operator',
        companyId: selectedCompanyId ?? undefined,
      });
      setDetail(updated);
      setSuccess('Vendor rating saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor rating');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={pageShellClass()}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft size={12} />
            Back to Vendor List
          </button>
          <h2 className="text-sm font-semibold text-foreground">Vendor Rating Detail</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {vendor.name} · {vendor.externalId}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall rating</p>
          <p className="text-2xl font-semibold tabular-nums font-sans">
            {formatOverallRating(detail?.overallRating)}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ 5</span>
          </p>
        </div>
      </div>

      {loading ? (
        <MillstoneLoader size="sm" layout="block" label="Loading vendor rating…" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5 text-muted-foreground">
              {isOnline ? <Cloud size={16} /> : <HardDrive size={16} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {detail?.vendorKindLabel ?? vendorKindLabel(vendor.type)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {detail?.controlNote || vendorKindHint(vendor.type)}
              </p>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2 rounded-md bg-[#5A7A2A]/10 border border-[#5A7A2A]/20 text-[#5A7A2A] text-xs">
              {success}
            </div>
          )}

          {isOnline ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-1">
                <h3 className="text-xs font-semibold text-foreground mb-2">Order accepted</h3>
                <p className="text-[11px] text-muted-foreground mb-2">System generated (from PO accept timing).</p>
                <MetricCount label="Within 4 hours" count={detail?.orderAccepted?.within4Hours ?? 0} total={detail?.orderAccepted?.total ?? 0} />
                <MetricCount label="Within 8 hours" count={detail?.orderAccepted?.within8Hours ?? 0} total={detail?.orderAccepted?.total ?? 0} />
                <MetricCount label="Beyond 9 hours" count={detail?.orderAccepted?.beyond9Hours ?? 0} total={detail?.orderAccepted?.total ?? 0} />
              </section>
              <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-1">
                <h3 className="text-xs font-semibold text-foreground mb-2">PO acceptance</h3>
                <p className="text-[11px] text-muted-foreground mb-2">
                  System generated. Quantity/price-change outcomes will populate when the cloud-vendor relationship is built.
                </p>
                <MetricCount label="Yes" count={detail?.poAcceptance?.yes ?? 0} total={detail?.poAcceptance?.total ?? 0} />
                <MetricCount label="No" count={detail?.poAcceptance?.no ?? 0} total={detail?.poAcceptance?.total ?? 0} />
                <MetricCount label="Accept with quantity change" count={detail?.poAcceptance?.acceptWithQuantityChange ?? 0} total={detail?.poAcceptance?.total ?? 0} />
                <MetricCount label="Accept with price change" count={detail?.poAcceptance?.acceptWithPriceChange ?? 0} total={detail?.poAcceptance?.total ?? 0} />
                <MetricCount label="Accept without changes" count={detail?.poAcceptance?.acceptWithoutChanges ?? 0} total={detail?.poAcceptance?.total ?? 0} />
              </section>
            </div>
          ) : (
            <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-foreground">Client input measures</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Operator-controlled ratings for offline (virtual) vendors.
                </p>
              </div>
              <LevelPicker
                label="Delivery"
                description="Target: within 2 days"
                value={delivery}
                onChange={setDelivery}
              />
              <LevelPicker
                label="Product accuracy (PO to DO to Invoice)"
                value={productAccuracy}
                onChange={setProductAccuracy}
              />
              <LevelPicker
                label="Product quality"
                value={productQuality}
                onChange={setProductQuality}
              />
              <LevelPicker
                label="Hygiene & cleanliness"
                value={hygiene}
                onChange={setHygiene}
              />
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Notes</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-border rounded-md px-3 py-2 bg-background"
                  placeholder="Optional operator notes"
                />
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] text-muted-foreground">
                  {detail?.updatedAt
                    ? `Last updated ${new Date(detail.updatedAt).toLocaleString()}${detail.updatedBy ? ` · ${detail.updatedBy}` : ''}`
                    : 'No rating saved yet.'}
                </p>
                <button
                  type="button"
                  disabled={!canSaveOffline || saving}
                  onClick={() => void handleSave()}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save rating'}
                </button>
              </div>
              {(detail?.delivery || detail?.productAccuracy) && (
                <div className="pt-2 border-t border-border text-[11px] text-muted-foreground space-y-1">
                  <p>Current: Delivery {ratingLevelLabel(detail.delivery)} · Accuracy {ratingLevelLabel(detail.productAccuracy)}</p>
                  <p>Quality {ratingLevelLabel(detail.productQuality)} · Hygiene {ratingLevelLabel(detail.hygieneCleanliness)}</p>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
