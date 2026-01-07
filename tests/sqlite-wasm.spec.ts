import { expect, test } from '@playwright/test';

/**
 * SQLite WASM Database Tests
 *
 * These tests verify the SQLite WASM database functionality by creating an isolated
 * database instance in the browser context and running various database operations.
 */

// Performance threshold multiplier for CI environments where tests may run slower
// Set PERF_TIMEOUT_MULTIPLIER environment variable to increase timeout thresholds
const PERF_MULTIPLIER = Number(process.env.PERF_TIMEOUT_MULTIPLIER) || 1;

test.describe('SQLite WASM Database', () => {
    test.beforeEach(async ({ page }) => {
        // TODO: Get this from playwright itself
        await page.goto('http://localhost:9123/');

        // Wait for the page to load
        await page.waitForLoadState('networkidle');
    });

    test.describe('Worker Initialization', () => {
        test('should support browser SQLite WASM', async ({ page }) => {
            const supportsWasm = await page.evaluate(() => {
                // Check if browser supports the required features
                return !!(window.BigInt64Array && window.FinalizationRegistry);
            });

            expect(supportsWasm).toBe(true);
        });

        test('should initialize SQLite worker through try_load_sqlite_wasm', async ({ page }) => {
            const result = await page.evaluate(async () => {
                try {
                    const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                    const worker = await try_load_sqlite_wasm();
                    return { success: !!worker, error: null };
                } catch (error) {
                    return { success: false, error: String(error) };
                }
            });

            expect(result.success).toBe(true);
            expect(result.error).toBeNull();
        });
    });

    test.describe('Database Operations via Worker', () => {
        test('should execute simple queries', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                // Create a test table
                await worker.exec('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, value TEXT)');

                // Insert data
                await worker.exec('INSERT INTO test_table (id, value) VALUES (?, ?)', [1, 'test']);

                // Query data
                const rows = await worker.exec('SELECT * FROM test_table WHERE id = ?', [1]);

                // Clean up
                await worker.exec('DROP TABLE test_table');

                return rows[0];
            });

            expect(result).toEqual({ id: 1, value: 'test' });
        });

        test('should handle multiple inserts', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS test_multi (id INTEGER, name TEXT)');

                await worker.exec(
                    ['INSERT INTO test_multi VALUES (?, ?)', [1, 'Alice']],
                    ['INSERT INTO test_multi VALUES (?, ?)', [2, 'Bob']],
                    ['INSERT INTO test_multi VALUES (?, ?)', [3, 'Charlie']],
                );

                const rows = await worker.exec('SELECT COUNT(*) as count FROM test_multi');
                await worker.exec('DROP TABLE test_multi');

                return rows[0].count;
            });

            expect(result).toBe(3);
        });

        test('should support bulk_exec for performance', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS bulk_test (id INTEGER, value TEXT)');

                const binds = [];
                for (let i = 0; i < 50; i++) {
                    binds.push([i, `value_${i}`]);
                }

                const start = Date.now();
                await worker.bulk_exec('INSERT INTO bulk_test VALUES (?, ?)', binds);
                const duration = Date.now() - start;

                const rows = await worker.exec('SELECT COUNT(*) as count FROM bulk_test');
                await worker.exec('DROP TABLE bulk_test');

                return { count: rows[0].count, duration };
            });

            expect(result.count).toBe(50);
            // Bulk insert should be fast (less than 500ms for 50 records)
            expect(result.duration).toBeLessThan(500 * PERF_MULTIPLIER);
        });

        test('should handle transactions', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS txn_test (id INTEGER, value TEXT)');

                // Transaction that commits
                await worker.exec('BEGIN');
                await worker.exec('INSERT INTO txn_test VALUES (?, ?)', [1, 'committed']);
                await worker.exec('COMMIT');

                // Transaction that rolls back
                try {
                    await worker.exec('BEGIN');
                    await worker.exec('INSERT INTO txn_test VALUES (?, ?)', [2, 'rolled_back']);
                    await worker.exec('ROLLBACK');
                } catch (e) {
                    // Expected
                }

                const rows = await worker.exec('SELECT * FROM txn_test ORDER BY id');
                await worker.exec('DROP TABLE txn_test');

                return rows.map((r) => r.id);
            });

            // Only the committed row should exist
            expect(result).toEqual([1]);
        });

        test('should support WITHOUT ROWID tables', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                try {
                    await worker.exec(`
                        CREATE TABLE IF NOT EXISTS rowid_test (
                            key TEXT PRIMARY KEY,
                            value TEXT
                        ) WITHOUT ROWID
                    `);

                    await worker.exec('INSERT INTO rowid_test VALUES (?, ?)', ['key1', 'value1']);
                    const rows = await worker.exec('SELECT * FROM rowid_test WHERE key = ?', ['key1']);
                    await worker.exec('DROP TABLE rowid_test');

                    return { supported: true, data: rows[0] };
                } catch (error) {
                    return { supported: false, error: String(error) };
                }
            });

            expect(result.supported).toBe(true);
            expect(result.data).toEqual({ key: 'key1', value: 'value1' });
        });

        test('should handle LIKE queries efficiently', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS like_test (id INTEGER, title TEXT)');

                const binds = [
                    [1, 'Amazing Grace'],
                    [2, 'Grace Alone'],
                    [3, 'How Great Thou Art'],
                    [4, 'Great is Thy Faithfulness'],
                    [5, 'Other Song'],
                ];

                await worker.bulk_exec('INSERT INTO like_test VALUES (?, ?)', binds);

                const rows = await worker.exec("SELECT * FROM like_test WHERE title LIKE '%Grace%' OR title LIKE '%Great%'");
                await worker.exec('DROP TABLE like_test');

                return rows.length;
            });

            expect(result).toBe(4);
        });

        test('should handle JSON data storage', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS json_test (id INTEGER, data TEXT)');

                const jsonData = { name: 'Test', tags: ['a', 'b', 'c'], count: 42 };
                await worker.exec('INSERT INTO json_test VALUES (?, ?)', [1, JSON.stringify(jsonData)]);

                const rows = await worker.exec('SELECT * FROM json_test WHERE id = ?', [1]);
                await worker.exec('DROP TABLE json_test');

                return JSON.parse(rows[0].data);
            });

            expect(result).toEqual({ name: 'Test', tags: ['a', 'b', 'c'], count: 42 });
        });

        test('should handle NULL values correctly', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS null_test (id INTEGER, value TEXT)');

                await worker.exec('INSERT INTO null_test VALUES (?, ?)', [1, null]);
                await worker.exec('INSERT INTO null_test VALUES (?, ?)', [2, 'not null']);

                const rows = await worker.exec('SELECT * FROM null_test ORDER BY id');
                await worker.exec('DROP TABLE null_test');

                return rows;
            });

            expect(result[0].value).toBeNull();
            expect(result[1].value).toBe('not null');
        });

        test('should handle special characters', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS char_test (text TEXT)');

                const specialText = 'Test \'quotes\' "double" <tags> & ñ Ş İ © ® ™';
                await worker.exec('INSERT INTO char_test VALUES (?)', [specialText]);

                const rows = await worker.exec('SELECT * FROM char_test');
                await worker.exec('DROP TABLE char_test');

                return rows[0].text;
            });

            expect(result).toBe('Test \'quotes\' "double" <tags> & ñ Ş İ © ® ™');
        });

        test('should perform JOIN operations', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS join_a (id INTEGER, name TEXT)');
                await worker.exec('CREATE TABLE IF NOT EXISTS join_b (id INTEGER, aid INTEGER, value TEXT)');

                await worker.exec(
                    ['INSERT INTO join_a VALUES (?, ?)', [1, 'Alice']],
                    ['INSERT INTO join_b VALUES (?, ?, ?)', [1, 1, 'value1']],
                    ['INSERT INTO join_b VALUES (?, ?, ?)', [2, 1, 'value2']],
                );

                const rows = await worker.exec(
                    `
                    SELECT join_a.name, join_b.value
                    FROM join_a
                    JOIN join_b ON join_a.id = join_b.aid
                    WHERE join_a.id = ?
                `,
                    [1],
                );

                await worker.exec('DROP TABLE join_a');
                await worker.exec('DROP TABLE join_b');

                return rows.length;
            });

            expect(result).toBe(2);
        });

        test('should perform aggregate queries', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS agg_test (category TEXT, value INTEGER)');

                await worker.exec(
                    ['INSERT INTO agg_test VALUES (?, ?)', ['A', 10]],
                    ['INSERT INTO agg_test VALUES (?, ?)', ['A', 20]],
                    ['INSERT INTO agg_test VALUES (?, ?)', ['B', 30]],
                );

                const rows = await worker.exec(`
                    SELECT category, SUM(value) as total, AVG(value) as avg, COUNT(*) as count
                    FROM agg_test
                    GROUP BY category
                    ORDER BY category
                `);

                await worker.exec('DROP TABLE agg_test');

                return rows;
            });

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ category: 'A', total: 30, avg: 15, count: 2 });
            expect(result[1]).toEqual({ category: 'B', total: 30, avg: 30, count: 1 });
        });

        test('should handle UPSERT with ON CONFLICT', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS upsert_test (id INTEGER PRIMARY KEY, value TEXT)');

                // Initial insert
                await worker.exec('INSERT INTO upsert_test VALUES (?, ?)', [1, 'original']);

                // Upsert (should update)
                await worker.exec(
                    `
                    INSERT INTO upsert_test VALUES (?, ?)
                    ON CONFLICT(id) DO UPDATE SET value = excluded.value
                `,
                    [1, 'updated'],
                );

                const rows = await worker.exec('SELECT * FROM upsert_test WHERE id = ?', [1]);
                await worker.exec('DROP TABLE upsert_test');

                return rows[0].value;
            });

            expect(result).toBe('updated');
        });

        test('should handle large text fields', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS large_test (id INTEGER, content TEXT)');

                // Create a large string (10KB+)
                const largeText = 'x'.repeat(15000);
                await worker.exec('INSERT INTO large_test VALUES (?, ?)', [1, largeText]);

                const rows = await worker.exec('SELECT LENGTH(content) as len FROM large_test WHERE id = ?', [1]);
                await worker.exec('DROP TABLE large_test');

                return rows[0].len;
            });

            expect(result).toBe(15000);
        });

        test('should create and use indexes', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS idx_test (id INTEGER, category TEXT, value INTEGER)');
                await worker.exec('CREATE INDEX IF NOT EXISTS idx_category ON idx_test(category)');

                // Insert test data
                for (let i = 0; i < 20; i++) {
                    await worker.exec('INSERT INTO idx_test VALUES (?, ?, ?)', [i, i % 2 === 0 ? 'even' : 'odd', i]);
                }

                const rows = await worker.exec('SELECT COUNT(*) as count FROM idx_test WHERE category = ?', ['even']);

                // Verify index exists
                const indexes = await worker.exec("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_category'");

                await worker.exec('DROP INDEX idx_category');
                await worker.exec('DROP TABLE idx_test');

                return { count: rows[0].count, indexExists: indexes.length > 0 };
            });

            expect(result.indexExists).toBe(true);
            expect(result.count).toBe(10);
        });

        test('should handle ORDER BY with multiple columns', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS order_test (category TEXT, priority INTEGER, name TEXT)');

                const binds = [
                    ['A', 1, 'Alice'],
                    ['A', 2, 'Amy'],
                    ['B', 1, 'Bob'],
                    ['A', 1, 'Andrew'],
                    ['B', 2, 'Bill'],
                ];

                await worker.bulk_exec('INSERT INTO order_test VALUES (?, ?, ?)', binds);

                const rows = await worker.exec('SELECT * FROM order_test ORDER BY category, priority, name');
                await worker.exec('DROP TABLE order_test');

                return rows.map((r) => r.name);
            });

            expect(result).toEqual(['Alice', 'Andrew', 'Amy', 'Bob', 'Bill']);
        });

        test('should handle DISTINCT queries', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS distinct_test (category TEXT, value INTEGER)');

                const binds = [
                    ['A', 1],
                    ['A', 2],
                    ['B', 1],
                    ['A', 3],
                    ['B', 2],
                ];

                await worker.bulk_exec('INSERT INTO distinct_test VALUES (?, ?)', binds);

                const rows = await worker.exec('SELECT DISTINCT category FROM distinct_test ORDER BY category');
                await worker.exec('DROP TABLE distinct_test');

                return rows.map((r) => r.category);
            });

            expect(result).toEqual(['A', 'B']);
        });

        test('should handle LIMIT and OFFSET', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS pagination_test (id INTEGER, value TEXT)');

                const binds = [];
                for (let i = 1; i <= 20; i++) {
                    binds.push([i, `Item ${i}`]);
                }

                await worker.bulk_exec('INSERT INTO pagination_test VALUES (?, ?)', binds);

                const rows = await worker.exec('SELECT * FROM pagination_test ORDER BY id LIMIT 5 OFFSET 10');
                await worker.exec('DROP TABLE pagination_test');

                return rows.map((r) => r.id);
            });

            expect(result).toEqual([11, 12, 13, 14, 15]);
        });

        test('should handle subqueries', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS subquery_test (id INTEGER, value INTEGER)');

                const binds = [
                    [1, 10],
                    [2, 20],
                    [3, 30],
                    [4, 5],
                ];

                await worker.bulk_exec('INSERT INTO subquery_test VALUES (?, ?)', binds);

                const rows = await worker.exec(`
                    SELECT * FROM subquery_test
                    WHERE value > (SELECT AVG(value) FROM subquery_test)
                    ORDER BY id
                `);
                await worker.exec('DROP TABLE subquery_test');

                return rows.map((r) => r.id);
            });

            expect(result).toEqual([2, 3]);
        });

        test('should handle CASE expressions', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS case_test (id INTEGER, score INTEGER)');

                const binds = [
                    [1, 95],
                    [2, 75],
                    [3, 50],
                ];

                await worker.bulk_exec('INSERT INTO case_test VALUES (?, ?)', binds);

                const rows = await worker.exec(`
                    SELECT id,
                           CASE
                               WHEN score >= 90 THEN 'A'
                               WHEN score >= 70 THEN 'B'
                               ELSE 'C'
                           END as grade
                    FROM case_test
                    ORDER BY id
                `);
                await worker.exec('DROP TABLE case_test');

                return rows.map((r) => r.grade);
            });

            expect(result).toEqual(['A', 'B', 'C']);
        });
    });

    test.describe('Performance Tests', () => {
        test('should efficiently insert 1000 records using bulk_exec', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS perf_test (id INTEGER, title TEXT, content TEXT)');

                const binds = [];
                for (let i = 0; i < 1000; i++) {
                    binds.push([i, `Title ${i}`, `Content for item ${i}`]);
                }

                const start = Date.now();
                await worker.bulk_exec('INSERT INTO perf_test VALUES (?, ?, ?)', binds);
                const insertDuration = Date.now() - start;

                const queryStart = Date.now();
                const rows = await worker.exec('SELECT COUNT(*) as count FROM perf_test');
                const queryDuration = Date.now() - queryStart;

                await worker.exec('DROP TABLE perf_test');

                return {
                    count: rows[0].count,
                    insertDuration,
                    queryDuration,
                };
            });

            expect(result.count).toBe(1000);
            // Should insert 1000 records in under 3 seconds
            expect(result.insertDuration).toBeLessThan(3000 * PERF_MULTIPLIER);
            // Query should be fast
            expect(result.queryDuration).toBeLessThan(200 * PERF_MULTIPLIER);
        });

        test('should handle complex queries on large datasets', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec(`
                    CREATE TABLE IF NOT EXISTS complex_test (
                        id INTEGER,
                        lang TEXT,
                        category TEXT,
                        rating INTEGER,
                        title TEXT
                    )
                `);

                await worker.exec('CREATE INDEX IF NOT EXISTS idx_lang ON complex_test(lang)');
                await worker.exec('CREATE INDEX IF NOT EXISTS idx_rating ON complex_test(rating)');

                const binds = [];
                const langs = ['en', 'ru', 'fr', 'es', 'de'];
                const categories = ['hymn', 'worship', 'contemporary'];
                for (let i = 0; i < 500; i++) {
                    binds.push([i, langs[i % langs.length], categories[i % categories.length], (i % 5) + 1, `Song ${i}`]);
                }

                await worker.bulk_exec('INSERT INTO complex_test VALUES (?, ?, ?, ?, ?)', binds);

                const start = Date.now();
                const rows = await worker.exec(`
                    SELECT lang, category, AVG(rating) as avg_rating, COUNT(*) as count
                    FROM complex_test
                    WHERE rating >= 3
                    GROUP BY lang, category
                    HAVING COUNT(*) > 10
                    ORDER BY avg_rating DESC, count DESC
                `);
                const duration = Date.now() - start;

                await worker.exec('DROP INDEX idx_lang');
                await worker.exec('DROP INDEX idx_rating');
                await worker.exec('DROP TABLE complex_test');

                return { resultCount: rows.length, duration };
            });

            expect(result.resultCount).toBeGreaterThan(0);
            // Complex query should complete in under 500ms
            expect(result.duration).toBeLessThan(500 * PERF_MULTIPLIER);
        });

        test('should load a simulated Russian language database efficiently', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                // Create schema similar to the actual database
                await worker.exec(`
                    CREATE TABLE IF NOT EXISTS songs_ru (
                        id INTEGER NOT NULL PRIMARY KEY,
                        lang VARCHAR(15) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        source_title VARCHAR(255),
                        search_title TEXT,
                        search_text TEXT,
                        songxml TEXT NOT NULL,
                        rating INTEGER,
                        songkey VARCHAR(15),
                        capo INTEGER,
                        alternative_titles TEXT,
                        info TEXT,
                        files TEXT,
                        related_songs TEXT,
                        song_usage INTEGER,
                        real_song_usage INTEGER,
                        song_ts INTEGER,
                        year INTEGER,
                        favourite INTEGER NOT NULL,
                        is_original INTEGER NOT NULL,
                        copyright_restricted INTEGER NOT NULL,
                        has_chord INTEGER NOT NULL,
                        has_sheet INTEGER NOT NULL,
                        has_mp3 INTEGER NOT NULL,
                        sort_title TEXT NOT NULL
                    )
                `);

                await worker.exec('CREATE INDEX IF NOT EXISTS song_usage_idx ON songs_ru(song_usage DESC)');
                await worker.exec('CREATE INDEX IF NOT EXISTS title_idx ON songs_ru(sort_title)');

                // Simulate loading ~2000 Russian songs (approximate size of Russian database)
                const binds = [];
                const sampleXml = '<song><verse>Слава Богу за всё</verse><verse>Он так любит нас</verse></song>';
                const sampleInfo = JSON.stringify([{ type: 'composer', value: 'Unknown' }]);
                const sampleFiles = JSON.stringify([{ type: 'mp3', url: '/songs/123.mp3' }]);

                for (let i = 1; i <= 2000; i++) {
                    binds.push([
                        i,
                        'ru',
                        `Песня ${i}`,
                        null,
                        `песня ${i}`,
                        `слова для песни ${i}`,
                        sampleXml,
                        null,
                        null,
                        null,
                        '[]',
                        sampleInfo,
                        sampleFiles,
                        '[]',
                        i % 100,
                        i % 100,
                        Date.now(),
                        null,
                        0,
                        1,
                        0,
                        sampleXml.includes('<chord>') ? 1 : 0,
                        0,
                        i % 10 === 0 ? 1 : 0,
                        `песня ${i}`,
                    ]);
                }

                const insertStart = Date.now();
                await worker.bulk_exec(`INSERT INTO songs_ru VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, binds);
                const insertDuration = Date.now() - insertStart;

                // Test various query patterns
                const queryStart = Date.now();

                // Count query
                const countResult = await worker.exec('SELECT COUNT(*) as count FROM songs_ru');

                // Search by title pattern
                const searchResult = await worker.exec('SELECT * FROM songs_ru WHERE search_title LIKE ? LIMIT 10', ['%песня 1%']);

                // Popular songs query
                const popularResult = await worker.exec('SELECT * FROM songs_ru ORDER BY song_usage DESC LIMIT 20');

                // Filter by language
                await worker.exec('SELECT COUNT(*) as count FROM songs_ru WHERE lang = ?', ['ru']);

                const queryDuration = Date.now() - queryStart;

                await worker.exec('DROP INDEX song_usage_idx');
                await worker.exec('DROP INDEX title_idx');
                await worker.exec('DROP TABLE songs_ru');

                return {
                    songsLoaded: countResult[0].count,
                    insertDuration,
                    queryDuration,
                    searchResultCount: searchResult.length,
                    popularResultCount: popularResult.length,
                };
            });

            expect(result.songsLoaded).toBe(2000);
            expect(result.searchResultCount).toBeGreaterThan(0);
            expect(result.popularResultCount).toBe(20);

            // Loading 2000 songs should complete in reasonable time (under 10 seconds)
            expect(result.insertDuration).toBeLessThan(10000 * PERF_MULTIPLIER);

            // Queries should be fast even with 2000 songs
            expect(result.queryDuration).toBeLessThan(1000 * PERF_MULTIPLIER);
        });

        test('should handle concurrent operations efficiently', async ({ page }) => {
            const result = await page.evaluate(async () => {
                const { try_load_sqlite_wasm } = await import('/src/db/offline-sqlite-wasm');
                const worker = await try_load_sqlite_wasm();

                await worker.exec('CREATE TABLE IF NOT EXISTS concurrent_test (id INTEGER, value TEXT)');

                const binds = [];
                for (let i = 0; i < 100; i++) {
                    binds.push([i, `Value ${i}`]);
                }
                await worker.bulk_exec('INSERT INTO concurrent_test VALUES (?, ?)', binds);

                // Fire off multiple read queries concurrently
                const start = Date.now();
                const promises = [];
                for (let i = 0; i < 20; i++) {
                    promises.push(worker.exec('SELECT * FROM concurrent_test WHERE id = ?', [i * 5]));
                }
                const results = await Promise.all(promises);
                const duration = Date.now() - start;

                await worker.exec('DROP TABLE concurrent_test');

                return {
                    queryCount: promises.length,
                    successCount: results.filter((r) => r.length > 0).length,
                    duration,
                };
            });

            expect(result.successCount).toBe(20);
            // 20 concurrent queries should complete in reasonable time
            expect(result.duration).toBeLessThan(2000 * PERF_MULTIPLIER);
        });
    });
});
