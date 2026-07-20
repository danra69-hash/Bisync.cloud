import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { setAppLocale } from '../../i18n';
import { LANGUAGES, type AppLocale } from '../../i18n/languages';
import { useAppTranslation } from '../../i18n/useAppTranslation';

export function LanguageSelector() {
  const { t, i18n } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find(language => language.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  async function choose(code: AppLocale) {
    await setAppLocale(code);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="w-8 h-8 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 flex items-center justify-center text-base leading-none transition-colors"
        title={t('language.choose')}
        aria-label={t('language.label')}
      >
        <span aria-hidden>{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 min-w-[12rem] rounded-lg border border-border bg-card shadow-xl py-1.5">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('language.choose')}
          </p>
          {LANGUAGES.map(language => {
            const selected = language.code === current.code;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => void choose(language.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-muted/40 ${selected ? 'text-primary' : 'text-foreground'}`}
              >
                <span className="w-7 h-7 rounded-full border border-border bg-muted/30 flex items-center justify-center text-base shrink-0">
                  {language.flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{language.nativeName}</span>
                  <span className="block text-[10px] text-muted-foreground">{language.name}</span>
                </span>
                {selected ? <Check size={12} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
