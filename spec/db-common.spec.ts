// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommonDB, get_db_chosen_langs, save_db_chosen_langs } from '../src/db/common';
import type { DBLangCode } from '../src/lang-types';

type TestPreparedQuery = Record<string, any>;

describe('db/common utility functions', function () {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('get_db_chosen_langs', function () {
        it('returns array when called', function () {
            const result = get_db_chosen_langs(['default'] as DBLangCode[]);
            expect(Array.isArray(result)).toBe(true);
        });

        it('returns default value when no stored value', function () {
            const result = get_db_chosen_langs(['default'] as DBLangCode[]);
            expect(result).toEqual(['default']);
        });

        it('handles different default values', function () {
            const result = get_db_chosen_langs(['fr', 'es'] as DBLangCode[]);
            expect(result).toEqual(['fr', 'es']);
        });
    });

    describe('save_db_chosen_langs', function () {
        it('executes without throwing', function () {
            expect(() => save_db_chosen_langs(['en', 'fr'] as DBLangCode[])).not.toThrow();
        });

        it('handles empty array', function () {
            expect(() => save_db_chosen_langs([] as DBLangCode[])).not.toThrow();
        });

        it('handles single language', function () {
            expect(() => save_db_chosen_langs(['de'] as DBLangCode[])).not.toThrow();
        });
    });

    describe('CommonDB constructor', function () {
        // Create a concrete implementation for testing
        class TestCommonDB extends CommonDB<TestPreparedQuery> {
            async _initialize_db(): Promise<void> {}
            get_version_string(): string {
                return 'test';
            }
            async _populate_db(): Promise<void> {}
            async _search_meta(): Promise<{ albums: any[]; sources: any[] }> {
                return { albums: [], sources: [] };
            }
            async _get_songs(): Promise<any[]> {
                return [];
            }
            async get_song_sources(): Promise<any[]> {
                return [];
            }
            async get_song(): Promise<any> {
                return null;
            }
            async _run_search(): Promise<{ data: any[]; total: number }> {
                return { data: [], total: 0 };
            }
            async _get_total(): Promise<number> {
                return 0;
            }
            _prepare_query(): TestPreparedQuery {
                return {};
            }
        }

        it('creates a new CommonDB instance', function () {
            const db = new TestCommonDB(null as any);

            expect(db).toBeInstanceOf(CommonDB<any>);
        });

        it('initializes deferred promises', function () {
            const db = new TestCommonDB(null as any);

            expect(db.db_initialized).toBeDefined();
            expect(db.db_populated).toBeDefined();
            expect(typeof db.db_initialized.then).toBe('function');
            expect(typeof db.db_populated.then).toBe('function');
        });

        it('initializes timing stats and avg_time', function () {
            const db = new TestCommonDB(null as any);

            expect(db.timing_stats).toEqual([]);
            expect(typeof db.avg_time).toBe('number');
        });

        it('sets default avg_time when no stored value', function () {
            const db = new TestCommonDB(null as any);

            expect(db.avg_time).toBe(75); // default value
        });

        it('initializes query validity counter', function () {
            const db = new TestCommonDB(null as any);

            expect(db._query_validity).toBe(0);
        });
    });

    describe('CommonDB prototype methods', function () {
        // Create a concrete implementation for testing
        class TestCommonDB extends CommonDB<TestPreparedQuery> {
            async _initialize_db(): Promise<void> {}
            get_version_string(): string {
                return 'test';
            }
            async _populate_db(): Promise<void> {}
            async _search_meta(): Promise<{ albums: any[]; sources: any[] }> {
                return { albums: [], sources: [] };
            }
            async _get_songs(): Promise<any[]> {
                return [];
            }
            async get_song_sources(): Promise<any[]> {
                return [];
            }
            async get_song(): Promise<any> {
                return null;
            }
            async _run_search(): Promise<{ data: any[]; total: number }> {
                return { data: [], total: 0 };
            }
            async _get_total(): Promise<number> {
                return 0;
            }
            _prepare_query(): any {
                return {};
            }
        }

        let db: TestCommonDB;

        beforeEach(() => {
            db = new TestCommonDB(null as any);
        });

        describe('type and full_type', function () {
            it('returns _type property', function () {
                db._type = 'test-type';
                expect(db.type()).toBe('test-type');
                expect(db.full_type()).toBe('test-type');
            });

            it('returns undefined when _type not set', function () {
                expect(db.type()).toBeUndefined();
                expect(db.full_type()).toBeUndefined();
            });
        });

        describe('_invalidate_queries', function () {
            it('increments query validity counter', function () {
                expect(db._query_validity).toBe(0);

                db._invalidate_queries();
                expect(db._query_validity).toBe(1);

                db._invalidate_queries();
                expect(db._query_validity).toBe(2);
            });
        });

        describe('query_validity', function () {
            it('returns string combining type and validity counter', function () {
                db._type = 'test';
                db._query_validity = 5;

                expect(db.query_validity()).toBe('test-5');
            });

            it('handles undefined type', function () {
                db._query_validity = 3;

                expect(db.query_validity()).toBe('undefined-3');
            });
        });

        describe('avg_query_key', function () {
            it('returns key string with full_type', function () {
                db._type = 'offline';

                expect(db.avg_query_key()).toBe('avg-query-offline');
            });
        });

        describe('add_timing_stat', function () {
            it('updates avg_time using moving average', function () {
                db.avg_time = 100;
                db.add_timing_stat(150);

                // Moving average calculation: avg_time += (time_ms - avg_time) / TIMING_STAT_LENGTH
                // 100 + (150 - 100) / 50 = 101
                expect(db.avg_time).toBe(101);
            });

            it('handles timing stat lower than average', function () {
                db.avg_time = 100;
                db.add_timing_stat(50);

                // 100 + (50 - 100) / 50 = 99
                expect(db.avg_time).toBe(99);
            });
        });

        describe('ideal_debounce', function () {
            it('returns avg_time multiplied by 3', function () {
                db.avg_time = 100;
                expect(db.ideal_debounce()).toBe(300);

                db.avg_time = 50;
                expect(db.ideal_debounce()).toBe(150);
            });
        });

        describe('has_any_songs', function () {
            it('returns true by default', async function () {
                const result = await db.has_any_songs();
                expect(result).toBe(true);
            });
        });

        describe('get_songs', function () {
            beforeEach(() => {
                // Mock the _get_songs method
                db._get_songs = vi.fn();
            });

            it('filters out invalid IDs', async function () {
                (db._get_songs as any).mockResolvedValue([]);

                await db.get_songs([1, null, 2, undefined, 3, ''] as any, false, false);

                expect(db._get_songs).toHaveBeenCalledWith([1, 2, 3], false);
            });

            it('returns empty array for empty input', async function () {
                const result = await db.get_songs([], false, false);

                expect(result).toEqual([]);
                expect(db._get_songs).not.toHaveBeenCalled();
            });

            it('returns empty array for null/undefined input', async function () {
                // Handles null/undefined gracefully
                const resultNull = await db.get_songs(null as any, false, false);
                const resultUndefined = await db.get_songs(undefined as any, false, false);

                expect(resultNull).toEqual([]);
                expect(resultUndefined).toEqual([]);
                expect(db._get_songs).not.toHaveBeenCalled();
            });

            it('adds missing IDs when include_empties is true', async function () {
                (db._get_songs as any).mockResolvedValue([
                    { id: 1, title: 'Song 1' },
                    { id: 3, title: 'Song 3' },
                ]);

                const result = await db.get_songs([1, 2, 3], true, false);

                expect(result).toHaveLength(3);
                expect(result).toContainEqual({ id: 1, title: 'Song 1' });
                expect(result).toContainEqual({ id: 3, title: 'Song 3' });
                expect(result).toContainEqual({ id: 2, not_loaded: 1 });
            });

                it('does not add missing IDs when include_empties is false', async function () {
                    (db._get_songs as any).mockResolvedValue([{ id: 1, title: 'Song 1' }]);

                    const result = await db.get_songs([1, 2, 3], false, false);

                    expect(result).toHaveLength(1);
                    expect(result).toContainEqual({ id: 1, title: 'Song 1' });
                });
            });

            describe('search_meta', function () {
                it('returns sorted albums and sources', async function () {
                    db._search_meta = vi.fn().mockResolvedValue({
                        albums: [{ id: 1, title: 'Album B' }, { id: 2, title: 'Album A' }],
                        sources: [{ id: 1, name: 'Source Z' }, { id: 2, name: 'Source A' }],
                    });

                    const result = await db.search_meta({} as any);

                    expect(result.length).toBe(4);
                    expect(result[0]).toMatchObject({ title: 'Album A', _type: 'album' });
                    expect(result[3]).toMatchObject({ name: 'Source Z', _type: 'song_source' });
                });

                it('returns empty array on error', async function () {
                    db._search_meta = vi.fn().mockRejectedValue(new Error('Search failed'));

                    const result = await db.search_meta({} as any);

                    expect(result).toEqual([]);
                });
            });

            describe('search', function () {
                it('delegates to _prepare_query and _run_search', async function () {
                    const mockQuery = { prepared: true };
                    db._prepare_query = vi.fn().mockReturnValue(mockQuery);
                    db._run_search = vi.fn().mockResolvedValue({ data: [{ id: 1 }], total: 1 });

                    const result = await db.search({} as any, { start: 0, size: 10 });

                    expect(db._prepare_query).toHaveBeenCalledWith({});
                    expect(db._run_search).toHaveBeenCalledWith(mockQuery, { start: 0, size: 10 });
                    expect(result.data).toEqual([{ id: 1 }]);
                    expect(result.total).toBe(1);
                });
            });

            describe('initialize_db and populate_db', function () {
                it('initialize_db resolves db_initialized promise', async function () {
                    db._initialize_db = vi.fn().mockResolvedValue(undefined);

                    await db.initialize_db();

                    expect(db._initialize_db).toHaveBeenCalled();
                    await expect(db.db_initialized).resolves.toBeUndefined();
                });

                it('populate_db resolves db_populated promise', async function () {
                    db.has_any_songs = vi.fn().mockResolvedValue(false);
                    db._populate_db = vi.fn().mockResolvedValue(undefined);

                    // We need db_initialized to be resolved first
                    db._db_initialized.resolve();

                    await db.populate_db();

                    expect(db._populate_db).toHaveBeenCalled();
                    await expect(db.db_populated).resolves.toBeUndefined();
                });
            });
    });
});
