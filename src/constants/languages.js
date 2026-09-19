import { useTranslation } from 'react-i18next';

export const LANGUAGES = [
    { code: 'en', nativeName: 'English', flag: '🇬🇧' },
    { code: 'fr', nativeName: 'Français', flag: '🇫🇷' },
];

// Used as fallback when the browser language is not one we support.
export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export const getLanguage = (code) =>
    LANGUAGES.find((language) => language.code === code) ??
    LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE);

export const useLocalized = () => {
    const { i18n } = useTranslation();
    return (value) => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return value[i18n.language] ?? value[DEFAULT_LANGUAGE] ?? '';
    };
};
