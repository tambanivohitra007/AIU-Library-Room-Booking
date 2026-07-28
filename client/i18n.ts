import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import th from './locales/th.json';

const saved =
  typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    th: { translation: th },
  },
  lng: saved === 'th' ? 'th' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export type AppLanguage = 'en' | 'th';

export const setLanguage = (lang: AppLanguage) => {
  localStorage.setItem('lang', lang);
  i18n.changeLanguage(lang);
};

// Locale for date formatting. Thai forced to the Gregorian calendar so years
// match the stored dates (default th-TH would render Buddhist Era, +543).
export const dateLocale = (): string =>
  i18n.language === 'th' ? 'th-TH-u-ca-gregory' : 'en-US';

export default i18n;
