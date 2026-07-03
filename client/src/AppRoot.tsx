import App from './App';
import { useCurrentUser } from './hooks/useCurrentUser';
import { LandingPage } from './pages/LandingPage';
import { VendorOrderPortalPage } from './pages/VendorOrderPortalPage';
import { parseVendorOrderToken } from './data/vendorOrderShare';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-herme-cream">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-herme-muted border-t-herme" />
        <p className="mt-4 text-sm font-medium text-herme-ink/60">Loading Bisync.cloud…</p>
      </div>
    </div>
  );
}

export function AppRoot() {
  const vendorToken = parseVendorOrderToken(window.location.pathname);
  const { isAuthenticated, loading } = useCurrentUser();

  if (vendorToken) return <VendorOrderPortalPage token={vendorToken} />;
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <LandingPage />;
  return <App />;
}
