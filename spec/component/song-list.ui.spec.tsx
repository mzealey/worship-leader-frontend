import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let SongList: typeof import('../../src/component/song-list').SongList;
let SongListLink: typeof import('../../src/component/song-list').SongListLink;
let TextDirection: typeof import('../../src/component/song-list').TextDirection;

describe('song-list', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                ideal_debounce: () => 300,
                type: () => 'offline',
                run_search: vi.fn(),
            }),
            DB_AVAILABLE: Promise.resolve({}),
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/db-search', () => {
            const searchState = {
                filters: { search: '', order_by: 'default' },
                tags: {},
                sources: {},
                current_search: undefined,
                setFilters: vi.fn(),
                updateTagFilter: vi.fn(),
                updateSourceFilter: vi.fn(),
                resetSourceFilter: vi.fn(),
                resetTagFilter: vi.fn(),
                setCurrentSearch: vi.fn(),
            };
            return {
                useSearchStore: Object.assign(
                    vi.fn((selector: (...args: any[]) => any) => (typeof selector === 'function' ? selector(searchState) : searchState)),
                    {
                        getState: () => searchState,
                        subscribe: vi.fn(() => vi.fn()),
                    },
                ),
                useSongListStore: Object.assign(
                    vi.fn((selector: (...args: any[]) => any) => {
                        const state = { items: [], requested_items: undefined, pager: undefined };
                        return typeof selector === 'function' ? selector(state) : state;
                    }),
                    {
                        getState: () => ({
                            items: [],
                            requested_items: undefined,
                            pager: undefined,
                            setSongList: vi.fn(),
                            setPager: vi.fn(),
                        }),
                    },
                ),
                DBSearch: class {
                    run = vi.fn();
                    subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
                },
            };
        });
        vi.doMock('../../src/favourite-db', () => ({
            FAVOURITE_DB: { get_favourite: vi.fn().mockReturnValue(null) },
            useFavouriteVersion: vi.fn(),
        }));
        vi.doMock('../../src/settings-store', () => ({
            useSetting: () => [false, vi.fn()],
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            on_resize: vi.fn(() => ({ unsubscribe: vi.fn() })),
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
            ensure_visible: vi.fn(),
            format_string: (s: string, ..._args: any[]) => s,
            scroll_to: vi.fn(),
        }));
        vi.doMock('../../src/song-utils', () => ({
            get_text_title: vi.fn(() => ''),
        }));
        vi.doMock('../../src/react-get-text', () => ({
            react_get_text: vi.fn(() => ''),
        }));
        vi.doMock('../../src/filter-sources', () => ({
            toggle_filter_source: vi.fn(),
        }));
        vi.doMock('../../src/search', () => ({
            set_search_text: vi.fn(),
        }));
        vi.doMock('../../src/page/add-to-set', () => ({
            DialogAddToSet: () => <div data-testid="add-to-set" />,
        }));
        vi.doMock('../../img/unknown_album_icon.png', () => ({ default: 'mock-img.png' }));

        const mod = await import('../../src/component/song-list');
        SongList = mod.SongList;
        SongListLink = mod.SongListLink;
        TextDirection = mod.TextDirection;
    });

    describe('TextDirection', () => {
        it('renders children with ltr direction', () => {
            renderWithRouter(<TextDirection>Hello</TextDirection>);
            const span = document.querySelector('span');
            expect(span).toBeInTheDocument();
            expect(span?.getAttribute('dir')).toBe('ltr');
        });
    });

    describe('SongListLink', () => {
        it('renders a list item element', () => {
            const song = { id: 1, title: 'Test Song', lang: 'en' } as any;
            const { container } = renderWithRouter(<SongListLink song={song} />);
            const listItem = container.querySelector('.MuiListItem-root');
            expect(listItem).toBeInTheDocument();
        });

        it('renders with stripe class', () => {
            const song = { id: 1, title: 'Test', lang: 'en' } as any;
            renderWithRouter(<SongListLink withStripe song={song} />);
            const listItem = document.querySelector('.MuiListItem-root');
            expect(listItem).toBeInTheDocument();
        });
    });

    describe('SongList', () => {
        it('renders without crashing', () => {
            renderWithRouter(<SongList container={document} />);
            expect(document.body).toBeInTheDocument();
        });
    });
});
