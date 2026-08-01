import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let UILanguageChooser: typeof import('../../src/component/uilanguagechooser').UILanguageChooser;

describe('UILanguageChooser', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', () => ({
            ...createLangpackMock(),
            useAppLang: () => {
                const store = {
                    appLang: 'en',
                    setLanguage: vi.fn().mockImplementation(async (lang: string) => {
                        store.appLang = lang;
                        return lang;
                    }),
                };
                return store;
            },
        }));

        vi.doMock('../../src/sort-helpers', () => ({
            LOCALE_SORT: vi.fn((a: string, b: string) => a.localeCompare(b)),
        }));

        vi.doMock('../../src/util', () => ({
            is_rtl: vi.fn((name: string) => name === 'Arabic' || name === 'Hebrew'),
        }));

        const mod = await import('../../src/component/uilanguagechooser');
        UILanguageChooser = mod.UILanguageChooser;
    });

    it('renders a language select dropdown', () => {
        renderWithProviders(<UILanguageChooser />);

        const select = document.querySelector('select');
        expect(select).toBeInTheDocument();
    });

    it('contains language options', () => {
        renderWithProviders(<UILanguageChooser />);

        const options = document.querySelectorAll('option');
        expect(options.length).toBeGreaterThan(0);
    });

    it('has en as current value', () => {
        renderWithProviders(<UILanguageChooser />);

        const select = document.querySelector('select');
        expect(select?.value).toBe('en');
    });
});
