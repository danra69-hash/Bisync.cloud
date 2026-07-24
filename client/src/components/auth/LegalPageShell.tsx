import type { ReactNode } from 'react';
import { BrandEngineLockup } from '../layout/BrandEngineLockup';
import { BisyncMarkTile } from '../layout/BisyncMark';

type Props = {
  title: string;
  version: string;
  effectiveDate: string;
  children: ReactNode;
};

export function LegalPageShell({ title, version, effectiveDate, children }: Props) {
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
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
