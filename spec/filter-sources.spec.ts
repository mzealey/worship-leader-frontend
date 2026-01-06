import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/jqm-util', () => ({
    current_page: vi.fn(() => ({ trigger: vi.fn() })),
}));

import { clear_filter_source, filter_sources, toggle_filter_source } from '../src/filter-sources';

describe('filter-sources functions', function () {
    beforeEach(() => {
        // Clear the filter_sources object before each test
        Object.keys(filter_sources).forEach((key) => delete filter_sources[key]);
        vi.clearAllMocks();
    });

    describe('filter_sources object', function () {
        it('starts as empty object', function () {
            expect(Object.keys(filter_sources)).toEqual([]);
        });

        it('can be modified directly', function () {
            filter_sources['source1'] = 1;
            expect(filter_sources['source1']).toBe(1);
            expect(Object.keys(filter_sources)).toEqual(['source1']);
        });
    });

    describe('clear_filter_source', function () {
        it('removes all properties from filter_sources', function () {
            filter_sources['source1'] = 1;
            filter_sources['source2'] = 1;
            filter_sources['source3'] = 1;

            clear_filter_source();

            expect(Object.keys(filter_sources)).toEqual([]);
        });

        it('handles already empty filter_sources', function () {
            clear_filter_source();
            expect(Object.keys(filter_sources)).toEqual([]);
        });
    });

    describe('toggle_filter_source', function () {
        it('adds source when state is true', function () {
            toggle_filter_source('source1', true);
            expect(filter_sources['source1']).toBe(1);
        });

        it('removes source when state is false', function () {
            filter_sources['source1'] = 1;
            toggle_filter_source('source1', false);
            expect(filter_sources['source1']).toBeUndefined();
        });

        it('toggles source when no state provided (not in filter)', function () {
            toggle_filter_source('source1');
            expect(filter_sources['source1']).toBe(1);
        });

        it('toggles source when no state provided (already in filter)', function () {
            filter_sources['source1'] = 1;
            toggle_filter_source('source1');
            expect(filter_sources['source1']).toBeUndefined();
        });

        it('handles multiple sources', function () {
            toggle_filter_source('source1', true);
            toggle_filter_source('source2', true);
            toggle_filter_source('source3', false);

            expect(filter_sources['source1']).toBe(1);
            expect(filter_sources['source2']).toBe(1);
            expect(filter_sources['source3']).toBeUndefined();
        });

        it('handles numeric and string source IDs', function () {
            toggle_filter_source(123, true);
            toggle_filter_source('string_id', true);

            expect(filter_sources[123]).toBe(1);
            expect(filter_sources['string_id']).toBe(1);
        });
    });

    describe('integration behavior', function () {
        it('filter_sources state persists between function calls', function () {
            toggle_filter_source('source1', true);
            toggle_filter_source('source2', true);

            expect(Object.keys(filter_sources)).toEqual(['source1', 'source2']);

            clear_filter_source();
            expect(Object.keys(filter_sources)).toEqual([]);
        });

        it('handles complex toggle sequences', function () {
            // Add some sources
            toggle_filter_source('a', true);
            toggle_filter_source('b', true);
            toggle_filter_source('c', true);
            expect(Object.keys(filter_sources).sort()).toEqual(['a', 'b', 'c']);

            // Remove one
            toggle_filter_source('b', false);
            expect(Object.keys(filter_sources).sort()).toEqual(['a', 'c']);

            // Toggle (should add back)
            toggle_filter_source('b');
            expect(Object.keys(filter_sources).sort()).toEqual(['a', 'b', 'c']);

            // Toggle again (should remove)
            toggle_filter_source('b');
            expect(Object.keys(filter_sources).sort()).toEqual(['a', 'c']);
        });
    });
});
