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
  isAwaitingSubscription,
} from './pages/CompanyOnboardingPage';
import { SubscriptionPlaceholderPage } from './pages/SubscriptionPlaceholderPage';
import { parseVendorOrderToken } from './data/vendorOrderShare';
import { parseVendorRfqToken } from './data/vendorRfqShare';
import { parseSampleRequestToken } from './data/requestForSample';
import { matchDevConsolePath } from './config/devConsole';
import { REQUIRE_PLATFORM_LOGIN } from './config/platformAuth';
import { useState } from 'react';

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
  const [onboardingTick, setOnboardingTick] = useState(0);

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

  if (isAuthenticated && currentUser && currentUser.companyId == null) {
    return (
      <CompanyOnboardingPage
        onCompleted={() => setOnboardingTick(v => v + 1)}
      />
    );
  }

  if (isAuthenticated && currentUser?.companyId != null && isAwaitingSubscription()) {
    return (
      <SubscriptionPlaceholderPage
        onContinue={() => setOnboardingTick(v => v + 1)}
      />
    );
  }

  // onboardingTick forces re-render after localStorage flag changes
  void onboardingTick;
  return <App />;
}
