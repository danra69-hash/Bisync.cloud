import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, HardDrive, X } from 'lucide-react';
import {
  api,
  type Vendor,
  type VendorRatingDetail,
  type VendorRatingLevel,
  type VendorRatingScoreBucket,
} from '../../api';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';
import {
  formatOverallRating,
  moodFromAverage,
  ratingLevelLabel,
  vendorKindHint,
  vendorKindLabel,
  VENDOR_RATING_LEVELS,
  type RatingMood,
} from '../../data/vendorRating';

type Props = {
  vendor: Vendor;
  selectedCompanyId: number | null;
  onClose: () => void;
};

function MoodFace({ mood, label }: { mood: RatingMood; label?: string }) {
  const color =
    mood === 'green' ? 'text-[#5A7A2A]'
      : mood === 'yellow' ? 'text-amber-600'
        : mood === 'red' ? 'text-destructive'
          : 'text-muted-foreground';
  const face = mood === 'green' ? '☺' : mood === 'yellow' ? '😐' : mood === 'red' ? '☹' : '—';
  return (
    <span className={`inline-flex items-center gap-1.5 ${color}`} title={label ?? mood}>
      <span className="text-lg leading-none" aria-hidden>{face}</span>
      {label ? <span className="text-[11px] font-medium">{label}</span> : null}
    </span>
  );
}

function ScoreRow({
  label,
  bucket,
}: {
  label: string;
  bucket: VendorRatingScoreBucket | undefined;
}) {
  const count = bucket?.count ?? 0;
  const score = bucket?.scorePercent ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-foreground">{label}</span>
      <span className="text-xs font-sans tabular-nums text-muted-foreground">
        {count} <span className="text-[10px]">→ {score}%</span>
      </span>
    </div>
  );
}

function LevelPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: VendorRatingLevel | '';
  onChange: (next: VendorRatingLevel) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {description ? <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {VENDOR_RATING_LEVELS.map(level => {
          const active = value === level.id;
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => onChange(level.id)}
              className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {level.label} ({level.score}%)
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VendorRatingDetailPage({ vendor, selectedCompanyId, onClose }: Props) {
  const [detail, setDetail] = useState<VendorRatingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<VendorRatingLevel | ''>('');
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
        const d = (row.delivery === 'unsatisfied' ? 'poor' : row.delivery) as VendorRatingLevel | null;
        setDelivery(d || '');
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSaveOffline = useMemo(() => !isOnline && Boolean(delivery), [isOnline, delivery]);

  async function handleSave() {
    if (!canSaveOffline || !delivery) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.upsertVendorRating(vendor.externalId, {
        delivery,
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

  const orderMood = (detail?.orderAcceptance?.mood as RatingMood | undefined)
    ?? moodFromAverage(detail?.orderAcceptance?.averagePercent);
  const overallMood = (detail?.overallMood as RatingMood | undefined)
    ?? moodFromAverage(detail?.overallRating);

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div
        className={`${MODAL_SHELL_CLS} w-[min(720px,94vw)] max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-rating-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">Vendor Rating</p>
            <h2 id="vendor-rating-title" className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {vendor.name}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {vendor.externalId} · {detail?.vendorKindLabel ?? vendorKindLabel(vendor.type)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</p>
              <div className="flex items-center gap-2 justify-end">
                <MoodFace mood={overallMood} />
                <span className="text-lg font-semibold tabular-nums font-sans">
                  {formatOverallRating(detail?.overallRating)}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted" aria-label="Close">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/10 px-3 py-2.5 flex items-start gap-2">
            <span className="mt-0.5 text-muted-foreground">
              {isOnline ? <Cloud size={14} /> : <HardDrive size={14} />}
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {detail?.controlNote || vendorKindHint(vendor.type)}
            </p>
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

          {loading && !detail ? (
            <MillstoneLoader size="sm" layout="block" label="Loading vendor rating…" />
          ) : (
            <>
              {isOnline && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <section className="rounded-lg border border-border px-3 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xs font-semibold">Order acceptance</h3>
                      <MoodFace
                        mood={orderMood}
                        label={detail?.orderAcceptance?.averagePercent != null
                          ? `${detail.orderAcceptance.averagePercent.toFixed(0)}% avg`
                          : undefined}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1">
                      No. of orders: {detail?.orderAcceptance?.orderCount ?? 0}
                    </p>
                    <ScoreRow label="Accepted within 4 hours" bucket={detail?.orderAcceptance?.within4Hours} />
                    <ScoreRow label="Accepted within 8 hours" bucket={detail?.orderAcceptance?.within8Hours} />
                    <ScoreRow label="Accepted beyond 9 hours" bucket={detail?.orderAcceptance?.beyond9Hours} />
                  </section>

                  <section className="rounded-lg border border-border px-3 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xs font-semibold">PO acceptance</h3>
                      <span className="text-xs font-sans tabular-nums text-muted-foreground">
                        {detail?.poAcceptance?.averagePercent != null
                          ? `${detail.poAcceptance.averagePercent.toFixed(0)}% avg`
                          : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Received orders: {detail?.poAcceptance?.orderCount ?? 0}
                    </p>
                    <ScoreRow label="Without changes" bucket={detail?.poAcceptance?.withoutChanges} />
                    <ScoreRow label="Qty or price change" bucket={detail?.poAcceptance?.withQuantityOrPriceChange} />
                    <ScoreRow label="Qty = 0 (out of stock)" bucket={detail?.poAcceptance?.quantityZeroOutOfStock} />
                  </section>

                  <section className="rounded-lg border border-border px-3 py-3 space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xs font-semibold">Product accuracy</h3>
                      <span className="text-xs font-sans tabular-nums text-muted-foreground">
                        {detail?.productAccuracy?.averagePercent != null
                          ? `${detail.productAccuracy.averagePercent.toFixed(0)}% avg`
                          : '—'}
                      </span>
                    </div>
                    <ScoreRow label="Received without changes" bucket={detail?.productAccuracy?.withoutChanges} />
                    <ScoreRow label="Changed lines ≤ 30%" bucket={detail?.productAccuracy?.changedLinesUnder30Pct} />
                    <ScoreRow label="Changed lines &gt; 30%" bucket={detail?.productAccuracy?.changedLinesOver30Pct} />
                  </section>
                </div>
              )}

              {!isOnline && (
                <section className="rounded-lg border border-border px-3 py-3 space-y-4">
                  <LevelPicker
                    label="Delivery"
                    description="Offline / virtual vendor — operator controlled"
                    value={delivery}
                    onChange={setDelivery}
                  />
                  <div>
                    <p className="text-xs font-semibold mb-1">Notes</p>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs border border-border rounded-md px-3 py-2 bg-background"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!canSaveOffline || saving}
                      onClick={() => void handleSave()}
                      className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save delivery rating'}
                    </button>
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <section className="rounded-lg border border-border px-3 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-xs font-semibold">Product quality</h3>
                    <span className="text-xs font-sans tabular-nums text-muted-foreground">
                      {detail?.productQuality?.averagePercent != null
                        ? `${detail.productQuality.averagePercent.toFixed(0)}%`
                        : '—'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">From receive / consolidate ({detail?.productQuality?.responseCount ?? 0})</p>
                  <p className="text-[11px] text-muted-foreground">
                    Satisfied {detail?.productQuality?.satisfied ?? 0} · Acceptable {detail?.productQuality?.acceptable ?? 0} · Poor {detail?.productQuality?.poor ?? 0}
                  </p>
                </section>
                <section className="rounded-lg border border-border px-3 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-xs font-semibold">Hygiene &amp; cleanliness</h3>
                    <span className="text-xs font-sans tabular-nums text-muted-foreground">
                      {detail?.hygieneCleanliness?.averagePercent != null
                        ? `${detail.hygieneCleanliness.averagePercent.toFixed(0)}%`
                        : '—'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">From receive / consolidate ({detail?.hygieneCleanliness?.responseCount ?? 0})</p>
                  <p className="text-[11px] text-muted-foreground">
                    Satisfied {detail?.hygieneCleanliness?.satisfied ?? 0} · Acceptable {detail?.hygieneCleanliness?.acceptable ?? 0} · Poor {detail?.hygieneCleanliness?.poor ?? 0}
                  </p>
                </section>
              </div>

              <section className="rounded-lg border border-border px-3 py-3">
                <h3 className="text-xs font-semibold mb-1">Product temperature check (optional)</h3>
                <p className="text-[11px] text-muted-foreground mb-2">Recorded on receive / consolidate for selected PO products.</p>
                {(detail?.temperatureReadings?.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">No temperature readings yet.</p>
                ) : (
                  <ul className="space-y-1 max-h-36 overflow-y-auto">
                    {detail!.temperatureReadings!.map((row, i) => (
                      <li key={`${row.poNumber}-${row.vendorProductId}-${i}`} className="text-xs flex justify-between gap-2 border-b border-border/40 last:border-0 py-1">
                        <span className="min-w-0 truncate">
                          {row.productName}
                          <span className="text-muted-foreground"> · {row.poNumber}</span>
                        </span>
                        <span className="font-sans tabular-nums shrink-0">{row.temperature}°C</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {!isOnline && detail?.delivery && (
                <p className="text-[11px] text-muted-foreground">
                  Delivery: {ratingLevelLabel(detail.delivery)}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
