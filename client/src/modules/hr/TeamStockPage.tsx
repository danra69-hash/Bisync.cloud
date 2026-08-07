import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Boxes,
  Trash2,
} from 'lucide-react';
import { api, setApiTenantCompanyId } from '../../api';
import { InventoryPage } from '../../components/revenue/InventoryPage';
import { TransferPage } from '../../components/revenue/TransferPage';
import { WastagePage } from '../../components/revenue/WastagePage';
import { TeamRmsOrderPage } from './TeamRmsOrderPage';

export type RmsStockView = 'menu' | 'transfer' | 'wastage' | 'inventory';

function BackStock({ onBack }: { onBack: () => void }) {
  return (
    <div className="team-panel-head">
      <button type="button" className="team-back-btn" onClick={onBack} aria-label="Back">
        ← Stock
      </button>
    </div>
  );
}

type Props = {
  employeeName: string;
};

/**
 * Team Stock shortcuts open the same RMS Transfer / Wastage / Inventory pages
 * used on desktop, scoped to the Team company/locations and employee actor name.
 */
export function TeamStockPage({ employeeName }: Props) {
  const [stockView, setStockView] = useState<RmsStockView>('menu');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOrgLoading(true);
    setOrgError(null);
    void (async () => {
      try {
        const [cos, locs] = await Promise.all([api.companies(), api.locations()]);
        if (cancelled) return;
        const companies = Array.isArray(cos) ? cos : [];
        const locations = Array.isArray(locs) ? locs : [];
        const stored = Number(localStorage.getItem('bisync.selectedCompanyId') || 0);
        const pick = companies.find(c => c.id === stored) ?? companies[0] ?? null;
        if (pick) {
          setCompanyId(pick.id);
          setApiTenantCompanyId(pick.id);
          const locForCo = locations.filter(l => l.companyId == null || l.companyId === pick.id);
          setLocationIds(locForCo.map(l => l.externalId).filter(Boolean));
        } else {
          setCompanyId(null);
          setLocationIds([]);
        }
      } catch (err) {
        if (!cancelled) {
          setOrgError(err instanceof Error ? err.message : 'Unable to load company context.');
          setCompanyId(null);
          setLocationIds([]);
        }
      } finally {
        if (!cancelled) setOrgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (stockView === 'transfer' || stockView === 'wastage' || stockView === 'inventory') {
    const teamActor = employeeName.trim() || undefined;
    return (
      <section className="team-card team-stock-rms">
        <BackStock onBack={() => setStockView('menu')} />
        {orgLoading ? <p className="team-muted">Loading…</p> : null}
        {orgError ? <p className="team-inline-error">{orgError}</p> : null}
        {!orgLoading && !orgError && !companyId ? (
          <p className="team-muted">No company is available for stock actions.</p>
        ) : null}
        {!orgLoading && !orgError && companyId ? (
          <div className="team-stock-rms-body">
            {stockView === 'transfer' ? (
              <TransferPage
                selectedCompanyId={companyId}
                selectedLocationIds={locationIds}
                teamActorName={teamActor}
                embedded
              />
            ) : null}
            {stockView === 'wastage' ? (
              <WastagePage
                selectedCompanyId={companyId}
                selectedLocationIds={locationIds}
                embedded
              />
            ) : null}
            {stockView === 'inventory' ? (
              <InventoryPage
                selectedCompanyId={companyId}
                selectedLocationIds={locationIds}
                teamActorName={teamActor}
                embedded
              />
            ) : null}
          </div>
        ) : null}
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
