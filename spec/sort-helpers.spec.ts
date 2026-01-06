import { describe, expect, it } from 'vitest';
import { LOCALE_SORT, SORT_TITLE_SORT } from '../src/sort-helpers';

describe('sort-helpers functions', function () {
    describe('SORT_TITLE_SORT', function () {
        it('sorts objects by sort_title ascending', function () {
            const a = { sort_title: 'apple' };
            const b = { sort_title: 'banana' };
            expect(SORT_TITLE_SORT(a, b)).toBe(-1);
            expect(SORT_TITLE_SORT(b, a)).toBe(1);
        });

        it('returns 0 for equal sort_titles', function () {
            const a = { sort_title: 'apple' };
            const b = { sort_title: 'apple' };
            expect(SORT_TITLE_SORT(a, b)).toBe(0);
        });

        it('handles case sensitivity', function () {
            const a = { sort_title: 'Apple' };
            const b = { sort_title: 'apple' };
            expect(SORT_TITLE_SORT(a, b)).toBe(-1);
        });

        it('handles numbers in sort_title', function () {
            const a = { sort_title: '1 song' };
            const b = { sort_title: '2 song' };
            expect(SORT_TITLE_SORT(a, b)).toBe(-1);
        });

        it('handles special characters', function () {
            const a = { sort_title: '#hashtag' };
            const b = { sort_title: 'normal' };
            expect(SORT_TITLE_SORT(a, b)).toBe(-1);
        });

        it('can be used with Array.sort()', function () {
            const songs = [{ sort_title: 'zebra' }, { sort_title: 'apple' }, { sort_title: 'banana' }];
            songs.sort(SORT_TITLE_SORT);
            expect(songs.map((s) => s.sort_title)).toEqual(['apple', 'banana', 'zebra']);
        });
    });

    describe('LOCALE_SORT', function () {
        it('sorts strings using locale comparison', function () {
            expect(LOCALE_SORT('apple', 'banana')).toBeLessThan(0);
            expect(LOCALE_SORT('banana', 'apple')).toBeGreaterThan(0);
        });

        it('returns 0 for equal strings', function () {
            expect(LOCALE_SORT('apple', 'apple')).toBe(0);
        });

        it('handles case differences', function () {
            const result = LOCALE_SORT('Apple', 'apple');
            expect(typeof result).toBe('number');
        });

        it('handles unicode characters', function () {
            const result = LOCALE_SORT('café', 'cafe');
            expect(typeof result).toBe('number');
        });

        it('can be used with Array.sort()', function () {
            const items = ['zebra', 'apple', 'banana'];
            items.sort(LOCALE_SORT);
            expect(items).toEqual(['apple', 'banana', 'zebra']);
        });

        it('handles empty strings', function () {
            expect(LOCALE_SORT('', '')).toBe(0);
            expect(LOCALE_SORT('', 'a')).toBeLessThan(0);
            expect(LOCALE_SORT('a', '')).toBeGreaterThan(0);
        });
    });
});
