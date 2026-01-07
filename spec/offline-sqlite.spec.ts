import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineSQLiteDB, type BindParams, type ExecFunction } from '../src/db/offline-sqlite';
import { persistentStorage } from '../src/persistent-storage.es5';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const EN_SONG_COUNT = 3394;
const TR_SONG_COUNT = 3050;
const EN_SONGS_WITH_CHORDS = 1433;
const EN_ORIGINAL_SONGS = 3253;
const EN_SONGS_IN_KEY_C = 252;

const SONG_1471 = {
    id: 1471,
    title: 'Silent Night',
    lang: 'en',
    songkey: 'A',
    has_chord: 1,
    is_original: 0,
    sources: [{ id: 42, name: 'Open Hymnal', abbreviation: 'OH' }],
    tags: [3, 9, 53, 61, 87, 5, 129],
};

const SONG_1472 = {
    id: 1472,
    title: 'Angels We Have Heard On High',
    lang: 'en',
    songkey: 'F',
    has_chord: 1,
    is_original: 1,
    sources: [
        { id: 42, name: 'Open Hymnal', abbreviation: 'OH' },
        { id: 108, name: 'OpenSong: Zagraniczne', abbreviation: null },
        { id: 110, name: 'Holychords', abbreviation: null, number: 2901 },
    ],
    tags: [3, 9, 19, 51, 60, 87, 5, 128],
};

const SONG_6337 = {
    id: 6337,
    title: 'Alive, Alive, Alive Forevermore',
    lang: 'en',
    songkey: 'G',
    has_chord: 1,
    is_original: 1,
    tags: [2, 6, 7, 18, 19, 55, 61],
};

async function loadFixture(filename: string): Promise<any> {
    const filePath = path.join(FIXTURES_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

function createFetchMock() {
    return vi.fn(async (url: string) => {
        const match = url.match(/([^/]+)$/);
        if (!match) {
            throw new Error(`Invalid URL: ${url}`);
        }
        const filename = match[1];
        const data = await loadFixture(filename);
        return {
            json: () => Promise.resolve(data),
            ok: true,
            headers: { get: () => 100 },
            body: { getReader: () => ({ read: () => Promise.resolve({ done: true }) }) },
        };
    });
}

persistentStorage.setObj('chosen-languages', ['en', 'tr']);

vi.mock('../src/error-catcher', () => ({
    send_error_report: vi.fn(),
}));

vi.mock('../src/favourite-db', () => ({
    FAVOURITE_DB: {
        get_favourite: vi.fn().mockReturnValue(false),
    },
}));

class TestSQLiteDB extends OfflineSQLiteDB {
    db: Database.Database;

    constructor() {
        // @ts-expect-error - FavouriteDB interface mismatch in test
        super({ get_favourite: () => false });
        this.db = new Database(':memory:');
        this._offline_type = 'test';
        this._last_update_key = 'test_update';
        this.DB_VERSION = 49;
    }

    _should_try_fts(): boolean {
        return false;
    }

    async trans(callback: (exec: ExecFunction) => void | Promise<void>, _rw: boolean): Promise<void> {
        this.db.prepare('BEGIN').run();
        try {
            await callback(this._exec.bind(this));
            this.db.prepare('COMMIT').run();
        } catch (e) {
            this.db.prepare('ROLLBACK').run();
            throw e;
        }
    }

    _exec(...args: any[]) {
        if (typeof args[0] === 'string') {
            this.db.prepare(args[0]).run(args[1] || []);
        } else {
            for (const arg of args) {
                if (Array.isArray(arg)) {
                    this.db.prepare(arg[0]).run(arg[1] || []);
                }
            }
        }
    }

    async single_query<T>(cmd: string, vars?: BindParams, _rw?: boolean): Promise<T[]> {
        return this.db.prepare(cmd).all(vars || []) as T[];
    }

    async single_rw_query<T>(cmd: string, vars?: BindParams): Promise<T[]> {
        return this.single_query(cmd, vars, true);
    }

    async _supports_without_rowid(): Promise<boolean> {
        return true;
    }
}

describe('OfflineSQLiteDB', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete (window as any).ReadableStream;
        vi.stubGlobal('fetch', createFetchMock());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('initialization', () => {
        it('creates tables successfully', async () => {
            const testDB = new TestSQLiteDB();
            await testDB._recreate_db();

            const tables = await testDB.single_query("SELECT name FROM sqlite_master WHERE type='table'");
            const tableNames = tables.map((t: any) => t.name);

            expect(tableNames).toContain('songs');
            expect(tableNames).toContain('version');
            expect(tableNames).toContain('song_source');
            expect(tableNames).toContain('song_source_info');
            expect(tableNames).toContain('song_tags');
            expect(tableNames).toContain('albums');
            expect(tableNames).toContain('album_songs');
            expect(tableNames).toContain('usage_stat');
        });

        it('get_version_string returns correct format', async () => {
            const testDB = new TestSQLiteDB();
            await testDB._recreate_db();

            const versionString = testDB.get_version_string();
            expect(versionString).toContain('offline');
            expect(versionString).toContain('test');
            expect(versionString).toContain('49');
            expect(versionString).toContain('Without FTS');
        });

        it('full_type returns combined type', () => {
            const testDB = new TestSQLiteDB();
            expect(testDB.full_type()).toBe('offline-test');
        });

        it('type returns offline', () => {
            const testDB = new TestSQLiteDB();
            expect(testDB.type()).toBe('offline');
        });
    });

    describe('database recreation and kill', () => {
        it('kill_db drops tables', async () => {
            const testDB = new TestSQLiteDB();
            await testDB._recreate_db();

            await testDB.kill_db();

            const tables = await testDB.single_query("SELECT name FROM sqlite_master WHERE type='table' AND name='songs'");
            expect(tables.length).toBe(0);
        });

        it('_initialize_db recreates db when version mismatch', async () => {
            const testDB = new TestSQLiteDB();
            await testDB._recreate_db();

            testDB.db.prepare('UPDATE version SET version = 1').run();

            await testDB._initialize_db();

            const version = await testDB.single_query<{ version: number }>('SELECT version FROM version');
            expect(version[0].version).toBe(49);
        });
    });

    describe('language management', () => {
        let testDB: TestSQLiteDB;

        beforeEach(async () => {
            vi.stubGlobal('fetch', createFetchMock());
            testDB = new TestSQLiteDB();
            await testDB._recreate_db();
        });

        it('remove_languages removes songs for a language', async () => {
            await testDB.add_languages(['en']);
            const beforeCount = await testDB.single_query<{ count: number }>('SELECT COUNT(*) as count FROM songs');
            expect(beforeCount[0].count).toBe(EN_SONG_COUNT);

            await testDB.remove_languages(['en']);
            const afterCount = await testDB.single_query<{ count: number }>('SELECT COUNT(*) as count FROM songs');
            expect(afterCount[0].count).toBe(0);
        });

        it('list_loaded_langs returns empty array for empty db', async () => {
            const langs = await testDB.list_loaded_langs();
            expect(langs).toEqual([]);
        });

        it('has_any_songs returns false for empty db', async () => {
            const hasSongs = await testDB.has_any_songs();
            expect(hasSongs).toBe(false);
        });
    });

    describe('song operations with English data', () => {
        let testDB: TestSQLiteDB;

        beforeAll(async () => {
            vi.stubGlobal('fetch', createFetchMock());

            testDB = new TestSQLiteDB();
            await testDB._recreate_db();
            await testDB.add_languages(['dbmeta', 'en']);
        });

        it('get_song returns full song details with sources and tags', async () => {
            const song = await testDB.get_song(1471);
            expect(song!.id).toBe(SONG_1471.id);
            expect(song!.title).toBe(SONG_1471.title);
            expect(song!.lang).toBe(SONG_1471.lang);
            expect(song!.songkey).toBe(SONG_1471.songkey);
            expect(song!.has_chord).toBe(SONG_1471.has_chord);
            expect(song!.sources!.length).toBe(1);
            expect(song!.sources![0].id).toBe(SONG_1471.sources[0].id);
            expect(song!.sources![0].name).toBe(SONG_1471.sources[0].name);
            expect(song!.sources![0].abbreviation).toBe(SONG_1471.sources[0].abbreviation);
            expect(song!.tags!.slice().sort((a, b) => a - b)).toEqual(SONG_1471.tags.slice().sort((a, b) => a - b));
            expect(song!.albums).toEqual([]);
        });

        it('get_song returns song with multiple sources', async () => {
            const song = await testDB.get_song(1472);
            expect(song!.id).toBe(SONG_1472.id);
            expect(song!.title).toBe(SONG_1472.title);
            expect(song!.songkey).toBe(SONG_1472.songkey);
            expect(song!.sources!.length).toBe(3);
            expect(
                song!
                    .sources!.map((s) => s.id)
                    .slice()
                    .sort((a, b) => a - b),
            ).toEqual([42, 108, 110]);
            const holychordsSource = song!.sources!.find((s) => s.id === 110);
            expect(holychordsSource!.number).toBe(2901);
            expect(song!.tags!.slice().sort((a, b) => a - b)).toEqual(SONG_1472.tags.slice().sort((a, b) => a - b));
        });

        it('get_song returns song with chords and tags', async () => {
            const song = await testDB.get_song(6337);
            expect(song!.id).toBe(SONG_6337.id);
            expect(song!.title).toBe(SONG_6337.title);
            expect(song!.songkey).toBe(SONG_6337.songkey);
            expect(song!.has_chord).toBe(SONG_6337.has_chord);
            expect(song!.is_original).toBe(SONG_6337.is_original);
            expect(song!.sources).toEqual([]);
            expect(song!.tags!.slice().sort((a, b) => a - b)).toEqual(SONG_6337.tags.slice().sort((a, b) => a - b));
        });

        it('get_song returns null for non-existent song without fallback', async () => {
            const song = await testDB.get_song(999999999, false);
            expect(song).toBeNull();
        });

        it('get_song returns null for id 0', async () => {
            const song = await testDB.get_song(0);
            expect(song).toBeNull();
        });

        it('search finds songs by text', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: 'isa', order_by: 'default', advanced_tags: {} }), { start: 0, size: 10 });

            expect(result.data.length).toEqual(10);
            expect(result.data[0].title).toContain('Isa');
        });

        it('search by song number', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: '123', order_by: 'default', advanced_tags: {} }), { start: 0, size: 10 });
            expect(result.data).toBeDefined();
        });

        it('search by song ID format (i1471)', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: 'i1471', order_by: 'default', advanced_tags: {} }), { start: 0, size: 10 });
            expect(result.data.length).toBe(1);
            expect(result.data[0].id).toBe(1471);
            expect(result.data[0].title).toBe('Silent Night');
        });

        it('search by multiple song IDs', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: 'i1471, i1472', order_by: 'default', advanced_tags: {} }), {
                start: 0,
                size: 10,
            });
            expect(result.data.length).toBe(2);
            expect(result.data.map((s) => s.id).sort()).toEqual([1471, 1472]);
        });

        it('search with wildcard (*) finds Silent Night', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: 'sil*nt', order_by: 'default', advanced_tags: {} }), {
                start: 0,
                size: 10,
            });
            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.some((s) => s.title === 'Silent Night')).toBe(true);
        });

        it('search with single character wildcard (.) finds Silent Night', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: 'silen.', order_by: 'default', advanced_tags: {} }), {
                start: 0,
                size: 10,
            });
            expect(result.data.length).toBeGreaterThan(0);
            expect(result.data.some((s) => s.title === 'Silent Night')).toBe(true);
        });

        it('filtering by source', async () => {
            const sources = await testDB.single_query<any>('SELECT * FROM song_source_info LIMIT 1');
            if (sources.length > 0) {
                const sourceId = sources[0].id;
                const result = await testDB._run_search(
                    testDB._prepare_query({ search: '', source_id: String(sourceId), order_by: 'default', advanced_tags: {} }),
                    { start: 0, size: 10 },
                );
                expect(result.data).toBeDefined();
            }
        });

        it('filtering by language', async () => {
            const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, lang: 'en' });
            const total = await testDB._get_total(query);
            expect(total).toBe(EN_SONG_COUNT);
        });

        it('filtering by favourite', async () => {
            const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, favourite: 1 });
            const total = await testDB._get_total(query);
            expect(total).toBe(0);
        });

        it('filtering by has_chord', async () => {
            const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, has_chord: 1 });
            const total = await testDB._get_total(query);
            expect(total).toBe(EN_SONGS_WITH_CHORDS);
        });

        it('filtering by is_original', async () => {
            const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, is_original: 1 });
            const total = await testDB._get_total(query);
            expect(total).toBe(EN_ORIGINAL_SONGS);
        });

        it('filtering by songkey', async () => {
            const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, songkey: 'C' });
            const total = await testDB._get_total(query);
            expect(total).toBe(EN_SONGS_IN_KEY_C);
        });

        it('filtering with advanced_tags include', async () => {
            const tags = await testDB.single_query<{ tag_id: number }>('SELECT DISTINCT tag_id FROM song_tags LIMIT 1');
            if (tags.length > 0) {
                const tagId = tags[0].tag_id;
                const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: { [tagId]: 1 } });
                const total = await testDB._get_total(query);
                expect(total).toBeGreaterThan(0);
            }
        });

        it('filtering with advanced_tags exclude', async () => {
            const tags = await testDB.single_query<{ tag_id: number }>('SELECT DISTINCT tag_id FROM song_tags LIMIT 1');
            if (tags.length > 0) {
                const tagId = tags[0].tag_id;
                const queryWithTag = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: { [tagId]: 1 } });
                const totalWith = await testDB._get_total(queryWithTag);

                const queryWithoutTag = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: { [tagId]: 0 } });
                const totalWithout = await testDB._get_total(queryWithoutTag);

                expect(totalWith + totalWithout).toBe(EN_SONG_COUNT);
            }
        });

        it('order by sort_title ASC', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: '', order_by: 'sort_title ASC', advanced_tags: {} }), {
                start: 0,
                size: 10,
            });
            expect(result.data.length).toBe(10);
        });

        it('order by song_usage DESC', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: '', order_by: 'song_usage DESC', advanced_tags: {} }), {
                start: 0,
                size: 10,
            });
            expect(result.data.length).toBe(10);
        });

        it('order by song_ts DESC', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: '', order_by: 'song_ts DESC', advanced_tags: {} }), { start: 0, size: 10 });
            expect(result.data.length).toBe(10);
        });

        it('order by rating DESC', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: '', order_by: 'rating DESC', advanced_tags: {} }), { start: 0, size: 10 });
            expect(result.data.length).toBe(10);
        });

        it('order by song_source.number asc', async () => {
            const result = await testDB._run_search(testDB._prepare_query({ search: '', order_by: 'song_source.number asc', advanced_tags: {} }), {
                start: 0,
                size: 10,
            });
            expect(result.data.length).toBe(10);
        });

        it('_get_songs returns multiple songs with correct data', async () => {
            const songs = await testDB._get_songs([1471, 1472, 6337]);
            expect(songs.length).toBe(3);
            expect(songs.map((s) => s.id).sort()).toEqual([1471, 1472, 6337]);
            expect(songs.find((s) => s.id === 1471)!.title).toBe('Silent Night');
            expect(songs.find((s) => s.id === 1472)!.title).toBe('Angels We Have Heard On High');
            expect(songs.find((s) => s.id === 6337)!.title).toBe('Alive, Alive, Alive Forevermore');
        });

        it('_get_songs handles non-existent ids gracefully', async () => {
            const songs = await testDB._get_songs([1471, 999999999]);
            expect(songs.length).toBe(1);
        });

        it('search_meta_sources finds sources by abbreviation', async () => {
            const sources = await testDB.search_meta_sources('H', '');
            expect(sources).toBeDefined();
        });

        it('search_meta_sources finds sources by searchdata with 3+ chars', async () => {
            const sources = await testDB.search_meta_sources('Hym', '');
            expect(sources).toBeDefined();
        });

        it('search_meta_sources filters by language', async () => {
            const sources = await testDB.search_meta_sources('H', 'en');
            expect(sources).toBeDefined();
        });

        it('search_meta_albums finds albums', async () => {
            const albums = await testDB.search_meta_albums('wor', '');
            expect(albums).toBeDefined();
        });

        it('search_meta_albums filters by language', async () => {
            const albums = await testDB.search_meta_albums('wor', 'en');
            expect(albums).toBeDefined();
        });

        it('_search_meta returns both albums and sources', async () => {
            const result = await testDB._search_meta({ search: 'worship', lang: '', order_by: 'default', advanced_tags: {} });
            expect(result.albums).toBeDefined();
            expect(result.sources).toBeDefined();
        });

        it('_search_meta skips albums for short search', async () => {
            const result = await testDB._search_meta({ search: 'wo', lang: '', order_by: 'default', advanced_tags: {} });
            expect(result.albums).toEqual([]);
        });

        it('get_tag_counts returns tag statistics', async () => {
            const tagCounts = await testDB.get_tag_counts();
            expect(tagCounts).toBeDefined();
            expect(typeof tagCounts).toBe('object');
        });

        it('get_song_sources returns all sources for loaded languages', async () => {
            const sources = await testDB.get_song_sources();
            expect(sources).toBeDefined();
        });

        it('list_loaded_langs returns loaded languages', async () => {
            const langs = await testDB.list_loaded_langs();
            expect(langs).toContain('en');
        });

        it('has_any_songs returns true when songs exist', async () => {
            const hasSongs = await testDB.has_any_songs();
            expect(hasSongs).toBe(true);
        });

        it('set_favourite updates favourite status', async () => {
            await testDB.rw_trans((exec) => {
                exec('UPDATE songs SET favourite = ? WHERE id = ?', [1, 1471]);
            });
            const song = await testDB.single_query<{ favourite: number }>('SELECT favourite FROM songs WHERE id = 1471');
            expect(song[0].favourite).toBe(1);

            await testDB.rw_trans((exec) => {
                exec('UPDATE songs SET favourite = ? WHERE id = ?', [0, 1471]);
            });
            const song2 = await testDB.single_query<{ favourite: number }>('SELECT favourite FROM songs WHERE id = 1471');
            expect(song2[0].favourite).toBe(0);
        });

        it('add_song adds a new song', async () => {
            const newSong = {
                id: 999888,
                lang: 'en',
                title: 'Test Song',
                source_title: 'Test Source',
                songxml: '<verse>Test</verse>',
                songkey: 'C',
                capo: 0,
                alternative_titles: [],
                related_songs: [],
                info: [],
                files: [],
                song_usage: 100,
                rating: 5,
                real_song_usage: 50,
                song_ts: Date.now(),
                search_title: 'test song',
                search_text: 'test',
                search_meta: '',
                sort_title: 'test song',
                is_original: 1,
                copyright_restricted: 0,
                year: 2024,
                sources: [],
                tags: [],
                albums: [],
            };

            await testDB.add_song(newSong as any);

            const song = await testDB.get_song(999888);
            expect(song).toBeDefined();
            expect(song!.title).toBe('Test Song');
        });

        it('add_song replaces existing song', async () => {
            const updatedSong = {
                id: 999888,
                lang: 'en',
                title: 'Updated Test Song',
                source_title: 'Test Source',
                songxml: '<verse>Updated</verse>',
                songkey: 'D',
                capo: 2,
                alternative_titles: [],
                related_songs: [],
                info: [],
                files: [],
                song_usage: 200,
                rating: 4,
                real_song_usage: 100,
                song_ts: Date.now(),
                search_title: 'updated test song',
                search_text: 'updated test',
                search_meta: '',
                sort_title: 'updated test song',
                is_original: 0,
                copyright_restricted: 1,
                year: 2025,
                sources: [],
                tags: [],
                albums: [],
            };

            await testDB.add_song(updatedSong as any);

            const song = await testDB.get_song(999888);
            expect(song!.title).toBe('Updated Test Song');
            expect(song!.songkey).toBe('D');
        });

        it('get_song with fallback fetches song not in loaded language from server', async () => {
            //vi.unstubAllGlobals();

            const song = await testDB.get_song(689, true);

            expect(song).not.toBeNull();
            expect(song!.id).toBe(689);
            expect(song!.lang).toBe('tr');
            expect(song!.title).toBe('Sakin Gece! Kutsal Gece!');
        });
    });

    describe('album filtering', () => {
        let testDB: TestSQLiteDB;

        beforeAll(async () => {
            vi.stubGlobal('fetch', createFetchMock());

            testDB = new TestSQLiteDB();
            await testDB._recreate_db();
            await testDB.add_languages(['dbmeta', 'en']);
        });

        it('filtering by album_id', async () => {
            const albums = await testDB.single_query<{ album_id: number }>('SELECT DISTINCT album_id FROM album_songs LIMIT 1');
            if (albums.length > 0) {
                const albumId = albums[0].album_id;
                const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, album_id: String(albumId) });
                const total = await testDB._get_total(query);
                expect(total).toBeGreaterThan(0);
            }
        });

        it('order by album_songs.track', async () => {
            const albums = await testDB.single_query<{ album_id: number }>('SELECT DISTINCT album_id FROM album_songs LIMIT 1');
            if (albums.length > 0) {
                const albumId = albums[0].album_id;
                const result = await testDB._run_search(
                    testDB._prepare_query({ search: '', order_by: 'album_songs.track ASC', advanced_tags: {}, album_id: String(albumId) }),
                    { start: 0, size: 10 },
                );
                expect(result.data).toBeDefined();
            }
        });
    });

    describe('full fixture data with English and Turkish', () => {
        let testDB: TestSQLiteDB;
        const expectedTotal = EN_SONG_COUNT + TR_SONG_COUNT;

        beforeAll(async () => {
            vi.stubGlobal('fetch', createFetchMock());

            testDB = new TestSQLiteDB();
            await testDB._recreate_db();
            await testDB.refresh_languages();
        });

        it('has correct song counts', async () => {
            const dbCount = await testDB.single_query<{ count: number }>('SELECT COUNT(*) as count FROM songs');
            expect(dbCount[0].count).toBe(expectedTotal);

            const enCount = await testDB.single_query<{ count: number }>("SELECT COUNT(*) as count FROM songs WHERE lang = 'en'");
            expect(enCount[0].count).toBe(EN_SONG_COUNT);

            const trCount = await testDB.single_query<{ count: number }>("SELECT COUNT(*) as count FROM songs WHERE lang = 'tr'");
            expect(trCount[0].count).toBe(TR_SONG_COUNT);
        });

        it('blank search returns all songs', async () => {
            const totalFromSearch = await testDB._get_total(testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {} }));
            expect(totalFromSearch).toBe(expectedTotal);

            const searchResult = await testDB._run_search(testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {} }), {
                start: 0,
                size: expectedTotal + 100,
            });
            expect(searchResult.data.length).toBe(expectedTotal);
        });

        it('paginated blank search returns correct totals', async () => {
            const query = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {} });
            const total = await testDB._get_total(query);
            expect(total).toBe(expectedTotal);

            const pageSize = 500;
            let totalCounted = 0;
            let enCounted = 0;
            let trCounted = 0;
            let start = 0;

            while (start < total) {
                const result = await testDB._run_search(query, { start, size: pageSize });
                totalCounted += result.data.length;

                for (const song of result.data) {
                    expect(song.id).toBeDefined();
                    expect(song.title).toBeDefined();
                    if (song.lang === 'en') enCounted++;
                    else if (song.lang === 'tr') trCounted++;
                }

                start += pageSize;
            }

            expect(totalCounted).toBe(expectedTotal);
            expect(enCounted).toBe(EN_SONG_COUNT);
            expect(trCounted).toBe(TR_SONG_COUNT);
        });

        it('different order_by options return same count', async () => {
            const orderByOptions = ['default', 'sort_title ASC', 'song_usage DESC', 'song_ts DESC'];

            for (const orderBy of orderByOptions) {
                const query = testDB._prepare_query({ search: '', order_by: orderBy, advanced_tags: {} });
                const total = await testDB._get_total(query);
                expect(total).toBe(expectedTotal);
            }
        });

        it('filters by language correctly', async () => {
            const enQuery = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, lang: 'en' });
            const enTotal = await testDB._get_total(enQuery);
            expect(enTotal).toBe(EN_SONG_COUNT);

            const trQuery = testDB._prepare_query({ search: '', order_by: 'default', advanced_tags: {}, lang: 'tr' });
            const trTotal = await testDB._get_total(trQuery);
            expect(trTotal).toBe(TR_SONG_COUNT);
        });

        it('list_loaded_langs returns both languages', async () => {
            const langs = await testDB.list_loaded_langs();
            expect(langs).toContain('en');
            expect(langs).toContain('tr');
        });
    });

    describe('handle_returned_songs', () => {
        it('parses JSON fields correctly', async () => {
            const testDB = new TestSQLiteDB();
            const rows = [
                {
                    id: 1,
                    alternative_titles: '["Alt 1", "Alt 2"]',
                    related_songs: '[1, 2, 3]',
                    info: '{"key": "value"}',
                    files: '[{"type": "mp3"}]',
                },
            ];

            const result = testDB.handle_returned_songs(rows);

            expect(result[0].alternative_titles).toEqual(['Alt 1', 'Alt 2']);
            expect(result[0].related_songs).toEqual([1, 2, 3]);
            expect(result[0].info).toEqual({ key: 'value' });
            expect(result[0].files).toEqual([{ type: 'mp3' }]);
        });
    });
});
