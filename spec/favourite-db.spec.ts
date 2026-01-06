// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FavouriteDB } from '../src/favourite-db';

// Mock dependencies
vi.mock('../src/db', () => ({
    DB: Promise.resolve({
        type: () => 'offline',
        set_favourite: vi.fn(),
    }),
}));

vi.mock('../src/persistent-storage.es5', () => ({
    persistentStorage: {
        getObj: vi.fn(),
        setObj: vi.fn(),
    },
}));

describe('favourite-db functions', function () {
    let mockPersistentStorage: any;
    let mockDb: any;
    let FAVOURITE_DB: FavouriteDB;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // Setup mocks
        mockPersistentStorage = {
            getObj: vi.fn(() => ({})),
            setObj: vi.fn(),
        };

        mockDb = {
            type: () => 'offline',
            set_favourite: vi.fn(),
        };

        vi.doMock('../src/persistent-storage.es5', () => ({
            persistentStorage: mockPersistentStorage,
        }));

        vi.doMock('../src/db', () => ({
            DB: Promise.resolve(mockDb),
        }));

        // Import the module after mocking
        const module = await import('../src/favourite-db');
        FAVOURITE_DB = module.FAVOURITE_DB;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
    });

    describe('FAVOURITE_DB instance', function () {
        it('initializes with data from persistent storage', function () {
            expect(mockPersistentStorage.getObj).toHaveBeenCalledWith('favourites', {});
        });

        it('has required methods', function () {
            expect(typeof FAVOURITE_DB.get_favourite).toBe('function');
            expect(typeof FAVOURITE_DB.set_favourite).toBe('function');
            expect(typeof FAVOURITE_DB.get_favourites).toBe('function');
            expect(typeof FAVOURITE_DB.get_rating).toBe('function');
            expect(typeof FAVOURITE_DB.set_rating).toBe('function');
        });
    });

    describe('get_favourite', function () {
        it('returns false for non-existent song', function () {
            const result = FAVOURITE_DB.get_favourite(999);
            expect(result).toBe(false);
        });

        it('returns true for favourited song', function () {
            mockPersistentStorage.getObj.mockReturnValue({
                1: { favourite: 1 },
            });
            // Reinitialize with new data
            FAVOURITE_DB._data = mockPersistentStorage.getObj();

            const result = FAVOURITE_DB.get_favourite(1);
            expect(result).toBe(true);
        });

        it('returns false for unfavourited song', function () {
            mockPersistentStorage.getObj.mockReturnValue({
                1: { favourite: 0 },
            });
            FAVOURITE_DB._data = mockPersistentStorage.getObj();

            const result = FAVOURITE_DB.get_favourite(1);
            expect(result).toBe(false);
        });
    });

    describe('get_favourites', function () {
        it('returns empty object when no favourites', function () {
            const result = FAVOURITE_DB.get_favourites();
            expect(result).toEqual({});
        });

        it('returns object with favourited song IDs', function () {
            mockPersistentStorage.getObj.mockReturnValue({
                1: { favourite: 1 },
                2: { favourite: 0 },
                3: { favourite: 1 },
            });
            FAVOURITE_DB._data = mockPersistentStorage.getObj();

            const result = FAVOURITE_DB.get_favourites();
            expect(result).toEqual({
                '1': 1,
                '3': 1,
            });
        });
    });

    describe('set_favourite', function () {
        it('sets favourite to true', function () {
            FAVOURITE_DB.set_favourite(1, true);

            expect(FAVOURITE_DB._data['1'].favourite).toBe(1);
            expect(mockPersistentStorage.setObj).toHaveBeenCalledWith('favourites', expect.any(Object));
        });

        it('sets favourite to false', function () {
            FAVOURITE_DB.set_favourite(1, false);

            expect(FAVOURITE_DB._data['1'].favourite).toBe(0);
            expect(mockPersistentStorage.setObj).toHaveBeenCalledWith('favourites', expect.any(Object));
        });

        it('updates offline database when available', async function () {
            FAVOURITE_DB.set_favourite(1, true);

            // Allow promise to resolve
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockDb.set_favourite).toHaveBeenCalledWith(1, 1);
        });
    });

    describe('get_rating', function () {
        it('returns 0 for non-existent song', function () {
            const result = FAVOURITE_DB.get_rating(999);
            expect(result).toBe(0);
        });

        it('returns stored rating', function () {
            mockPersistentStorage.getObj.mockReturnValue({
                1: { rating: 5 },
            });
            FAVOURITE_DB._data = mockPersistentStorage.getObj();

            const result = FAVOURITE_DB.get_rating(1);
            expect(result).toBe(5);
        });

        it('returns 0 when no rating set', function () {
            mockPersistentStorage.getObj.mockReturnValue({
                1: { favourite: 1 },
            });
            FAVOURITE_DB._data = mockPersistentStorage.getObj();

            const result = FAVOURITE_DB.get_rating(1);
            expect(result).toBe(0);
        });
    });

    describe('set_rating', function () {
        it('sets rating for song', function () {
            FAVOURITE_DB.set_rating(1, 4);

            expect(FAVOURITE_DB._data['1'].rating).toBe(4);
            expect(mockPersistentStorage.setObj).toHaveBeenCalledWith('favourites', expect.any(Object));
        });

        it('overwrites existing rating', function () {
            FAVOURITE_DB.set_rating(1, 3);
            FAVOURITE_DB.set_rating(1, 5);

            expect(FAVOURITE_DB._data['1'].rating).toBe(5);
        });
    });

    describe('_save method', function () {
        it('removes empty song entries', function () {
            FAVOURITE_DB._data = {
                song1: { favourite: 1 },
                song2: {}, // Should be removed
                song3: { rating: 3 },
            };

            FAVOURITE_DB._save();

            expect('song2' in FAVOURITE_DB._data).toBe(false);
            expect('song1' in FAVOURITE_DB._data).toBe(true);
            expect('song3' in FAVOURITE_DB._data).toBe(true);
        });

        it('saves data to persistent storage', function () {
            FAVOURITE_DB._data = { song1: { favourite: 1 } };

            FAVOURITE_DB._save();

            expect(mockPersistentStorage.setObj).toHaveBeenCalledWith('favourites', FAVOURITE_DB._data);
        });
    });
});
