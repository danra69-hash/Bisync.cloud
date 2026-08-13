import {
  Calculator,
  CheckSquare,
  ChevronRight,
  ShoppingBag,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PLATFORM_MODULES, isNavItemEnabled } from '../../data/companyModules';
import type { AccessModule } from '../../data/userAccess';
import type { NavItem } from '../../data/revenueManagement';
import { isNavItemPlatformLive, type ModulesGoLiveMap } from '../../data/platformGoLiveModules';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { PlatformTeamChatPanel } from '../chat/PlatformTeamChatPanel';
import { DesktopUpdateNotice } from './DesktopUpdateNotice';
import { HomeDesktopDownloadCard } from './HomeDesktopDownloadCard';

type Props = {
  enabledModules: AccessModule[];
  modulesGoLive: ModulesGoLiveMap | null;
  onOpenModule: (item: NavItem) => void;
};

const MODULE_VISUAL: Record<
  AccessModule,
  { icon: LucideIcon; accent: string; wash: string; graphic: 'revenue' | 'pos' | 'hr' | 'accounting' }
> = {
  RMS: {
    icon: TrendingUp,
    accent: 'text-[#F37021]',
    wash: 'from-[#F37021]/20 via-[#F37021]/5 to-transparent',
    graphic: 'revenue',
  },
  POS: {
    icon: ShoppingBag,
    accent: 'text-[#2A7A6A]',
    wash: 'from-[#2A7A6A]/20 via-[#2A7A6A]/5 to-transparent',
    graphic: 'pos',
  },
  HRM: {
    icon: Users,
    accent: 'text-[#3B6EA5]',
    wash: 'from-[#3B6EA5]/20 via-[#3B6EA5]/5 to-transparent',
    graphic: 'hr',
  },
  Accounting: {
    icon: Calculator,
    accent: 'text-[#8A6A2A]',
    wash: 'from-[#8A6A2A]/20 via-[#8A6A2A]/5 to-transparent',
    graphic: 'accounting',
  },
};

function ModuleGraphic({ kind }: { kind: 'revenue' | 'pos' | 'hr' | 'accounting' }) {
  if (kind === 'revenue') {
    return (
      <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden>
        <path d="M12 78h136" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
        <path
          d="M20 70 L44 52 L68 58 L96 34 L124 42 L140 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="140" cy="22" r="4" fill="currentColor" />
        <rect x="28" y="48" width="10" height="30" rx="2" fill="currentColor" opacity="0.18" />
        <rect x="52" y="40" width="10" height="38" rx="2" fill="currentColor" opacity="0.28" />
        <rect x="76" y="30" width="10" height="48" rx="2" fill="currentColor" opacity="0.38" />
        <rect x="100" y="22" width="10" height="56" rx="2" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }

  if (kind === 'pos') {
    return (
      <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden>
        <rect x="36" y="18" width="88" height="60" rx="8" fill="currentColor" opacity="0.12" />
        <rect x="48" y="28" width="64" height="28" rx="4" fill="currentColor" opacity="0.22" />
        <rect x="52" y="64" width="12" height="8" rx="2" fill="currentColor" opacity="0.45" />
        <rect x="70" y="64" width="12" height="8" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="88" y="64" width="12" height="8" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="106" y="64" width="12" height="8" rx="2" fill="currentColor" opacity="0.28" />
        <circle cx="118" cy="34" r="10" fill="currentColor" opacity="0.55" />
        <path d="M114 34h8M118 30v8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'hr') {
    return (
      <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden>
        <circle cx="56" cy="34" r="12" fill="currentColor" opacity="0.45" />
        <path d="M34 72c2-16 12-24 22-24s20 8 22 24" fill="currentColor" opacity="0.28" />
        <circle cx="104" cy="30" r="10" fill="currentColor" opacity="0.35" />
        <path d="M86 72c2-14 10-20 18-20s16 6 18 20" fill="currentColor" opacity="0.2" />
        <circle cx="80" cy="42" r="9" fill="currentColor" opacity="0.55" />
        <path d="M58 78c3-16 11-22 22-22s19 6 22 22" fill="currentColor" opacity="0.38" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 160 96" className="h-full w-full" aria-hidden>
      <rect x="30" y="20" width="100" height="58" rx="6" fill="currentColor" opacity="0.12" />
      <path d="M42 36h76M42 48h52M42 60h64" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      <rect x="98" y="44" width="28" height="22" rx="3" fill="currentColor" opacity="0.45" />
      <text x="112" y="59" textAnchor="middle" fontSize="12" fill="white" fontFamily="ui-sans-serif, system-ui">
        Σ
      </text>
    </svg>
  );
}

const MODULE_BLURB_KEY: Record<AccessModule, string> = {
  RMS: 'home.modules.rms',
  POS: 'home.modules.pos',
  HRM: 'home.modules.hrm',
  Accounting: 'home.modules.accounting',
};

export function HomePage({ enabledModules, modulesGoLive, onOpenModule }: Props) {
  const { t, navLabel } = useAppTranslation();

  return (
    <div className="w-full min-w-0 flex flex-col lg:flex-row gap-3 items-stretch">
      <div className="w-full lg:w-[min(20rem,32%)] shrink-0 flex flex-col gap-3">
        <PlatformTeamChatPanel compact />
        <DesktopUpdateNotice downloadAnchorId="desktop-download" />
        <div id="desktop-download">
          <HomeDesktopDownloadCard compact />
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground leading-tight">{t('nav.home')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t('home.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PLATFORM_MODULES.map(module => {
            const visual = MODULE_VISUAL[module.id];
            const Icon = visual.icon;
            const enabled =
              isNavItemEnabled(module.navItem, enabledModules)
              && isNavItemPlatformLive(module.navItem, modulesGoLive);
            const title = navLabel(module.navItem);

            return (
              <button
                key={module.id}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (enabled) onOpenModule(module.navItem);
                }}
                title={!enabled ? t('common.moduleNotEnabled') : title}
                className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
                  enabled
                    ? 'border-border bg-card hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                    : 'border-border/60 bg-muted/30 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${visual.wash}`} />
                <div className="relative grid grid-cols-[1fr_5rem] gap-1.5 p-2.5 sm:p-3">
                  <div className="min-w-0 flex flex-col justify-between gap-1.5 py-0.5">
                    <div>
                      <div className={`inline-flex items-center gap-1 ${visual.accent}`}>
                        <Icon size={13} />
                        <span className="text-[9px] font-sans uppercase tracking-wider opacity-80">
                          {module.id}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground mt-0.5 leading-tight">{title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {t(MODULE_BLURB_KEY[module.id])}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                        enabled ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {enabled ? t('home.openModule') : t('common.moduleNotEnabled')}
                      {enabled ? <ChevronRight size={11} className="transition-transform group-hover:translate-x-0.5" /> : null}
                    </span>
                  </div>
                  <div className={`h-16 sm:h-[4.5rem] self-end ${visual.accent}`}>
                    <ModuleGraphic kind={visual.graphic} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <section className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[8rem]">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <CheckSquare size={13} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-tight">{t('home.todoToday.title')}</h2>
              <p className="text-[11px] text-muted-foreground leading-snug">{t('home.todoToday.subtitle')}</p>
            </div>
          </div>
          <div className="flex-1 px-3 py-3 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center leading-snug">
              {t('home.todoToday.empty')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
