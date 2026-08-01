import { vi } from 'vitest';
import enTranslations from '../../../langpack/en.json';

export function createLangpackMock() {
    const appLangStore = {
        appLang: 'en',
        setLanguage: vi.fn(),
    };

    const t = (key: string): string => {
        const parts = key.split('.');
        if (parts.length === 2) {
            const parent = (enTranslations as Record<string, unknown>)[parts[0]];
            return (parent && typeof parent === 'object' ? (parent as Record<string, string>)[parts[1]] : undefined) ?? key;
        }
        return (enTranslations as unknown as Record<string, string>)[key] ?? key;
    };

    return {
        useAppLang: Object.assign(() => appLangStore, {
            getState: () => appLangStore,
        }),
        useTranslation: () => ({
            t,
            lang_name: (code: string) => code,
            sorted_language_codes: (codes: string[]) => codes,
        }),
    };
}
