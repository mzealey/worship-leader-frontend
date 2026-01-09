import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { persistentStorage } from '../src/persistent-storage.es5';

vi.mock('../src/song-languages', () => ({
    refresh_song_languages: vi.fn(),
    get_default_db_languages: vi.fn(() => ['en']),
}));

vi.mock('../src/db/common', () => ({
    get_db_chosen_langs: vi.fn((def: string[]) => def),
}));

vi.mock('../src/globals', () => ({
    get_uuid: vi.fn(() => 'test-uuid'),
    get_client_type: vi.fn(() => 'www'),
    API_HOST: 'https://songs.worshipleaderapp.com',
    is_firsttime: false,
}));

vi.mock('../src/util', () => ({
    fetch_json: vi.fn(),
    generate_search_params: vi.fn((data: Record<string, unknown>) =>
        Object.entries(data)
            .map(([k, v]) => `${k}=${v}`)
            .join('&'),
    ),
}));

vi.mock('../src/unidecode', () => ({
    unidecode: vi.fn((str: string) => Promise.resolve(str.toLowerCase())),
}));

vi.mock('../src/error-catcher', () => ({
    send_error_report: vi.fn(),
}));

vi.mock('../src/db', () => {
    let resolveDbAvailable: (value: unknown) => void;
    let rejectDbAvailable: (reason?: unknown) => void;
    const dbAvailablePromise = new Promise((resolve, reject) => {
        resolveDbAvailable = resolve;
        rejectDbAvailable = reject;
    });

    return {
        DB_AVAILABLE: dbAvailablePromise,
        __resolveDbAvailable: (val: unknown) => resolveDbAvailable(val),
        __rejectDbAvailable: (err: unknown) => rejectDbAvailable(err),
    };
});

import { getDbLangs } from '../src/db-language-utils';
import { get_db_chosen_langs } from '../src/db/common';
import { refresh_song_languages } from '../src/song-languages';
import { fetch_json } from '../src/util';

describe('getDbLangs', () => {
    const mockLangName = (code: string) => {
        const names: Record<string, string> = {
            en: 'English',
            fr: 'French',
            de: 'German',
            es: 'Spanish',
            ru: 'Russian',
        };
        return names[code] || code;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        persistentStorage.clear();

        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('successful path', () => {
        it('returns language entries when all promises resolve', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
                fr: { count: 500 },
            });
            (fetch_json as Mock).mockResolvedValue({ languages: ['en', 'fr'] });

            const result = await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            expect(result).toBeDefined();
            expect(result).toHaveLength(2);

            const enLang = result!.find((l) => l.code === 'en');
            expect(enLang).toBeDefined();
            expect(enLang!.count).toBe(1000);
            expect(enLang!.unidecoded).toBe('english');
        });

        it('marks languages as selected when they match loaded_langs', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
                fr: { count: 500 },
            });
            (get_db_chosen_langs as Mock).mockReturnValue(['en']);
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            const result = await getDbLangs({ alreadySetup: true, lang_name: mockLangName });

            const enLang = result!.find((l) => l.code === 'en');
            const frLang = result!.find((l) => l.code === 'fr');

            expect(enLang!.selected).toBe(true);
            expect(frLang!.selected).toBe(false);
        });

        it('marks languages as top position when in preferred_langs', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
                fr: { count: 500 },
                de: { count: 300 },
            });
            (get_db_chosen_langs as Mock).mockReturnValue([]);
            (fetch_json as Mock).mockResolvedValue({ languages: ['fr'] });

            const result = await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            const enLang = result!.find((l) => l.code === 'en');
            const frLang = result!.find((l) => l.code === 'fr');
            const deLang = result!.find((l) => l.code === 'de');

            expect(frLang!.position).toBe('top');
            expect(enLang!.position).toBe('bottom');
            expect(deLang!.position).toBe('bottom');
        });

        it('marks selected languages as top position', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
                de: { count: 300 },
            });
            (get_db_chosen_langs as Mock).mockReturnValue(['de']);
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            const result = await getDbLangs({ alreadySetup: true, lang_name: mockLangName });

            const deLang = result!.find((l) => l.code === 'de');
            expect(deLang!.position).toBe('top');
            expect(deLang!.selected).toBe(true);
        });

        it('uses lang_name function to get language display names', async () => {
            const customLangName = vi.fn((code: string) => `Language-${code.toUpperCase()}`);
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 100 },
            });
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            await getDbLangs({ alreadySetup: false, lang_name: customLangName });

            expect(customLangName).toHaveBeenCalledWith('en');
        });
    });

    describe('API timeout handling', () => {
        it('uses defaults when fetch_json times out after 4 seconds', async () => {
            vi.useFakeTimers();

            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
            });

            const neverResolves = new Promise(() => {});
            (fetch_json as Mock).mockReturnValue(neverResolves);

            const resultPromise = getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            await vi.advanceTimersByTimeAsync(4001);

            const result = await resultPromise;

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
        });

        it('uses defaults when fetch_json rejects', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
                fr: { count: 500 },
            });
            (fetch_json as Mock).mockRejectedValue(new Error('Network error'));

            const result = await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            expect(result).toBeDefined();
            expect(result).toHaveLength(2);
        });

        it('handles missing languages field in API response', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
            });
            (fetch_json as Mock).mockResolvedValue({});

            const result = await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            expect(result).toBeDefined();
        });
    });

    describe('offline handling', () => {
        it('returns undefined when offline and no languages available', async () => {
            Object.defineProperty(navigator, 'onLine', {
                value: false,
                writable: true,
                configurable: true,
            });

            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
            });

            const dbMock = { populate_db: vi.fn().mockResolvedValue(undefined) };
            const dbModule = await import('../src/db');
            (dbModule as any).__resolveDbAvailable(dbMock);

            const result = await getDbLangs({ alreadySetup: true, lang_name: mockLangName });

            expect(result).toBeUndefined();
        });
    });

    describe('empty languages handling', () => {
        it('returns undefined when refresh_song_languages returns empty object', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({});

            const dbMock = { populate_db: vi.fn().mockResolvedValue(undefined) };
            const dbModule = await import('../src/db');
            (dbModule as any).__resolveDbAvailable(dbMock);

            const result = await getDbLangs({ alreadySetup: true, lang_name: mockLangName });

            expect(result).toBeUndefined();
        });
    });

    describe('alreadySetup parameter', () => {
        it('passes cur_db=1 when alreadySetup is true', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
            });
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            await getDbLangs({ alreadySetup: true, lang_name: mockLangName });

            expect(fetch_json).toHaveBeenCalled();
            const callArg = (fetch_json as Mock).mock.calls[0][0];
            expect(callArg).toContain('cur_db=1');
        });

        it('passes cur_db=0 when alreadySetup is false', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
            });
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            expect(fetch_json).toHaveBeenCalled();
            const callArg = (fetch_json as Mock).mock.calls[0][0];
            expect(callArg).toContain('cur_db=0');
        });
    });

    describe('DbLangEntry structure', () => {
        it('creates entries with all required fields', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                es: { count: 750 },
            });
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            const result = await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            expect(result).toHaveLength(1);
            const entry = result![0];

            expect(entry).toHaveProperty('code', 'es');
            expect(entry).toHaveProperty('position');
            expect(entry).toHaveProperty('selected');
            expect(entry).toHaveProperty('count', 750);
            expect(entry).toHaveProperty('unidecoded');
        });

        it('initializes entries with position=bottom and selected=false by default', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                ru: { count: 200 },
            });
            (get_db_chosen_langs as Mock).mockReturnValue([]);
            (fetch_json as Mock).mockResolvedValue({ languages: [] });

            const result = await getDbLangs({ alreadySetup: false, lang_name: mockLangName });

            const ruLang = result![0];
            expect(ruLang.position).toBe('bottom');
            expect(ruLang.selected).toBe(false);
        });
    });

    describe('multiple languages', () => {
        it('handles many languages correctly', async () => {
            (refresh_song_languages as Mock).mockResolvedValue({
                en: { count: 1000 },
                fr: { count: 500 },
                de: { count: 300 },
                es: { count: 750 },
                ru: { count: 200 },
            });
            (get_db_chosen_langs as Mock).mockReturnValue(['en', 'es']);
            (fetch_json as Mock).mockResolvedValue({ languages: ['fr', 'de'] });

            const result = await getDbLangs({ alreadySetup: true, lang_name: mockLangName });

            expect(result).toHaveLength(5);

            const enLang = result!.find((l) => l.code === 'en');
            const frLang = result!.find((l) => l.code === 'fr');
            const deLang = result!.find((l) => l.code === 'de');
            const esLang = result!.find((l) => l.code === 'es');
            const ruLang = result!.find((l) => l.code === 'ru');

            expect(enLang!.selected).toBe(true);
            expect(enLang!.position).toBe('top');

            expect(esLang!.selected).toBe(true);
            expect(esLang!.position).toBe('top');

            expect(frLang!.selected).toBe(false);
            expect(frLang!.position).toBe('top');

            expect(deLang!.selected).toBe(false);
            expect(deLang!.position).toBe('top');

            expect(ruLang!.selected).toBe(false);
            expect(ruLang!.position).toBe('bottom');
        });
    });
});
