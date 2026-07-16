import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSocketMock } from '../helpers/mocks/event-socket';

describe('songinfo-other', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('can import all exported components', async () => {
        vi.doMock('../../src/event-socket', createEventSocketMock);
        vi.doMock('../../src/abc2svg', () => ({ can_do_worker: () => true }));
        vi.doMock('../../src/db-search', () => ({
            useSearchStore: Object.assign(
                vi.fn(() => ({ filters: {}, tags: {}, sources: {} })),
                { getState: vi.fn(() => ({})) },
            ),
        }));
        vi.doMock('../../src/langpack', () => ({
            useTranslation: () => ({ t: (k: string) => k }),
            useAppLang: () => ({ appLang: 'en' }),
        }));
        vi.doMock('../../src/favourite-db', () => ({
            FAVOURITE_DB: { get_favourite: () => null },
            useFavouriteVersion: vi.fn(),
        }));
        vi.doMock('../../src/settings-store', () => ({
            useSetting: () => [false, vi.fn()],
        }));
        vi.doMock('../../src/transpose-details', () => ({
            TransposeDetails: class {
                subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
            },
        }));
        vi.doMock('../../src/transpose', () => ({
            Transpose: class {
                keys = [];
                getNewChord = () => 'C';
            },
        }));
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({}),
            DB_AVAILABLE: Promise.resolve({}),
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/meta-db', () => ({
            get_meta_db: () => Promise.resolve({ tags: {}, tag_mappings: {}, tag_groups: {} }),
        }));
        vi.doMock('../../src/set-db', () => ({
            SET_DB: {},
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        vi.doMock('../../src/set-switcher', () => ({
            SetSwitcher: class {
                move = vi.fn();
            },
        }));
        vi.doMock('../../src/util', () => ({
            is_rtl: () => false,
            is_vertical_lang: () => false,
            scroll_to: vi.fn(),
            ensure_visible: vi.fn(),
            format_string: (s: string) => s,
        }));
        vi.doMock('../../src/file-download-utils', () => ({
            try_window_open_download: vi.fn(),
            get_downloaded_file: vi.fn(),
            is_local_url_allowed: () => false,
        }));
        vi.doMock('../../src/search', () => ({ set_search_text: vi.fn() }));
        vi.doMock('../../src/filter-sources', () => ({ toggle_filter_source: vi.fn() }));
        vi.doMock('../../src/persistent-storage.es5', () => ({
            persistentStorage: { get: vi.fn(), set: vi.fn(), getObj: () => false },
        }));
        vi.doMock('../../src/globals', () => ({
            API_HOST: '',
            DEBUG: false,
            match_media_watcher: () => ({ unsubscribe: vi.fn() }),
        }));
        vi.doMock('../../src/solfege-util', () => ({ maybe_convert_solfege: (s: string) => s }));
        vi.doMock('../../src/song-utils', () => ({
            get_text_title: () => '',
        }));
        vi.doMock('../../src/use-dialog', () => ({
            useDialog: () => ({ closed: false, handleClose: vi.fn() }),
        }));
        vi.doMock('../../src/page-padding', () => ({
            usePagePadding: vi.fn((sel: (s: any) => any) => sel({ top: 0, bottom: 0 })),
        }));
        vi.doMock('../../src/component/basic', () => ({
            DialogTitleWithClose: ({ children }: any) => <div>{children}</div>,
            ImageButton: ({ children }: any) => <button>{children}</button>,
            DropDownIcon: () => <div />,
        }));
        vi.doMock('../../src/component/presenter-view', () => ({ PresenterView: () => <div /> }));
        vi.doMock('../../src/component/score', () => ({ SheetMusicDisplay: () => <div /> }));
        vi.doMock('../../src/component/search-area', () => ({ SearchArea: () => <div /> }));
        vi.doMock('../../src/component/song-list', () => ({
            SongList: () => <div />,
            SongListLink: () => <div />,
            TextDirection: ({ children }: any) => <span>{children}</span>,
        }));
        vi.doMock('../../src/component/songinfo-chords', () => ({
            CapoChange: () => <div />,
            ChordSelect: () => <div />,
        }));
        vi.doMock('../../src/component/songinfo-sidebar', () => ({
            PrintCapoDisplay: () => <div />,
            SongTopInfoSection: () => <div />,
            FavouriteButton: () => <div />,
            SongInfoSide: () => <div />,
        }));
        vi.doMock('../../src/component/songxml', () => ({ SongXMLDisplay: () => <div /> }));
        vi.doMock('../../src/component/theme', () => ({
            Theme: ({ children }: any) => <>{children}</>,
        }));
        vi.doMock('../../src/dual-present', () => ({
            get_presentation: vi.fn().mockResolvedValue({
                send_msg: vi.fn(),
                exit_cast_mode: vi.fn(),
                subject: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            }),
            useCast: vi.fn(() => ({ supported: false, available: false, active: false })),
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children }: any) => <a href={to}>{children}</a>,
        }));
        vi.doMock('../../src/component/icons', () => ({}));

        const mod = await import('../../src/component/songinfo-other');
        expect(mod.SongsDisplay).toBeDefined();
        expect(mod.SongPageSidebar).toBeDefined();
        expect(mod.SongPresentBtn).toBeDefined();
        expect(mod.SongRefreshBtn).toBeDefined();
        expect(mod.SetPrevNext).toBeDefined();
        expect(mod.MobileScroller).toBeDefined();
        expect(mod.DialogPresent).toBeDefined();
    });
});
