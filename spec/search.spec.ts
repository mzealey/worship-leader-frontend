import { beforeEach, describe, expect, it, vi } from 'vitest';
import { set_search_text } from '../src/search';

// Mock db-search store
const mockSetFilters = vi.fn();
vi.mock('../src/db-search', async () => {
    const actual = (await vi.importActual('../src/db-search')) as Record<string, unknown>;
    return {
        ...actual,
        useSearchStore: {
            getState: () => ({
                filters: { search: '', order_by: 'default', lang: 'all' },
                tags: {},
                sources: {},
                setFilters: mockSetFilters,
            }),
            setState: vi.fn(),
            subscribe: vi.fn(),
        },
    };
});

describe('search', function () {
    beforeEach(function () {
        vi.clearAllMocks();
    });

    describe('set_search_text', function () {
        it('calls setFilters with search text', function () {
            set_search_text('amazing grace');

            expect(mockSetFilters).toHaveBeenCalledWith({
                search: 'amazing grace',
            });
        });

        it('handles empty search text', function () {
            set_search_text('');

            expect(mockSetFilters).toHaveBeenCalledWith({
                search: '',
            });
        });

        it('handles search with special characters', function () {
            set_search_text('Psalm #23');

            expect(mockSetFilters).toHaveBeenCalledWith({
                search: 'Psalm #23',
            });
        });

        it('handles search with numbers', function () {
            set_search_text('512');

            expect(mockSetFilters).toHaveBeenCalledWith({
                search: '512',
            });
        });

        it('handles unicode characters', function () {
            set_search_text('Señor');

            expect(mockSetFilters).toHaveBeenCalledWith({
                search: 'Señor',
            });
        });

        it('calls setFilters for each call', function () {
            set_search_text('first');
            set_search_text('second');
            set_search_text('third');

            expect(mockSetFilters).toHaveBeenCalledTimes(3);
            expect(mockSetFilters).toHaveBeenNthCalledWith(1, {
                search: 'first',
            });
            expect(mockSetFilters).toHaveBeenNthCalledWith(2, {
                search: 'second',
            });
            expect(mockSetFilters).toHaveBeenNthCalledWith(3, {
                search: 'third',
            });
        });
    });
});
