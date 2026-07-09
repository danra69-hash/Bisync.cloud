export const LOCALE_STORAGE_KEY = 'bisync.locale';

export type AppLocale = 'en' | 'ms' | 'id' | 'zh' | 'th' | 'ko' | 'ja' | 'fr' | 'es' | 'it';

export type LanguageOption = {
  code: AppLocale;
  name: string;
  nativeName: string;
  flag: string;
  htmlLang: string;
};

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', htmlLang: 'en' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', htmlLang: 'ms' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', htmlLang: 'id' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', htmlLang: 'zh-CN' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', htmlLang: 'th' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', htmlLang: 'ko' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', htmlLang: 'ja' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', htmlLang: 'fr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', htmlLang: 'es' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', htmlLang: 'it' },
];

export const DEFAULT_LOCALE: AppLocale = 'en';

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return LANGUAGES.some(language => language.code === value);
}

export function getLanguage(code: AppLocale): LanguageOption {
  return LANGUAGES.find(language => language.code === code) ?? LANGUAGES[0];
}

export function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(code: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    // ignore storage failures
  }
}
