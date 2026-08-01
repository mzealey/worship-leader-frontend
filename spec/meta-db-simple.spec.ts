// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('meta-db module', function () {
    let mockUtil: any;
    let mockSpinner: any;
    let mockGlobals: any;
    let mockPersistentStorage: any;

    beforeEach(() => {
        // Set up mocks
        mockUtil = {
            fetch_json: vi.fn(),
        };

        mockSpinner = {
            spinner: vi.fn((promise) => promise),
        };

        mockGlobals = {
            DB_PATH: '/test/path',
            BUILD_TYPE: 'www',
        };

        mockPersistentStorage = {
            setObj: vi.fn(),
            getObj: vi.fn(),
        };

        vi.doMock('../src/util', () => mockUtil);
        vi.doMock('../src/spinner', () => mockSpinner);
        vi.doMock('../src/globals', () => mockGlobals);
        vi.doMock('../src/persistent-storage.es5', () => ({
            persistentStorage: mockPersistentStorage,
        }));

        // Mock Date.now()
        vi.spyOn(Date, 'now').mockReturnValue(1000000);
    });

    afterEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it('imports without throwing', async function () {
        await expect(import('../src/meta-db')).resolves.toBeDefined();
    });

    it('exports get_meta_db_update_ts function', async function () {
        const module = await import('../src/meta-db');
        expect(typeof module.get_meta_db_update_ts).toBe('function');
    });

    it('exports refresh_meta_db function', async function () {
        const module = await import('../src/meta-db');
        expect(typeof module.refresh_meta_db).toBe('function');
    });

    it('exports get_meta_db function', async function () {
        const module = await import('../src/meta-db');
        expect(typeof module.get_meta_db).toBe('function');
    });

    it('get_meta_db_update_ts calls persistentStorage.getObj', async function () {
        mockPersistentStorage.getObj.mockReturnValue(12345);

        const module = await import('../src/meta-db');
        const result = module.get_meta_db_update_ts();

        expect(mockPersistentStorage.getObj).toHaveBeenCalledWith('meta-db-update', 0);
        expect(result).toBe(12345);
    });

    it('refresh_meta_db calls fetch_json with correct URL', async function () {
        const testData = { test: 'data' };
        mockUtil.fetch_json.mockResolvedValue(testData);

        const module = await import('../src/meta-db');
        await module.refresh_meta_db();

        expect(mockUtil.fetch_json).toHaveBeenCalledWith('/test/path.smeta.json', { cache: 'no-store' });
    });

    it('get_meta_db loads from persistent storage when available', async function () {
        const storedData = { stored: 'data' };
        mockPersistentStorage.getObj.mockReturnValue(storedData);

        const module = await import('../src/meta-db');
        const result = await module.get_meta_db();

        expect(mockPersistentStorage.getObj).toHaveBeenCalledWith('meta-db');
        expect(result).toEqual(storedData);
    });

    it('get_meta_db triggers refresh when cache is expired', async function () {
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        // Set Date.now to a large value so that expiry works
        vi.mocked(Date.now).mockReturnValue(sevenDaysInMs + 1000000);

        const storedData = { stored: 'data' };
        const freshData = { fresh: 'data' };

        // Return stored data for first call, but update_ts is 1 (way way old)
        mockPersistentStorage.getObj.mockImplementation((key: string) => {
            if (key === 'meta-db') return storedData;
            if (key === 'meta-db-update') return 1;
            return undefined;
        });
        mockUtil.fetch_json.mockResolvedValue(freshData);

        const module = await import('../src/meta-db');
        const result = await module.get_meta_db();

        expect(result).toEqual(storedData);
        expect(mockUtil.fetch_json).toHaveBeenCalled();
    });

    it('refresh_meta_db obeys cooldown period', async function () {
        const testData1 = { test: 'data1' };
        const testData2 = { test: 'data2' };
        mockUtil.fetch_json.mockResolvedValue(testData1);

        const module = await import('../src/meta-db');

        // First refresh - should call fetch
        await module.refresh_meta_db();
        expect(mockUtil.fetch_json).toHaveBeenCalledTimes(1);

        // Set Date.now to just 30 minutes later
        vi.mocked(Date.now).mockReturnValue(1000000 + 30 * 60 * 1000);

        // Second refresh - should use cached promise (within 1 hour)
        mockUtil.fetch_json.mockResolvedValue(testData2);
        await module.refresh_meta_db();
        // Should not have called fetch again because within cooldown
        expect(mockUtil.fetch_json).toHaveBeenCalledTimes(1);
    });

    it('refresh_meta_db saves results to persistent storage', async function () {
        const testData = {
            tag_mappings: {},
            tag_groups: {},
            tags: {},
        };
        mockUtil.fetch_json.mockResolvedValue(testData);

        const module = await import('../src/meta-db');
        await module.refresh_meta_db();

        expect(mockPersistentStorage.setObj).toHaveBeenCalledWith('meta-db-update', 1000000);
        expect(mockPersistentStorage.setObj).toHaveBeenCalledWith('meta-db', testData);
    });
});
