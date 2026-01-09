// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { OnlineDB } from '../src/db/online';

// Mock dependencies
vi.mock('../src/globals', () => ({
    API_HOST: 'https://example.com',
    DB_PATH: 'https://example.com/db',
    DUMP_VERSION: 1,
}));

vi.mock('../src/langdetect.es5', () => ({
    get_browser_languages: vi.fn(() => ['en-US', 'en']),
}));

vi.mock('../src/langpack', () => ({
    app_lang: () => 'en',
}));

vi.mock('../src/util', () => ({
    fetch_json: vi.fn(),
    generate_search_params: vi.fn((obj) =>
        Object.keys(obj)
            .map((k) => `${k}=${obj[k]}`)
            .join('&'),
    ),
}));

vi.mock('../src/db/common', () => ({
    CommonDB: class CommonDB {
        _type = 'base';
        _instant_total_query = false;
        async _initialize_db() {}
        async _populate_db() {}
        async _search_meta() {}
        async get_song() {}
        async _get_total() {}
        async _run_search() {}
        async _get_songs() {}
        async get_song_sources() {}
    },
    get_db_chosen_langs: vi.fn(() => ['en', 'es']),
}));

vi.mock('../src/persistent-storage.es5', () => ({
    persistentStorage: {
        getObj: vi.fn(),
        setObj: vi.fn(),
    },
}));

describe('OnlineDB', function () {
    let db: OnlineDB;
    let fetch_json: Mock<typeof import('../src/util').fetch_json>;
    let getObjMock: Mock;
    let setObjMock: Mock;

    beforeEach(async function () {
        const util = await import('../src/util');
        const storage = await import('../src/persistent-storage.es5');
        fetch_json = util.fetch_json as Mock<typeof import('../src/util').fetch_json>;
        getObjMock = storage.persistentStorage.getObj as Mock;
        setObjMock = storage.persistentStorage.setObj as Mock;
        db = new OnlineDB(null as any);
        vi.clearAllMocks();
    });

    describe('constructor and basic properties', function () {
        it('sets correct type', function () {
            expect(db._type).toBe('online');
        });

        it('enables instant total query', function () {
            expect(db._instant_total_query).toBe(true);
        });
    });

    describe('api_url', function () {
        it('constructs basic API URL', function () {
            const url = db.api_url('test', undefined);
            expect(url).toBe('https://example.com/api/test');
        });

        it('adds query parameters', function () {
            const url = db.api_url('search', { query: 'test', lang: 'en' });
            expect(url).toContain('https://example.com/api/search?');
            expect(url).toContain('query=test');
            expect(url).toContain('lang=en');
        });
    });

    describe('get_version_string', function () {
        it('returns online db identifier', function () {
            expect(db.get_version_string()).toBe('online db');
        });
    });

    describe('ideal_debounce', function () {
        it('returns 750ms debounce', function () {
            expect(db.ideal_debounce()).toBe(750);
        });
    });

    describe('_initialize_db', function () {
        it('resolves immediately', async function () {
            await expect(db._initialize_db()).resolves.toBeUndefined();
        });
    });

    describe('_populate_db', function () {
        it('resolves immediately', async function () {
            await expect(db._populate_db()).resolves.toBeUndefined();
        });
    });

    describe('_get_lang_details', function () {
        it('returns UI lang and browser langs', function () {
            const details = db._get_lang_details();
            expect(details).toEqual({
                ui_lang: 'en',
                browser_langs: 'en-US,en',
            });
        });
    });

    describe('_search_meta', function () {
        it('calls API with search params', async function () {
            fetch_json.mockResolvedValue({ results: [] });

            await db._search_meta({ search: 'grace', lang: 'en', advanced_tags: {}, order_by: '' });

            expect(fetch_json).toHaveBeenCalledWith(expect.stringContaining('/api/app/search_meta'));
            expect(fetch_json.mock.calls[0][0]).toContain('query=grace');
            expect(fetch_json.mock.calls[0][0]).toContain('lang=en');
        });
    });

    describe('get_song', function () {
        it('fetches song by id', async function () {
            const mockSong = { id: 123, title: 'Amazing Grace' };
            fetch_json.mockResolvedValue({ data: mockSong });

            const result = await db.get_song(123, false, false);

            expect(result).toEqual(mockSong);
            expect(fetch_json).toHaveBeenCalled();
        });

        it('returns null when song not found', async function () {
            fetch_json.mockResolvedValue({ data: [] });

            const result = await db.get_song(999, false, false);

            expect(result).toBeNull();
        });

        it('includes dump version when requested', async function () {
            fetch_json.mockResolvedValue({ data: { id: 123 } });

            await db.get_song(123, false, true);

            expect(fetch_json.mock.calls[0][0]).toContain('include_dump=1');
        });

        it('includes albums and sources when not requesting dump', async function () {
            fetch_json.mockResolvedValue({ data: { id: 123 } });

            await db.get_song(123, false, false);

            expect(fetch_json.mock.calls[0][0]).toContain('with_albums=1');
            expect(fetch_json.mock.calls[0][0]).toContain('with_sources=1');
        });
    });

    describe('_prepare_query', function () {
        it('prepares basic query', function () {
            const filters = { search: 'grace', lang: 'en', advanced_tags: {}, order_by: '' };
            const query = db._prepare_query(filters);

            expect(query.query).toBe('grace');
            expect(query.ui_lang).toBe('en');
            expect(query.browser_langs).toBe('en-US,en');
        });

        it('handles order_by parameter', function () {
            const filters = { search: 'test', order_by: 'title ASC', advanced_tags: {} };
            const query = db._prepare_query(filters);

            expect(query.sort).toBe('title');
            expect(query.dir).toBe('ASC');
        });

        it('uses chosen langs when lang not specified', function () {
            const filters = { search: 'test', advanced_tags: {}, order_by: '' };
            const query = db._prepare_query(filters);

            const parsedFilters = JSON.parse(query.filters!);
            expect(parsedFilters.lang).toBe('en,es');
        });

        it('serializes remaining filters to JSON', function () {
            const filters = { search: 'test', source_id: '123', advanced_tags: {}, order_by: '' };
            const query = db._prepare_query(filters);

            const parsedFilters = JSON.parse(query.filters!);
            expect(parsedFilters.source_id).toBe('123');
        });
    });

    describe('_get_total', function () {
        it('fetches total count', async function () {
            fetch_json.mockResolvedValue({ total: 42 });

            const query = { query: 'test', filters: '{}', ui_lang: 'en', browser_langs: 'en-US,en' };
            const total = await db._get_total(query);

            expect(total).toBe(42);
            expect(fetch_json.mock.calls[0][0]).toContain('pager_only=1');
        });
    });

    describe('_run_search', function () {
        it('runs search with pagination', async function () {
            fetch_json.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });

            const query = { query: 'test', filters: '{}', ui_lang: 'en', browser_langs: 'en-US,en' };
            const pager = { start: 0, size: 10 };
            const result = await db._run_search(query, pager);

            expect(result.data).toHaveLength(2);
            expect(fetch_json.mock.calls[0][0]).toContain('start=0');
            expect(fetch_json.mock.calls[0][0]).toContain('limit=10');
        });

        it('converts single result to array', async function () {
            fetch_json.mockResolvedValue({ data: { id: 1 } });

            const result = await db._run_search({ query: '', filters: '{}', ui_lang: 'en', browser_langs: 'en-US,en' }, { start: 0, size: 10 });

            expect(Array.isArray(result.data)).toBe(true);
            expect(result.data).toHaveLength(1);
        });
    });

    describe('_get_songs', function () {
        it('fetches songs by ids', async function () {
            fetch_json.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });

            const songs = await db._get_songs([1, 2]);

            expect(songs).toHaveLength(2);
            expect(fetch_json).toHaveBeenCalledWith(expect.stringContaining('/api/grid'));
        });

        it('ensures result is always an array', async function () {
            fetch_json.mockResolvedValue({ data: { id: 1 } });

            const songs = await db._get_songs([1]);

            expect(Array.isArray(songs)).toBe(true);
        });
    });

    describe('get_song_sources', function () {
        it('fetches and caches song sources', async function () {
            const mockSources = {
                song_source_info: [
                    { id: 1, abbreviation: 'HYM', name: 'Hymnal' },
                    { id: 2, abbreviation: 'SB', name: 'Songbook' },
                ],
            };
            fetch_json.mockResolvedValue(mockSources);
            getObjMock.mockReturnValue(null);

            const sources = await db.get_song_sources();

            expect(sources).toHaveLength(2);
            expect(setObjMock).toHaveBeenCalledWith('sourcedb', mockSources);
        });

        it('uses cached sources if available and fresh', async function () {
            const cachedSources = {
                song_source_info: [{ id: 1, abbreviation: 'HYM', name: 'Hymnal' }],
            };
            getObjMock.mockImplementation((key) => {
                if (key === 'sourcedb') return cachedSources;
                if (key === 'sourcedb-ts') return Date.now();
                return null;
            });

            const sources = await db.get_song_sources();

            expect(sources).toHaveLength(1);
            expect(fetch_json).not.toHaveBeenCalled();
        });

        it('filters sources without abbreviation', async function () {
            const mockSources = {
                song_source_info: [
                    { id: 1, abbreviation: 'HYM', name: 'Hymnal' },
                    { id: 2, abbreviation: '', name: 'No Abbr' },
                    { id: 3, name: 'Missing Abbr' },
                ],
            };
            fetch_json.mockResolvedValue(mockSources);
            getObjMock.mockReturnValue(null);

            const sources = await db.get_song_sources();

            expect(sources).toHaveLength(1);
            expect(sources[0].abbreviation).toBe('HYM');
        });
    });
});
