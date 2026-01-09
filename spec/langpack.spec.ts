// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Remove mock for src/util
// We keep song-languages and jqm-util mocks
vi.mock('../src/song-languages', () => ({
    song_language_translations: vi.fn(),
}));

vi.mock('../src/jqm-util', () => ({
    refresh_selectmenu: vi.fn(),
}));

describe('langpack', () => {
    let langpackMod: typeof import('../src/langpack');
    let songLanguagesMod: typeof import('../src/song-languages');
    let mockJQuery: any;
    let mockJQueryObj: any;
    let fetchMock: any;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        mockJQueryObj = {
            attr: vi.fn(),
            find: vi.fn().mockReturnThis(),
            each: vi.fn(),
            html: vi.fn(),
            is: vi.fn(),
            parent: vi.fn(),
            text: vi.fn(),
            sort: vi.fn().mockReturnThis(),
            appendTo: vi.fn(),
        };
        mockJQuery = vi.fn(() => mockJQueryObj);
        (window as any).$ = mockJQuery;

        document.body.innerHTML = '';

        songLanguagesMod = await import('../src/song-languages');
        langpackMod = await import('../src/langpack');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('lang_setup', () => {
        it('fetches language pack and sets app language', async () => {
            const mockLangPack = {
                langpack_direction: 'ltr',
                welcome: 'Welcome',
                language_names: { en: 'English' },
            };
            fetchMock.mockResolvedValue({
                json: () => Promise.resolve(mockLangPack),
                ok: true,
            });

            const lang = await langpackMod.lang_setup('en');

            expect(lang).toBe('en');
            expect(fetchMock).toHaveBeenCalledWith('langpack/en.json', expect.anything());
            expect(langpackMod.app_lang()).toBe('en');

            expect(mockJQuery).toHaveBeenCalledWith('html, body');
            expect(mockJQueryObj.attr).toHaveBeenCalledWith({ dir: 'ltr', lang: 'en' });
        });

        it('loads from injected script tag if available', async () => {
            const mockLangPack = { welcome: 'Injected Welcome', langpack_direction: 'ltr' };
            const script = document.createElement('script');
            script.id = 'json-langpack-fr';
            script.type = 'application/json';
            script.innerHTML = JSON.stringify(mockLangPack);
            document.body.appendChild(script);

            const lang = await langpackMod.lang_setup('fr');

            expect(lang).toBe('fr');
            expect(fetchMock).not.toHaveBeenCalled();
            expect(langpackMod.get_translation('welcome')).toBe('Injected Welcome');
        });

        it('fallbacks to en if fetch fails', async () => {
            // First call fails
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            // Second call succeeds
            fetchMock.mockResolvedValueOnce({
                json: () => Promise.resolve({ langpack_direction: 'ltr', ok: 'ok' }),
                ok: true,
            });

            const lang = await langpackMod.lang_setup('es');

            expect(lang).toBe('en');
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock).toHaveBeenNthCalledWith(1, 'langpack/es.json', expect.anything());
            expect(fetchMock).toHaveBeenNthCalledWith(2, 'langpack/en.json', expect.anything());
        });
    });

    describe('get_translation', () => {
        it('returns translation if exists', async () => {
            fetchMock.mockResolvedValue({
                json: () => Promise.resolve({ welcome: 'Welcome' }),
                ok: true,
            });
            await langpackMod.lang_setup('en');

            expect(langpackMod.get_translation('welcome')).toBe('Welcome');
        });

        it('returns empty string if not found', () => {
            expect(langpackMod.get_translation('non_existent')).toBe('');
        });

        it('handles lang. prefix by calling lang_name', async () => {
            vi.mocked(songLanguagesMod.song_language_translations).mockReturnValue({
                fr: { name: { en: 'French' }, count: 1 },
            });

            fetchMock.mockResolvedValue({
                json: () => Promise.resolve({}),
                ok: true,
            });
            await langpackMod.lang_setup('en');

            expect(langpackMod.get_translation('lang.fr')).toBe('French');
        });
    });

    describe('relocalize_page', () => {
        it('localizes elements with data attributes', () => {
            const mockElements = [
                {
                    attr: vi.fn(),
                    html: vi.fn(),
                    is: vi.fn().mockReturnValue(false),
                    find: vi.fn().mockReturnThis(),
                    text: vi.fn(),
                    appendTo: vi.fn(),
                    sort: vi.fn().mockReturnThis(),
                },
            ];

            mockJQueryObj.find.mockImplementation((_selector) => {
                return {
                    each: (cb) => {
                        mockElements.forEach((el, i) => cb(i, el));
                    },
                } as any;
            });

            mockJQuery.mockImplementation((e) => {
                if (e === 'html, body') return mockJQueryObj;
                if (mockElements.includes(e as any)) return e;
                return mockJQueryObj;
            });

            langpackMod.relocalize_page(mockJQueryObj as any);

            expect(mockJQueryObj.find).toHaveBeenCalledWith('[data-title-localize]');
            expect(mockJQueryObj.find).toHaveBeenCalledWith('[data-placeholder-localize]');
            expect(mockJQueryObj.find).toHaveBeenCalledWith('[data-localize]');
        });
    });
});
