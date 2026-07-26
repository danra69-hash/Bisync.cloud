export const LOCALE_STORAGE_KEY = 'bisync.locale';
/** Flag: visitor explicitly picked a language (landing selector or register dropdown). */
export const LOCALE_MANUAL_KEY = 'bisync.localeManual';
/** Locale last chosen manually — kept separate from account/session sync. */
export const LOCALE_MANUAL_VALUE_KEY = 'bisync.localeManualValue';

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

/** True when the visitor explicitly chose a language (not geo / account sync). */
export function hasManualLocalePreference(): boolean {
  try {
    return localStorage.getItem(LOCALE_MANUAL_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Locale for public surfaces (landing). Always English unless the user
 * changed language manually via the language selector.
 */
export function readStoredLocale(): AppLocale {
  try {
    if (!hasManualLocalePreference()) return DEFAULT_LOCALE;
    const stored =
      localStorage.getItem(LOCALE_MANUAL_VALUE_KEY)
      ?? localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(code: AppLocale, options?: { manual?: boolean }) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
    if (options?.manual) {
      localStorage.setItem(LOCALE_MANUAL_KEY, '1');
      localStorage.setItem(LOCALE_MANUAL_VALUE_KEY, code);
    }
  } catch {
    // ignore storage failures
  }
}
