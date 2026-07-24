import { useEffect, useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { LoginModal } from '../components/auth/LoginModal';
import { RegisterModal } from '../components/auth/RegisterModal';
import { LanguageSelector } from '../components/layout/LanguageSelector';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { useAppTranslation } from '../i18n/useAppTranslation';

const PIPELINE_KEYS = ['sense', 'predict', 'act', 'learn'] as const;

const CAPABILITY_KEYS = [
  'predictive',
  'autonomous',
  'margin',
  'anomaly',
  'adaptive',
  'unified',
] as const;

function Grain({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply ${className}`}
      style={{
        backgroundImage:
          'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
      }}
      aria-hidden
    />
  );
}

function BisyncMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-9 w-9' : 'h-7 w-7';
  const icon = size === 'lg' ? 24 : size === 'md' ? 20 : 16;
  return (
    <div className={`${box} relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#2A2118] text-white`}>
      <Link2 size={icon} strokeWidth={2.25} />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#F37021]/35 to-transparent" />
    </div>
  );
}

/** Product workbench — the landing visual anchor (not an abstract AI orb). */
function ProductWorkbench() {
  const { t } = useAppTranslation();
  const rows = [
    { po: 'PO-2407-018', vendor: 'Cold Chain Supplies', status: 'Pending', value: 'RM 4,280.00' },
    { po: 'PO-2407-019', vendor: 'Pasar Fresh Co.', status: 'Approved', value: 'RM 1,965.40' },
    { po: 'PO-2407-021', vendor: 'Ocean Catch MY', status: 'Receiving', value: 'RM 3,112.75' },
  ];

  return (
    <div className="landing-reveal relative h-full min-h-[22rem] w-full overflow-hidden border-l border-[#2A2118]/10 bg-[#F7F3EE] md:min-h-0">
      <Grain />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(243,112,33,0.12),transparent_55%),linear-gradient(160deg,#FFFFFF_0%,#F5F2EE_48%,#EFE8DF_100%)]" />

      <div className="relative flex h-full flex-col p-4 sm:p-6 lg:p-8">
        <div className="overflow-hidden rounded-lg border border-[#2A2118]/12 bg-white shadow-[0_24px_60px_-28px_rgba(42,33,24,0.45)]">
          <div className="flex items-center gap-2 border-b border-[#2A2118]/08 bg-[#2A2118] px-3 py-2.5">
            <BisyncMark size="sm" />
            <BrandEngineLockup size="sm" tone="onDark" />
            <span className="ml-auto rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
              {t('landing.workbench.module')}
            </span>
          </div>

          <div className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[5.5rem_1fr]">
            <aside className="space-y-1 border-r border-[#2A2118]/08 bg-[#2A2118] px-2 py-3 text-[10px] text-white/55">
              <div className="rounded bg-[#F37021] px-2 py-1.5 font-semibold text-white">{t('landing.workbench.navOrders')}</div>
              <div className="px-2 py-1.5">{t('landing.workbench.navStock')}</div>
              <div className="px-2 py-1.5">{t('landing.workbench.navCost')}</div>
              <div className="px-2 py-1.5">{t('landing.workbench.navVendors')}</div>
            </aside>

            <div className="min-w-0 bg-white">
              <div className="flex items-end justify-between gap-3 border-b border-[#2A2118]/08 px-3 py-3 sm:px-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F37021]">
                    {t('landing.workbench.panelEyebrow')}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tracking-tight text-[#2A2118] sm:text-base">
                    {t('landing.workbench.panelTitle')}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] uppercase tracking-wider text-[#2A2118]/45">{t('landing.workbench.onHand')}</p>
                  <p className="font-semibold tabular-nums text-[#2A2118]">12</p>
                </div>
              </div>

              <table className="w-full table-fixed text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-[#2A2118]/08 bg-[#F5F2EE]/80 text-[10px] uppercase tracking-wider text-[#2A2118]/50">
                    <th className="px-3 py-2 font-semibold sm:px-4">{t('landing.workbench.colPo')}</th>
                    <th className="hidden px-3 py-2 font-semibold sm:table-cell">{t('landing.workbench.colVendor')}</th>
                    <th className="px-3 py-2 font-semibold">{t('landing.workbench.colStatus')}</th>
                    <th className="px-3 py-2 text-right font-semibold sm:px-4">{t('landing.workbench.colValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.po} className="border-b border-[#2A2118]/06 last:border-0">
                      <td className="truncate px-3 py-2.5 font-medium text-[#F37021] sm:px-4">{row.po}</td>
                      <td className="hidden truncate px-3 py-2.5 text-[#2A2118]/75 sm:table-cell">{row.vendor}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded border border-[#2A2118]/12 bg-[#F5F2EE] px-1.5 py-0.5 text-[10px] font-medium text-[#2A2118]/80">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-[#2A2118] sm:px-4">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="relative mt-4 max-w-md text-xs leading-relaxed text-[#2A2118]/55">
          {t('landing.workbench.caption')}
        </p>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { t } = useAppTranslation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function scrollToWorkflow() {
    document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div
      className={`landing-page min-h-[100dvh] bg-white text-[#2A2118] antialiased ${ready ? 'landing-ready' : ''}`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
        .landing-page {
          font-family: Outfit, Nunito, ui-sans-serif, sans-serif;
        }
        .landing-page .landing-display {
          font-family: Outfit, Nunito, ui-sans-serif, sans-serif;
          letter-spacing: -0.035em;
          text-wrap: balance;
        }
        .landing-page .landing-reveal {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .landing-page.landing-ready .landing-reveal {
          opacity: 1;
          transform: none;
        }
        .landing-page.landing-ready .landing-reveal-delay-1 { transition-delay: 90ms; }
        .landing-page.landing-ready .landing-reveal-delay-2 { transition-delay: 180ms; }
        .landing-page.landing-ready .landing-reveal-delay-3 { transition-delay: 270ms; }
        .landing-page.landing-ready .landing-reveal-delay-4 { transition-delay: 360ms; }
        @media (prefers-reduced-motion: reduce) {
          .landing-page .landing-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-[#2A2118]/08 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <BisyncMark size="md" />
            <BrandEngineLockup size="md" tone="onLight" />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="rounded-md border border-[#2A2118]/15 px-3.5 py-2 text-sm font-semibold text-[#2A2118] transition-colors hover:border-[#F37021]/50 hover:text-[#F37021] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F37021]/40"
            >
              {t('landing.login')}
            </button>
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="rounded-md bg-[#F37021] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F37021]/40 active:scale-[0.98]"
            >
              {t('landing.register')}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero — brand + one headline + one line + CTAs + product plane */}
        <section className="relative overflow-hidden border-b border-[#2A2118]/08">
          <Grain />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,#FFFFFF_0%,#FFFFFF_42%,#F7F3EE_100%)]" aria-hidden />
          <div className="relative mx-auto grid min-h-[calc(100dvh-4.25rem)] max-w-[1400px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="flex flex-col justify-center px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
              <div className="landing-reveal landing-reveal-delay-1 flex items-center gap-3">
                <BisyncMark size="lg" />
                <BrandEngineLockup size="md" tone="onLight" className="scale-110 origin-left" />
              </div>

              <h1 className="landing-display landing-reveal landing-reveal-delay-2 mt-8 max-w-[14ch] text-4xl font-semibold leading-[1.05] text-[#2A2118] sm:text-5xl lg:text-[3.5rem]">
                {t('landing.heroTitle')}{' '}
                <span className="text-[#F37021]">{t('landing.heroTitleHighlight')}</span>
              </h1>

              <p className="landing-reveal landing-reveal-delay-3 mt-5 max-w-[38ch] text-base leading-relaxed text-[#2A2118]/65 sm:text-lg">
                {t('landing.heroSubtitle')}
              </p>

              <div className="landing-reveal landing-reveal-delay-4 mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-[#F37021] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F37021]/40 active:scale-[0.98]"
                >
                  {t('landing.enterPlatform')}
                  <ArrowRight size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={scrollToWorkflow}
                  className="inline-flex items-center gap-2 rounded-md border border-[#2A2118]/15 bg-white/70 px-5 py-3 text-sm font-semibold text-[#2A2118] transition-colors hover:border-[#F37021]/45 hover:text-[#F37021] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F37021]/40"
                >
                  {t('landing.exploreCapabilities')}
                </button>
              </div>
            </div>

            <div className="landing-reveal landing-reveal-delay-3 min-h-[22rem] lg:min-h-0">
              <ProductWorkbench />
            </div>
          </div>
        </section>

        {/* Narrative workflow — one ribbon, not four equal cards */}
        <section id="workflow" className="relative scroll-mt-24 border-b border-[#2A2118]/08 bg-white py-20 sm:py-24">
          <Grain className="opacity-[0.025]" />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
            <p className="text-sm font-medium italic text-[#F37021]">{t('landing.pipeline.eyebrow')}</p>
            <h2 className="landing-display mt-2 max-w-[20ch] text-3xl font-semibold leading-[1.1] text-[#2A2118] sm:text-4xl">
              {t('landing.pipeline.title')}
            </h2>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-[#2A2118]/60">
              {t('landing.pipeline.subtitle')}
            </p>

            <ol className="mt-12 grid gap-0 border-y border-[#2A2118]/12 md:grid-cols-4">
              {PIPELINE_KEYS.map((key, index) => (
                <li
                  key={key}
                  className="relative border-[#2A2118]/12 px-0 py-6 md:border-r md:px-5 md:py-8 md:last:border-r-0"
                >
                  <div className="flex items-baseline gap-3 md:block">
                    <span className="font-semibold tabular-nums text-[#F37021]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight text-[#2A2118] md:mt-4">
                      {t(`landing.pipeline.${key}Label`)}
                    </h3>
                  </div>
                  <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-[#2A2118]/60">
                    {t(`landing.pipeline.${key}Detail`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Capabilities — asymmetric list, not a 3×2 card grid */}
        <section id="capabilities" className="relative scroll-mt-24 bg-[#F7F3EE] py-20 sm:py-24">
          <Grain />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
              <div className="lg:sticky lg:top-28 lg:self-start">
                <p className="text-sm font-medium italic text-[#F37021]">{t('landing.capabilities.eyebrow')}</p>
                <h2 className="landing-display mt-2 max-w-[16ch] text-3xl font-semibold leading-[1.1] text-[#2A2118] sm:text-4xl">
                  {t('landing.capabilities.title')}
                </h2>
                <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-[#2A2118]/60">
                  {t('landing.capabilities.subtitle')}
                </p>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="mt-8 inline-flex items-center gap-2 rounded-md bg-[#2A2118] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#F37021] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F37021]/40 active:scale-[0.98]"
                >
                  {t('landing.capabilities.launch')}
                  <ArrowRight size={16} />
                </button>
              </div>

              <ul className="divide-y divide-[#2A2118]/12 border-y border-[#2A2118]/12">
                {CAPABILITY_KEYS.map((key, index) => (
                  <li key={key} className="grid gap-2 py-6 sm:grid-cols-[3.5rem_1fr] sm:gap-6">
                    <span className="pt-1 text-xs font-semibold tabular-nums text-[#F37021]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-[#2A2118]">
                        {t(`landing.capabilityItems.${key}.title`)}
                      </h3>
                      <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-[#2A2118]/60">
                        {t(`landing.capabilityItems.${key}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Closing CTA — single purpose */}
        <section className="relative overflow-hidden bg-[#2A2118] py-20 text-white sm:py-24">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 15% 20%, rgba(243,112,33,0.35), transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(243,112,33,0.12), transparent 45%)',
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8">
            <h2 className="landing-display max-w-[16ch] text-3xl font-semibold leading-[1.1] sm:text-4xl">
              {t('landing.ctaTitle')}
            </h2>
            <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-white/65">
              {t('landing.ctaSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setRegisterOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[#F37021] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]"
              >
                {t('landing.register')}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {t('landing.login')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#2A2118]/08 bg-white py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 text-sm text-[#2A2118]/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <BisyncMark size="sm" />
            <BrandEngineLockup size="sm" tone="onLight" />
          </div>
          <p>{t('landing.footer')}</p>
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
