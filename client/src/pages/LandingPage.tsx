import { useState } from 'react';
import {
  ArrowRight,
  Handshake,
  Link2,
  Leaf,
  Users,
  Wrench,
} from 'lucide-react';
import { LoginModal } from '../components/auth/LoginModal';
import { RegisterModal } from '../components/auth/RegisterModal';
import { LanguageSelector } from '../components/layout/LanguageSelector';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { useAppTranslation } from '../i18n/useAppTranslation';

/** Owned CubeValue photography — same company as Bisync. */
const IMG = {
  about: 'https://www.cubevalue.com/wp-content/uploads/About_Us-1-e1599625875996.jpg',
  banner: 'https://www.cubevalue.com/wp-content/uploads/OurApproach_1.jpg',
} as const;

const NAV = [
  { href: '#about', key: 'navAbout' },
  { href: '#approach', key: 'navApproach' },
  { href: '#products', key: 'navProducts' },
] as const;

const APPROACH = [
  { key: 'veterans', icon: Users },
  { key: 'implementation', icon: Wrench },
  { key: 'collaboration', icon: Handshake },
  { key: 'digital', icon: Leaf },
] as const;

const MODULE_HIGHLIGHTS = ['rms', 'pos', 'hrm', 'accounting'] as const;

const PRODUCT_COLUMNS = [
  {
    key: 'rms',
    items: ['buy', 'forecast', 'recipe', 'cost', 'analytics', 'kitchen'] as const,
  },
  {
    key: 'pos',
    items: ['browser', 'mobile', 'menu', 'delivery', 'enterprise', 'store'] as const,
  },
  {
    key: 'hrm',
    items: ['schedule', 'leave', 'clock', 'payroll', 'broadcast', 'mobileHr'] as const,
  },
  {
    key: 'accounting',
    items: ['ledger', 'apAr', 'period', 'reports', 'costLink', 'export'] as const,
  },
] as const;

function BisyncMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'h-9 w-9' : 'h-7 w-7';
  const icon = size === 'md' ? 20 : 16;
  return (
    <div className={`${box} relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[#2A2118] text-white`}>
      <Link2 size={icon} strokeWidth={2.25} />
      <div className="absolute inset-0 bg-gradient-to-tr from-[#F37021]/40 to-transparent" />
    </div>
  );
}

function SectionRule() {
  return <div className="mx-auto mt-3 h-0.5 w-16 bg-[#F37021]" aria-hidden />;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export function LandingPage() {
  const { t } = useAppTranslation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  return (
    <div className="cv-landing min-h-[100dvh] bg-white text-[#1f2430] antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
        .cv-landing { font-family: Outfit, Nunito, ui-sans-serif, sans-serif; }
        .cv-landing h1, .cv-landing h2, .cv-landing h3 {
          font-family: Outfit, Nunito, ui-sans-serif, sans-serif;
          text-wrap: balance;
        }
      `}</style>

      {/* Header — CubeValue-style: logo left, in-page nav, actions right */}
      <header className="sticky top-0 z-40 border-b border-[#e8e8e8] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-2.5" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <BisyncMark />
            <BrandEngineLockup size="md" tone="onLight" />
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#1f2430]/70 md:flex" aria-label="Primary">
            {NAV.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={e => { e.preventDefault(); scrollTo(item.href.slice(1)); }}
                className="transition-colors hover:text-[#F37021]"
              >
                {t(`landing.${item.key}`)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="hidden rounded-sm border border-[#d0d0d0] px-3.5 py-1.5 text-sm font-semibold text-[#1f2430] transition-colors hover:border-[#F37021] hover:text-[#F37021] sm:inline-flex"
            >
              {t('landing.login')}
            </button>
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="inline-flex rounded-sm bg-[#F37021] px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] active:scale-[0.98]"
            >
              {t('landing.register')}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero — full-bleed photo + centered slogan (CubeValue closing/hero pattern) */}
        <section
          className="relative flex min-h-[min(70vh,34rem)] items-center justify-center overflow-hidden bg-[#2A2118] px-5 py-20 text-center text-white sm:min-h-[min(72vh,38rem)] sm:py-24"
          style={{
            backgroundImage: `linear-gradient(rgba(31,36,48,0.62), rgba(31,36,48,0.72)), url(${IMG.banner})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="relative mx-auto max-w-[900px]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
              {t('landing.badge')}
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl md:text-[3.25rem]">
              {t('landing.heroSlogan')}
            </h1>
            <p className="mx-auto mt-4 max-w-[48ch] text-base leading-relaxed text-white/80 sm:text-lg">
              {t('landing.heroSubtitle')}
            </p>
            <ul className="mx-auto mt-7 flex max-w-[40rem] flex-wrap items-center justify-center gap-2">
              {MODULE_HIGHLIGHTS.map(mod => (
                <li
                  key={mod}
                  className="rounded-sm border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90"
                >
                  {t(`landing.moduleLabels.${mod}`)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-sm bg-[#F37021] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] active:scale-[0.98]"
              >
                {t('landing.enterPlatform')}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => scrollTo('products')}
                className="inline-flex items-center gap-2 rounded-sm border border-white/35 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/70"
              >
                {t('landing.navProducts')}
              </button>
            </div>
          </div>
        </section>

        {/* About — 40/60 text + photo, dense padding like CubeValue */}
        <section id="about" className="scroll-mt-14 border-b border-[#e8e8e8] bg-white">
          <div className="mx-auto grid max-w-[1120px] lg:grid-cols-[0.42fr_0.58fr]">
            <div className="flex flex-col justify-center px-5 py-14 sm:px-8 sm:py-16 lg:py-20 lg:pl-6 lg:pr-10">
              <h2 className="text-2xl font-semibold tracking-tight text-[#1f2430] sm:text-3xl">
                {t('landing.aboutTitle')}
              </h2>
              <SectionRule />
              <p className="mt-6 text-[15px] leading-relaxed text-[#1f2430]/75">
                {t('landing.aboutP1')}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[#1f2430]/75">
                {t('landing.aboutP2')}
              </p>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => scrollTo('approach')}
                  className="inline-flex items-center gap-2 rounded-sm bg-[#F37021] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] active:scale-[0.98]"
                >
                  {t('landing.navApproach')}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
            <div
              className="min-h-[16rem] bg-[#f2f2f2] bg-cover bg-right lg:min-h-full"
              style={{ backgroundImage: `url(${IMG.about})` }}
              role="img"
              aria-label={t('landing.aboutImageAlt')}
            />
          </div>
        </section>

        {/* Approach — 4 balanced pillars on light grey */}
        <section id="approach" className="scroll-mt-14 border-b border-[#e8e8e8] bg-[#f2f2f2] px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#1f2430] sm:text-3xl">
              {t('landing.approachTitle')}
            </h2>
            <SectionRule />

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {APPROACH.map(({ key, icon: Icon }) => (
                <article key={key} className="bg-white px-5 py-6 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#F37021]/12 text-[#F37021]">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-[#1f2430]">
                    {t(`landing.approach.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1f2430]/65">
                    {t(`landing.approach.${key}.body`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Products — four ERP modules including HR and Accounting */}
        <section id="products" className="scroll-mt-14 bg-white px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-[#1f2430] sm:text-3xl">
              {t('landing.productsTitle')}
            </h2>
            <SectionRule />
            <p className="mx-auto mt-5 max-w-[56ch] text-center text-[15px] leading-relaxed text-[#1f2430]/65">
              {t('landing.productsSubtitle')}
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:gap-6">
              {PRODUCT_COLUMNS.map(col => (
                <div key={col.key} className="border border-[#e8e8e8] bg-[#fafafa] px-5 py-5 sm:px-6 sm:py-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F37021]">
                    {t(`landing.moduleLabels.${col.key}`)}
                  </p>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-[#1f2430]">
                    {t(`landing.products.${col.key}.title`)}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {col.items.map(item => (
                      <li key={item} className="flex gap-2.5 text-sm leading-snug text-[#1f2430]/75">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F37021]" aria-hidden />
                        <span>{t(`landing.products.${col.key}.${item}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-sm bg-[#F37021] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] active:scale-[0.98]"
              >
                {t('landing.capabilities.launch')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Closing banner — CubeValue slogan strip */}
        <section
          className="relative flex items-center justify-center overflow-hidden px-5 py-16 text-center text-white sm:py-20"
          style={{
            backgroundImage: `linear-gradient(rgba(31,36,48,0.7), rgba(31,36,48,0.78)), url(${IMG.banner})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="relative mx-auto max-w-[720px]">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {t('landing.heroSlogan')}
            </h2>
            <p className="mx-auto mt-4 max-w-[44ch] text-sm leading-relaxed text-white/75 sm:text-base">
              {t('landing.ctaSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRegisterOpen(true)}
                className="inline-flex items-center gap-2 rounded-sm bg-[#F37021] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#D4550A] active:scale-[0.98]"
              >
                {t('landing.register')}
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex rounded-sm border border-white/35 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/70"
              >
                {t('landing.login')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e8e8e8] bg-white py-7">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-3 px-5 text-sm text-[#1f2430]/50 sm:flex-row sm:px-6">
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
