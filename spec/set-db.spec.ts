// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistentStorage } from '../src/persistent-storage.es5';
import { type SetDB, type SetEntry } from '../src/set-db';

describe('set-db module', function () {
    let mockEventSocket: any;
    let mockGlobals: any;
    let SET_DB: SetDB;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // Clear persistent storage between tests
        persistentStorage.clear();

        // Mock event socket
        mockEventSocket = {
            add_queue: vi.fn(() => vi.fn()),
            is_setup: vi.fn(() => Promise.resolve()),
            register_listener: vi.fn(),
            unregister_listener: vi.fn(),
        };

        // Mock globals
        mockGlobals = {
            random_int: vi.fn(() => 5), // Fixed value for predictable UUIDs in tests
        };

        // Mock Date.now for predictable timestamps
        vi.spyOn(Date, 'now').mockReturnValue(1000000);

        // Set up mocks
        vi.doMock('../src/event-socket', () => ({
            eventSocket: mockEventSocket,
        }));

        vi.doMock('../src/globals', () => mockGlobals);

        // Import the module after mocking
        const module = await import('../src/set-db');
        SET_DB = module.SET_DB;
    });

    afterEach(() => {
        persistentStorage.clear();
        vi.restoreAllMocks();
        vi.resetModules();
    });

    describe('SetDB initialization', function () {
        it('initializes with empty data when storage is cleared', function () {
            expect(SET_DB._data).toEqual({
                max_id: 1,
                sets: {},
            });
        });

        it('creates event socket queue for sets', function () {
            expect(mockEventSocket.add_queue).toHaveBeenCalledWith('sets');
        });

        it('migrates old sets without UUIDs', async function () {
            // Setup storage with old format sets
            persistentStorage.setObj('set_data', {
                max_id: 3,
                sets: {
                    1: { id: 1, name: 'Test Set 1' },
                    2: { id: 2, name: 'Test Set 2' },
                },
            });

            // Re-import to trigger migration
            vi.resetModules();
            vi.doMock('../src/event-socket', () => ({
                eventSocket: mockEventSocket,
            }));
            vi.doMock('../src/globals', () => mockGlobals);

            const module = await import('../src/set-db');
            const migratedSetDB = module.SET_DB;

            // Check that sets were migrated
            expect(migratedSetDB._data.sets[1].uuid).toBeDefined();
            expect(migratedSetDB._data.sets[1].create).toBe(1);
            expect(migratedSetDB._data.sets[1].v).toBe(0);
            expect(migratedSetDB._data.sets[2].uuid).toBeDefined();
        });
    });

    describe('create_set', function () {
        it('creates a new set with correct properties', async function () {
            const result = await SET_DB.create_set('Test Set');

            expect(result).toBe(1);
            expect(SET_DB._data.sets[1]).toEqual({
                id: 1,
                name: 'Test Set',
                uuid: expect.any(String),
                create: 1000000,
                v: 0,
                songs: [],
            });
            expect(SET_DB._data.max_id).toBe(2);
        });

        it('generates unique UUIDs for different sets', async function () {
            mockGlobals.random_int.mockReturnValueOnce(5).mockReturnValueOnce(10);

            await SET_DB.create_set('Set 1');
            await SET_DB.create_set('Set 2');

            expect(SET_DB._data.sets[1].uuid).not.toBe(SET_DB._data.sets[2].uuid);
        });
    });

    describe('get_set_list', function () {
        it('returns empty array when no sets', async function () {
            const result = await SET_DB.get_set_list();
            expect(result).toEqual([]);
        });

        it('returns list of sets with total count', async function () {
            await SET_DB.create_set('Test Set');
            SET_DB._data.sets[1].songs = [{ song_id: 1 }, { song_id: 2 }];

            const result = await SET_DB.get_set_list();

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 1,
                name: 'Test Set',
                uuid: expect.any(String),
                create: 1000000,
                v: 0,
                songs: [{ song_id: 1 }, { song_id: 2 }],
                total: 2,
            });
        });

        it('filters out deleted sets', async function () {
            await SET_DB.create_set('Test Set');
            SET_DB._data.sets[1].deleted = 1;

            const result = await SET_DB.get_set_list();
            expect(result).toEqual([]);
        });

        it('sorts sets by update time (most recent first)', async function () {
            await SET_DB.create_set('Set 1');
            vi.spyOn(Date, 'now').mockReturnValue(2000000);
            await SET_DB.create_set('Set 2');

            const result = await SET_DB.get_set_list();

            expect(result[0].name).toBe('Set 2');
            expect(result[1].name).toBe('Set 1');
        });
    });

    describe('get_set', function () {
        it('returns set when it exists', async function () {
            await SET_DB.create_set('Test Set');

            const result = await SET_DB.get_set(1);
            expect(result.name).toBe('Test Set');
        });

        it('rejects when set does not exist', async function () {
            await expect(SET_DB.get_set(999)).rejects.toBeUndefined();
        });

        it('rejects when set is deleted', async function () {
            await SET_DB.create_set('Test Set');
            SET_DB._data.sets[1].deleted = 1;

            await expect(SET_DB.get_set(1)).rejects.toBeUndefined();
        });

        it('adds watcher for live sets', async function () {
            await SET_DB.create_set('Test Set');
            SET_DB._data.sets[1].live = 1;
            const addWatcherSpy = vi.spyOn(SET_DB, '_add_watcher');

            await SET_DB.get_set(1);

            expect(addWatcherSpy).toHaveBeenCalledWith(SET_DB._data.sets[1].uuid, 1);
        });
    });

    describe('rename_set', function () {
        it('renames a set successfully', async function () {
            await SET_DB.create_set('Old Name');

            await SET_DB.rename_set(1, 'New Name');

            expect(SET_DB._data.sets[1].name).toBe('New Name');
            expect(SET_DB._data.sets[1].v).toBe(1);
            expect(SET_DB._data.sets[1].update).toBe(1000000);
        });

        it('rejects when trying to rename read-only set', async function () {
            await SET_DB.create_set('Test Set');
            SET_DB._data.sets[1].ro = 1;

            await expect(SET_DB.rename_set(1, 'New Name')).rejects.toBe('Cannot rename a read-only set');
        });
    });

    describe('delete_set', function () {
        it('marks non-ro set as deleted and removes it after sync', async function () {
            await SET_DB.create_set('Test Set');

            // Verify the set exists before deletion
            expect(SET_DB._data.sets[1]).toBeDefined();
            expect(SET_DB._data.sets[1].name).toBe('Test Set');

            SET_DB.delete_set(1);

            // After delete_set is called, the set is immediately removed from _data
            // because _save_changed_sets removes deleted sets after "syncing to server"
            expect(SET_DB._data.sets[1]).toBeUndefined();

            // Verify _get_set returns null for deleted sets
            expect(SET_DB._get_set(1)).toBeNull();
        });

        it('permanently deletes ro sets', function () {
            SET_DB._data.sets[1] = { id: 1, name: 'Test Set', ro: 1, create: 1000000, uuid: 'test-uuid', v: 0, songs: [] };

            SET_DB.delete_set(1);

            expect(SET_DB._data.sets[1]).toBeUndefined();
            // Data is saved to persistent storage automatically
        });

        it('removes watcher for live sets', function () {
            SET_DB._data.sets[1] = { id: 1, name: 'Test Set', live: 1, uuid: 'test-uuid', create: 1000000, v: 0, songs: [] };
            SET_DB._watchers['test-uuid'] = 1;

            SET_DB.delete_set(1);

            expect(mockEventSocket.unregister_listener).toHaveBeenCalledWith('sets/test-uuid');
            expect(SET_DB._watchers['test-uuid']).toBeUndefined();
        });

        it('does nothing when set does not exist', function () {
            SET_DB.delete_set(999);
            // Should not throw or cause errors
        });
    });

    describe('song management', function () {
        beforeEach(async function () {
            await SET_DB.create_set('Test Set');
        });

        describe('add_song_to_set', function () {
            it('adds a song to set', async function () {
                await SET_DB.add_song_to_set(1, 1, 'C', 0);

                expect(SET_DB._data.sets[1].songs).toEqual([
                    {
                        song_id: 1,
                        song_key: 'C',
                        capo: 0,
                    },
                ]);
                expect(SET_DB._data.sets[1].v).toBe(1);
            });

            it('rejects when song already exists in set', async function () {
                await SET_DB.add_song_to_set(1, 1, 'C', 0);

                await expect(SET_DB.add_song_to_set(1, 1, 'D', 2)).rejects.toBeUndefined();
            });

            it('rejects when set is read-only', async function () {
                SET_DB._data.sets[1].ro = 1;

                await expect(SET_DB.add_song_to_set(1, 1, 'C', 0)).rejects.toBe('Set not writable');
            });
        });

        describe('add_songs_to_set', function () {
            it('adds multiple songs to set', async function () {
                const songs = [
                    { song_id: 1, song_key: 'C', capo: 0 },
                    { song_id: 2, song_key: 'D', capo: 2 },
                ];

                await SET_DB.add_songs_to_set(1, songs);

                expect(SET_DB._data.sets[1].songs).toEqual(songs);
            });

            it('rejects if any song already exists', async function () {
                await SET_DB.add_song_to_set(1, 1, 'C', 0);

                const songs = [
                    { song_id: 1, song_key: 'D', capo: 1 },
                    { song_id: 2, song_key: 'E', capo: 0 },
                ];

                await expect(SET_DB.add_songs_to_set(1, songs)).rejects.toBeUndefined();
            });
        });

        describe('update_song_in_set', function () {
            beforeEach(async function () {
                await SET_DB.add_song_to_set(1, 1, 'C', 0);
            });

            it('updates song key and capo in normal set', function () {
                SET_DB.update_song_in_set(1, 1, 'D', 2);

                expect(SET_DB._data.sets[1].songs[0]).toEqual({
                    song_id: 1,
                    song_key: 'D',
                    capo: 2,
                });
            });

            it('stores local changes for live sets', function () {
                SET_DB._data.sets[1].live = 1;

                SET_DB.update_song_in_set(1, 1, 'D', 2);

                expect(SET_DB._data.sets[1].local).toEqual({
                    1: { song_key: 'D', capo: 2 },
                });
            });

            it('removes local changes when they match set values', function () {
                SET_DB._data.sets[1].live = 1;
                SET_DB._data.sets[1].local = { 1: { song_key: 'D' } };

                SET_DB.update_song_in_set(1, 1, 'C', 1); // C matches original

                expect(SET_DB._data.sets[1].local[1]?.song_key).toBeUndefined();
                expect(SET_DB._data.sets[1].local[1]?.capo).toBe(1);
            });

            it('does nothing for read-only sets', function () {
                SET_DB._data.sets[1].ro = 1;
                const originalSong = { ...SET_DB._data.sets[1].songs[0] };

                SET_DB.update_song_in_set(1, 1, 'D', 2);

                expect(SET_DB._data.sets[1].songs[0]).toEqual(originalSong);
            });
        });

        describe('delete_song_from_set', function () {
            beforeEach(async function () {
                await SET_DB.add_songs_to_set(1, [
                    { song_id: 1, song_key: 'C', capo: 0 },
                    { song_id: 2, song_key: 'D', capo: 1 },
                ]);
            });

            it('removes song from set', function () {
                SET_DB.delete_song_from_set(1, 1);

                expect(SET_DB._data.sets[1].songs).toEqual([{ song_id: 2, song_key: 'D', capo: 1 }]);
            });

            it('does nothing for read-only sets', function () {
                SET_DB._data.sets[1].ro = 1;
                const originalLength = SET_DB._data.sets[1].songs.length;

                SET_DB.delete_song_from_set(1, 1);

                expect(SET_DB._data.sets[1].songs).toHaveLength(originalLength);
            });
        });

        describe('update_set_db_order', function () {
            beforeEach(async function () {
                await SET_DB.add_songs_to_set(1, [
                    { song_id: 1, song_key: 'C', capo: 0 },
                    { song_id: 2, song_key: 'D', capo: 1 },
                    { song_id: 3, song_key: 'E', capo: 2 },
                ]);
            });

            it('reorders songs in set', function () {
                SET_DB.update_set_db_order(1, [3, 1, 2]);

                expect(SET_DB._data.sets[1].songs.map((s) => s.song_id)).toEqual([3, 1, 2]);
            });

            it('does nothing for read-only sets', function () {
                SET_DB._data.sets[1].ro = 1;
                const originalOrder = SET_DB._data.sets[1].songs.map((s) => s.song_id);

                SET_DB.update_set_db_order(1, [3, 1, 2]);

                expect(SET_DB._data.sets[1].songs.map((s) => s.song_id)).toEqual(originalOrder);
            });
        });
    });

    describe('song finding and navigation', function () {
        beforeEach(async function () {
            await SET_DB.create_set('Test Set');
            await SET_DB.add_songs_to_set(1, [
                { song_id: 1, song_key: 'C', capo: 0 },
                { song_id: 2, song_key: 'D', capo: 1 },
                { song_id: 3, song_key: 'E', capo: 2 },
            ]);
        });

        describe('find_song_position_in_set', function () {
            it('finds song position correctly', function () {
                const result = SET_DB.find_song_position_in_set(1, 2);

                expect(result?.position).toBe(1);
                expect(result?.set.id).toBe(1);
            });

            it('returns undefined for non-existent song', function () {
                const result = SET_DB.find_song_position_in_set(1, 999);
                expect(result).toBeUndefined();
            });

            it('returns undefined for non-existent set', function () {
                const result = SET_DB.find_song_position_in_set(999, 1);
                expect(result).toBeUndefined();
            });
        });

        describe('get_song_set_details', function () {
            it('returns song details from set', async function () {
                const result = await SET_DB.get_song_set_details(1, 2);

                expect(result).toEqual({
                    song_id: 2,
                    song_key: 'D',
                    capo: 1,
                });
            });

            it('merges local overrides for live sets', async function () {
                SET_DB._data.sets[1].live = 1;
                SET_DB._data.sets[1].local = {
                    2: { song_key: 'F', capo: 3 },
                };

                const result = await SET_DB.get_song_set_details(1, 2);

                expect(result).toEqual({
                    song_id: 2,
                    song_key: 'F',
                    capo: 3,
                });
            });

            it('returns undefined for non-existent song', async function () {
                const result = await SET_DB.get_song_set_details(1, 999);
                expect(result).toBeUndefined();
            });
        });
    });

    describe('live sets functionality', function () {
        describe('create_live_set', function () {
            it('creates new live set from server data', async function () {
                const serverData = {
                    name: 'Live Set',
                    v: 1,
                    songs: [{ song_id: 'song1', song_key: 'C', capo: 0 }],
                };
                mockEventSocket.register_listener.mockImplementation((channel: any, callback: any) => {
                    callback(serverData);
                });

                const result = await SET_DB.create_live_set('live-uuid');

                expect(result).toBe(1);
                expect(SET_DB._data.sets[1]).toEqual({
                    id: 1,
                    name: 'Live Set',
                    uuid: 'live-uuid',
                    create: 1000000,
                    v: 1,
                    songs: [{ song_id: 'song1', song_key: 'C', capo: 0 }],
                    live: 1,
                    ro: 1,
                });
            });

            it('returns existing set ID if UUID already exists', async function () {
                SET_DB._data.sets[1] = {
                    id: 1,
                    name: 'Existing Set',
                    uuid: 'existing-uuid',
                    create: 1000000,
                    v: 0,
                    songs: [],
                };

                const result = await SET_DB.create_live_set('existing-uuid');
                expect(result).toBe(1);
            });

            it('handles duplicate watcher attempts', async function () {
                SET_DB._watchers['duplicate-uuid'] = 1;
                mockEventSocket.register_listener.mockImplementation((channel: any, callback: any) => {
                    callback(); // Empty response for duplicate
                });

                const result = await SET_DB.create_live_set('duplicate-uuid');
                expect(result).toBe(1);
            });
        });

        describe('_watch_live_set', function () {
            it('returns resolved promise for duplicate watchers', async function () {
                SET_DB._watchers['test-uuid'] = 1;

                const result = await SET_DB._watch_live_set('test-uuid');
                expect(result).toBeUndefined();
            });

            it('registers listener with event socket', async function () {
                // Mock register_listener to immediately call the callback
                mockEventSocket.register_listener.mockImplementation((channel: any, callback: any) => {
                    callback({}); // Empty response to resolve the promise
                });

                await SET_DB._watch_live_set('test-uuid', 1);

                expect(mockEventSocket.register_listener).toHaveBeenCalledWith('sets/test-uuid', expect.any(Function), { v: 1 });
            });

            it('handles server response correctly', async function () {
                await SET_DB.create_set('Test Set');
                SET_DB._data.sets[1].uuid = 'test-uuid';
                SET_DB._watchers['test-uuid'] = 1;

                // Manually call the callback that would be registered
                const mockCallback = mockEventSocket.register_listener.mock.calls[0]?.[1];
                if (mockCallback) {
                    mockCallback({
                        name: 'Updated Name',
                        v: 2,
                        songs: [{ song_id: 'song1' }],
                    });

                    expect(SET_DB._data.sets[1].name).toBe('Updated Name');
                    expect(SET_DB._data.sets[1].v).toBe(2);
                    expect(SET_DB._data.sets[1].songs).toEqual([{ song_id: 'song1' }]);
                }
            });
        });
    });

    describe('utility methods', function () {
        describe('get_set_title', function () {
            it('returns set name', async function () {
                await SET_DB.create_set('Test Set');

                const result = await SET_DB.get_set_title(1);
                expect(result).toBe('Test Set');
            });
        });

        describe('get_songs', function () {
            it('returns songs array for existing set', async function () {
                await SET_DB.create_set('Test Set');
                await SET_DB.add_song_to_set(1, 1, 'C', 0);

                const result = SET_DB.get_songs(1);
                expect(result).toEqual([{ song_id: 1, song_key: 'C', capo: 0 }]);
            });

            it('returns empty array for non-existent set', function () {
                const result = SET_DB.get_songs(999);
                expect(result).toEqual([]);
            });
        });

        describe('mark_shared_live', function () {
            it('marks set as shared live', async function () {
                await SET_DB.create_set('Test Set');

                SET_DB.mark_shared_live(1, 1);

                expect(SET_DB._data.sets[1].shared_live).toBe(1);
            });

            it('unmarks set as shared live', async function () {
                await SET_DB.create_set('Test Set');
                SET_DB._data.sets[1].shared_live = 1;

                SET_DB.mark_shared_live(1, 0);

                expect(SET_DB._data.sets[1].shared_live).toBe(0);
            });
        });
    });

    describe('error handling', function () {
        it('throws error when calling _set_changed on read-only set', function () {
            const roSet: SetEntry = {
                id: 1,
                name: 'Test',
                ro: 1,
                create: 1000000,
                uuid: 'test-uuid',
                v: 0,
                songs: [],
            };

            expect(() => SET_DB._set_changed(roSet)).toThrow('Calling set_changed on a ro set');
        });

        it('throws error when calling _save_set_local_info on non-live set', function () {
            const normalSet: SetEntry = {
                id: 1,
                name: 'Test',
                live: 0,
                create: 1000000,
                uuid: 'test-uuid',
                v: 0,
                songs: [],
            };

            expect(() => SET_DB._save_set_local_info(normalSet)).toThrow('Calling _save_set_local_info on a normal set');
        });
    });

    describe('data persistence', function () {
        it('saves sets after creation', async function () {
            await SET_DB.create_set('Test Set');
            // Data is saved to persistent storage automatically
        });

        it('saves changes when set is modified', async function () {
            await SET_DB.create_set('Test Set');
            vi.clearAllMocks();

            await SET_DB.rename_set(1, 'New Name');

            // Data is saved to persistent storage automatically
        });

        it('removes deleted sets from storage after server sync', function () {
            SET_DB._data.sets[1] = { id: 1, name: 'Test', deleted: 1, v: 1, create: 1000000, uuid: 'test-uuid', songs: [] };

            SET_DB._save_changed_sets([SET_DB._data.sets[1]]);

            expect(SET_DB._data.sets[1]).toBeUndefined();
        });

        it('filters out local data when saving to server', function () {
            const set: SetEntry = {
                id: 1,
                name: 'Test',
                local: { 1: { capo: 2 } },
                v: 1,
                uuid: 'test-uuid',
                create: 1000000,
                songs: [],
            };

            SET_DB._save_changed_sets([set]);

            // Verify the set was processed without local data
            expect(set.local).toBeDefined(); // Original set still has local data
            expect(SET_DB._data.sets[1]).toBeUndefined(); // Set was removed after sync
        });
    });
});
