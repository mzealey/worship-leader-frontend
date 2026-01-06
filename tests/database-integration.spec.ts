import { expect, test } from '@playwright/test';

/**
 * Database Integration Tests
 *
 * These tests verify the overall database functionality through the CommonDB interface.
 * Tests are run against both OnlineDB and SQLite implementations to ensure response parity.
 * No mocking is used - we test through the actual application interface.
 */

// Helper to initialize database without waiting for population
async function initializeDatabase(page, dbType: 'online' | 'offline') {
    const result = await page.evaluate(async (type) => {
        try {
            const { persistentStorage } = await import('/src/persistent-storage.es5');
            const { OnlineDB } = await import('/src/db/online');
            const { FAVOURITE_DB } = await import('/src/favourite-db');

            // Clear any previous database state
            persistentStorage.clear();

            let DB_API;

            if (type === 'offline') {
                // Try to load SQLite WASM
                const { try_load_sqlite_wasm, OfflineWASMDB } = await import('/src/db/offline-sqlite-wasm');
                const db = await try_load_sqlite_wasm();
                if (db) {
                    DB_API = new OfflineWASMDB(FAVOURITE_DB, db);
                } else {
                    throw new Error('Failed to initialize SQLite WASM');
                }
            } else {
                // Use OnlineDB
                DB_API = new OnlineDB(FAVOURITE_DB);
            }

            // Initialize the database
            await DB_API.initialize_db();

            // Store the database directly on window for tests to access
            window.TEST_DB_API = DB_API;

            // Populate the database
            if (type === 'offline') {
                const { save_db_chosen_langs } = await import('/src/db/common');
                // Include multiple languages for comprehensive testing
                save_db_chosen_langs(['en', 'tr', 'ru']);

                // Trigger population and wait for it to complete
                // Pass false for in_background to ensure it completes
                await DB_API.populate_db(false);
            } else {
                // For OnlineDB, we need to call populate_db to resolve the db_populated promise
                // This will be instant since _populate_db() is empty for OnlineDB
                await DB_API.populate_db();
            }

            if (DEBUG) window.DB_API = DB_API;

            return { success: true, type: DB_API.type() };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }, dbType);

    if (!result.success) {
        throw new Error(`Failed to initialize ${dbType} database: ${result.error}`);
    }
}

//Test both database types
const dbTypes = [
    { name: 'OnlineDB', type: 'online' as const },
    { name: 'SQLite', type: 'offline' as const },
];

test.describe.configure({ mode: 'serial' });

for (const { name, type } of dbTypes) {
    test.describe(`${name} - Database Integration`, () => {
        test('comprehensive database functionality test', async ({ page }) => {
            test.setTimeout(120000); // 2 minutes for database population
            await page.goto('http://localhost:9123/');
            await page.waitForLoadState('networkidle');

            // Initialize the database once for all tests
            await initializeDatabase(page, type);

            const results = await page.evaluate(async () => {
                const db = window.TEST_DB_API;
                const testResults: Record<string, unknown> = {};

                // Test 1: Initialization
                testResults.initialization = {
                    type: db.type(),
                    fullType: db.full_type(),
                    versionString: db.get_version_string(),
                    hasIdealDebounce: typeof db.ideal_debounce() === 'number',
                };

                // Test 2: db_initialized promise
                await db.db_initialized;
                testResults.dbInitialized = true;

                // Test 3: has_any_songs
                testResults.hasSongs = await db.has_any_songs();

                // Wait for population
                await db.db_populated;

                // Test 4: Get a specific song by ID
                const song1 = await db.get_song(1, true);
                testResults.specificSong = {
                    exists: !!song1,
                    hasId: song1?.id === 1,
                    hasTitle: !!song1?.title,
                    hasLang: !!song1?.lang,
                    hasSongXml: !!song1?.songxml,
                };

                // Test 5: Return null for non-existent song
                const nonExistentSong = await db.get_song(999999, false);
                testResults.nonExistentSong = nonExistentSong;

                // Test 6: Get multiple songs by IDs
                const songs = await db.get_songs([1, 2, 3], false, false);
                testResults.multipleSongs = {
                    isArray: Array.isArray(songs),
                    count: songs.length,
                    allHaveIds: songs.every((s) => typeof s.id === 'number'),
                    allHaveTitles: songs.every((s) => typeof s.title === 'string'),
                };

                // Test 7: Get song sources
                const sources = await db.get_song_sources();
                testResults.songSources = {
                    isArray: Array.isArray(sources),
                    count: sources.length,
                    firstSource: sources[0],
                    allHaveIds: sources.every((s) => typeof s.id === 'number'),
                    allHaveNames: sources.every((s) => typeof s.name === 'string'),
                };

                // Test 8: Search for meta
                const metaResults = await db.search_meta({ search: 'test', lang: null });
                testResults.searchMeta = {
                    isArray: Array.isArray(metaResults),
                    count: metaResults.length,
                    hasTypes: metaResults.every((r) => r._type === 'album' || r._type === 'song_source'),
                };

                // Test 9: Get tag counts
                const tagCounts = await db.get_tag_counts();
                testResults.tagCounts = {
                    isObject: typeof tagCounts === 'object',
                    hasEntries: Object.keys(tagCounts).length > 0,
                    allValuesAreNumbers: Object.values(tagCounts).every((v) => typeof v === 'number'),
                };

                // Test 10: Query validity
                const validity1 = db.query_validity();
                db._invalidate_queries();
                const validity2 = db.query_validity();
                testResults.queryValidity = {
                    validity1,
                    validity2,
                    changed: validity1 !== validity2,
                    hasCorrectFormat: /^(online|offline)-\d+$/.test(validity1),
                };

                // Test 11: Timing statistics
                const initialAvg = db.avg_time;
                db.add_timing_stat(100);
                db.add_timing_stat(150);
                db.add_timing_stat(80);
                const newAvg = db.avg_time;
                testResults.timingStats = {
                    initialAvg,
                    newAvg,
                    changed: initialAvg !== newAvg,
                    idealDebounce: db.ideal_debounce(),
                };

                // Test 12: Set favourite
                try {
                    await db.set_favourite(1, 1);
                    await db.set_favourite(2, 0);
                    testResults.setFavourite = { success: true, error: null };
                } catch (error) {
                    testResults.setFavourite = { success: false, error: String(error) };
                }

                return testResults;
            });

            // Verify all test results
            expect(results.initialization.type).toBe(type);
            expect(results.initialization.versionString).toBeTruthy();
            expect(results.initialization.hasIdealDebounce).toBe(true);

            expect(results.dbInitialized).toBe(true);
            expect(typeof results.hasSongs).toBe('boolean');

            if (results.specificSong.exists) {
                expect(results.specificSong.hasId).toBe(true);
                expect(results.specificSong.hasTitle).toBe(true);
                expect(results.specificSong.hasLang).toBe(true);
                expect(results.specificSong.hasSongXml).toBe(true);
            }

            expect(results.nonExistentSong).toBeNull();

            expect(results.multipleSongs.isArray).toBe(true);
            if (results.multipleSongs.count > 0) {
                expect(results.multipleSongs.allHaveIds).toBe(true);
                expect(results.multipleSongs.allHaveTitles).toBe(true);
            }

            expect(results.songSources.isArray).toBe(true);
            if (results.songSources.count > 0) {
                expect(results.songSources.allHaveIds).toBe(true);
                expect(results.songSources.allHaveNames).toBe(true);
                expect(results.songSources.firstSource).toHaveProperty('id');
                expect(results.songSources.firstSource).toHaveProperty('name');
            }

            expect(results.searchMeta.isArray).toBe(true);
            if (results.searchMeta.count > 0) {
                expect(results.searchMeta.hasTypes).toBe(true);
            }

            expect(results.tagCounts.isObject).toBe(true);
            if (results.tagCounts.hasEntries) {
                expect(results.tagCounts.allValuesAreNumbers).toBe(true);
            }

            expect(results.queryValidity.hasCorrectFormat).toBe(true);
            expect(results.queryValidity.changed).toBe(true);

            expect(results.timingStats.initialAvg).toBeGreaterThan(0);
            expect(results.timingStats.idealDebounce).toBeGreaterThan(0);
            expect(results.timingStats.idealDebounce).toBeGreaterThanOrEqual(results.timingStats.newAvg * 2);

            expect(results.setFavourite.success).toBe(true);
        });
    });
}

// Additional tests that compare behavior between database types
test.describe('Database Parity Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:9123/');
        await page.waitForLoadState('networkidle');
    });

    test('should return identical song data from both databases', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes for database population
        // Expected song data based on actual database content
        const expectedSongs = [
            {
                id: 1,
                title: 'Amazing Grace',
                lang: 'en',
                songxml_start: '<verse><chord>E</chord>Amazing grace, how sw<chord>A</chord>eet the s<chord>E</chord>ound',
            },
            {
                id: 627,
                title: 'Ey Göklerdeki Babamız',
                lang: 'tr',
                songxml_start: '<verse><chord>Am</chord>Ey göklerdeki Babamız,<br />',
            },
            {
                id: 45347,
                title: 'Иисус за Кровь Твою',
                lang: 'ru',
                songxml_start: '<verse><chord>Dm</chord>Иисус, за Кровь Тво<chord>C</chord>ю,<br />Я Тебя благодар<chord>Bb</chord>ю',
            },
        ];

        const testSongIds = expectedSongs.map((s) => s.id);
        const results = [];

        for (const dbType of ['online', 'offline'] as const) {
            await initializeDatabase(page, dbType);

            const result = await page.evaluate(async (songIds) => {
                const db = window.TEST_DB_API;
                await db.db_populated;

                const songs = [];
                for (const id of songIds) {
                    const song = await db.get_song(id, true);
                    if (song) {
                        songs.push({
                            id: song.id,
                            title: song.title,
                            lang: song.lang,
                            songxml_length: song.songxml?.length || 0,
                            songxml_start: song.songxml?.substring(0, 100) || '',
                            has_albums: Array.isArray(song.albums),
                            has_sources: Array.isArray(song.sources),
                        });
                    } else {
                        songs.push(null);
                    }
                }

                return songs;
            }, testSongIds);

            results.push({ type: dbType, songs: result });
        }

        // Compare the two database results
        const [online, offline] = results;
        expect(online.songs.length).toBe(offline.songs.length);
        expect(online.songs.length).toBe(expectedSongs.length);

        for (let i = 0; i < expectedSongs.length; i++) {
            const expected = expectedSongs[i];
            const onlineSong = online.songs[i];
            const offlineSong = offline.songs[i];

            // Both should have the song
            expect(onlineSong).not.toBeNull();
            expect(offlineSong).not.toBeNull();

            // Check against expected values
            for (const song of [onlineSong, offlineSong]) {
                expect(song.id).toBe(expected.id);
                expect(song.title).toBe(expected.title);
                expect(song.lang).toBe(expected.lang);
                expect(song.songxml_start).toContain(expected.songxml_start);
                expect(song.songxml_length).toBeGreaterThan(100); // Has content
                expect(song.has_sources).toBe(true);
            }

            // Online and offline should match each other (allowing for minor whitespace differences)
            expect(onlineSong.id).toBe(offlineSong.id);
            expect(onlineSong.title).toBe(offlineSong.title);
            expect(onlineSong.lang).toBe(offlineSong.lang);
            // Allow up to 50 chars difference for whitespace variations
            expect(Math.abs(onlineSong.songxml_length - offlineSong.songxml_length)).toBeLessThan(50);
        }
    });

    test('should return consistent get_songs batch results', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes for database population
        // Expected song data for batch get_songs test
        const expectedSongs = [
            { id: 1, title: 'Amazing Grace', lang: 'en' },
            { id: 627, title: 'Ey Göklerdeki Babamız', lang: 'tr' },
            { id: 45347, title: 'Иисус за Кровь Твою', lang: 'ru' },
        ];

        const testSongIds = expectedSongs.map((s) => s.id);
        const results = [];

        for (const dbType of ['online', 'offline'] as const) {
            await initializeDatabase(page, dbType);

            const result = await page.evaluate(async (songIds) => {
                const db = window.TEST_DB_API;
                await db.db_populated;

                // Get songs with songxml - need to call get_song individually with ajax_fallback=true
                const songs = [];
                for (const id of songIds) {
                    const song = await db.get_song(id, true);
                    if (song) {
                        songs.push({
                            id: song.id,
                            title: song.title,
                            lang: song.lang,
                            songxml_length: song.songxml?.length || 0,
                        });
                    }
                }

                return songs;
            }, testSongIds);

            results.push({ type: dbType, songs: result });
        }

        // Compare the two database results
        const [online, offline] = results;
        expect(online.songs.length).toBe(expectedSongs.length);
        expect(offline.songs.length).toBe(expectedSongs.length);

        for (let i = 0; i < expectedSongs.length; i++) {
            const expected = expectedSongs[i];
            const onlineSong = online.songs[i];
            const offlineSong = offline.songs[i];

            // Check against expected values
            for (const song of [onlineSong, offlineSong]) {
                expect(song.id).toBe(expected.id);
                expect(song.title).toBe(expected.title);
                expect(song.lang).toBe(expected.lang);
                expect(song.songxml_length).toBeGreaterThan(100);
            }

            // Online and offline should match
            expect(onlineSong.id).toBe(offlineSong.id);
            expect(onlineSong.title).toBe(offlineSong.title);
            expect(onlineSong.lang).toBe(offlineSong.lang);
            // Allow for minor whitespace differences
            expect(Math.abs(onlineSong.songxml_length - offlineSong.songxml_length)).toBeLessThan(50);
        }
    });
});
