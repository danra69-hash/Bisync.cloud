import { useEffect, type ReactNode } from 'react';
import { LEGAL_PUBLIC_PATHS } from '../../data/legalShared';
import { BrandEngineLockup } from '../layout/BrandEngineLockup';
import { BisyncMarkTile } from '../layout/BisyncMark';

type Props = {
  title: string;
  version: string;
  effectiveDate: string;
  /** Which legal doc this page is — used for related-link highlighting. */
  doc?: 'eula' | 'privacy' | 'dpa';
  children: ReactNode;
};

const RELATED = [
  { id: 'eula' as const, label: 'EULA', href: LEGAL_PUBLIC_PATHS.eula },
  { id: 'privacy' as const, label: 'Privacy Policy', href: LEGAL_PUBLIC_PATHS.privacy },
  { id: 'dpa' as const, label: 'DPA', href: LEGAL_PUBLIC_PATHS.dpa },
];

export function LegalPageShell({ title, version, effectiveDate, doc, children }: Props) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Bisync.cloud`;
    return () => {
      document.title = previous;
    };
  }, [title]);

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
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-herme-ink/55">
            Version {version} · Effective {effectiveDate}
          </p>
          <nav
            aria-label="Legal documents"
            className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-b border-[#e8e8e8] pb-4 text-xs"
          >
            {RELATED.map(item => {
              const active = doc === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'font-semibold text-[#F37021]'
                      : 'text-herme-ink/55 hover:text-[#F37021]'
                  }
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
