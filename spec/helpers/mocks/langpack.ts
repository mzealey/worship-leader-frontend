import { vi } from 'vitest';

export function createLangpackMock() {
    const appLangStore = {
        appLang: 'en',
        setLanguage: vi.fn(),
    };
    return {
        useAppLang: Object.assign(() => appLangStore, {
            getState: () => appLangStore,
        }),
        useTranslation: () => ({
            t: (key: string) => key,
            lang_name: (code: string) => code,
            sorted_language_codes: (codes: string[]) => codes,
        }),
    };
}
