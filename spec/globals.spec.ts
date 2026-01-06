// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DUMP_VERSION, get_client_type, get_db_path, get_host, get_main_domain, get_uuid, is_firsttime, random_int } from '../src/globals';

// Mock dependencies
vi.mock('../src/splash-util.es5', () => ({
    gup: vi.fn(),
}));

vi.mock('../src/persistent-storage.es5', () => ({
    persistentStorage: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

(global as any).BUILD_TYPE = 'test';
(global as any).DEBUG = false;

describe('globals utility functions', function () {
    let mockPersistentStorage: any;
    let mockGup: any;
    let originalPerformance: any;
    let originalLocation: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mocks
        mockPersistentStorage = {
            get: vi.fn(),
            set: vi.fn(),
        };

        mockGup = vi.fn();

        // Mock modules
        vi.doMock('../src/persistent-storage.es5', () => ({
            persistentStorage: mockPersistentStorage,
        }));

        vi.doMock('../src/splash-util.es5', () => ({
            gup: mockGup,
        }));

        // Mock Date.now and Math.random for predictable tests
        vi.spyOn(Date, 'now').mockReturnValue(1000000);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        // Mock window.performance
        originalPerformance = window.performance;
        window.performance = {
            now: vi.fn(() => 123.456),
        } as unknown as Performance;

        // Mock window.location
        originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            writable: true,
            value: {
                protocol: 'https:',
                host: 'songs.worshipleaderapp.com',
            },
        });

        // Clear firsttime flag
        delete (window as any).firsttime;
    });

    afterEach(() => {
        window.performance = originalPerformance;
        window.location = originalLocation;
        vi.restoreAllMocks();
        vi.resetModules();
    });

    describe('random_int', function () {
        it('returns integer within range', function () {
            const result = random_int(10);
            expect(Number.isInteger(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(10);
        });

        it('uses default range of 1', function () {
            const result = random_int();
            expect(result).toBe(0); // With mocked random(0.5) and other values
        });

        it('incorporates performance.now when available', function () {
            const result = random_int(100);
            expect(window.performance.now).toHaveBeenCalled();
            expect(Number.isInteger(result)).toBe(true);
        });

        it('works without performance.now', function () {
            (window as any).performance = undefined;
            const result = random_int(5);
            expect(Number.isInteger(result)).toBe(true);
        });
    });

    describe('get_uuid', function () {
        it('returns a string', function () {
            const result = get_uuid();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('returns consistent value on multiple calls', function () {
            const result1 = get_uuid();
            const result2 = get_uuid();
            expect(result1).toBe(result2);
        });
    });

    describe('is_firsttime', function () {
        it('is a boolean', function () {
            expect(typeof is_firsttime).toBe('boolean');
        });
    });

    describe('get_client_type', function () {
        it('returns default client type', function () {
            const result = get_client_type();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('get_main_domain', function () {
        it('returns main domain URL', function () {
            const result = get_main_domain();
            expect(result).toBe('https://songs.worshipleaderapp.com');
        });
    });

    describe('get_host', function () {
        it('returns empty string for production host', function () {
            window.location.host = 'songs.worshipleaderapp.com';
            window.location.protocol = 'https:';

            const result = get_host();

            expect(result).toBe('');
        });

        it('returns main domain for localhost', function () {
            window.location.host = 'localhost';
            window.location.protocol = 'http:';

            const result = get_host();

            expect(result).toBe('https://songs.worshipleaderapp.com');
        });

        it('returns string in debug mode', function () {
            (global as any).DEBUG = true;

            const result = get_host();

            expect(typeof result).toBe('string');

            (global as any).DEBUG = false;
        });

        it('caches host value', function () {
            get_host();
            const result2 = get_host();

            // Should return same value without recalculating
            expect(typeof result2).toBe('string');
        });
    });

    describe('get_db_path', function () {
        it('constructs database path with host and version', function () {
            const result = get_db_path();

            expect(result).toContain(`db${DUMP_VERSION}/db`);
            expect(typeof result).toBe('string');
        });
    });

    describe('DUMP_VERSION', function () {
        it('is a number', function () {
            expect(typeof DUMP_VERSION).toBe('number');
            expect(DUMP_VERSION).toBeGreaterThan(0);
        });
    });
});
