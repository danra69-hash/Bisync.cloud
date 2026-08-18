import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api, setApiTenantCompanyId } from '../api';
import {
  isDocumentFullscreen,
  isStandaloneDisplay,
  setPosViewportLock,
  subscribeFullscreenChange,
  wantsPosFullscreen,
} from '../data/posKiosk';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';
import { PosEmbedErrorBoundary } from '../components/shared/PosEmbedErrorBoundary';
import {
  loadStationActivation,
  readActivationSync,
  type StationActivation,
} from '../bisync-pos/core/station/stationActivation';
import { joinStationLan } from '../bisync-pos/core/lan/stationLanBus';
import { startPosSyncWorker } from '../bisync-pos/core/offline/posSyncWorker';
import { StationActivationPage } from '../bisync-pos/features/station/StationActivationPage';
import './PosAppPage.css';

const BisyncPosEmbed = lazy(() =>
  import('../bisync-pos/embed').then(m => ({ default: m.BisyncPosEmbed })),
);

export type PosStandaloneEntry = 'pos' | 'kds' | 'bds' | 'cds'

const ENTRY_PATH: Record<PosStandaloneEntry, string> = {
  pos: '/order/floor',
  kds: '/boh/kds',
  bds: '/boh/bds',
  cds: '/boh/cds',
}

const ENTRY_LABEL: Record<PosStandaloneEntry, string> = {
  pos: 'POS',
  kds: 'KDS',
  bds: 'BDS',
  cds: 'CDS',
}

/** Deep-link query: /POS?c=12&l=location-external-id */
function readQueryBootstrap(): { companyId: number | null; locationId: string } {
  try {
    const params = new URLSearchParams(window.location.search);
    const cRaw = params.get('c') || params.get('companyId') || params.get('company');
    const lRaw = params.get('l') || params.get('locationId') || params.get('location');
    const companyId = cRaw ? Number(cRaw) : null;
    return {
      companyId: Number.isFinite(companyId) && (companyId as number) > 0 ? companyId : null,
      locationId: (lRaw ?? '').trim(),
    };
  } catch {
    return { companyId: null, locationId: '' };
  }
}

type PosAppPageProps = {
  /** Which standalone screen to open (/POS, /KDS, /BDS, /CDS). */
  entry?: PosStandaloneEntry
}

/** Standalone POS shell — activates once, then runs offline from device store. */
export function PosAppPage({ entry = 'pos' }: PosAppPageProps) {
  const query = useMemo(() => readQueryBootstrap(), []);
  const [activation, setActivation] = useState<StationActivation | null>(() => readActivationSync());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [kioskActive, setKioskActive] = useState(
    () => wantsPosFullscreen() || isStandaloneDisplay() || isDocumentFullscreen(),
  );
  const entryLabel = ENTRY_LABEL[entry];
  const initialEntry = ENTRY_PATH[entry];

  useEffect(() => {
    setPosViewportLock(true);
    const sync = () => {
      setKioskActive(
        isDocumentFullscreen() || isStandaloneDisplay() || wantsPosFullscreen(),
      );
    };
    sync();
    const unsub = subscribeFullscreenChange(sync);
    return () => {
      unsub();
      setPosViewportLock(false);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadStationActivation();
      if (cancelled) return;
      if (stored) {
        setActivation(stored);
        setApiTenantCompanyId(stored.companyId);
        joinStationLan(stored.lanRoomId);
        startPosSyncWorker();
      }
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onActivated = useCallback((next: StationActivation) => {
    setActivation(next);
    setApiTenantCompanyId(next.companyId);
    joinStationLan(next.lanRoomId);
    startPosSyncWorker();
  }, []);

  if (bootstrapping) {
    return <MillstoneLoader layout="screen" size="lg" label={`Starting ${entryLabel}…`} />;
  }

  if (!activation) {
    return (
      <StationActivationPage
        onActivated={onActivated}
        preferredCompanyId={query.companyId}
        preferredLocationId={query.locationId}
      />
    );
  }

  return (
    <ActivatedPosShell
      activation={activation}
      entryLabel={entryLabel}
      initialEntry={initialEntry}
      kioskActive={kioskActive}
    />
  );
}

function ActivatedPosShell({
  activation,
  entryLabel,
  initialEntry,
  kioskActive,
}: {
  activation: StationActivation;
  entryLabel: string;
  initialEntry: string;
  kioskActive: boolean;
}) {
  const companyId = activation.companyId;
  const [locationId, setLocationId] = useState(activation.locationExternalId);
  const [locationOptions, setLocationOptions] = useState<
    Array<{
      externalId: string;
      name: string;
      physicalSiteKey?: string;
      conceptLabel?: string;
      conceptSortOrder?: number;
    }>
  >([
    {
      externalId: activation.locationExternalId,
      name: activation.locationName,
    },
  ]);

  useEffect(() => {
    let cancelled = false;
    void api.locationsConfig({ includeInactive: false })
      .then(rows => {
        if (cancelled) return;
        const companyLocs = rows.filter(
          l => l.companyId === companyId && l.active !== false,
        );
        const self = companyLocs.find(l => l.externalId === activation.locationExternalId);
        const siteKey = (self?.physicalSiteKey || '').trim();
        const siblings = (
          siteKey
            ? companyLocs.filter(l => (l.physicalSiteKey || '').trim() === siteKey)
            : self
              ? [self]
              : companyLocs.filter(l => l.externalId === activation.locationExternalId)
        ).sort(
          (a, b) =>
            (a.conceptSortOrder ?? 0) - (b.conceptSortOrder ?? 0)
            || a.name.localeCompare(b.name),
        );
        setLocationOptions(
          siblings.map(l => ({
            externalId: l.externalId,
            name: l.name,
            physicalSiteKey: l.physicalSiteKey || undefined,
            conceptLabel: (l.conceptLabel || '').trim() || l.name,
            conceptSortOrder: l.conceptSortOrder ?? 0,
          })),
        );
      })
      .catch(() => {
        /* keep activation single-location fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, activation.locationExternalId]);

  const hideOrgChrome = kioskActive && (isDocumentFullscreen() || isStandaloneDisplay());

  return (
    <div
      className={[
        'pos-standalone',
        kioskActive ? 'pos-standalone--kiosk' : '',
        hideOrgChrome ? 'pos-standalone--immersive' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="pos-standalone-frame">
        <PosEmbedErrorBoundary title={`${entryLabel} crashed`}>
          <Suspense
            fallback={
              <div className="pos-standalone-loading">
                <MillstoneLoader label="Loading Bisync POS…" />
              </div>
            }
          >
            <BisyncPosEmbed
              companyId={companyId}
              locationId={locationId}
              locations={locationOptions}
              onLocationChange={setLocationId}
              initialEntry={initialEntry}
              offlineFirst
            />
          </Suspense>
        </PosEmbedErrorBoundary>
      </div>
    </div>
  );
}

/** Standalone Kitchen Display at /KDS. */
export function KdsAppPage() {
  return <PosAppPage entry="kds" />;
}

/** Standalone Bar Display at /BDS. */
export function BdsAppPage() {
  return <PosAppPage entry="bds" />;
}

/** Standalone Customer Display at /CDS. */
export function CdsAppPage() {
  return <PosAppPage entry="cds" />;
}
