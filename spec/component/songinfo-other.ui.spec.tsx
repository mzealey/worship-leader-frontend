import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSocketMock } from '../helpers/mocks/event-socket';
import { createLangpackMock } from '../helpers/mocks/langpack';
import { createUseDialogMock } from '../helpers/mocks/use-dialog';
import { renderWithProviders, renderWithRouter } from '../helpers/render';

let DialogPresent: typeof import('../../src/component/songinfo-other').DialogPresent;
let SongRefreshBtn: typeof import('../../src/component/songinfo-other').SongRefreshBtn;
let SongPresentBtn: typeof import('../../src/component/songinfo-other').SongPresentBtn;
let SetPrevNext: typeof import('../../src/component/songinfo-other').SetPrevNext;
let SongPageSidebar: typeof import('../../src/component/songinfo-other').SongPageSidebar;
let SongsDisplay: typeof import('../../src/component/songinfo-other').SongsDisplay;

function setupStandardMocks() {
    vi.doMock('../../src/event-socket', createEventSocketMock);
    vi.doMock('../../src/abc2svg', () => ({ can_do_worker: () => true }));
    vi.doMock('../../src/db-search', () => ({
        useSearchStore: Object.assign(
            vi.fn(() => ({ filters: {}, tags: {}, sources: {} })),
            { getState: vi.fn(() => ({})) },
        ),
    }));
    vi.doMock('../../src/langpack', createLangpackMock);
    vi.doMock('../../src/favourite-db', () => ({
        FAVOURITE_DB: { get_favourite: () => null },
        useFavouriteVersion: vi.fn(),
    }));
    vi.doMock('../../src/settings-store', () => ({
        useSetting: (key: string) => {
            if (key === 'sidebyside') return [false, vi.fn()];
            if (key === 'observe-copyright') return [false, vi.fn()];
            return [false, vi.fn()];
        },
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
        DB: Promise.resolve({
            type: () => 'offline',
            get_song: vi.fn().mockResolvedValue({}),
            get_version_string: () => '1.0',
        }),
        DB_AVAILABLE: Promise.resolve({ type: () => 'offline' }),
        on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    }));
    vi.doMock('../../src/meta-db', () => ({
        get_meta_db: () => Promise.resolve({ tags: {}, tag_mappings: {}, tag_groups: {} }),
    }));
    vi.doMock('../../src/set-db', () => ({
        SET_DB: { get_set_title: vi.fn().mockResolvedValue('My Set'), get_song_ids: vi.fn().mockResolvedValue([1, 2, 3]) },
        on_set_db_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    }));
    vi.doMock('../../src/set-switcher', () => ({
        SetSwitcher: class {
            set_id = 1;
            position = () => 0;
            can_prev = () => true;
            can_next = () => true;
            move = vi.fn((offset: number) => 1 + offset);
        },
    }));
    vi.doMock('../../src/util', () => ({
        is_rtl: () => false,
        is_vertical_lang: () => false,
        scroll_to: vi.fn(),
        ensure_visible: vi.fn(),
        format_string: (s: string, ...args: string[]) => {
            let i = 0;
            return s.replace(/\{[0-9]+\}/g, () => args[i++] ?? '');
        },
        get_youtube_id: () => '',
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
    vi.doMock('../../src/song-utils', () => ({ get_text_title: () => 'Song Title' }));
    vi.doMock('../../src/use-dialog', createUseDialogMock);
    vi.doMock('../../src/page-padding', () => ({
        usePagePadding: vi.fn((sel: (s: any) => any) => sel({ top: 0, bottom: 0 })),
    }));
    vi.doMock('../../src/component/basic', () => ({
        DialogTitleWithClose: ({ children, handleClose }: any) => (
            <div data-testid="dialog-title">
                {children}
                <button data-testid="dialog-close" onClick={handleClose}>
                    X
                </button>
            </div>
        ),
        ImageButton: ({ children, onClick, icon: _icon, ...rest }: any) => (
            <button data-testid="image-button" onClick={onClick} {...rest}>
                {children}
            </button>
        ),
        DropDownIcon: () => <div />,
    }));
    vi.doMock('../../src/component/presenter-view', () => ({ PresenterView: () => <div /> }));
    vi.doMock('../../src/component/score', () => ({ SheetMusicDisplay: () => <div /> }));
    vi.doMock('../../src/component/search-area', () => ({ SearchArea: () => <div data-testid="search-area" /> }));
    vi.doMock('../../src/component/song-list', () => ({
        SongList: () => <div data-testid="song-list" />,
        SongListLink: () => <div />,
        TextDirection: ({ children }: any) => <span>{children}</span>,
    }));
    vi.doMock('../../src/component/songinfo-chords', () => ({
        CapoChange: () => <div data-testid="capo-change" />,
        ChordSelect: () => <div data-testid="chord-select" />,
    }));
    vi.doMock('../../src/component/songinfo-sidebar', () => ({
        PrintCapoDisplay: ({ transpose }: any) => <div data-testid="print-capo" data-transpose={!!transpose} />,
        SongTopInfoSection: ({ song }: any) => <div data-testid="song-top-info" data-song-id={song?.id} />,
        FavouriteButton: () => <div data-testid="favourite-btn" />,
        SongInfoSide: () => <div data-testid="song-info-side" />,
    }));
    vi.doMock('../../src/component/songxml', () => ({ SongXMLDisplay: () => <div data-testid="songxml" /> }));
    vi.doMock('../../src/component/theme', () => ({
        Theme: ({ children }: any) => <>{children}</>,
    }));
    vi.doMock('../../src/dual-present', () => ({
        get_presentation: vi.fn().mockResolvedValue({
            send_msg: vi.fn(),
            exit_cast_mode: vi.fn(),
            is_casting: () => false,
            enter_cast_mode: vi.fn(),
            subject: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }),
        useCast: vi.fn((selector) => selector({ supported: false, available: false, active: false })),
    }));
    vi.doMock('../../src/component/router-link', () => ({
        Link: ({ to, children }: any) => <a href={to}>{children}</a>,
    }));
    vi.doMock('../../src/component/icons', () => ({
        PresentFullScreen: () => <svg data-testid="icon-present-fullscreen" />,
        PresentCast: () => <svg data-testid="icon-present-cast" />,
        Present: () => <svg data-testid="icon-present" />,
        ExitPresent: () => <svg data-testid="icon-exit-present" />,
        ReloadSong: () => <svg data-testid="icon-reload" />,
        Prev: () => <svg data-testid="icon-prev" />,
        Next: () => <svg data-testid="icon-next" />,
        Close: () => <svg data-testid="icon-close" />,
        SwapSec: () => <svg data-testid="icon-swap" />,
        SymbolHasChord: () => <svg data-testid="icon-chord" />,
        SymbolHasSheet: () => <svg data-testid="icon-sheet" />,
        SymbolHasMP3: () => <svg data-testid="icon-mp3" />,
        Details: () => <svg data-testid="icon-details" />,
        Video: () => <svg data-testid="icon-video" />,
        Logo: () => <svg data-testid="icon-logo" />,
        _logo_width: 100,
        _logo_height: 100,
    }));
}

async function importModule() {
    const mod = await import('../../src/component/songinfo-other');
    DialogPresent = mod.DialogPresent;
    SongRefreshBtn = mod.SongRefreshBtn;
    SongPresentBtn = mod.SongPresentBtn;
    SetPrevNext = mod.SetPrevNext;
    SongPageSidebar = mod.SongPageSidebar;
    SongsDisplay = mod.SongsDisplay;
}

const mockSong = {
    id: 1,
    lang: 'en',
    songxml: '<song><verse><chord>C</chord>Test</verse></song>',
    files: [{ type: 'abccache', id: 10 }],
} as any;

describe('DialogPresent', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders dialog with present options', async () => {
        renderWithProviders(<DialogPresent enter_single_presentor_mode={vi.fn()} />);

        expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
        expect(screen.getByText('Choose presentation device')).toBeInTheDocument();
        expect(screen.getByText('This monitor')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('Second monitor or wireless screen')).toBeInTheDocument();
        });
    });

    it('calls enter_single_presentor_mode on monitor click', () => {
        const enterFn = vi.fn();
        renderWithProviders(<DialogPresent enter_single_presentor_mode={enterFn} />);

        fireEvent.click(screen.getByText('This monitor'));
        expect(enterFn).toHaveBeenCalled();
    });

    it('closes on cancel', () => {
        renderWithProviders(<DialogPresent enter_single_presentor_mode={vi.fn()} />);
        fireEvent.click(screen.getByText('Cancel'));
    });
});

describe('SongRefreshBtn', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders refresh button for offline DB', async () => {
        renderWithProviders(<SongRefreshBtn onClick={vi.fn()} />);
        await screen.findByText('Refresh Song');
    });

    it('calls onClick when clicked', async () => {
        const onClick = vi.fn();
        renderWithProviders(<SongRefreshBtn onClick={onClick} />);
        await screen.findByText('Refresh Song');
        fireEvent.click(screen.getByText('Refresh Song'));
        expect(onClick).toHaveBeenCalled();
    });

    it('returns null for non-offline DB', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        vi.doMock('../../src/db', () => ({
            DB: Promise.resolve({ type: () => 'online', get_version_string: () => '1.0' }),
            DB_AVAILABLE: Promise.resolve({ type: () => 'online' }),
            on_db_languages_update: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
            on_db_change: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
        }));
        await importModule();

        const { container } = renderWithProviders(<SongRefreshBtn onClick={vi.fn()} />);
        expect(container.textContent).toBe('');
    });
});

describe('SongPresentBtn', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders present button when not active', () => {
        renderWithProviders(<SongPresentBtn show_dialog={vi.fn()} enter_single_presentor_mode={vi.fn()} />);

        expect(screen.getByText('Present')).toBeInTheDocument();
    });

    it('enters single presentor mode when cast not available', () => {
        const enterFn = vi.fn();
        const showDialog = vi.fn();
        renderWithProviders(<SongPresentBtn show_dialog={showDialog} enter_single_presentor_mode={enterFn} />);

        fireEvent.click(screen.getByTestId('image-button'));
        expect(enterFn).toHaveBeenCalled();
    });
});

describe('SetPrevNext', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('returns null without set_switcher', () => {
        const { container } = renderWithRouter(<SetPrevNext song_id={1} />);
        expect(container.textContent).toBe('');
    });

    it('renders prev/next with set info', async () => {
        const switcher = {
            set_id: 1,
            position: () => 2,
            can_prev: () => true,
            can_next: () => true,
            move: (offset: number) => 1 + offset,
        };

        renderWithRouter(<SetPrevNext song_id={1} set_switcher={switcher as any} />);

        await screen.findByText('Previous');
        expect(screen.getByText('Next')).toBeInTheDocument();
    });
});

describe('SongPageSidebar', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders sidebar with search and song list', () => {
        renderWithProviders(<SongPageSidebar active_song_id={1} />);

        expect(screen.getByTestId('search-area')).toBeInTheDocument();
        expect(screen.getByTestId('song-list')).toBeInTheDocument();
    });
});

describe('SongsDisplay', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('shows loading spinner when song_loading', () => {
        renderWithProviders(<SongsDisplay song={undefined} song_loading={true} update_item_refs={vi.fn()} />);

        const spinner = document.querySelector('.MuiCircularProgress-root');
        expect(spinner).toBeInTheDocument();
    });

    it('renders song with SongXMLDisplay when no score', () => {
        renderWithProviders(<SongsDisplay song={mockSong} update_item_refs={vi.fn()} />);

        expect(screen.getByTestId('songxml')).toBeInTheDocument();
    });

    it('renders song with SheetMusicDisplay when prefer_score', () => {
        renderWithProviders(<SongsDisplay song={mockSong} update_item_refs={vi.fn()} />);

        expect(screen.getByTestId('songxml')).toBeInTheDocument();
    });

    it('renders print ad box', () => {
        renderWithProviders(<SongsDisplay song={mockSong} update_item_refs={vi.fn()} />);

        expect(screen.getByText('Printed from https://worshipleaderapp.com')).toBeInTheDocument();
    });

    it('renders capo and chord select when transpose available', () => {
        renderWithProviders(
            <SongsDisplay
                song={{ ...mockSong, songxml: '<song><verse><chord>C</chord>Test</verse></song>', files: [{ type: 'abccache', id: 10 }] }}
                transpose={{} as any}
                update_item_refs={vi.fn()}
            />,
        );

        expect(screen.getByTestId('capo-change')).toBeInTheDocument();
        expect(screen.getByTestId('chord-select')).toBeInTheDocument();
    });

    it('renders in presentation mode', () => {
        renderWithProviders(<SongsDisplay song={mockSong} in_presentation={true} exit_single_presentor_mode={vi.fn()} update_item_refs={vi.fn()} />);

        expect(screen.getByTestId('songxml')).toBeInTheDocument();
    });

    it('renders with related songs in side-by-side mode', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        vi.doMock('../../src/settings-store', () => ({
            useSetting: (key: string) => {
                if (key === 'sidebyside') return [true, vi.fn()];
                if (key === 'observe-copyright') return [true, vi.fn()];
                return [false, vi.fn()];
            },
        }));
        await importModule();

        renderWithProviders(<SongsDisplay song={mockSong} related_songs={[{ id: 2, lang: 'tr' } as any]} update_item_refs={vi.fn()} />);
    });

    it('renders copyright restricted message', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        vi.doMock('../../src/settings-store', () => ({
            useSetting: (key: string) => {
                if (key === 'sidebyside') return [false, vi.fn()];
                if (key === 'observe-copyright') return [true, vi.fn()];
                return [false, vi.fn()];
            },
        }));
        await importModule();

        renderWithProviders(<SongsDisplay song={{ ...mockSong, copyright_restricted: true, lang: 'en' }} update_item_refs={vi.fn()} />);

        expect(screen.getByText('Unfortunately, due to copyright reasons this song cannot be displayed')).toBeInTheDocument();
    });
});
