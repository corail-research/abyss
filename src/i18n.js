import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGE_CODES } from './constants/languages.js';

i18n
    .use(Backend)
    // Detect user language
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: DEFAULT_LANGUAGE,
        supportedLngs: SUPPORTED_LANGUAGE_CODES,
        // Collapse regional variants onto the base language, so a browser
        // reporting fr-CA or fr-FR resolves to our `fr` bundle.
        load: 'languageOnly',
        debug: import.meta.env.DEV,
        ns: ['common'],
        defaultNS: 'common',
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        },
        detection: {
            // `navigator` is what makes a francophone browser land on French
            // automatically; everything before it is an explicit user choice.
            order: ['querystring', 'cookie', 'localStorage', 'navigator'],
            caches: ['localStorage', 'cookie'],
        },
    });

// Keep <html lang> in sync so screen readers and browser translation
// prompts see the language actually being displayed.
// Always read `resolvedLanguage` rather than the event payload: the latter is
// the raw detected code (en-US), not the bundle we actually render (en).
const syncDocumentLanguage = () => {
    document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LANGUAGE;
};

// `initialized` covers the first paint, since init() resolves asynchronously.
i18n.on('initialized', syncDocumentLanguage);
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
