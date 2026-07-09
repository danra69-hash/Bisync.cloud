import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, getLanguage, readStoredLocale, storeLocale, type AppLocale } from './languages';
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
      en: { translation: en },
      ms: { translation: ms },
      id: { translation: id },
      zh: { translation: zh },
      th: { translation: th },
      ko: { translation: ko },
      ja: { translation: ja },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: it },
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
