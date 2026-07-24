import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { api, type VendorRfqPortal } from '../api';
import { inputCls } from '../data/componentForm';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';

type Props = {
  token: string;
};

type LineDraft = {
  lineId: number;
  deliveryUnitText: string;
  rrp: string;
  notes: string;
};

export function VendorRfqPortalPage({ token }: Props) {
  const [portal, setPortal] = useState<VendorRfqPortal | null>(null);
  const [drafts, setDrafts] = useState<LineDraft[]>([]);
  const [submittedBy, setSubmittedBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.vendorRfqPortal(token)
      .then(data => {
        setPortal(data);
        setSubmittedBy(data.submittedBy || '');
        setDrafts(data.lines.map(line => ({
          lineId: line.id,
          deliveryUnitText: line.deliveryUnitText || '',
          rrp: line.rrp > 0 ? String(line.rrp) : '',
          notes: line.responseNotes || '',
        })));
      })
      .catch(err => {
        setPortal(null);
        setError(err instanceof Error ? err.message : 'Unable to load sample & quote request.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    if (!portal) return;
    setError(null);
    for (const draft of drafts) {
      if (!draft.deliveryUnitText.trim()) {
        const line = portal.lines.find(l => l.id === draft.lineId);
        setError(`Delivery unit is required for ${line?.componentName ?? 'each line'}.`);
        return;
      }
      const rrp = parseFloat(draft.rrp);
      if (!Number.isFinite(rrp) || rrp < 0) {
        const line = portal.lines.find(l => l.id === draft.lineId);
        setError(`Enter a valid price for ${line?.componentName ?? 'each line'}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await api.submitVendorRfq(token, {
        submittedBy: submittedBy.trim() || undefined,
        responses: drafts.map(d => ({
          lineId: d.lineId,
          deliveryUnitText: d.deliveryUnitText.trim(),
          rrp: parseFloat(d.rrp),
          notes: d.notes.trim() || undefined,
        })),
      });
      setPortal(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quote.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <MillstoneLoader layout="screen" size="lg" label="Loading sample & quote request…" />;
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3EE] px-4">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{error ?? 'This sample & quote link is invalid.'}</p>
        </div>
      </div>
    );
  }

  const readOnly = !portal.canSubmit;

  return (
    <div className="min-h-screen bg-[#F7F3EE]">
      <header className="border-b border-border bg-[#2A2118] text-white px-4 py-4">
        <div className="w-full max-w-none mx-auto">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">pasar.ai · Bisync.cloud</p>
          <h1 className="text-lg font-semibold mt-1">Sample & Quote</h1>
          <p className="text-sm text-white/80 mt-0.5">{portal.rfqNumber}</p>
        </div>
      </header>

      <main className="w-full max-w-none mx-auto px-4 py-6 space-y-5">
        {error ? (
          <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2 bg-destructive/5">
            {error}
          </p>
        ) : null}

        {saved || readOnly ? (
          <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-2 text-sm text-[#5A7A2A] flex items-center gap-2">
            <Check size={14} />
            Quote {readOnly && !saved ? 'already submitted' : 'saved'}. Thank you.
          </div>
        ) : null}

        {portal.company ? (
          <section className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">From</p>
            <p className="text-sm font-semibold text-foreground">{portal.company.name}</p>
            {portal.company.brn ? <p className="text-xs text-muted-foreground">BRN: {portal.company.brn}</p> : null}
            {[portal.company.addressLine1, portal.company.addressLine2]
              .filter(Boolean)
              .map(line => <p key={line} className="text-xs text-muted-foreground">{line}</p>)}
            <p className="text-xs text-muted-foreground">
              {[portal.company.postcode, portal.company.city, portal.company.stateProvince].filter(Boolean).join(' ')}
            </p>
            {[portal.company.phone, portal.company.email].filter(Boolean).map(line => (
              <p key={line} className="text-xs text-muted-foreground">{line}</p>
            ))}
          </section>
        ) : null}

        {portal.locations.length > 0 ? (
          <section className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivery location(s)</p>
            {portal.locations.map(loc => (
              <div key={loc.externalId} className="text-xs text-foreground">
                <p className="font-semibold">{loc.name}</p>
                {[loc.addressLine1, loc.addressLine2].filter(Boolean).map(line => <p key={line}>{line}</p>)}
                <p>{[loc.postcode, loc.city, loc.stateProvince].filter(Boolean).join(' ')}</p>
              </div>
            ))}
          </section>
        ) : null}

        {portal.notes ? (
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{portal.notes}</p>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Quote lines</h2>
          {portal.lines.map(line => {
            const draft = drafts.find(d => d.lineId === line.id);
            if (!draft) return null;
            return (
              <div key={line.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{line.componentName}</p>
                  {line.kind === 'other' ? (
                    <p className="text-xs text-muted-foreground">Other component</p>
                  ) : null}
                  {line.specification ? (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{line.specification}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Delivery unit *
                    </label>
                    <input
                      className={inputCls}
                      placeholder="e.g. 1box/24tin/200gr"
                      disabled={readOnly || saving}
                      value={draft.deliveryUnitText}
                      onChange={e => setDrafts(prev => prev.map(row => (
                        row.lineId === line.id ? { ...row, deliveryUnitText: e.target.value } : row
                      )))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Price *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={inputCls}
                      disabled={readOnly || saving}
                      value={draft.rrp}
                      onChange={e => setDrafts(prev => prev.map(row => (
                        row.lineId === line.id ? { ...row, rrp: e.target.value } : row
                      )))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Notes
                  </label>
                  <input
                    className={inputCls}
                    disabled={readOnly || saving}
                    value={draft.notes}
                    onChange={e => setDrafts(prev => prev.map(row => (
                      row.lineId === line.id ? { ...row, notes: e.target.value } : row
                    )))}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {!readOnly ? (
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Submitted by
              </label>
              <input
                className={inputCls}
                value={submittedBy}
                disabled={saving}
                placeholder="Your name"
                onChange={e => setSubmittedBy(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold bg-[#F37021] text-white disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save quote'}
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
