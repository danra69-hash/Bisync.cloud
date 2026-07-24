import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { BisyncMarkTile } from '../components/layout/BisyncMark';
import { EulaDocument } from '../components/auth/EulaDocument';
import { CURRENT_EULA_VERSION, EULA_EFFECTIVE_DATE, EULA_TITLE } from '../data/eula';

/**
 * Public EULA page for registration and footer links.
 * Routed at /legal/eula without requiring login.
 */
export function EulaPage() {
  return (
    <div className="min-h-screen bg-[#f7f5f2] text-herme-ink">
      <header className="border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 min-w-0">
            <BisyncMarkTile size="sm" />
            <BrandEngineLockup size="sm" tone="onLight" />
          </a>
          <a
            href="/"
            className="text-xs font-semibold text-[#F37021] hover:text-[#D4550A] whitespace-nowrap"
          >
            Back to home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
        <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-6 sm:px-8 sm:py-8 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F37021]">Legal</p>
          <h1 className="mt-1 text-2xl font-bold">{EULA_TITLE}</h1>
          <p className="mt-1 text-sm text-herme-ink/55">
            Version {CURRENT_EULA_VERSION} · Effective {EULA_EFFECTIVE_DATE}
          </p>
          <div className="mt-6">
            <EulaDocument />
          </div>
        </div>
      </main>
    </div>
  );
}
