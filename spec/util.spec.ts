// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

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

            // Clean up by aborting to prevent unhandled promise rejection
            promise.abort?.();
        });

        it('abort method is callable without throwing', function () {
            const promise = fetch_json('https://songs.worshipleaderapp.com/api/get?id=1');

            // Should not throw when calling abort
            expect(() => promise.abort?.()).not.toThrow();
        });

        it('creates a promise that can be chained', function () {
            const promise = fetch_json<{ test: boolean }>('https://songs.worshipleaderapp.com/api/get?id=1');

            expect(promise.then).toBeDefined();
            expect(promise.catch).toBeDefined();
            expect(typeof promise.abort).toBe('function');

            // Clean up
            promise.abort?.();
        });
    });
});
