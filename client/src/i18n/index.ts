import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, getLanguage, readStoredLocale, storeLocale, type AppLocale } from './languages';
import { AUTH_REGISTER_I18N } from './authRegisterI18n';
import { en } from './locales/en';
import { ms } from './locales/ms';
import { id } from './locales/id';
import { zh } from './locales/zh';
import { th } from './locales/th';
import { ko } from './locales/ko';
import { ja } from './locales/ja';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { it } from './locales/it';

function withRegisterLocale<T extends { auth: Record<string, unknown> }>(locale: T, code: string): T {
  const patch = AUTH_REGISTER_I18N[code];
  if (!patch) return locale;
  return {
    ...locale,
    auth: {
      ...locale.auth,
      ...patch,
    },
  };
}

function applyDocumentLocale(code: AppLocale) {
  const language = getLanguage(code);
  document.documentElement.lang = language.htmlLang;
  document.documentElement.setAttribute('data-locale', code);
}

const initialLocale = readStoredLocale();
applyDocumentLocale(initialLocale);

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: withRegisterLocale(en, 'en') },
      ms: { translation: withRegisterLocale(ms, 'ms') },
      id: { translation: withRegisterLocale(id, 'id') },
      zh: { translation: withRegisterLocale(zh, 'zh') },
      th: { translation: withRegisterLocale(th, 'th') },
      ko: { translation: withRegisterLocale(ko, 'ko') },
      ja: { translation: withRegisterLocale(ja, 'ja') },
      fr: { translation: withRegisterLocale(fr, 'fr') },
      es: { translation: withRegisterLocale(es, 'es') },
      it: { translation: withRegisterLocale(it, 'it') },
    },
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export async function setAppLocale(code: AppLocale) {
  storeLocale(code);
  applyDocumentLocale(code);
  await i18n.changeLanguage(code);
}

export default i18n;
