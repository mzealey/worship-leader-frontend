// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('error-catcher module', function () {
    let mockStackTrace: any;
    let mockEventSocket: any;
    let mockPersistentStorage: any;
    let mockDb: any;
    let mockLangpack: any;

    beforeEach(() => {
        // Mock StackTrace
        mockStackTrace = {
            fromError: vi.fn().mockResolvedValue([{ toString: () => 'frame1' }, { toString: () => 'frame2' }]),
        };

        // Mock dependencies
        mockEventSocket = {
            add_queue: vi.fn(() => vi.fn()),
        };

        mockPersistentStorage = {
            type: () => 'localStorage',
        };

        mockDb = {
            type: () => 'test-db',
        };

        mockLangpack = {
            app_lang: vi.fn(() => 'en'),
            useAppLang: {
                getState: vi.fn(() => ({ appLang: 'en' })),
            },
        };

        // Set up global mocks
        (global as any).DEBUG = false;
        (global as any).APP_VERSION = '1.0.0';
        (global as any).BUILD_TYPE = 'test';

        vi.doMock('stacktrace-js', () => ({
            default: mockStackTrace,
        }));

        vi.doMock('../src/event-socket', () => ({
            eventSocket: mockEventSocket,
        }));

        vi.doMock('../src/persistent-storage.es5', () => ({
            persistentStorage: mockPersistentStorage,
        }));

        vi.doMock('../src/db', () => ({
            DB_AVAILABLE: Promise.resolve(mockDb),
        }));

        vi.doMock('../src/langpack', () => mockLangpack);
    });

    afterEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it('imports without throwing', async function () {
        await expect(import('../src/error-catcher')).resolves.toBeDefined();
    });

    it('exports send_error_report function', async function () {
        const module = await import('../src/error-catcher');
        expect(typeof module.send_error_report).toBe('function');
    });

    it('exports setup_error_catcher function', async function () {
        const module = await import('../src/error-catcher');
        expect(typeof module.setup_error_catcher).toBe('function');
    });

    it('setup_error_catcher sets window.onerror', async function () {
        const module = await import('../src/error-catcher');
        const originalOnerror = window.onerror;

        module.setup_error_catcher();

        expect(typeof window.onerror).toBe('function');
        expect(window.onerror).not.toBe(originalOnerror);
    });

    it('send_error_report handles null error object', async function () {
        const module = await import('../src/error-catcher');

        expect(() => {
            module.send_error_report('test', null, { msg: 'test' });
        }).not.toThrow();
    });
});
