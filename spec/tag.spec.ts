import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clear_filter_tags, filter_tags, refresh_tag_button_status, update_filter_tag_btn } from '../src/tag';

describe('tag functions', function () {
    beforeEach(() => {
        // Clear the filter_tags object before each test
        Object.keys(filter_tags).forEach((key) => delete filter_tags[key]);
        vi.clearAllMocks();
    });

    describe('filter_tags object', function () {
        it('starts as empty object', function () {
            expect(Object.keys(filter_tags)).toEqual([]);
        });

        it('can be modified directly', function () {
            filter_tags['tag1'] = 1;
            expect(filter_tags['tag1']).toBe(1);
            expect(Object.keys(filter_tags)).toEqual(['tag1']);
        });

        it('supports various value types', function () {
            filter_tags['tag1'] = 1;
            filter_tags['tag2'] = true;
            filter_tags['tag3'] = 'active';
            filter_tags['tag4'] = null;
            filter_tags['tag5'] = 0;

            expect(filter_tags['tag1']).toBe(1);
            expect(filter_tags['tag2']).toBe(true);
            expect(filter_tags['tag3']).toBe('active');
            expect(filter_tags['tag4']).toBe(null);
            expect(filter_tags['tag5']).toBe(0);
        });
    });

    describe('clear_filter_tags', function () {
        it('removes all properties from filter_tags', function () {
            filter_tags['tag1'] = 1;
            filter_tags['tag2'] = 1;
            filter_tags['tag3'] = 1;

            clear_filter_tags();

            expect(Object.keys(filter_tags)).toEqual([]);
        });

        it('handles already empty filter_tags', function () {
            clear_filter_tags();
            expect(Object.keys(filter_tags)).toEqual([]);
        });

        it('removes all types of values', function () {
            filter_tags['tag1'] = 1;
            filter_tags['tag2'] = true;
            filter_tags['tag3'] = 'active';
            filter_tags['tag4'] = { nested: 'object' };

            clear_filter_tags();
            expect(Object.keys(filter_tags)).toEqual([]);
        });
    });

    describe('refresh_tag_button_status', function () {
        it('works with empty filter_tags', function () {
            expect(() => refresh_tag_button_status()).not.toThrow();
        });

        it('works with populated filter_tags', function () {
            filter_tags['tag1'] = 1;
            filter_tags['tag2'] = 1;

            expect(() => refresh_tag_button_status()).not.toThrow();
        });
    });

    describe('update_filter_tag_btn', function () {
        it('works with empty filter_tags', function () {
            expect(() => update_filter_tag_btn()).not.toThrow();
        });

        it('works with populated filter_tags', function () {
            filter_tags['tag1'] = 1;
            filter_tags['tag2'] = 1;

            expect(() => update_filter_tag_btn()).not.toThrow();
        });
    });

    describe('integration behavior', function () {
        it('filter_tags state persists between function calls', function () {
            filter_tags['tag1'] = 1;
            filter_tags['tag2'] = 1;

            expect(Object.keys(filter_tags)).toEqual(['tag1', 'tag2']);

            refresh_tag_button_status();
            expect(Object.keys(filter_tags)).toEqual(['tag1', 'tag2']);

            update_filter_tag_btn();
            expect(Object.keys(filter_tags)).toEqual(['tag1', 'tag2']);

            clear_filter_tags();
            expect(Object.keys(filter_tags)).toEqual([]);
        });

        it('handles numeric and string tag IDs', function () {
            filter_tags[123] = 1;
            filter_tags['string_tag'] = 1;

            expect(filter_tags[123]).toBe(1);
            expect(filter_tags['string_tag']).toBe(1);
            expect(Object.keys(filter_tags).sort()).toEqual(['123', 'string_tag']);

            clear_filter_tags();
            expect(Object.keys(filter_tags)).toEqual([]);
        });

        it('maintains object reference integrity', function () {
            const originalRef = filter_tags;

            filter_tags['tag1'] = 1;
            expect(filter_tags).toBe(originalRef);

            clear_filter_tags();
            expect(filter_tags).toBe(originalRef);
            expect(Object.keys(filter_tags)).toEqual([]);
        });
    });
});
