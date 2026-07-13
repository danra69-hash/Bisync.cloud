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
      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-herme-ink text-white shrink-0">
        <Link2 size={20} strokeWidth={2.25} />
        <div className="absolute inset-0 bg-gradient-to-tr from-herme/40 to-transparent" />
      </div>
      <BrandEngineLockup size="md" />
    </div>
  );
}

function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(243,112,33,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(243,112,33,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-herme/20 blur-3xl" />
      <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-herme-dark/15 blur-3xl" />
    </div>
  );
}

function AiOrb({ labels }: { labels: string[] }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div className="absolute inset-0 animate-pulse rounded-full bg-herme/10 blur-2xl" />
      <div className="absolute inset-8 rounded-full border border-herme/30 bg-gradient-to-br from-herme-ink via-[#2a1810] to-herme-darker shadow-2xl shadow-herme/20">
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
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-herme/40 bg-herme-ink/90 px-3 py-1 text-[11px] font-semibold text-herme-light backdrop-blur-sm"
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
    <div className="min-h-screen bg-herme-ink text-white font-sans">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-herme-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BisyncLogo />
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="rounded-full border border-herme bg-herme/10 px-6 py-2 text-sm font-semibold text-herme transition-all hover:bg-herme hover:text-white hover:shadow-lg hover:shadow-herme/25"
            >
              {t('landing.login')}
            </button>
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="rounded-full bg-[#C9963A] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-[#A87A2E] hover:shadow-lg hover:shadow-[#C9963A]/30"
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
              <div className="inline-flex items-center gap-2 rounded-full border border-herme/30 bg-herme/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-herme-light">
                <Sparkles size={14} className="text-herme" />
                {t('landing.badge')}
              </div>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
                {t('landing.heroTitle')}{' '}
                <span className="bg-gradient-to-r from-herme-light via-herme to-herme-muted bg-clip-text text-transparent">
                  {t('landing.heroTitleHighlight')}
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
                {t('landing.heroSubtitle')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-herme px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-herme-dark hover:shadow-lg hover:shadow-herme/30"
                >
                  {t('landing.enterPlatform')}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={scrollToFeatures}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-herme/50 hover:text-white"
                >
                  {t('landing.exploreCapabilities')}
                </button>
              </div>
            </div>
            <AiOrb labels={orbLabels} />
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
            {METRIC_KEYS.map(({ value, key }) => (
              <div key={key} className="text-center md:text-left">
                <p className="text-3xl font-bold text-herme md:text-4xl">{value}</p>
                <p className="mt-1 text-sm text-white/50">{t(`landing.metrics.${key}`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-herme">{t('landing.pipeline.eyebrow')}</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold md:text-4xl">
              {t('landing.pipeline.title')}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
              {t('landing.pipeline.subtitle')}
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_KEYS.map((key, index) => (
                <div
                  key={key}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 transition-colors hover:border-herme/40"
                >
                  <div className="absolute right-4 top-4 text-4xl font-bold text-white/[0.04]">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-herme/15 text-herme">
                    <Zap size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t(`landing.pipeline.${key}Label`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{t(`landing.pipeline.${key}Detail`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-b from-herme-darker/40 to-transparent py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
            <div className="order-2 md:order-1">
              <div className="overflow-hidden rounded-3xl border border-herme/20 bg-herme-ink p-1 shadow-2xl shadow-herme/10">
                <div className="rounded-[1.35rem] bg-[#120a06] p-6 text-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-herme" />
                    <span className="text-xs uppercase tracking-widest text-herme/80">{t('landing.neural.consoleTitle')}</span>
                  </div>
                  <div className="space-y-3 text-white/70">
                    <p><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine1')}</p>
                    <p><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine2')}</p>
                    <p><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine3')}</p>
                    <p className="text-herme-light"><span className="text-herme">&gt;</span> {t('landing.neural.consoleLine4')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-sm font-semibold uppercase tracking-widest text-herme">{t('landing.neural.eyebrow')}</p>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                {t('landing.neural.title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                {t('landing.neural.subtitle')}
              </p>
              <button
                type="button"
                onClick={scrollToFeatures}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-herme transition-colors hover:text-herme-light"
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
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">
                {t('landing.edge.title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                {t('landing.edge.subtitle')}
              </p>
            </div>
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-herme/25 bg-gradient-to-br from-herme/20 via-herme-dark/30 to-herme-ink">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(243,112,33,0.25),transparent_70%)]" />
              <div className="relative rounded-2xl border border-white/10 bg-herme-ink/80 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-herme/20">
                    <Bot size={22} className="text-herme" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t('landing.edge.agentActive')}</p>
                    <p className="text-xs text-white/50">{t('landing.edge.monitoringLocations')}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-herme to-herme-light" />
                  </div>
                  <p className="text-xs text-white/45">{t('landing.edge.systemConfidence')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-t border-white/10 bg-white/[0.02] py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-herme">
              {t('landing.capabilities.eyebrow')}
            </p>
            <h2 className="mt-2 text-center text-3xl font-bold md:text-4xl">
              {t('landing.capabilities.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-white/55">
              {t('landing.capabilities.subtitle')}
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITY_KEYS.map(({ key, icon: Icon }) => (
                <article
                  key={key}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 transition-all hover:border-herme/40 hover:shadow-lg hover:shadow-herme/5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-herme/15 text-herme transition-colors group-hover:bg-herme group-hover:text-white">
                      <Icon size={22} />
                    </div>
                    <span className="rounded-full border border-herme/30 bg-herme/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-herme-light">
                      {t(`landing.capabilityItems.${key}.tag`)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{t(`landing.capabilityItems.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{t(`landing.capabilityItems.${key}.description`)}</p>
                </article>
              ))}
            </div>
            <div className="mt-14 text-center">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-herme px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-herme-dark hover:shadow-xl hover:shadow-herme/25"
              >
                {t('landing.capabilities.launch')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-white/40">
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
