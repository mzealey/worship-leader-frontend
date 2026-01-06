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
            get_db_path: vi.fn(() => '/test/path'),
        };

        mockPersistentStorage = {
            setObj: vi.fn(),
            getObj: vi.fn(),
        };

        (global as any).BUILD_TYPE = 'test';

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
});
