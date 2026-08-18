import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  dismissDesktopVersion,
  fetchDesktopLauncherVersion,
  isDesktopAppSession,
  setInstalledDesktopVersion,
  shouldOfferDesktopUpdate,
  syncDesktopLauncherFromUrl,
  type DesktopLauncherVersionInfo,
} from '../../data/desktopLauncher';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { useCurrentUser } from '../../hooks/useCurrentUser';

type Props = {
  /** Scroll target for the download card (e.g. #desktop-download). */
  downloadAnchorId?: string;
};

/**
 * After login, if a newer desktop launcher is published, show a dismissible notice.
 * Desktop app sessions (launched with ?desktop=1) get the same prompt on boot.
 */
export function DesktopUpdateNotice({ downloadAnchorId = 'desktop-download' }: Props) {
  const { t } = useAppTranslation();
  const { isAuthenticated } = useCurrentUser();
  const [info, setInfo] = useState<DesktopLauncherVersionInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    syncDesktopLauncherFromUrl();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchDesktopLauncherVersion();
      if (cancelled || !next) return;
      if (!shouldOfferDesktopUpdate(next.version)) {
        setVisible(false);
        return;
      }
      setInfo(next);
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!visible || !info) return null;

  const desktopSession = isDesktopAppSession();

  function handleDismiss() {
    dismissDesktopVersion(info!.version);
    setVisible(false);
  }

  function handleDownload() {
    // Mark as seen so we don't re-prompt until a newer publish.
    setInstalledDesktopVersion(info!.version);
    dismissDesktopVersion(info!.version);
    setVisible(false);
    const el = document.getElementById(downloadAnchorId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-start gap-2 shrink-0"
    >
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Download size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground leading-tight">
          {t('home.desktopApp.updateAvailable', { version: info.version })}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
          {desktopSession
            ? t('home.desktopApp.updateBodyDesktop')
            : t('home.desktopApp.updateBody')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
          >
            <Download size={12} aria-hidden />
            {t('home.desktopApp.updateDownload')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {t('home.desktopApp.updateDismiss')}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={t('common.close')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
