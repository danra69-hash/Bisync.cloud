import { useState } from 'react';
import App from './App';
import { useCurrentUser } from './hooks/useCurrentUser';
import { LandingPage } from './pages/LandingPage';
import { VendorOrderPortalPage } from './pages/VendorOrderPortalPage';
import { VendorRfqPortalPage } from './pages/VendorRfqPortalPage';
import { SampleRequestPortalPage } from './pages/SampleRequestPortalPage';
import { DevConsolePage } from './pages/DevConsolePage';
import { ActivateAccountPage, parseActivationToken } from './pages/ActivateAccountPage';
import {
  CompanyOnboardingPage,
  clearAwaitingSubscription,
  isAwaitingSubscription,
} from './pages/CompanyOnboardingPage';
import { SubscriptionPlaceholderPage } from './pages/SubscriptionPlaceholderPage';
import { parseVendorOrderToken } from './data/vendorOrderShare';
import { parseVendorRfqToken } from './data/vendorRfqShare';
import { parseSampleRequestToken } from './data/requestForSample';
import { matchDevConsolePath } from './config/devConsole';
import { REQUIRE_PLATFORM_LOGIN } from './config/platformAuth';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-herme-cream">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-herme-muted border-t-herme" />
        <p className="mt-4 text-sm font-medium text-herme-ink/60">Loading Bisync.cloud...</p>
      </div>
    </div>
  );
}

export function AppRoot() {
  const vendorToken = parseVendorOrderToken(window.location.pathname);
  const rfqToken = parseVendorRfqToken(window.location.pathname);
  const sampleRequestToken = parseSampleRequestToken(window.location.pathname);
  const activationToken = parseActivationToken(window.location.pathname);
  const isDevConsole = matchDevConsolePath(window.location.pathname);
  const { isAuthenticated, loading, currentUser } = useCurrentUser();
  /** Explicit step so subscription opens even if companyId sync races. */
  const [forceSubscription, setForceSubscription] = useState(false);

  if (vendorToken) {
    return <VendorOrderPortalPage token={vendorToken} />;
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
  if (isDevConsole) {
    return <DevConsolePage />;
  }
  if (loading) {
    return <LoadingScreen />;
  }
  if (REQUIRE_PLATFORM_LOGIN && !isAuthenticated) {
    return <LandingPage />;
  }

  const showSubscription =
    isAuthenticated
    && (forceSubscription || (currentUser?.companyId != null && isAwaitingSubscription()));

  if (showSubscription) {
    return (
      <SubscriptionPlaceholderPage
        onContinue={() => {
          clearAwaitingSubscription();
          setForceSubscription(false);
        }}
      />
    );
  }

  if (isAuthenticated && currentUser && currentUser.companyId == null) {
    return (
      <CompanyOnboardingPage
        onCompleted={() => setForceSubscription(true)}
      />
    );
  }

  return <App />;
}
