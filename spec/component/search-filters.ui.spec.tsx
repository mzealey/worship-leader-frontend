import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let SearchFilters: typeof import('../../src/component/search-filters').SearchFilters;

describe('SearchFilters', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/event-socket', () => ({
            eventSocket: {
                add_queue: vi.fn(() => vi.fn()),
                is_setup: vi.fn(() => Promise.resolve()),
                register_listener: vi.fn(),
            },
        }));
        vi.doMock('../../src/langpack', createLangpackMock);

        vi.doMock('../../src/db', () => ({
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            DB_AVAILABLE: Promise.resolve({ ideal_debounce: () => 300, type: () => 'offline' }),
            DB: Promise.resolve({
                ideal_debounce: () => 300,
                type: () => 'offline',
                get_song_sources: vi.fn().mockResolvedValue([]),
                db_suggest: vi.fn().mockResolvedValue([]),
            }),
            on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_dbload_failed: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            db_suggest: vi.fn().mockResolvedValue([]),
        }));
        vi.doMock('../../src/db-search', () => ({
            useSearchStore: Object.assign(
                vi.fn((selector: (...args: any[]) => any) => {
                    if (typeof selector === 'function') {
                        return selector({ filters: { search: '', order_by: '', lang: undefined }, tags: {}, sources: {} });
                    }
                    return { filters: { search: '', order_by: '', lang: undefined }, tags: {}, sources: {} };
                }),
                {
                    getState: vi.fn(() => ({
                        filters: { search: '', order_by: '', lang: undefined },
                        tags: {},
                        sources: {},
                        setFilters: vi.fn(),
                        updateTagFilter: vi.fn(),
                        updateSourceFilter: vi.fn(),
                        resetSourceFilter: vi.fn(),
                        resetTagFilter: vi.fn(),
                    })),
                },
            ),
        }));
        vi.doMock('../../src/meta-db', () => ({
            get_meta_db: vi.fn().mockResolvedValue({
                tag_groups: {},
                tag_mappings: {},
                tags: {},
                sources: {},
                languages: {},
            }),
        }));
        vi.doMock('../../src/settings-store', () => ({
            useSetting: vi.fn(() => [undefined, vi.fn()]),
        }));
        vi.doMock('../../src/page/source-select', () => ({
            PageSourceSelect: () => <div data-testid="source-select" />,
        }));
        vi.doMock('../../src/page/tag_select', () => ({
            PageTagSelect: () => <div data-testid="tag-select" />,
        }));
        vi.doMock('../../src/db/common', () => ({
            get_db_chosen_langs: vi.fn(() => []),
        }));

        const mod = await import('../../src/component/search-filters');
        SearchFilters = mod.SearchFilters;
    });

    it('renders without crashing', () => {
        renderWithProviders(<SearchFilters />);
        expect(document.body).toBeInTheDocument();
    });

    it('renders sort dropdown', async () => {
        renderWithProviders(<SearchFilters />);

        const sortSelect = await screen.findByTitle('sort_default');
        expect(sortSelect).toBeInTheDocument();
    });

    it('renders language filter', () => {
        renderWithProviders(<SearchFilters />);

        expect(screen.getByTitle('button-choose-song-languages')).toBeInTheDocument();
    });
});
