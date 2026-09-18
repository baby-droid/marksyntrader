export default function useTranslations(): {
    ready: boolean;
    localize: (tString: string, values?: Record<string, unknown>) => string;
    instance: import('i18next').i18n;
    switchLanguage: (lang: string) => void;
    currentLang: string;
};
