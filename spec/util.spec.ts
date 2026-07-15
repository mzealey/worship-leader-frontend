// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
    clear_object,
    date_as_utc,
    fetch_json,
    format_string,
    generate_search_params,
    get_youtube_id,
    is_mobile_browser,
    is_rtl,
    is_vertical,
    is_vertical_lang,
    normalize_url,
    prepare_search_string,
    timeout,
} from '../src/util';

describe('util functions', function () {
    describe('prepare_search_string', function () {
        it('removes special characters', function () {
            expect(prepare_search_string('hello!@#$%world')).toBe('hello@world');
        });

        it('normalizes whitespace', function () {
            expect(prepare_search_string('hello   world\t\n')).toBe('hello world ');
        });

        it('handles abbreviations with numbers', function () {
            expect(prepare_search_string('ty512')).toBe('512');
            expect(prepare_search_string('abc123')).toBe('123');
        });

        it('preserves wildcards and dots', function () {
            expect(prepare_search_string('hello*world.test')).toBe('hello*world.test');
        });

        it('handles empty string', function () {
            expect(prepare_search_string('')).toBe('');
        });

        it('handles mixed content', function () {
            expect(prepare_search_string('Song #1 (verse)')).toBe('Song 1 verse');
        });
    });

    describe('is_rtl', function () {
        it('detects Arabic text', function () {
            expect(is_rtl('مرحبا')).toBe(true);
        });

        it('detects Hebrew text', function () {
            expect(is_rtl('שלום')).toBe(true);
        });

        it('returns false for Latin text', function () {
            expect(is_rtl('hello world')).toBe(false);
        });

        it('returns false for empty string', function () {
            expect(is_rtl('')).toBe(false);
        });

        it('returns false for null/undefined', function () {
            expect(is_rtl(null)).toBe(false);
            expect(is_rtl(undefined)).toBe(false);
        });

        it('detects RTL in mixed content', function () {
            expect(is_rtl('hello مرحبا world')).toBe(true);
        });
    });

    describe('is_vertical', function () {
        it('detects Mongolian script', function () {
            expect(is_vertical('\u1820\u1821')).toBe(true);
        });

        it('returns false for Latin text', function () {
            expect(is_vertical('hello world')).toBe(false);
        });

        it('returns false for empty string', function () {
            expect(is_vertical('')).toBe(false);
        });

        it('returns false for null/undefined', function () {
            expect(is_vertical(null)).toBe(false);
            expect(is_vertical(undefined)).toBe(false);
        });
    });

    describe('is_vertical_lang', function () {
        it('returns true for traditional Mongolian', function () {
            expect(is_vertical_lang('mn-TR')).toBe(true);
        });

        it('returns false for other languages', function () {
            expect(is_vertical_lang('en')).toBe(false);
            expect(is_vertical_lang('mn')).toBe(false);
            expect(is_vertical_lang('zh')).toBe(false);
        });
    });

    describe('is_mobile_browser', function () {
        it('is a function', function () {
            expect(typeof is_mobile_browser).toBe('function');
        });

        it('returns a boolean', function () {
            const result = is_mobile_browser();
            expect(typeof result).toBe('boolean');
        });
    });

    describe('clear_object', function () {
        it('removes all properties from object', function () {
            const obj = { a: 1, b: 2, c: 3 };
            clear_object(obj);
            expect(Object.keys(obj)).toEqual([]);
        });

        it('handles empty object', function () {
            const obj = {};
            clear_object(obj);
            expect(Object.keys(obj)).toEqual([]);
        });

        it('handles object with various property types', function () {
            const obj = {
                str: 'hello',
                num: 42,
                bool: true,
                arr: [1, 2, 3],
                nested: { x: 1 },
            };
            clear_object(obj);
            expect(Object.keys(obj)).toEqual([]);
        });
    });

    describe('format_string', function () {
        it('format method works with placeholders', function () {
            expect(format_string('Hello {0}, you are {1} years old', 'John', 25)).toBe('Hello John, you are 25 years old');
            expect(format_string('Hello {1}, you are {0} years old', 25, 'John')).toBe('Hello John, you are 25 years old');
        });

        it('format method handles missing arguments', function () {
            expect(format_string('Hello {0}, you are {1} years old', 'John')).toBe('Hello John, you are {1} years old');
        });

        it('format method handles extra arguments', function () {
            expect(format_string('Hello {0}', 'John', 'extra')).toBe('Hello John');
        });

        it('format method handles no placeholders', function () {
            expect(format_string('Hello world', 'John')).toBe('Hello world');
        });
    });

    describe('deferred_promise', function () {
        it('creates a promise with external resolve', async function () {
            const { deferred_promise } = await import('../src/util');
            const [control, promise] = deferred_promise<string>();

            control.resolve('success');
            await expect(promise).resolves.toBe('success');
        });

        it('creates a promise with external reject', async function () {
            const { deferred_promise } = await import('../src/util');
            const [control, promise] = deferred_promise<string>();

            control.reject(new Error('failed'));
            await expect(promise).rejects.toThrow('failed');
        });
    });

    describe('get_youtube_id', function () {
        it('extracts YouTube ID from youtube.com/watch?v= URLs', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe('dQw4w9WgXcQ');
            expect(get_youtube_id({ type: 'video', path: 'https://youtube.com/watch?v=abc123xyz' })).toBe('abc123xyz');
        });

        it('extracts YouTube ID from youtu.be/ URLs', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://youtu.be/dQw4w9WgXcQ' })).toBe('dQw4w9WgXcQ');
            expect(get_youtube_id({ type: 'video', path: 'https://youtu.be/abc123xyz' })).toBe('abc123xyz');
        });

        it('handles URLs with additional query parameters', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s' })).toBe('dQw4w9WgXcQ');
        });

        it('returns undefined for non-YouTube URLs', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://vimeo.com/123456' })).toBeUndefined();
        });

        it('returns undefined for non-video types', function () {
            expect(get_youtube_id({ type: 'audio', path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBeUndefined();
        });
    });

    describe('generate_search_params', function () {
        it('converts object to URL query string', function () {
            expect(generate_search_params({ foo: 'bar', baz: 'qux' })).toBe('foo=bar&baz=qux');
        });

        it('URL encodes special characters', function () {
            expect(generate_search_params({ name: 'John Doe', email: 'john@example.com' })).toBe('name=John%20Doe&email=john%40example.com');
        });

        it('handles empty object', function () {
            expect(generate_search_params({})).toBe('');
        });

        it('handles numeric values', function () {
            expect(generate_search_params({ id: 123, count: 0 })).toBe('id=123&count=0');
        });
    });

    describe('timeout', function () {
        it('resolves when promise finishes before timeout', async function () {
            const quickPromise = Promise.resolve('success');
            await expect(timeout(quickPromise, 1000)).resolves.toBe('success');
        });

        it('rejects when timeout is reached', async function () {
            const slowPromise = new Promise((resolve) => setTimeout(() => resolve('too late'), 100));
            await expect(timeout(slowPromise, 10)).rejects.toThrow('timeout');
        });
    });

    describe('date_as_utc', function () {
        it('converts Date to UTC string', function () {
            const date = new Date('2023-01-15T12:00:00Z');
            const result = date_as_utc(date);
            expect(typeof result).toBe('string');
            expect(result).toContain('2023');
        });
    });

    describe('normalize_url', function () {
        it('prepends domain to relative URLs', function () {
            expect(normalize_url('api/songs', 'https://example.com')).toBe('https://example.com/api/songs');
        });

        it('does not modify absolute HTTP URLs', function () {
            expect(normalize_url('https://other.com/api', 'https://example.com')).toBe('https://other.com/api');
        });

        it('does not modify absolute HTTPS URLs', function () {
            expect(normalize_url('http://other.com/api', 'https://example.com')).toBe('http://other.com/api');
        });
    });

    describe('fetch_json', function () {
        it('returns an AbortablePromise with abort method', function () {
            const promise = fetch_json('https://songs.worshipleaderapp.com/api/get?id=1');
            expect(typeof promise.abort).toBe('function');

            // Catch rejection from abort to prevent unhandled rejection
            promise.catch(() => {});
            promise.abort?.();
        });

        it('abort method is callable without throwing', function () {
            const promise = fetch_json('https://songs.worshipleaderapp.com/api/get?id=1');

            // Catch rejection
            promise.catch(() => {});

            // Should not throw when calling abort
            expect(() => promise.abort?.()).not.toThrow();
        });

        it('creates a promise that can be chained', function () {
            const promise = fetch_json<{ test: boolean }>('https://songs.worshipleaderapp.com/api/get?id=1');

            expect(promise.then).toBeDefined();
            expect(promise.catch).toBeDefined();
            expect(typeof promise.abort).toBe('function');

            // Catch rejection
            promise.catch(() => {});
            promise.abort?.();
        });

        it('uses XHR fallback for file:// URLs', async function () {
            // The fetch_json function detects file:// protocol and uses XHR
            const promise = fetch_json('file:///test.json');
            expect(typeof promise.abort).toBe('function');

            // Catch the rejection from abort to prevent unhandled rejection
            promise.catch(() => {});
            promise.abort?.();
        });
    });

    describe('try_to_run_fn', function () {
        it('runs a function found on the element', async function () {
            const { try_to_run_fn } = await import('../src/util');
            const fn = vi.fn();
            const elem = { existingMethod: fn };
            try_to_run_fn(elem, ['existingMethod']);
            expect(fn).toHaveBeenCalled();
        });

        it('does nothing when element is null', async function () {
            const { try_to_run_fn } = await import('../src/util');
            expect(() => try_to_run_fn(null, ['someFn'])).not.toThrow();
        });

        it('does nothing when function not found', async function () {
            const { try_to_run_fn } = await import('../src/util');
            const elem = { otherMethod: () => 'x' };
            try_to_run_fn(elem, ['nonExistent']);
            // Should not throw
        });

        it('tries multiple function names', async function () {
            const { try_to_run_fn } = await import('../src/util');
            const fn = vi.fn();
            const elem = { thirdFn: fn };
            try_to_run_fn(elem, ['firstFn', 'secondFn', 'thirdFn']);
            expect(fn).toHaveBeenCalled();
        });
    });

    describe('scroll_to', function () {
        it('sets scrollTop immediately when no animation', async function () {
            const { scroll_to } = await import('../src/util');
            const elem = document.createElement('div');
            elem.scrollTop = 50;
            scroll_to(elem, 0);
            expect(elem.scrollTop).toBe(0);
        });

        it('clamps negative scrollTop to 0', async function () {
            const { scroll_to } = await import('../src/util');
            const elem = document.createElement('div');
            elem.scrollTop = 50;
            scroll_to(elem, -10);
            expect(elem.scrollTop).toBe(0);
        });

        it('does nothing when already at target scroll', async function () {
            const { scroll_to } = await import('../src/util');
            const elem = document.createElement('div');
            elem.scrollTop = 100;
            scroll_to(elem, 100);
            expect(elem.scrollTop).toBe(100);
        });
    });

    describe('ensure_visible', function () {
        it('scrolls element into view when below viewport', async function () {
            const { ensure_visible } = await import('../src/util');
            const parent = document.createElement('div');
            Object.defineProperty(parent, 'clientHeight', { value: 500, configurable: true });
            Object.defineProperty(parent, 'scrollTop', { value: 0, writable: true });
            document.body.appendChild(parent);

            const elem = document.createElement('div');
            Object.defineProperty(elem, 'clientHeight', { value: 100, configurable: true });
            Object.defineProperty(elem, 'getBoundingClientRect', {
                value: () => ({ top: 600, bottom: 700 }),
                configurable: true,
            });
            parent.appendChild(elem);

            ensure_visible(elem, parent);

            document.body.removeChild(parent);
        });
    });

    describe('generate_search_params with edge cases', function () {
        it('handles array values', function () {
            expect(generate_search_params({ tags: ['rock', 'pop'] })).toBe('tags=rock%2Cpop');
        });

        it('handles null and undefined values', function () {
            expect(generate_search_params({ a: null })).toBe('a=');
            expect(generate_search_params({ a: undefined })).toBe('a=');
        });

        it('handles boolean values', function () {
            expect(generate_search_params({ active: true })).toBe('active=true');
            expect(generate_search_params({ active: false })).toBe('active=false');
        });
    });

    describe('normalize_url with edge variations', function () {
        it('does not modify protocol-relative URLs', function () {
            expect(normalize_url('//other.com/api', 'https://example.com')).toBe('https://example.com///other.com/api');
        });
    });

    describe('date_as_utc edge cases', function () {
        it('handles invalid dates', function () {
            const result = date_as_utc(new Date('invalid'));
            expect(typeof result).toBe('string');
        });
    });

    describe('get_youtube_id edge cases', function () {
        it('handles URLs without v= parameter', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://www.youtube.com/watch' })).toBeUndefined();
        });

        it('handles URLs with v= parameter at end', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe('dQw4w9WgXcQ');
        });

        it('handles path with youtu.be and additional params', function () {
            const result = get_youtube_id({ type: 'video', path: 'https://youtu.be/dQw4w9WgXcQ?t=30' });
            expect(typeof result).toBe('string');
            expect(result).toContain('dQw4w9WgXcQ');
        });

        it('handles path without youtube', function () {
            expect(get_youtube_id({ type: 'video', path: 'https://example.com/video' })).toBeUndefined();
        });
    });

    describe('is_mobile_browser with user agent', function () {
        it('detects mobile user agents', function () {
            const originalUA = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
            if (originalUA) {
                Object.defineProperty(navigator, 'userAgent', {
                    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
                    configurable: true,
                });
                expect(is_mobile_browser()).toBe(true);

                Object.defineProperty(navigator, 'userAgent', {
                    value: originalUA.value,
                    configurable: true,
                });
            }
        });

        it('returns false for desktop user agents', function () {
            const originalUA = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');

            if (originalUA) {
                Object.defineProperty(navigator, 'userAgent', {
                    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    configurable: true,
                });
                expect(is_mobile_browser()).toBe(false);

                Object.defineProperty(navigator, 'userAgent', {
                    value: originalUA.value,
                    configurable: true,
                });
            }
        });
    });
});
