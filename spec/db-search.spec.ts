// @vitest-environment jsdom
import $ from 'jquery';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistentStorage } from '../src/persistent-storage.es5';

let mockJQueryImplementation: any;

vi.mock('jquery', () => {
    const $ = (arg: any) => (mockJQueryImplementation ? mockJQueryImplementation(arg) : {});
    return { default: $ };
});

vi.mock('../src/unidecode', () => ({
    unidecode: vi.fn((str) => Promise.resolve(str)),
}));

const createMockPage = () => {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <div id="page">
                <select class="order-by"><option value="default">Default</option></select>
                <input class="search" value="" />
                <select class="filter-language"><option value="all">All</option></select>
                <input class="filter-favourites" />
                <input class="filter-original" />
                <input class="filter-mp3" />
                <input class="filter-sheet" />
                <input class="filter-chord" />
                <select class="songkey"><option value="">Any</option></select>
                <div class="pager">
                    <span class="pager-prev"></span>
                    <span class="pager-next"></span>
                    <span class="pager-total"></span>
                </div>
                <ul class="song-list"></ul>
                <div class="dropdown"></div>
            </div>
        </body>
        </html>
    `);

    mockJQueryImplementation = (selector: string | HTMLElement) => {
        let elements: NodeListOf<Element> | Element[];

        if (typeof selector === 'string') {
            elements = dom.window.document.querySelectorAll(selector);
        } else {
            elements = [selector];
        }

        const result: any = {
            val: () => {
                const el = elements[0] as HTMLInputElement | HTMLSelectElement;
                return el?.value || '';
            },
            find: (s: string) => $(`${typeof selector === 'string' ? selector : ''} ${s}`),
            toggle: () => result,
            toggleClass: () => result,
            text: () => result,
            data: (key?: string, value?: unknown) => {
                const el = elements[0] as any;
                if (!el) return {};
                if (key && value !== undefined) {
                    el[`_data_${key}`] = value;
                    return result;
                }
                if (key) {
                    return el[`_data_${key}`];
                }
                return {};
            },
            tristateValue: () => undefined,
        };
        return result;
    };

    return $('#page');
};

vi.mock('../src/filter-sources', () => ({
    filter_sources: {},
}));

vi.mock('../src/tag', () => ({
    filter_tags: {},
}));

vi.mock('../src/event-socket', () => ({
    eventSocket: {
        add_queue: vi.fn(() => vi.fn()),
    },
}));

vi.mock('../src/songlist', () => ({
    update_song_list: vi.fn(),
}));

vi.mock('../src/langpack', () => ({
    get_translation: vi.fn((key: string) => key),
    langpack_loaded: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/component/spinner', () => ({
    spinner: vi.fn((p: Promise<unknown>) => p),
}));

describe('Pager', () => {
    let Pager: typeof import('../src/db-search').Pager;
    let mockPage: ReturnType<typeof createMockPage>;

    beforeEach(async () => {
        vi.clearAllMocks();
        persistentStorage.clear();
        mockPage = createMockPage();
        const module = await import('../src/db-search');
        Pager = module.Pager;
    });

    describe('constructor', () => {
        it('initializes with correct defaults', () => {
            const pager = new Pager(mockPage);

            expect(pager.start).toBe(0);
            expect(pager.total).toBe(-1);
            expect(pager.min_total).toBe(-1);
            expect(pager.page_size).toBeGreaterThan(0);
        });
    });

    describe('clone', () => {
        it('creates a copy with same values', () => {
            const pager = new Pager(mockPage);
            pager.start = 50;
            pager.total = 100;

            const clone = pager.clone();

            expect(clone.start).toBe(50);
            expect(clone.total).toBe(100);
            expect(clone).not.toBe(pager);
        });
    });

    describe('get_requested_items', () => {
        it('returns start and size with extra row', () => {
            const pager = new Pager(mockPage);
            pager.start = 20;

            const items = pager.get_requested_items();

            expect(items.start).toBe(20);
            expect(items.size).toBe(pager.page_size + 1);
            expect(items.infinite_scroll).toBeUndefined();
        });

        it('includes infinite_scroll flag when provided', () => {
            const pager = new Pager(mockPage);

            const items = pager.get_requested_items(true);

            expect(items.infinite_scroll).toBe(true);
        });
    });

    describe('change_page', () => {
        it('moves forward by page_size', () => {
            const pager = new Pager(mockPage);
            const pageSize = pager.page_size;

            const result = pager.change_page(1);

            expect(result).toBe(true);
            expect(pager.start).toBe(pageSize);
        });

        it('moves backward by page_size', () => {
            const pager = new Pager(mockPage);
            pager.start = 50;
            pager.last_real_start = 50;
            const pageSize = pager.page_size;

            const result = pager.change_page(-1);

            expect(result).toBe(true);
            expect(pager.start).toBe(50 - pageSize);
        });

        it('returns false when at start and going backward', () => {
            const pager = new Pager(mockPage);
            pager.start = 0;
            pager.last_real_start = 0;

            const result = pager.change_page(-1);

            expect(result).toBe(false);
            expect(pager.start).toBe(0);
        });

        it('returns false when at end and going forward', () => {
            const pager = new Pager(mockPage);
            pager.total = 50;
            pager.start = 50;

            const result = pager.change_page(1);

            expect(result).toBe(false);
        });

        it('limits infinite scroll range', () => {
            const pager = new Pager(mockPage);
            pager.last_real_start = 0;
            pager.start = 200;

            const result = pager.change_page(1, true);

            expect(result).toBe(false);
        });

        it('updates last_real_start on non-infinite scroll', () => {
            const pager = new Pager(mockPage);
            pager.change_page(1, false);

            expect(pager.last_real_start).toBe(pager.start);
        });

        it('does not update last_real_start on infinite scroll', () => {
            const pager = new Pager(mockPage);
            const originalLastReal = pager.last_real_start;
            pager.change_page(1, true);

            expect(pager.last_real_start).toBe(originalLastReal);
        });
    });

    describe('set_total', () => {
        it('sets total count', () => {
            const pager = new Pager(mockPage);

            pager.set_total(150);

            expect(pager.total).toBe(150);
        });
    });

    describe('update', () => {
        it('calculates total from partial results', () => {
            const pager = new Pager(mockPage);

            pager.update({ start: 0, size: 21 }, 15);

            expect(pager.total).toBe(15);
        });

        it('does not set total when full page returned', () => {
            const pager = new Pager(mockPage);

            pager.update({ start: 0, size: 21 }, 21);

            expect(pager.total).toBe(-1);
        });

        it('updates min_total', () => {
            const pager = new Pager(mockPage);

            pager.update({ start: 0, size: 21 }, 21);

            expect(pager.min_total).toBe(21);
        });

        it('updates last_end_update', () => {
            const pager = new Pager(mockPage);

            pager.update({ start: 0, size: 21 }, 15);

            expect(pager.last_end_update).toBe(15);
        });

        it('does not update if scrolled past end', () => {
            const pager = new Pager(mockPage);
            pager.total = 50;

            pager.update({ start: 100, size: 21 }, 0);

            expect(pager.last_end_update).toBe(0);
        });
    });

    describe('navigation helpers', () => {
        it('has_prev returns true when not at start', () => {
            const pager = new Pager(mockPage);
            pager.last_start_update = 20;

            expect(pager.has_prev()).toBe(true);
        });

        it('has_prev returns false at start', () => {
            const pager = new Pager(mockPage);
            pager.last_start_update = 0;

            expect(pager.has_prev()).toBe(false);
        });

        it('has_next returns true when more results exist', () => {
            const pager = new Pager(mockPage);
            pager.last_end_update = 20;
            pager.total = 50;

            expect(pager.has_next()).toBe(true);
        });

        it('has_next returns false at end', () => {
            const pager = new Pager(mockPage);
            pager.last_end_update = 50;
            pager.total = 50;
            pager.min_total = 50;

            expect(pager.has_next()).toBe(false);
        });

        it('first returns 1-indexed start position', () => {
            const pager = new Pager(mockPage);
            pager.last_start_update = 0;

            expect(pager.first()).toBe(1);
        });

        it('last returns end position', () => {
            const pager = new Pager(mockPage);
            pager.last_end_update = 20;

            expect(pager.last()).toBe(20);
        });

        it('no_results returns true when empty', () => {
            const pager = new Pager(mockPage);
            pager.last_end_update = 0;

            expect(pager.no_results()).toBe(true);
        });

        it('no_results returns false when has results', () => {
            const pager = new Pager(mockPage);
            pager.last_end_update = 10;

            expect(pager.no_results()).toBe(false);
        });
    });
});

describe('DBSearch', () => {
    let DBSearch: typeof import('../src/db-search').DBSearch;
    let mockPage: ReturnType<typeof createMockPage>;
    let mockDb: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        persistentStorage.clear();
        mockPage = createMockPage();

        mockDb = {
            query_validity: vi.fn(() => 'db-1'),
            _prepare_query: vi.fn((filters: any) => ({ ...filters })),
            _run_search: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
            _get_total: vi.fn(() => Promise.resolve(0)),
            search_meta: vi.fn(() => Promise.resolve([])),
            add_timing_stat: vi.fn(),
            _instant_total_query: false,
        };

        const module = await import('../src/db-search');
        DBSearch = module.DBSearch;
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('constructor', () => {
        it('initializes with db and page', () => {
            const search = new DBSearch(mockDb, mockPage);

            expect(search.db).toBe(mockDb);
            expect(search.pager).toBeDefined();
            expect(search.filters).toBeDefined();
        });

        it('prepares query on construction', async () => {
            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;

            expect(mockDb._prepare_query).toHaveBeenCalled();
        });
    });

    describe('isEqual', () => {
        it('returns true for same db and filters', () => {
            const search = new DBSearch(mockDb, mockPage);

            expect(search.isEqual(mockDb, mockPage)).toBe(true);
        });

        it('returns false when db validity changed', () => {
            const search = new DBSearch(mockDb, mockPage);
            mockDb.query_validity.mockReturnValue('db-2');

            expect(search.isEqual(mockDb, mockPage)).toBe(false);
        });
    });

    describe('subscribe', () => {
        it('allows subscribing to state changes', () => {
            const search = new DBSearch(mockDb, mockPage);
            const callback = vi.fn();

            const subscription = search.subscribe(callback);

            expect(subscription).toBeDefined();
            expect(typeof subscription.unsubscribe).toBe('function');
        });
    });

    describe('run', () => {
        it('executes search and returns results', async () => {
            mockDb._run_search.mockResolvedValue({
                data: [{ id: 1, title: 'Test Song' }],
                total: 1,
            });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            const result = await search.run();

            expect(result.data).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('marks search as current on page', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 0 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            await search.run();

            expect(mockPage.data('cur_search')).toBe(search);
        });

        it('records timing stats', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 0 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            await search.run();

            expect(mockDb.add_timing_stat).toHaveBeenCalled();
        });

        it('emits running state', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 0 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            const states: string[] = [];
            search.subscribe((s) => states.push(s.state));

            await search.run();

            expect(states).toContain('running');
        });

        it('emits resolved state on completion', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 0 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            const states: string[] = [];
            search.subscribe((s) => states.push(s.state));

            await search.run();

            expect(states).toContain('resolved');
        });
    });

    describe('change_page', () => {
        it('changes page and runs search', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 100 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            await search.run();

            const initialStart = search.pager.start;
            await search.change_page(1);

            expect(search.pager.start).toBeGreaterThan(initialStart);
        });

        it('refreshes query if db validity changed', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 0 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            await search.run();

            mockDb.query_validity.mockReturnValue('db-2');

            await search.change_page(1);

            expect(search.pager.start).toBe(0);
        });
    });

    describe('infinite_scroll', () => {
        it('advances page with infinite scroll flag', async () => {
            mockDb._run_search.mockResolvedValue({ data: Array(21).fill({ id: 1 }), total: 100 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            search.pager.min_total = 100;
            await search.run();

            const result = await search.infinite_scroll();

            expect(result).toBeDefined();
        });

        it('rejects when cannot scroll', async () => {
            mockDb._run_search.mockResolvedValue({ data: [], total: 5 });

            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;
            search.pager.total = 5;
            search.pager.start = 0;
            search.pager.last_end_update = 5;
            await search.run();

            await expect(search.infinite_scroll()).rejects.toThrow('cannot-scroll');
        });
    });

    describe('stale query handling', () => {
        it('throws error for stale query', async () => {
            const search = new DBSearch(mockDb, mockPage);
            await search.prepared_query;

            mockDb.query_validity.mockReturnValue('db-stale');

            await expect((search as any)._run(false)).rejects.toThrow('stale-query');
        });
    });
});

describe('get_filters', () => {
    let get_filters: typeof import('../src/db-search').get_filters;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('../src/db-search');
        get_filters = module.get_filters;
    });

    it('extracts search value from page', () => {
        const mockPage = createMockPage();
        const originalImpl = mockJQueryImplementation;
        mockJQueryImplementation = (selector: string) => {
            if (selector.includes('.search')) return { val: () => 'amazing grace' };
            if (selector.includes('select.order-by')) return { val: () => 'default' };
            if (selector.includes('select.filter-language')) return { val: () => 'all' };
            return originalImpl(selector);
        };

        const filters = get_filters(mockPage);

        expect(filters).toEqual({
            order_by: 'default',
            search: 'amazing grace',
            advanced_tags: {},
        });
    });

    it('parses key=value pairs from search', () => {
        const mockPage = createMockPage();
        const originalImpl = mockJQueryImplementation;
        mockJQueryImplementation = (selector: string) => {
            if (selector.includes('.search')) return { val: () => 'test lang=en' };
            if (selector.includes('select.order-by')) return { val: () => 'default' };
            if (selector.includes('select.filter-language')) return { val: () => 'all' };
            return originalImpl(selector);
        };

        const filters = get_filters(mockPage);

        expect(filters).toEqual({
            order_by: 'default',
            lang: 'en',
            search: 'test',
            advanced_tags: {},
        });
    });

    it('includes order_by from select', () => {
        const mockPage = createMockPage();
        const originalImpl = mockJQueryImplementation;
        mockJQueryImplementation = (selector: string) => {
            if (selector.includes('select.order-by')) return { val: () => 'title ASC' };
            if (selector.includes('.search')) return { val: () => '' };
            if (selector.includes('select.filter-language')) return { val: () => 'all' };
            return originalImpl(selector);
        };

        const filters = get_filters(mockPage);

        expect(filters).toEqual({
            order_by: 'title ASC',
            search: '',
            advanced_tags: {},
        });
    });
});

describe('current_search', () => {
    let current_search: typeof import('../src/db-search').current_search;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('../src/db-search');
        current_search = module.current_search;
    });

    it('returns current search from page data', () => {
        const mockPage = createMockPage();
        const mockSearch = { id: 'test-search' };
        mockPage.data('cur_search', mockSearch);

        const result = current_search(mockPage);

        expect(result).toBe(mockSearch);
    });

    it('returns undefined when no search set', () => {
        const mockPage = createMockPage();

        const result = current_search(mockPage);

        expect(result).toBeUndefined();
    });
});
