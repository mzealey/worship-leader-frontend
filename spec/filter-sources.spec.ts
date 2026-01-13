import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies - need to be set up before imports
const mockUpdateSourceFilter = vi.fn();
const mockResetSourceFilter = vi.fn();
let mockSources = {};

vi.mock('../src/db-search', async () => {
    const actual = (await vi.importActual('../src/db-search')) as Record<string, unknown>;
    return {
        ...actual,
        useSearchStore: {
            getState: () => ({
                sources: mockSources,
                updateSourceFilter: mockUpdateSourceFilter,
                resetSourceFilter: mockResetSourceFilter,
            }),
            setState: vi.fn(),
            subscribe: vi.fn(),
        },
    };
});

vi.mock('../src/persistent-storage.es5', () => ({
    persistentStorage: {
        setObj: vi.fn(),
        getObj: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
    },
}));

// Import after mocks are set up
import { toggle_filter_source } from '../src/filter-sources';

describe('filter-sources', function () {
    beforeEach(async function () {
        vi.clearAllMocks();
        mockSources = {};
    });

    describe('toggle_filter_source', function () {
        it('toggles source on when not present', function () {
            mockSources = {};

            toggle_filter_source(123);

            expect(mockUpdateSourceFilter).toHaveBeenCalledWith({
                123: 1,
            });
        });

        it('toggles source off when present', function () {
            mockSources = { 123: 1 };

            toggle_filter_source(123);

            expect(mockUpdateSourceFilter).toHaveBeenCalledWith({
                123: undefined,
            });
        });

        it('can explicitly set state to true', function () {
            mockSources = {};

            toggle_filter_source(123, false, true);

            expect(mockUpdateSourceFilter).toHaveBeenCalledWith({
                123: 1,
            });
        });

        it('can explicitly set state to false', function () {
            mockSources = { 123: 1 };

            toggle_filter_source(123, false, false);

            expect(mockUpdateSourceFilter).toHaveBeenCalledWith({
                123: undefined,
            });
        });

        it('resets all sources when with_reset is true', function () {
            mockSources = { 100: 1, 200: 1 };

            toggle_filter_source(123, true, true);

            expect(mockResetSourceFilter).toHaveBeenCalledTimes(1);
            expect(mockUpdateSourceFilter).toHaveBeenCalledWith({
                123: 1,
            });
        });

        it('does not reset when with_reset is false', function () {
            mockSources = {};

            toggle_filter_source(123, false);

            expect(mockResetSourceFilter).not.toHaveBeenCalled();
            expect(mockUpdateSourceFilter).toHaveBeenCalledWith({
                123: 1,
            });
        });

        it('handles multiple different sources', function () {
            mockSources = {};

            toggle_filter_source(100);
            toggle_filter_source(200);

            expect(mockUpdateSourceFilter).toHaveBeenCalledTimes(2);
            expect(mockUpdateSourceFilter).toHaveBeenNthCalledWith(1, {
                100: 1,
            });
            expect(mockUpdateSourceFilter).toHaveBeenNthCalledWith(2, {
                200: 1,
            });
        });
    });
});
