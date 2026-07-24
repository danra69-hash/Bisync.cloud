import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Brain,
  Cpu,
  Link2,
  LineChart,
  Radar,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { LoginModal } from '../components/auth/LoginModal';
import { RegisterModal } from '../components/auth/RegisterModal';
import { LanguageSelector } from '../components/layout/LanguageSelector';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { useAppTranslation } from '../i18n/useAppTranslation';

const CAPABILITY_KEYS = [
  { key: 'predictive', icon: Brain },
  { key: 'autonomous', icon: Bot },
  { key: 'margin', icon: LineChart },
  { key: 'anomaly', icon: Radar },
  { key: 'adaptive', icon: Workflow },
  { key: 'unified', icon: Cpu },
] as const;

const PIPELINE_KEYS = ['sense', 'predict', 'act', 'learn'] as const;

const METRIC_KEYS = [
  { value: '94%', key: 'forecastAccuracy' },
  { value: '3.2×', key: 'fasterProcurement' },
  { value: '−18%', key: 'foodCostVariance' },
  { value: '24/7', key: 'autonomousMonitoring' },
] as const;

const ORB_KEYS = ['procurement', 'inventory', 'recipes', 'vendors'] as const;

function BisyncLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-herme-ink text-white shrink-0">
        <Link2 size={20} strokeWidth={2.25} />
        <div className="absolute inset-0 bg-gradient-to-tr from-herme/40 to-transparent" />
      </div>
      <BrandEngineLockup size="md" tone="onLight" />
    </div>
  );
}

function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(243,112,33,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(243,112,33,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-herme/10 blur-3xl" />
      <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-herme/5 blur-3xl" />
    </div>
  );
}

function AiOrb({ labels }: { labels: string[] }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div className="absolute inset-0 animate-pulse rounded-full bg-herme/10 blur-2xl" />
      <div className="absolute inset-8 rounded-full border border-herme/25 bg-gradient-to-br from-herme-ink via-[#3a2c22] to-herme-darker shadow-xl shadow-herme/15">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(243,112,33,0.35),transparent_55%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <Sparkles size={56} className="text-herme" strokeWidth={1.5} />
            <div className="absolute -right-2 -top-2 h-3 w-3 animate-ping rounded-full bg-herme" />
          </div>
        </div>
      </div>
      {labels.map((label, i) => {
        const angle = (i / labels.length) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(angle) * 46;
        const y = 50 + Math.sin(angle) * 46;
        return (
          <div
            key={label}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-semibold text-herme-ink shadow-sm"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

export function LandingPage() {
  const { t } = useAppTranslation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  function scrollToFeatures() {
    document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' });
  }

  const orbLabels = ORB_KEYS.map(key => t(`landing.orb.${key}`));

  return (
    <div className="min-h-screen bg-white text-herme-ink font-sans">
      <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BisyncLogo />
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="rounded-md border border-herme bg-herme/5 px-6 py-2 text-sm font-semibold text-herme transition-all hover:bg-herme hover:text-white"
            >
              {t('landing.login')}
            </button>
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="rounded-md bg-herme px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-herme-dark"
            >
              {t('landing.register')}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <GridBackground />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-herme/30 bg-herme/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-herme-dark">
                <Sparkles size={14} className="text-herme" />
                {t('landing.badge')}
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-herme-ink md:text-5xl lg:text-6xl">
                {t('landing.heroTitle')}{' '}
                <span className="text-herme">
                  {t('landing.heroTitleHighlight')}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {t('landing.heroSubtitle')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-herme px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-herme-dark"
                >
                  {t('landing.enterPlatform')}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={scrollToFeatures}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-semibold text-herme-ink transition-colors hover:border-herme/50 hover:text-herme"
                >
                  {t('landing.exploreCapabilities')}
                </button>
              </div>
            </div>
            <AiOrb labels={orbLabels} />
          </div>
        </section>

        <section className="border-y border-border bg-muted/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
            {METRIC_KEYS.map(({ value, key }) => (
              <div key={key} className="text-center md:text-left">
                <p className="text-3xl font-bold text-herme md:text-4xl">{value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`landing.metrics.${key}`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-herme">{t('landing.pipeline.eyebrow')}</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold text-herme-ink md:text-4xl">
              {t('landing.pipeline.title')}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {t('landing.pipeline.subtitle')}
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_KEYS.map((key, index) => (
                <div
                  key={key}
                  className="group relative overflow-hidden rounded-md border border-border bg-white p-6 transition-colors hover:border-herme/50"
                >
                  <div className="absolute right-4 top-4 text-4xl font-bold text-herme/15">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-herme/10 text-herme">
                    <Zap size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-herme-ink">{t(`landing.pipeline.${key}Label`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.pipeline.${key}Detail`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/40 py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
            <div className="order-2 md:order-1">
              <div className="overflow-hidden rounded-md border border-border bg-herme-ink p-1 shadow-sm">
                <div className="rounded-[5px] bg-[#241c16] p-6 text-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-herme" />
                    <span className="text-xs uppercase tracking-widest text-herme/90">{t('landing.neural.consoleTitle')}</span>
                  </div>
                  <div className="space-y-3 text-[#e8dfd2]/80">
                    <p><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine1')}</p>
                    <p><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine2')}</p>
                    <p><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine3')}</p>
                    <p className="text-herme-soft"><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine4')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-sm font-semibold uppercase tracking-widest text-herme">{t('landing.neural.eyebrow')}</p>
              <h2 className="mt-2 text-3xl font-bold text-herme-ink md:text-4xl">
                {t('landing.neural.title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {t('landing.neural.subtitle')}
              </p>
              <button
                type="button"
                onClick={scrollToFeatures}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-herme transition-colors hover:text-herme-dark"
              >
                {t('landing.neural.seeCapabilities')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-herme">{t('landing.edge.eyebrow')}</p>
              <h2 className="mt-2 text-3xl font-bold text-herme-ink md:text-4xl">
                {t('landing.edge.title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {t('landing.edge.subtitle')}
              </p>
            </div>
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-border bg-gradient-to-br from-herme/10 via-white to-muted">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(243,112,33,0.18),transparent_70%)]" />
              <div className="relative rounded-md border border-border bg-white/90 p-6 shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-herme/15">
                    <Bot size={22} className="text-herme" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-herme-ink">{t('landing.edge.agentActive')}</p>
                    <p className="text-xs text-muted-foreground">{t('landing.edge.monitoringLocations')}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-4/5 rounded-full bg-herme" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('landing.edge.systemConfidence')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-t border-border bg-muted/50 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-herme">
              {t('landing.capabilities.eyebrow')}
            </p>
            <h2 className="mt-2 text-center text-3xl font-bold text-herme-ink md:text-4xl">
              {t('landing.capabilities.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
              {t('landing.capabilities.subtitle')}
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITY_KEYS.map(({ key, icon: Icon }) => (
                <article
                  key={key}
                  className="group rounded-md border border-border bg-white p-6 transition-all hover:border-herme/50"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-herme/10 text-herme transition-colors group-hover:bg-herme group-hover:text-white">
                      <Icon size={22} />
                    </div>
                    <span className="rounded-full border border-herme/30 bg-herme/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-herme-dark">
                      {t(`landing.capabilityItems.${key}.tag`)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-herme-ink">{t(`landing.capabilityItems.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`landing.capabilityItems.${key}.description`)}</p>
                </article>
              ))}
            </div>
            <div className="mt-14 text-center">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-herme px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-herme-dark"
              >
                {t('landing.capabilities.launch')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          {t('landing.footer')}
        </div>
      </footer>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {registerOpen && (
        <RegisterModal
          onClose={() => setRegisterOpen(false)}
          onOpenLogin={() => {
            setRegisterOpen(false);
            setLoginOpen(true);
          }}
        />
      )}
    </div>
  );
}
