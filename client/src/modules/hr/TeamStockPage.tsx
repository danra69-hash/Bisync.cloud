import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Boxes,
  Trash2,
} from 'lucide-react';
import { api, type TransferEntry, type WastageEntry } from '../../api';
import { TeamRmsOrderPage } from './TeamRmsOrderPage';

export type RmsStockView = 'menu' | 'transfer' | 'wastage' | 'inventory';

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') || s.includes('approval')) return 'is-warn';
  if (s.includes('receiv') || s.includes('partial')) return 'is-info';
  if (s.includes('reconcil') || s.includes('consolidat') || s.includes('closed')) return 'is-ok';
  return '';
}

function BackStock({ onBack }: { onBack: () => void }) {
  return (
    <div className="team-panel-head">
      <button type="button" className="team-back-btn" onClick={onBack} aria-label="Back">
        ← Stock
      </button>
    </div>
  );
}

export function TeamStockPage() {
  const [stockView, setStockView] = useState<RmsStockView>('menu');
  const [wastage, setWastage] = useState<WastageEntry[]>([]);
  const [transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [rmLoading, setRmLoading] = useState(false);
  const [rmError, setRmError] = useState<string | null>(null);

  useEffect(() => {
    const needWastage = stockView === 'wastage';
    const needTransfers = stockView === 'transfer';
    if (!needWastage && !needTransfers) return;

    let cancelled = false;
    setRmLoading(true);
    setRmError(null);

    void (async () => {
      try {
        if (needWastage) {
          const list = await api.wastageEntries(undefined, []);
          if (!cancelled) setWastage(Array.isArray(list) ? list : []);
        } else if (needTransfers) {
          const list = await api.transfers(undefined, []);
          if (!cancelled) setTransfers(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (!cancelled) {
          setRmError(err instanceof Error ? err.message : 'Unable to load data.');
          setWastage([]);
          setTransfers([]);
        }
      } finally {
        if (!cancelled) setRmLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stockView]);

  if (stockView === 'wastage') {
    return (
      <section className="team-card">
        <BackStock onBack={() => setStockView('menu')} />
        <h3 style={{ margin: '0 0 8px' }}>Stock · Wastage</h3>
        {rmLoading ? <p className="team-muted">Loading…</p> : null}
        {rmError ? <p className="team-inline-error">{rmError}</p> : null}
        {!rmLoading && !rmError && wastage.length === 0 ? (
          <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>No wastage entries.</p>
        ) : null}
        <ul className="team-rm-list">
          {wastage.slice(0, 40).map(entry => (
            <li key={entry.id} className="team-rm-list-item">
              <div>
                <strong>{entry.itemName || entry.reason || `Wastage #${entry.id}`}</strong>
                <span className="team-muted">{entry.wastedDate || entry.createdAt || '—'}</span>
              </div>
              <span className="team-rm-status">
                {entry.quantity} {entry.uom}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (stockView === 'transfer') {
    return (
      <section className="team-card">
        <BackStock onBack={() => setStockView('menu')} />
        <h3 style={{ margin: '0 0 8px' }}>Stock · Transfer</h3>
        {rmLoading ? <p className="team-muted">Loading…</p> : null}
        {rmError ? <p className="team-inline-error">{rmError}</p> : null}
        {!rmLoading && !rmError && transfers.length === 0 ? (
          <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>No transfers.</p>
        ) : null}
        <ul className="team-rm-list">
          {transfers.slice(0, 40).map(entry => (
            <li key={entry.id} className="team-rm-list-item">
              <div>
                <strong>{entry.itemName || `TR-${entry.id}`}</strong>
                <span className="team-muted">
                  {(entry.fromLocationExternalId || 'From')}
                  {' → '}
                  {(entry.toLocationExternalId || 'To')}
                </span>
              </div>
              <span className={`team-rm-status ${statusTone(entry.status || '')}`}>
                {entry.status || '—'} · {entry.quantity} {entry.uom}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (stockView === 'inventory') {
    return (
      <section className="team-card">
        <BackStock onBack={() => setStockView('menu')} />
        <h3 style={{ margin: '0 0 8px' }}>Stock · Inventory</h3>
        <p className="team-muted" style={{ margin: 0 }}>
          Open Inventory counts from Revenue Management on desktop for full post and confirmation.
          Team inventory shortcuts will expand here as mobile count flows are enabled.
        </p>
      </section>
    );
  }

  return (
    <section className="team-card team-landing-box">
      <header className="team-landing-box-head">
        <h3>Stock</h3>
      </header>
      <div className="team-landing-tiles team-landing-tiles-stack">
        <button type="button" onClick={() => setStockView('transfer')}>
          <ArrowLeftRight size={15} />
          Transfer
        </button>
        <button type="button" onClick={() => setStockView('wastage')}>
          <Trash2 size={15} />
          Wastage
        </button>
        <button type="button" onClick={() => setStockView('inventory')}>
          <Boxes size={15} />
          Inventory
        </button>
      </div>
    </section>
  );
}

export function TeamOrderPage({ employeeName }: { employeeName: string }) {
  return <TeamRmsOrderPage employeeName={employeeName} />;
}
