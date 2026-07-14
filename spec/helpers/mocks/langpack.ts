import { vi } from 'vitest';

export function createLangpackMock() {
    return {
        useAppLang: () => ({ appLang: 'en', setLanguage: vi.fn() }),
        useTranslation: () => ({
            t: (key: string) => key,
            lang_name: (code: string) => code,
            sorted_language_codes: (codes: string[]) => codes,
        }),
    };
}
