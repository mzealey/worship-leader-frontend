import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { renderWithRouter } from '../helpers/render';

let PageSongInfo: typeof import('../../src/page/songinfo').PageSongInfo;

describe('PageSongInfo', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('../../src/langpack', createLangpackMock);
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({
                get_song: vi.fn().mockResolvedValue({ id: 1, title: 'Test Song', lang: 'en', songxml: '<song/>', related_songs: [] }),
                get_songs: vi.fn().mockResolvedValue([]),
            }),
            DB_AVAILABLE: Promise.resolve({}),
        }));
        vi.doMock('../../src/db/offline-common', () => ({ OfflineDBCommon: class {} }));
        vi.doMock('../../src/globals', () => ({
            match_media_watcher: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
            BUILD_TYPE: 'www',
            get_client_type: () => 'www',
        }));
        vi.doMock('../../src/settings-store', () => ({
            useSetting: () => [true, vi.fn()],
        }));
        vi.doMock('../../src/transpose-details', () => ({
            TransposeDetails: class {
                keyName: string;
                capo: number;
                constructor() {
                    this.keyName = '';
                    this.capo = 0;
                }
                update_key = vi.fn();
                update_capo = vi.fn();
                subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
            },
        }));
        vi.doMock('../../src/set-db', () => ({
            on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            SET_DB: {},
        }));
        vi.doMock('../../src/set-switcher', () => ({
            SetSwitcher: class {
                set_id: number;
                move: () => number;
                constructor(set_id: number) {
                    this.set_id = set_id;
                    this.move = vi.fn(() => 1);
                }
            },
        }));
        vi.doMock('../../src/can-print', () => ({
            useCanPrint: () => ({ canPrint: true }),
        }));
        vi.doMock('../../src/cordova-utils', () => ({
            statusbar: { hide: vi.fn(), show: vi.fn() },
        }));
        vi.doMock('../../src/util', () => ({
            is_cordova: () => false,
            scroll_to: vi.fn(),
            try_to_run_fn: vi.fn(),
        }));
        vi.doMock('../../src/feedback', () => ({
            song_feedback: vi.fn(),
        }));
        vi.doMock('../../src/resize-watcher', () => ({
            send_fake_resize: vi.fn(),
        }));
        vi.doMock('../../src/persistent-storage.es5', () => ({
            persistentStorage: {
                getObj: vi.fn(() => false),
                setObj: vi.fn(),
            },
        }));
        vi.doMock('../../src/page-padding', () => ({
            usePagePadding: vi.fn((sel: (s: any) => any) => sel({ top: 0, bottom: 0 })),
        }));
        vi.doMock('../../src/component/songinfo-other', () => ({
            SongsDisplay: ({ children }: any) => <div data-testid="songs-display">{children}</div>,
            SongPageSidebar: () => <div data-testid="song-page-sidebar" />,
            SongPresentBtn: () => <div data-testid="present-btn" />,
            SongRefreshBtn: () => <div data-testid="refresh-btn" />,
            SetPrevNext: () => <div data-testid="set-prev-next" />,
            MobileScroller: () => <div data-testid="mobile-scroller" />,
            DialogPresent: () => <div data-testid="present-dialog" />,
            sidebar_width: 300,
        }));
        vi.doMock('../../src/component/songinfo-sidebar', () => ({
            SongInfoSide: () => <div data-testid="song-info-side" />,
            FavouriteButton: () => <div data-testid="favourite-btn" />,
        }));
        vi.doMock('../../src/component/song-list', () => ({
            TextDirection: ({ children }: any) => <span>{children}</span>,
        }));
        vi.doMock('../../src/component/top-bar', () => ({
            TopBar: ({ title, before, children }: any) => (
                <div data-testid="topbar">
                    {before}
                    <span>{typeof title === 'string' ? title : ''}</span>
                    {children}
                </div>
            ),
        }));
        vi.doMock('../../src/component/router-link', () => ({
            Link: ({ to, children, ...props }: any) => (
                <a href={to} {...props}>
                    {children}
                </a>
            ),
        }));
        vi.doMock('../../src/component/container', () => ({
            useLastButtonHandler: vi.fn(() => ({ handler: undefined, set: vi.fn() })),
        }));
        vi.doMock('../../src/page/add-to-set', () => ({
            DialogAddToSet: () => <div data-testid="add-to-set" />,
        }));
        vi.doMock('../../src/page/copy', () => ({
            PageCopyTextarea: () => <div data-testid="copy-textarea" />,
        }));
        vi.doMock('../../src/page/sharer', () => ({
            PageSharer: () => <div data-testid="sharer" />,
        }));

        const mod = await import('../../src/page/songinfo');
        PageSongInfo = mod.PageSongInfo;
    });

    it('renders song page with topbar', async () => {
        renderWithRouter(<PageSongInfo requested_song_id={1} />);

        const topbar = await screen.findByTestId('topbar');
        expect(topbar).toBeInTheDocument();
    });

    it('renders song info sidebar', async () => {
        renderWithRouter(<PageSongInfo requested_song_id={1} />);

        const sidebar = await screen.findByTestId('song-info-side');
        expect(sidebar).toBeInTheDocument();
    });

    it('renders favourite button', async () => {
        renderWithRouter(<PageSongInfo requested_song_id={1} />);

        const fav = await screen.findByTestId('favourite-btn');
        expect(fav).toBeInTheDocument();
    });

    it('shows add-to-set button when not in set', async () => {
        renderWithRouter(<PageSongInfo requested_song_id={1} />);

        await screen.findByText('add_to_set');
    });

    it('renders share button', async () => {
        renderWithRouter(<PageSongInfo requested_song_id={1} />);

        await screen.findByText('sharebtn');
    });
});
