import { vi } from 'vitest';

export interface SearchStoreMockOptions {
    filters?: Record<string, unknown>;
    sources?: Record<number, 0 | 1 | undefined>;
    tags?: Record<number, 1 | undefined>;
    setFilters?: ReturnType<typeof vi.fn>;
    updateTagFilter?: ReturnType<typeof vi.fn>;
    updateSourceFilter?: ReturnType<typeof vi.fn>;
    resetSourceFilter?: ReturnType<typeof vi.fn>;
    resetTagFilter?: ReturnType<typeof vi.fn>;
}

export function createSearchStoreMock(options: SearchStoreMockOptions = {}) {
    const {
        filters = { search: '', order_by: 'default', lang: 'all' },
        sources = {} as Record<number, 0 | 1 | undefined>,
        tags = {} as Record<number, 1 | undefined>,
        setFilters: _setFilters,
        updateTagFilter: _updateTagFilter,
        updateSourceFilter: _updateSourceFilter,
        resetSourceFilter: _resetSourceFilter,
        resetTagFilter: _resetTagFilter,
    } = options;

    const setFilters = _setFilters ?? vi.fn();
    const updateTagFilter = _updateTagFilter ?? vi.fn();
    const updateSourceFilter = _updateSourceFilter ?? vi.fn();
    const resetSourceFilter = _resetSourceFilter ?? vi.fn();
    const resetTagFilter = _resetTagFilter ?? vi.fn();

    return {
        useSearchStore: Object.assign(
            (selector?: (state: any) => any) => {
                if (typeof selector === 'function') {
                    return selector({ filters, sources, tags });
                }
                return undefined;
            },
            {
                getState: () => ({ setFilters, updateTagFilter, updateSourceFilter, resetSourceFilter, resetTagFilter }),
            },
        ),
    };
}
