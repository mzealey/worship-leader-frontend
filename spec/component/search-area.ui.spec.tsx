import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithProviders } from '../helpers/render';

let SearchArea: typeof import('../../src/component/search-area').SearchArea;

describe('SearchArea', () => {
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
        vi.doMock('../../src/db-search', () => ({
            useSearchStore: Object.assign(
                vi.fn((selector: (...args: any[]) => any) => {
                    if (typeof selector === 'function') {
                        return selector({ filters: { search: '', order_by: '', lang: undefined }, tags: {}, sources: {} });
                    }
                    return { filters: { search: '', order_by: '' }, tags: {}, sources: {} };
                }),
                {
                    getState: vi.fn(() => ({
                        filters: { search: '', order_by: '' },
                        tags: {},
                        sources: {},
                        setFilters: vi.fn(),
                    })),
                },
            ),
        }));
        vi.doMock('../../src/globals', () => ({
            DEBUG: false,
            BUILD_TYPE: 'www',
            get_client_type: () => 'www',
            APP_VERSION: '1.0.0',
            SHARE_DOMAIN: '',
            API_HOST: '',
            EVENT_SOCKET_HOST: '',
            DUMP_VERSION: 2,
            DB_PATH: '',
            get_uuid: () => 'test-uuid',
            is_firsttime: false,
            match_media_watcher: vi.fn(),
        }));
        vi.doMock('../../src/settings-store', () => ({
            updateSetting: vi.fn(),
            useSetting: vi.fn(() => [undefined, vi.fn()]),
        }));
        vi.doMock('../../src/set', () => ({
            create_set_from_url: vi.fn(),
        }));
        vi.doMock('../../src/db', () => ({
            DB_AVAILABLE: Promise.resolve({ ideal_debounce: () => 300 }),
            DB: Promise.resolve({ ideal_debounce: () => 300, type: () => 'offline', get_song_sources: vi.fn().mockResolvedValue([]) }),
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/set-db', () => ({
            SET_DB: { get_set_list: vi.fn().mockResolvedValue([]) },
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/component/search-filters', () => ({
            SearchFilters: () => <div data-testid="search-filters" />,
        }));
        vi.doMock('../../src/component/theme', () => ({
            Theme: ({ children }: { children: React.ReactNode; section: string }) => <>{children}</>,
        }));

        const mod = await import('../../src/component/search-area');
        SearchArea = mod.SearchArea;
    });

    it('renders the search input', () => {
        renderWithProviders(<SearchArea />);

        expect(screen.getByTitle('Search by title, phrase or song number')).toBeInTheDocument();
    });

    it('renders toggle dropdown button', () => {
        renderWithProviders(<SearchArea />);

        expect(screen.getByTitle('Show more search options')).toBeInTheDocument();
    });

    it('toggles dropdown when button clicked', async () => {
        const user = userEvent.setup();

        renderWithProviders(<SearchArea />);

        const toggleBtn = screen.getByTitle('Show more search options');
        await user.click(toggleBtn);

        expect(screen.getByTestId('search-filters')).toBeInTheDocument();
    });
});
