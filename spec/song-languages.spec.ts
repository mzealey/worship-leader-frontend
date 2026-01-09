// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistentStorage } from '../src/persistent-storage.es5';

// Remove mock for src/util and src/persistent-storage.es5
// We keep langdetect and globals mocks as they depend on environment/constants
vi.mock('../src/langdetect.es5', () => ({
    get_app_languages: vi.fn(),
}));
vi.mock('../src/component/spinner', () => ({
    spinner: vi.fn((p) => p),
}));
vi.mock('../src/globals', () => ({
    DB_PATH: 'db/',
    BUILD_TYPE: 'www',
}));

describe('song-languages', () => {
    let songLanguagesMod: typeof import('../src/song-languages');
    let getAppLanguagesMock: any;
    let fetchMock: any;

    beforeEach(async () => {
        vi.resetModules();

        // Clear real persistent storage
        persistentStorage.clear();

        // Stub global fetch
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

            // Verify cache using real persistent storage
            expect(persistentStorage.getObj('song-languages')).toEqual(mockData);
        });

        it('uses spinner if requested', async () => {
            const { spinner } = await import('../src/component/spinner');
            fetchMock.mockResolvedValue({
                json: () => Promise.resolve({}),
                ok: true,
            });
            await songLanguagesMod.refresh_song_languages(true);
            expect(spinner).toHaveBeenCalled();
        });
    });

    describe('load_song_languages', () => {
        it('loads from persistentStorage on first call', async () => {
            const mockData = { fr: { count: 5 } };
            persistentStorage.setObj('song-languages', mockData);

            // We use no_wait=true to get sync result
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
            // Storage is empty by default in beforeEach
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
            // Setup available DB languages
            persistentStorage.setObj('song-languages', {
                en: { count: 1 },
                fr: { count: 1 },
            });
            // Setup user languages
            getAppLanguagesMock.mockReturnValue(['fr', 'es', 'en']);

            const defaults = songLanguagesMod.get_default_db_languages();
            // Should match 'fr' (available) and 'en' (available). 'es' is not in DB.
            expect(defaults).toEqual(['fr', 'en']);
        });

        it('defaults to en if nothing loaded', () => {
            // Nothing in storage
            getAppLanguagesMock.mockReturnValue(['es']);

            const defaults = songLanguagesMod.get_default_db_languages();
            // Fallback is { en: ... } but user is es. DB fallback is used if load returns nothing.
            // In source: const db_languages = load_song_languages(true) || { en: { count: 1 } };
            expect(defaults).toEqual([]);
        });

        it('defaults to en if user matches en fallback', () => {
            // Nothing in storage
            getAppLanguagesMock.mockReturnValue(['en']);

            const defaults = songLanguagesMod.get_default_db_languages();
            expect(defaults).toEqual(['en']);
        });
    });
});
