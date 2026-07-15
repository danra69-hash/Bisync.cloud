import { useState } from 'react';
import App from './App';
import { useCurrentUser } from './hooks/useCurrentUser';
import { LandingPage } from './pages/LandingPage';
import { VendorOrderPortalPage } from './pages/VendorOrderPortalPage';
import { VendorRfqPortalPage } from './pages/VendorRfqPortalPage';
import { SampleRequestPortalPage } from './pages/SampleRequestPortalPage';
import { SalesOrderPortalPage } from './pages/SalesOrderPortalPage';
import { DevConsolePage } from './pages/DevConsolePage';
import { ActivateAccountPage, parseActivationToken } from './pages/ActivateAccountPage';
import { CompanyOnboardingPage } from './pages/CompanyOnboardingPage';
import { LocationOnboardingPage } from './pages/LocationOnboardingPage';
import { SubscriptionPlaceholderPage } from './pages/SubscriptionPlaceholderPage';
import {
  clearAwaitingLocation,
  clearAwaitingPayment,
  isAwaitingLocation,
  isAwaitingPayment,
} from './data/onboardingFlags';
import { parseVendorOrderShareTarget } from './data/vendorOrderShare';
import { parseVendorRfqToken } from './data/vendorRfqShare';
import { parseSampleRequestToken } from './data/requestForSample';
import { parseSalesOrderShareTarget } from './data/salesOrderShare';
import { matchDevConsolePath } from './config/devConsole';
import { REQUIRE_PLATFORM_LOGIN } from './config/platformAuth';
import { MillstoneLoader } from './components/shared/MillstoneLoader';

export function AppRoot() {
  const vendorShare = parseVendorOrderShareTarget(window.location.pathname);
  const rfqToken = parseVendorRfqToken(window.location.pathname);
  const sampleRequestToken = parseSampleRequestToken(window.location.pathname);
  const activationToken = parseActivationToken(window.location.pathname);
  const salesOrderShare = parseSalesOrderShareTarget(window.location.pathname);
  const isDevConsole = matchDevConsolePath(window.location.pathname);
  const { isAuthenticated, loading, currentUser } = useCurrentUser();
  /** Explicit steps so next gate opens even if user sync races. */
  const [forceLocation, setForceLocation] = useState(false);
  const [forcePayment, setForcePayment] = useState(false);

  if (vendorShare) {
    return <VendorOrderPortalPage token={vendorShare.token} pdfOnly={vendorShare.pdfOnly} />;
  }
  if (rfqToken) {
    return <VendorRfqPortalPage token={rfqToken} />;
  }
  if (sampleRequestToken) {
    return <SampleRequestPortalPage token={sampleRequestToken} />;
  }
  if (activationToken) {
    return <ActivateAccountPage token={activationToken} />;
  }
  if (salesOrderShare) {
    return <SalesOrderPortalPage token={salesOrderShare.token} pdfOnly={salesOrderShare.pdfOnly} />;
  }
  if (isDevConsole) {
    return <DevConsolePage />;
  }
  if (loading) {
    return <MillstoneLoader layout="screen" size="lg" label="Loading Bisync.cloud…" />;
  }
  if (REQUIRE_PLATFORM_LOGIN && !isAuthenticated) {
    return <LandingPage />;
  }

  // Ghost Support sessions skip customer onboarding gates.
  const isGhostSupport = (() => {
    try {
      return Boolean(sessionStorage.getItem('bisync.ghostSupportSession'));
    } catch {
      return false;
    }
  })();

  // Self-serve gates: company (min 1) → location (min 1) → payment stub → app
  if (!isGhostSupport && isAuthenticated && currentUser && currentUser.companyId == null) {
    return (
      <CompanyOnboardingPage
        onCompleted={() => setForceLocation(true)}
      />
    );
  }

  const hasCompany = currentUser?.companyId != null;
  const hasLocation = (currentUser?.locationIds?.length ?? 0) > 0;
  // Only gate onboarding funnel users — not every account with empty locationIds.
  const needsLocation =
    hasCompany
    && (forceLocation
      || isAwaitingLocation()
      || (!hasLocation && isAwaitingPayment()));

  if (!isGhostSupport && isAuthenticated && needsLocation) {
    return (
      <LocationOnboardingPage
        onCompleted={() => {
          clearAwaitingLocation();
          setForceLocation(false);
          setForcePayment(true);
        }}
      />
    );
  }

  const needsPayment =
    hasCompany
    && hasLocation
    && (forcePayment || isAwaitingPayment());

  if (!isGhostSupport && isAuthenticated && needsPayment) {
    return (
      <SubscriptionPlaceholderPage
        onContinue={() => {
          clearAwaitingPayment();
          setForcePayment(false);
        }}
      />
    );
  }

  return <App />;
}
