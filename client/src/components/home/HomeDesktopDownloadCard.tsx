import { Download, Monitor } from 'lucide-react';
import { DESKTOP_DOWNLOADS } from '../../data/desktopLauncher';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  /** Compact stack under the Home chat rail. */
  compact?: boolean;
  className?: string;
};

export function HomeDesktopDownloadCard({ compact = false, className = '' }: Props) {
  const { t } = useAppTranslation();

  return (
    <section
      className={[
        'bg-card border border-border rounded-xl overflow-hidden',
        compact ? 'shrink-0' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Monitor size={13} className="text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{t('home.desktopApp.title')}</h2>
          <p className="text-[11px] text-muted-foreground leading-snug">{t('home.desktopApp.subtitle')}</p>
        </div>
      </div>
      <div className={`p-3 grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {DESKTOP_DOWNLOADS.map(item => (
          <a
            key={item.id}
            href={item.href}
            download={item.fileName}
            className="group flex items-start gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Download size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground group-hover:text-primary">
                {t(item.labelKey)}
              </span>
              <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5">
                {t(item.hintKey)}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
