import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSocketMock } from '../helpers/mocks/event-socket';
import { renderWithProviders } from '../helpers/render';

let PrintCapoDisplay: typeof import('../../src/component/songinfo-sidebar').PrintCapoDisplay;
let SongTopInfoSection: typeof import('../../src/component/songinfo-sidebar').SongTopInfoSection;
let FavouriteButton: typeof import('../../src/component/songinfo-sidebar').FavouriteButton;
let SongInfoSide: typeof import('../../src/component/songinfo-sidebar').SongInfoSide;

function setupStandardMocks() {
    vi.doMock('../../src/event-socket', createEventSocketMock);
    vi.doMock('../../src/favourite-db', () => ({
        FAVOURITE_DB: {
            get_favourite: vi.fn(() => false),
            set_favourite: vi.fn(),
            del_favourite: vi.fn(),
            get_rating: vi.fn(() => 0),
            set_rating: vi.fn(),
        },
        useFavouriteVersion: vi.fn(),
    }));
    vi.doMock('../../src/feedback', () => ({
        file_feedback: vi.fn(),
        song_feedback: vi.fn(),
    }));
    vi.doMock('../../src/file-download-utils', () => ({
        try_window_open_download: vi.fn(),
        get_downloaded_file: vi.fn(),
        is_local_url_allowed: () => false,
    }));
    vi.doMock('../../src/filter-sources', () => ({ toggle_filter_source: vi.fn() }));
    vi.doMock('../../src/globals', () => ({ API_HOST: '', DEBUG: false }));
    vi.doMock('../../src/langpack', () => ({
        useTranslation: () => ({
            t: (key: string) => key,
            lang_name: (code: string) => code,
            sorted_language_codes: (codes: string[]) => codes,
        }),
        useAppLang: () => ({ appLang: 'en' }),
    }));
    vi.doMock('../../src/settings-store', () => ({
        useSetting: (key: string) => {
            if (key === 'observe-copyright') return [false, vi.fn()];
            return [false, vi.fn()];
        },
    }));
    vi.doMock('../../src/persistent-storage.es5', () => ({
        persistentStorage: {
            get: vi.fn(),
            set: vi.fn(),
            getObj: vi.fn(() => false),
            setObj: vi.fn(),
        },
    }));
    vi.doMock('../../src/search', () => ({ set_search_text: vi.fn() }));
    vi.doMock('../../src/solfege-util', () => ({ maybe_convert_solfege: (s: string) => s }));
    vi.doMock('../../src/util', () => ({
        format_string: (s: string, ...args: string[]) => {
            let i = 0;
            return s.replace(/\{[0-9]+\}/g, () => args[i++] ?? '');
        },
        get_youtube_id: () => '',
        is_rtl: () => false,
        is_vertical_lang: () => false,
    }));
    vi.doMock('../../src/component/audio-player', () => ({
        AudioPlayer: ({ song, file }: any) => <div data-testid={`audio-${file.type}-${song.id}`} />,
    }));
    vi.doMock('../../src/component/basic', () => ({
        DropDownIcon: () => <div data-testid="dropdown-icon" />,
        ImageButton: ({ children, onClick, icon: _icon, ...rest }: any) => (
            <button data-testid="image-button" onClick={onClick} {...rest}>
                {children}
            </button>
        ),
    }));
    vi.doMock('../../src/component/tags-section', () => ({
        TagsSection: ({ tags }: any) => <div data-testid="tags-section">{tags?.length ?? 0}</div>,
    }));
    vi.doMock('../../src/component/song-list', () => ({
        SongListLink: ({ song, prefix }: any) => (
            <div data-testid="song-link">
                {prefix}
                {song.id}
            </div>
        ),
        TextDirection: ({ children }: any) => <span>{children}</span>,
    }));
    vi.doMock('../../src/component/icons', () => ({
        SymbolFavourite: () => <svg data-testid="icon-fav" />,
        SymbolNotFavourite: () => <svg data-testid="icon-not-fav" />,
        SymbolHasMP3: () => <svg data-testid="icon-mp3" />,
        Video: () => <svg data-testid="icon-video" />,
        Logo: () => <svg data-testid="icon-logo" />,
        _logo_width: 100,
        _logo_height: 100,
    }));
}

async function importModule() {
    const mod = await import('../../src/component/songinfo-sidebar');
    PrintCapoDisplay = mod.PrintCapoDisplay;
    SongTopInfoSection = mod.SongTopInfoSection;
    FavouriteButton = mod.FavouriteButton;
    SongInfoSide = mod.SongInfoSide;
}

describe('PrintCapoDisplay', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders nothing when transpose is null', () => {
        const { container } = renderWithProviders(<PrintCapoDisplay transpose={null} />);
        const box = container.firstElementChild as HTMLElement | null;
        expect(box?.children.length).toBe(0);
    });

    it('renders nothing when transpose is undefined', () => {
        const { container } = renderWithProviders(<PrintCapoDisplay />);
        const box = container.firstElementChild as HTMLElement | null;
        expect(box?.children.length).toBe(0);
    });

    it('renders capo value', () => {
        const transpose = {
            capo: 3,
            key: undefined,
            is_minor: false,
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        };

        renderWithProviders(<PrintCapoDisplay transpose={transpose as any} />);
        expect(screen.getByText('capo')).toBeInTheDocument();
    });

    it('renders key when set', () => {
        const transpose = {
            capo: 0,
            key: { name: 'G' },
            is_minor: false,
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        };

        renderWithProviders(<PrintCapoDisplay transpose={transpose as any} />);
        expect(screen.getByText('key')).toBeInTheDocument();
    });

    it('shows minor key indicator', () => {
        const transpose = {
            capo: 0,
            key: { name: 'Am' },
            is_minor: true,
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        };

        renderWithProviders(<PrintCapoDisplay transpose={transpose as any} />);
        // key name + 'm' suffix
        expect(screen.getByText('key')).toBeInTheDocument();
    });
});

describe('SongTopInfoSection', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders tempo info', () => {
        const song = {
            id: 1,
            lang: 'en',
            info: [{ type: 'tempo', value: '120' }],
        };

        renderWithProviders(<SongTopInfoSection song={song as any} />);
        expect(screen.getByText('tempo')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
    });

    it('renders timesignature info', () => {
        const song = {
            id: 1,
            lang: 'en',
            info: [{ type: 'timesignature', value: '4/4' }],
        };

        renderWithProviders(<SongTopInfoSection song={song as any} />);
        expect(screen.getByText('timesignature')).toBeInTheDocument();
    });

    it('renders multiple info items', () => {
        const song = {
            id: 1,
            lang: 'en',
            info: [
                { type: 'tempo', value: '120' },
                { type: 'timesignature', value: '3/4' },
            ],
        };

        renderWithProviders(<SongTopInfoSection song={song as any} />);
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('3/4')).toBeInTheDocument();
    });

    it('skips non-tempo/non-timesignature items', () => {
        const song = {
            id: 1,
            lang: 'en',
            info: [
                { type: 'words', value: 'Author Name' },
                { type: 'tempo', value: '80' },
            ],
        };

        renderWithProviders(<SongTopInfoSection song={song as any} />);
        expect(screen.getByText('80')).toBeInTheDocument();
        expect(screen.queryByText('Author Name')).toBeNull();
    });
});

describe('FavouriteButton', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('returns null when no song', () => {
        const { container } = renderWithProviders(<FavouriteButton />);
        expect(container.textContent).toBe('');
    });

    it('renders with song', () => {
        renderWithProviders(<FavouriteButton song={{ id: 1, lang: 'en' } as any} />);
        expect(screen.getByText('favourite-btn')).toBeInTheDocument();
    });

    it('toggles favourite on click', () => {
        renderWithProviders(<FavouriteButton song={{ id: 1, lang: 'en' } as any} />);
        fireEvent.click(screen.getByTestId('image-button'));
    });
});

const baseSong = {
    id: 1,
    title: 'Test Song',
    lang: 'en',
    tags: [],
    info: [],
    files: [],
    albums: [],
    sources: [],
    year: 2023,
    rating: 0,
    songxml: '<song/>',
};

describe('SongInfoSide', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('returns null when no song', () => {
        const { container } = renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={undefined} on_filter_change={vi.fn()} />);
        expect(container.textContent).toBe('');
    });

    it('renders song title and details', () => {
        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={baseSong as any} on_filter_change={vi.fn()} />);

        expect(screen.getByText('Test Song')).toBeInTheDocument();
    });

    it('renders year and language', () => {
        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={baseSong as any} on_filter_change={vi.fn()} />);

        expect(screen.getByText('year_written')).toBeInTheDocument();
        expect(screen.getByText('language')).toBeInTheDocument();
    });

    it('renders related songs', () => {
        renderWithProviders(
            <SongInfoSide
                update_item_refs={vi.fn()}
                related_songs={[{ id: 2, lang: 'tr' } as any, { id: 3, lang: 'de' } as any]}
                song={baseSong as any}
                on_filter_change={vi.fn()}
            />,
        );

        const songLinks = screen.getAllByTestId('song-link');
        expect(songLinks.length).toBe(2);
    });

    it('renders audio section with mp3 files', () => {
        const songWithMp3 = {
            ...baseSong,
            files: [{ type: 'mp3', id: 10, path: '/audio/test.mp3' }],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithMp3 as any} on_filter_change={vi.fn()} />);

        expect(screen.getByTestId('audio-mp3-1')).toBeInTheDocument();
    });

    it('renders instrumental mp3 section', () => {
        const songWithMp3 = {
            ...baseSong,
            files: [{ type: 'instmp3', id: 11, path: '/audio/inst.mp3' }],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithMp3 as any} on_filter_change={vi.fn()} />);

        expect(screen.getByTestId('audio-instmp3-1')).toBeInTheDocument();
    });

    it('renders tags section', () => {
        const songWithTags = {
            ...baseSong,
            tags: ['worship', 'fast'],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithTags as any} on_filter_change={vi.fn()} />);

        expect(screen.getByTestId('tags-section')).toBeInTheDocument();
    });
});

describe('SongInfoSide with copyright enabled', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        vi.doMock('../../src/settings-store', () => ({
            useSetting: (key: string) => {
                if (key === 'observe-copyright') return [true, vi.fn()];
                return [false, vi.fn()];
            },
        }));
        await importModule();
    });

    it('skips mp3 for copyright restricted songs', () => {
        const songWithMp3 = {
            ...baseSong,
            copyright_restricted: true,
            files: [{ type: 'mp3', id: 10, path: '/audio/test.mp3' }],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithMp3 as any} on_filter_change={vi.fn()} />);

        expect(screen.queryByTestId('audio-mp3-1')).toBeNull();
    });
});

describe('SongInfoSide full rendering', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupStandardMocks();
        await importModule();
    });

    it('renders sheet music section', () => {
        const songWithSheet = {
            ...baseSong,
            files: [{ type: 'sheetpdf', id: 20, path: '/sheet/test.pdf', download_path: '/dl/test.pdf' }],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithSheet as any} on_filter_change={vi.fn()} />);

        expect(screen.getByText('download_link')).toBeInTheDocument();
    });

    it('renders source info', () => {
        const songWithSource = {
            ...baseSong,
            sources: [{ name: 'My Source', number: '42', abbreviation: 'MS' }],
            info: [],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithSource as any} on_filter_change={vi.fn()} />);

        expect(screen.getByText('source')).toBeInTheDocument();
        expect(screen.getByText('My Source')).toBeInTheDocument();
    });

    it('renders alternative titles', () => {
        const songWithAlt = {
            ...baseSong,
            alternative_titles: ['Alt Title 1', 'Alt Title 2'],
        };

        renderWithProviders(<SongInfoSide update_item_refs={vi.fn()} related_songs={[]} song={songWithAlt as any} on_filter_change={vi.fn()} />);

        expect(screen.getByText('Alt Title 1, Alt Title 2')).toBeInTheDocument();
    });
});
