// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/song-languages', () => ({
    song_language_translations: vi.fn(),
}));

vi.mock('../src/settings-store', () => ({
    updateSetting: vi.fn(),
}));

vi.mock('../src/component/notification', () => ({
    send_ui_notification: vi.fn(),
}));

describe('langpack', () => {
    let langpackMod: typeof import('../src/langpack');
    let songLanguagesMod: typeof import('../src/song-languages');
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        document.body.innerHTML = '';
        (globalThis as any).BUILD_TYPE = 'www';
        (globalThis as any).DEBUG = false;

        songLanguagesMod = await import('../src/song-languages');
        langpackMod = await import('../src/langpack');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('setLanguage', () => {
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

            await langpackMod.useAppLang.getState().setLanguage('en');

            expect(fetchMock).toHaveBeenCalledWith('langpack/en.json', expect.anything());
            expect(langpackMod.useAppLang.getState().appLang).toBe('en');

            expect(document.documentElement.getAttribute('dir')).toBe('ltr');
            expect(document.documentElement.getAttribute('lang')).toBe('en');
        });

        it('loads from injected script tag if available', async () => {
            const mockLangPack = { welcome: 'Injected Welcome', langpack_direction: 'ltr' };
            const script = document.createElement('script');
            script.id = 'json-langpack-fr';
            script.type = 'application/json';
            script.innerHTML = JSON.stringify(mockLangPack);
            document.body.appendChild(script);

            await langpackMod.useAppLang.getState().setLanguage('fr');

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

            await langpackMod.useAppLang.getState().setLanguage('es');

            expect(langpackMod.useAppLang.getState().appLang).toBe('en');
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock).toHaveBeenNthCalledWith(1, 'langpack/es.json', expect.anything());
            expect(fetchMock).toHaveBeenNthCalledWith(2, 'langpack/en.json', expect.anything());
        });
    });

    describe('get_translation', () => {
        it('returns translation if exists', async () => {
            fetchMock.mockResolvedValue({
                json: () => Promise.resolve({ welcome: 'Welcome', langpack_direction: 'ltr' }),
                ok: true,
            });
            await langpackMod.useAppLang.getState().setLanguage('en');

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
                json: () => Promise.resolve({ langpack_direction: 'ltr' }),
                ok: true,
            });
            await langpackMod.useAppLang.getState().setLanguage('en');

            expect(langpackMod.get_translation('lang.fr')).toBe('French');
        });
    });
});
