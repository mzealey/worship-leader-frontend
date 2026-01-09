// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistentStorage } from '../src/persistent-storage.es5';
import { decode_uri_parameter, gup, is_bot } from '../src/splash-util.es5';

describe('splash-util functions', function () {
    let originalNavigator: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        persistentStorage.clear();

        // Mock navigator
        originalNavigator = window.navigator;
        Object.defineProperty(window, 'navigator', {
            writable: true,
            value: { userAgent: 'test browser' },
        });

        // Mock location
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { hash: '' },
        });
    });

    afterEach(() => {
        window.navigator = originalNavigator;
    });

    describe('is_bot', function () {
        it('returns false for non-www builds', function () {
            const result = is_bot();

            expect(result).toBe(false);
        });

        it('detects bot from user agent in www build', function () {
            Object.defineProperty(window, 'navigator', {
                writable: true,
                value: { userAgent: 'Mozilla/5.0 (compatible; bot/1.0)' },
            });

            const result = is_bot();

            expect(result).toBeTruthy();
        });

        it('returns false for normal user agent in www build', function () {
            Object.defineProperty(window, 'navigator', {
                writable: true,
                value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            });

            const result = is_bot();

            expect(result).toBeFalsy();
        });
    });

    describe('decode_uri_parameter', function () {
        it('decodes URI components', function () {
            const result = decode_uri_parameter('hello%20world');

            expect(result).toBe('hello world');
        });

        it('replaces plus signs with spaces', function () {
            const result = decode_uri_parameter('hello+world');

            expect(result).toBe('hello world');
        });

        it('handles combined encoding', function () {
            const result = decode_uri_parameter('hello+world%21');

            expect(result).toBe('hello world!');
        });

        it('handles empty string', function () {
            const result = decode_uri_parameter('');

            expect(result).toBe('');
        });
    });

    describe('gup', function () {
        it('extracts parameter from window location hash', function () {
            window.location.hash = '#page?param1=value1&param2=value2';

            const result = gup('param1');

            expect(result).toBe('value1');
        });

        it('extracts parameter from provided location', function () {
            const result = gup('param2', '#page?param1=value1&param2=value2');

            expect(result).toBe('value2');
        });

        it('returns undefined for non-existent parameter', function () {
            window.location.hash = '#page?param1=value1';

            const result = gup('nonexistent');

            expect(result).toBeUndefined();
        });

        it('handles location without query string', function () {
            window.location.hash = '#page';

            const result = gup('param1');

            expect(result).toBeUndefined();
        });

        it('handles empty parameter value', function () {
            window.location.hash = '#page?param1=&param2=value2';

            const result = gup('param1');

            expect(result).toBe('');
        });

        it('skips empty parameter names', function () {
            window.location.hash = '#page?=value&param1=value1';

            const result = gup('param1');

            expect(result).toBe('value1');
        });

        it('handles URL encoded parameters', function () {
            window.location.hash = '#page?param1=hello%20world&param2=test+value';

            expect(gup('param1')).toBe('hello world');
            expect(gup('param2')).toBe('test value');
        });

        it('removes fragment identifier from provided location', function () {
            const result = gup('param1', 'https://example.com/path#page?param1=value1');

            expect(result).toBe('value1');
        });
    });
});
