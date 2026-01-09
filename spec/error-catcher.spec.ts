// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    sendReport: vi.fn(),
    fromError: vi.fn().mockResolvedValue([]),
}));

vi.mock('stacktrace-js', () => {
    return {
        __esModule: true,
        fromError: mocks.fromError,
        default: { fromError: mocks.fromError },
    };
});

vi.mock('../src/db', () => ({
    DB_AVAILABLE: Promise.resolve({ type: () => 'mock_db' }),
}));

vi.mock('../src/event-socket', () => ({
    eventSocket: {
        add_queue: () => mocks.sendReport,
    },
}));

vi.mock('../src/langpack', () => ({
    useAppLang: {
        getState: () => ({ appLang: 'en' }),
    },
}));

vi.mock('../src/persistent-storage.es5', () => ({
    persistentStorage: {
        type: () => 'mock_storage',
    },
}));

describe('error-catcher', () => {
    let errorCatcherMod: typeof import('../src/error-catcher');
    let originalDebug: unknown;
    let originalBuildType: unknown;
    let originalAppVersion: unknown;
    let originalOnError: OnErrorEventHandler;

    beforeAll(async () => {
        (globalThis as Record<string, unknown>).DEBUG = false;
        (globalThis as Record<string, unknown>).BUILD_TYPE = 'test';
        (globalThis as Record<string, unknown>).APP_VERSION = '1.0.0';

        errorCatcherMod = await import('../src/error-catcher');
    });

    beforeEach(() => {
        mocks.sendReport.mockClear();
        mocks.fromError.mockClear();
        mocks.fromError.mockResolvedValue([]);

        originalDebug = (globalThis as Record<string, unknown>).DEBUG;
        originalBuildType = (globalThis as Record<string, unknown>).BUILD_TYPE;
        originalAppVersion = (globalThis as Record<string, unknown>).APP_VERSION;
        originalOnError = window.onerror;

        (globalThis as Record<string, unknown>).DEBUG = false;
        (globalThis as Record<string, unknown>).BUILD_TYPE = 'test';
        (globalThis as Record<string, unknown>).APP_VERSION = '1.0.0';
    });

    afterEach(() => {
        (globalThis as Record<string, unknown>).DEBUG = originalDebug;
        (globalThis as Record<string, unknown>).BUILD_TYPE = originalBuildType;
        (globalThis as Record<string, unknown>).APP_VERSION = originalAppVersion;
        window.onerror = originalOnError;
    });

    it('sends report with basic info', async () => {
        errorCatcherMod.send_error_report('test_type', 'some error');

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mocks.sendReport).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'test_type',
                error_obj: 'some error',
                v: '1.0.0',
                b: 'test',
                l: expect.any(String),
                s: 'mock_storage',
                ui: 'en',
            }),
        );
    });

    it('uses StackTrace for Error objects', async () => {
        const err = new Error('boom');
        const mockFrames = [{ toString: () => 'frame1' }, { toString: () => 'frame2' }];
        mocks.fromError.mockResolvedValue(mockFrames);

        errorCatcherMod.send_error_report('crash', err);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mocks.sendReport).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'crash',
                error_obj: err,
                frames: ['frame1', 'frame2'],
            }),
        );
    });

    it('handles StackTrace failure', async () => {
        const err = new Error('boom');
        mocks.fromError.mockRejectedValue('stacktrace failed');

        errorCatcherMod.send_error_report('crash', err);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mocks.sendReport).toHaveBeenCalledWith(
            expect.objectContaining({
                failure_msg: 'stacktrace failed',
            }),
        );
    });

    it('extracts string from object with toString', async () => {
        const obj = { toString: () => 'custom error' };
        errorCatcherMod.send_error_report('oops', obj);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mocks.sendReport).toHaveBeenCalledWith(
            expect.objectContaining({
                msg: 'custom error',
            }),
        );
    });

    it('setup_error_catcher hooks window.onerror', async () => {
        errorCatcherMod.setup_error_catcher();

        expect(window.onerror).not.toBe(originalOnError);
        expect(typeof window.onerror).toBe('function');

        if (window.onerror) {
            (window.onerror as (msg: string, file: string, line: number, col: number, error: Error) => void)('msg', 'file.js', 10, 5, new Error('e'));
        }

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mocks.sendReport).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'unhandled',
                msg: 'msg',
            }),
        );
    });

    it('logs to console when DEBUG is true', async () => {
        (globalThis as Record<string, unknown>).DEBUG = true;
        vi.spyOn(console, 'error').mockImplementation(() => {});

        errorCatcherMod.send_error_report('test', 'data');

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(console.error).toHaveBeenCalled();
        expect(mocks.sendReport).not.toHaveBeenCalled();
    });
});
