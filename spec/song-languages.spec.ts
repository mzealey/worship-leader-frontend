// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistentStorage } from '../src/persistent-storage.es5';

vi.mock('../src/langdetect.es5', () => ({
    get_app_languages: vi.fn(),
}));
vi.mock('../src/globals', () => ({
    get_db_path: vi.fn().mockReturnValue('db/'),
}));

describe('song-languages', () => {
    let songLanguagesMod: typeof import('../src/song-languages');
    let getAppLanguagesMock: any;
    let fetchMock: any;

    beforeEach(async () => {
        vi.resetModules();

        persistentStorage.clear();

        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const ld = await import('../src/langdetect.es5');
        getAppLanguagesMock = ld.get_app_languages;

        songLanguagesMod = await import('../src/song-languages');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('refresh_song_languages', () => {
        it('fetches from server and caches', async () => {
            const mockData = { en: { count: 10, name: {} } };
            fetchMock.mockResolvedValue({
                json: () => Promise.resolve(mockData),
                ok: true,
            });

            const result = await songLanguagesMod.refresh_song_languages();

            expect(fetchMock).toHaveBeenCalledWith('db/.index.json', expect.anything());
            expect(result).toEqual(mockData);

            expect(persistentStorage.getObj('song-languages')).toEqual(mockData);
        });
    });

    describe('load_song_languages', () => {
        it('loads from persistentStorage on first call', async () => {
            const mockData = { fr: { count: 5 } };
            persistentStorage.setObj('song-languages', mockData);

            const result = songLanguagesMod.load_song_languages(true);

            expect(result).toEqual(mockData);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('returns promise if no_wait is false (or undefined)', async () => {
            const mockData = { fr: { count: 5 } };
            persistentStorage.setObj('song-languages', mockData);

            const result = await songLanguagesMod.load_song_languages();
            expect(result).toEqual(mockData);
        });

        it('refreshes if storage is empty', async () => {
            const mockData = { de: { count: 1 } };
            fetchMock.mockResolvedValue({
                json: () => Promise.resolve(mockData),
                ok: true,
            });

            const result = await songLanguagesMod.load_song_languages();
            expect(fetchMock).toHaveBeenCalled();
            expect(result).toEqual(mockData);
        });
    });

    describe('get_default_db_languages', () => {
        it('filters available languages', async () => {
            persistentStorage.setObj('song-languages', {
                en: { count: 1 },
                fr: { count: 1 },
            });
            getAppLanguagesMock.mockReturnValue(['fr', 'es', 'en']);

            const defaults = songLanguagesMod.get_default_db_languages();
            expect(defaults).toEqual(['fr', 'en']);
        });

        it('defaults to en if nothing loaded', () => {
            getAppLanguagesMock.mockReturnValue(['es']);

            const defaults = songLanguagesMod.get_default_db_languages();
            expect(defaults).toEqual([]);
        });

        it('defaults to en if user matches en fallback', () => {
            getAppLanguagesMock.mockReturnValue(['en']);

            const defaults = songLanguagesMod.get_default_db_languages();
            expect(defaults).toEqual(['en']);
        });
    });
});
